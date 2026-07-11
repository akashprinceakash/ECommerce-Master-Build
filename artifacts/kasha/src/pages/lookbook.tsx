import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useUser, Show } from "@clerk/react";
import {
  useListLookbookSaved,
  getListLookbookSavedQueryKey,
  useListLookbookOutfits,
  getListLookbookOutfitsQueryKey,
  useCreateLookbookOutfit,
  useDeleteLookbookOutfit,
  useListProducts,
  getListProductsQueryKey,
  useSubmitTryOn,
  useGetTryOnJob,
  getGetTryOnJobQueryKey,
  useGetCreditsBalance,
  getGetCreditsBalanceQueryKey,
  useEnsureWelcomeCredits,
  usePurchaseCreditPackage,
  useVerifyCreditPayment,
  type LookbookOutfit,
  type LookbookLookItem,
  type CreditPackage,
} from "@workspace/api-client-react";
import { getAssetUrl, getApiUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Save, CheckCircle, Heart, Check, X, Wand2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Sparkles, Upload, User, Maximize2, Minimize2, Download, ShoppingBag, Zap } from "lucide-react";

declare global { interface Window { Razorpay?: any } }
import { useUploadLookbookPhoto } from "@workspace/api-client-react";

const GOLD = "#B8925A";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";
const CANVAS_BG = "#EDE9E3";

type Gender = "male" | "female";
type Role = "top" | "bottom" | "dress";

// Category groupings mirrored from the product catalog (see products.tsx and
// the server-side classifier in services/vton/classifier.ts). Only these
// three roles are wired to the AI try-on pipeline today — outerwear (e.g.
// "jacket"), accessories, shoes, and bags are intentionally left unmapped so
// they simply don't show up in the wardrobe rails yet.
const TOP_CATEGORIES = new Set(["t-shirt", "polo", "fabric-tshirt", "pattern", "shirts"]);
const BOTTOM_CATEGORIES = new Set(["pants", "trousers", "shorts", "skort", "skorts", "skirts"]);
const DRESS_CATEGORIES = new Set(["dress", "dresses", "golf dress", "golf dresses"]);

/** Resize an image file client-side to max `maxPx` on the longest edge before upload. */
async function resizeImageFile(file: File, maxPx = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise(resolve =>
    canvas.toBlob(
      blob => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })),
      "image/jpeg", 0.88,
    )
  );
}

function categoryRole(category: string): Role | null {
  const c = category.toLowerCase();
  if (TOP_CATEGORIES.has(c)) return "top";
  if (BOTTOM_CATEGORIES.has(c)) return "bottom";
  if (DRESS_CATEGORIES.has(c)) return "dress";
  return null;
}

type WardrobeItem = { productId: number; name: string; thumbnailUrl: string };

type GenerationState =
  | { status: "idle" }
  | { status: "generating"; jobId: string }
  | { status: "succeeded"; resultImageUrl: string }
  | { status: "failed"; error: string };

export default function LookbookPage() {
  useEffect(() => { document.title = "Lookbook — Ka.Sha"; }, []);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [gender, setGender] = useState<Gender>("female");
  const [selection, setSelection] = useState<Record<Role, WardrobeItem | null>>({ top: null, bottom: null, dress: null });
  const [outfitName, setOutfitName] = useState("My Outfit");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [generation, setGeneration] = useState<GenerationState>({ status: "idle" });
  const [zoom, setZoom] = useState(1);

  // ── Model choice: default AI avatar, or the customer's own photo ──────────
  const [modelSource, setModelSource] = useState<"avatar" | "photo">("avatar");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const uploadPhoto = useUploadLookbookPhoto();

  // ── Generation elapsed-time tracker ───────────────────────────────────────
  const generationStartRef = useRef<number | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    if (generation.status !== "generating") {
      generationStartRef.current = null;
      setElapsedSecs(0);
      return;
    }
    generationStartRef.current = Date.now();
    setElapsedSecs(0);
    const iv = setInterval(() => {
      const s = generationStartRef.current;
      if (s) setElapsedSecs(Math.floor((Date.now() - s) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [generation.status]);

  const handlePhotoSelected = useCallback(async (file: File) => {
    setPhotoUploadError(null);
    setUploadedPhotoUrl(null);
    setGeneration({ status: "idle" });
    // Resize client-side before preview + upload (phone photos can be 10MB+)
    const resized = await resizeImageFile(file);
    const localPreview = URL.createObjectURL(resized);
    setPhotoPreviewUrl(localPreview);
    try {
      const res = await uploadPhoto.mutateAsync({ data: { photo: resized } });
      setUploadedPhotoUrl(res.url);
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Failed to upload photo");
    }
  }, [uploadPhoto]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Credit system ──────────────────────────────────────────────────────────
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [creditPurchaseError, setCreditPurchaseError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{ razorpayOrderId: string; packageId: number } | null>(null);
  const [paymentDismissed, setPaymentDismissed] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const ensureWelcome = useEnsureWelcomeCredits();
  const purchaseCredits = usePurchaseCreditPackage();
  const verifyPayment = useVerifyCreditPayment();

  const { data: creditsData, refetch: refetchCredits } = useGetCreditsBalance({
    query: {
      enabled: !!user,
      queryKey: getGetCreditsBalanceQueryKey(),
      staleTime: 30_000,
    },
  });

  const creditsRemaining = creditsData?.creditsRemaining ?? null;
  const creditPackages: CreditPackage[] = creditsData?.packages ?? [];

  // Auto-grant 2 free welcome credits on first visit.
  useEffect(() => {
    if (!user) return;
    ensureWelcome.mutate(undefined, {
      onSuccess: () => { void refetchCredits(); },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user]);

  const checkOrderStatus = useCallback(async (orderId: string, packageId: number) => {
    setCheckingPayment(true);
    try {
      const { session } = (window as any).Clerk ?? {};
      const token = session ? await session.getToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/credits/check-order`, {
        method: "POST",
        headers,
        body: JSON.stringify({ orderId, packageId }),
      });
      const data = await res.json() as { paid?: boolean; creditsRemaining?: number };
      if (data.paid) {
        setPaymentVerified(true);
        setPendingOrder(null);
        setPaymentDismissed(false);
        await refetchCredits();
        setTimeout(() => {
          setPaymentVerified(false);
          setShowBuyCredits(false);
          setCreditPurchaseError(null);
        }, 2500);
      }
    } catch { /* silent — user can retry */ }
    setCheckingPayment(false);
  }, [refetchCredits]);

  // Auto-poll order status every 5 s while a Razorpay modal is open.
  // This catches UPI QR payments that complete on the user's phone.
  useEffect(() => {
    if (!pendingOrder || paymentDismissed || paymentVerified) return;
    const id = setInterval(() => {
      void checkOrderStatus(pendingOrder.razorpayOrderId, pendingOrder.packageId);
    }, 5000);
    return () => clearInterval(id);
  }, [pendingOrder, paymentDismissed, paymentVerified, checkOrderStatus]);

  const openRazorpayForCredits = useCallback(
    (order: { razorpayOrderId: string; amount: number; currency: string; keyId: string; package: CreditPackage }) => {
      if (!window.Razorpay) {
        setCreditPurchaseError("Payment service unavailable — please refresh and try again.");
        return;
      }
      setPendingOrder({ razorpayOrderId: order.razorpayOrderId, packageId: order.package.id });
      setPaymentDismissed(false);
      setPaymentVerified(false);
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "KA.SHA",
        description: `${order.package.creditsAmount} AI Credit${order.package.creditsAmount > 1 ? "s" : ""}`,
        order_id: order.razorpayOrderId,
        handler: async (resp: any) => {
          try {
            await verifyPayment.mutateAsync({
              data: {
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
                packageId: order.package.id,
              },
            });
            setPendingOrder(null);
            await refetchCredits();
            setShowBuyCredits(false);
            setCreditPurchaseError(null);
          } catch {
            setCreditPurchaseError("Payment verification failed — please contact support.");
          }
        },
        modal: { ondismiss: () => { setPaymentDismissed(true); } },
        theme: { color: "#B8925A" },
      });
      rzp.open();
    },
    [verifyPayment, refetchCredits, checkOrderStatus],
  );

  const handleBuyPackage = useCallback(async (pkg: CreditPackage) => {
    setCreditPurchaseError(null);
    setPaymentDismissed(false);
    setPaymentVerified(false);
    try {
      const order = await purchaseCredits.mutateAsync({ data: { packageId: pkg.id } });
      openRazorpayForCredits(order);
    } catch {
      setCreditPurchaseError("Could not initiate payment — please try again.");
    }
  }, [purchaseCredits, openRazorpayForCredits]);

  const handleDownload = useCallback(async () => {
    if (generation.status !== "succeeded") return;
    const url = generation.resultImageUrl;
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `kasha-look-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // CORS blocked — fall back to opening in a new tab
      window.open(url, "_blank");
    }
  }, [generation]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 0.25, 3)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 1)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: savedIds = [], isLoading: savedLoading } = useListLookbookSaved({
    query: { enabled: !!user, queryKey: getListLookbookSavedQueryKey(), staleTime: 60_000 },
  });
  const { data: savedOutfits = [], isLoading: outfitsLoading } = useListLookbookOutfits({
    query: { enabled: !!user, queryKey: getListLookbookOutfitsQueryKey() },
  });
  const { data: allProducts = [] } = useListProducts({}, {
    query: { queryKey: getListProductsQueryKey({}), staleTime: 5 * 60 * 1000 },
  });
  const createOutfit = useCreateLookbookOutfit();
  const deleteOutfit = useDeleteLookbookOutfit();
  const submitTryOn = useSubmitTryOn();

  // Poll job status while generating
  const activeJobId = generation.status === "generating" ? generation.jobId : null;
  const { data: jobStatus } = useGetTryOnJob(activeJobId ?? "", {
    query: {
      enabled: !!activeJobId,
      queryKey: getGetTryOnJobQueryKey(activeJobId ?? ""),
      refetchInterval: (query) => {
        const d = query.state.data;
        return d && (d.status === "succeeded" || d.status === "failed") ? false : 2000;
      },
    },
  });

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "succeeded" && jobStatus.resultImageUrl) {
      setGeneration({ status: "succeeded", resultImageUrl: jobStatus.resultImageUrl });
    } else if (jobStatus.status === "failed") {
      setGeneration({ status: "failed", error: jobStatus.error || "Try-on generation failed" });
    }
  }, [jobStatus]);

  // Saved products, split into tops / bottoms / dresses
  const { tops, bottoms, dresses } = useMemo(() => {
    const idSet = new Set(savedIds);
    const tops: WardrobeItem[] = [];
    const bottoms: WardrobeItem[] = [];
    const dresses: WardrobeItem[] = [];
    for (const p of allProducts) {
      if (!idSet.has(p.id)) continue;
      const role = categoryRole(p.category);
      if (!role) continue;
      const entry = { productId: p.id, name: p.name, thumbnailUrl: p.thumbnailUrl ?? "" };
      if (role === "top") tops.push(entry);
      else if (role === "bottom") bottoms.push(entry);
      else dresses.push(entry);
    }
    return { tops, bottoms, dresses };
  }, [savedIds, allProducts]);

  const hasAnySaved = tops.length > 0 || bottoms.length > 0 || dresses.length > 0;
  const hasSelection = !!selection.top || !!selection.bottom || !!selection.dress;

  // ── Selection logic — a dress is mutually exclusive with top/bottom ───────
  const selectItem = useCallback((role: Role, item: WardrobeItem) => {
    setGeneration({ status: "idle" });
    setSelection(prev => {
      if (role === "dress") return { top: null, bottom: null, dress: item };
      return { ...prev, dress: null, [role]: item };
    });
  }, []);

  const removeItem = useCallback((role: Role) => {
    setGeneration({ status: "idle" });
    setSelection(prev => ({ ...prev, [role]: null }));
  }, []);

  const clearSelection = useCallback(() => {
    setGeneration({ status: "idle" });
    setSelection({ top: null, bottom: null, dress: null });
  }, []);

  // "Surprise me" — pulls a random saved dress, or a random top + bottom.
  const randomizeOutfit = useCallback(() => {
    setGeneration({ status: "idle" });
    if (dresses.length > 0 && Math.random() < 0.4) {
      const pick = dresses[Math.floor(Math.random() * dresses.length)];
      setSelection({ top: null, bottom: null, dress: pick });
      return;
    }
    const next: Record<Role, WardrobeItem | null> = { top: null, bottom: null, dress: null };
    if (tops.length > 0) next.top = tops[Math.floor(Math.random() * tops.length)];
    if (bottoms.length > 0) next.bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    setSelection(next);
  }, [tops, bottoms, dresses]);

  const selectedItems = useMemo(
    () => selection.dress ? [selection.dress] : [selection.top, selection.bottom].filter((x): x is WardrobeItem => !!x),
    [selection],
  );

  const outOfCredits = creditsRemaining !== null && creditsRemaining < 1;

  const canGenerate = selectedItems.length > 0
    && !submitTryOn.isPending
    && !outOfCredits
    && (modelSource === "avatar" || (!!uploadedPhotoUrl && !uploadPhoto.isPending));

  const runGenerate = useCallback(async () => {
    if (selectedItems.length === 0 || submitTryOn.isPending) return;
    setShowConfirm(false);
    try {
      const res = await submitTryOn.mutateAsync({
        data: {
          gender,
          productIds: selectedItems.map(i => i.productId),
          humanImageUrl: modelSource === "photo" ? uploadedPhotoUrl : null,
        },
      });
      setGeneration({ status: "generating", jobId: res.jobId });
    } catch (err: any) {
      const msg: string = err?.response?.data?.error ?? err?.message ?? "Failed to start try-on";
      if (err?.response?.status === 402) {
        void refetchCredits();
        setGeneration({ status: "failed", error: "You're out of AI credits — top up to keep styling looks." });
      } else {
        setGeneration({ status: "failed", error: msg });
      }
    }
  }, [selectedItems, gender, submitTryOn, modelSource, uploadedPhotoUrl, refetchCredits]);

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    setShowConfirm(true);
  }, [canGenerate]);

  const handleSave = async () => {
    if (generation.status !== "succeeded" || createOutfit.isPending) return;
    const items: LookbookLookItem[] = (["top", "bottom", "dress"] as const)
      .filter(role => selection[role])
      .map(role => {
        const item = selection[role]!;
        return { productId: item.productId, role, name: item.name, thumbnailUrl: item.thumbnailUrl };
      });
    if (items.length === 0) return;
    await createOutfit.mutateAsync({
      data: { name: outfitName.trim() || "My Outfit", items, gender, resultImageUrl: generation.resultImageUrl },
    });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const loadOutfit = (outfit: LookbookOutfit) => {
    const next: Record<Role, WardrobeItem | null> = { top: null, bottom: null, dress: null };
    for (const raw of outfit.items as LookbookLookItem[]) {
      next[raw.role] = { productId: raw.productId, name: raw.name, thumbnailUrl: raw.thumbnailUrl };
    }
    setSelection(next);
    setGender(outfit.gender as Gender);
    setOutfitName(outfit.name);
    setGeneration({ status: "succeeded", resultImageUrl: outfit.resultImageUrl });
    setActiveTab("builder");
  };

  const handleDeleteOutfit = async (id: number) => {
    await deleteOutfit.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
  };

  const isGenerating = generation.status === "generating";

  return (
    <Layout>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0a0c14", padding: "120px 24px 80px", textAlign: "center" }}>
        <p style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 20 }}>
          Ka.Sha
        </p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 400, color: "#fff", lineHeight: 1.05, marginBottom: 20, letterSpacing: "0.03em" }}>
          The Lookbook
        </h1>
        <p style={{ fontFamily: FONT_UI, fontSize: 13, letterSpacing: "0.25em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 28 }}>
          Curate &nbsp;·&nbsp; Try On &nbsp;·&nbsp; Inspire
        </p>
        <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", maxWidth: 520, margin: "0 auto" }}>
          Tap the ♡ on any product to save it here, then choose your pieces and let AI generate a realistic try-on.
        </p>
      </section>

      {/* ── Outfit Planner (signed-in only) ───────────────────────────────────── */}
      <Show when="signed-in">
        <section style={{ background: "#F5F2EC", borderBottom: "1px solid rgba(184,146,90,0.2)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px" }}>

            {/* Section header */}
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 12 }}>
                My Wardrobe
              </p>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 400, color: "#0A0A0A", letterSpacing: "0.02em", marginBottom: 12 }}>
                AI Try-On Studio
              </h2>
              <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.42)", letterSpacing: "0.1em" }}>
                Save your favourite pieces with ♡, then generate a realistic try-on
              </p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 32, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
              {(["builder", "saved"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase",
                    padding: "10px 28px", border: "none", cursor: "pointer", background: "transparent",
                    color: activeTab === tab ? GOLD : "rgba(0,0,0,0.45)",
                    borderBottom: activeTab === tab ? `2px solid ${GOLD}` : "2px solid transparent",
                    marginBottom: -1, transition: "color 0.2s",
                  }}
                >
                  {tab === "builder" ? "Style Studio" : `Saved Looks (${savedOutfits.length})`}
                </button>
              ))}
            </div>

            {/* ── Builder tab ── */}
            {activeTab === "builder" && (
              <>
                {savedLoading && (
                  <div style={{ height: 320, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spinner />
                  </div>
                )}

                {!savedLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {!hasAnySaved && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
                        background: "rgba(184,146,90,0.08)", border: "1px dashed rgba(184,146,90,0.4)", padding: "12px 16px",
                      }}>
                        <Heart size={16} color={GOLD} style={{ flexShrink: 0 }} />
                        <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.06em", margin: 0, flex: 1, minWidth: 200 }}>
                          Tap ♡ on any top, bottom, or dress from the shop to see it here, then generate a try-on.
                        </p>
                        <Link href="/products">
                          <button style={{
                            fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                            background: GOLD, color: "#fff", border: "none", padding: "9px 20px", cursor: "pointer", whiteSpace: "nowrap",
                          }}>
                            Explore the Collection
                          </button>
                        </Link>
                      </div>
                    )}

                    {/* On-page instructions + gender toggle */}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between",
                      background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "14px 18px",
                    }}>
                      <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.06em", lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
                        Choose a dress, or a top and/or bottom — then hit Generate Look to see an AI-rendered try-on.
                      </p>
                      <div style={{ display: "flex", gap: 0, border: "1px solid rgba(0,0,0,0.12)" }}>
                        {(["female", "male"] as const).map(g => (
                          <button
                            key={g}
                            onClick={() => { setGender(g); setGeneration({ status: "idle" }); }}
                            style={{
                              fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                              padding: "9px 20px", border: "none", cursor: "pointer",
                              background: gender === g ? "#0A0A0A" : "transparent",
                              color: gender === g ? "#fff" : "rgba(0,0,0,0.55)",
                              transition: "background 0.2s, color 0.2s",
                            }}
                          >
                            {g === "female" ? "Her" : "Him"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Model choice: AI avatar vs the customer's own photo ── */}
                    <div style={{ background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "14px 18px" }}>
                      <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase", marginBottom: 12 }}>
                        Choose Model
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: modelSource === "photo" ? 16 : 0 }}>
                        {([
                          { key: "avatar" as const, label: "Use AI Model", sub: "Quick" },
                          { key: "photo" as const, label: "Upload My Photo", sub: "Best Results" },
                        ]).map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => { setModelSource(opt.key); setGeneration({ status: "idle" }); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, flex: "1 1 200px",
                              fontFamily: FONT_UI, padding: "8px 14px", cursor: "pointer",
                              border: `1.5px solid ${modelSource === opt.key ? GOLD : "rgba(0,0,0,0.12)"}`,
                              background: modelSource === opt.key ? "rgba(184,146,90,0.08)" : "transparent",
                              textAlign: "left",
                            }}
                          >
                            {opt.key === "avatar" ? (
                              <img
                                src={`/api/public/avatars/avatar-${gender}.png`}
                                alt={`${gender} avatar`}
                                style={{ width: 36, height: 48, objectFit: "cover", objectPosition: "top", flexShrink: 0, border: `1px solid rgba(184,146,90,0.2)` }}
                              />
                            ) : (
                              <div style={{ width: 36, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F2EC", flexShrink: 0 }}>
                                <User size={18} color="rgba(0,0,0,0.35)" />
                              </div>
                            )}
                            <span>
                              <span style={{ display: "block", fontSize: 12, letterSpacing: "0.05em", color: "#0A0A0A" }}>{opt.label}</span>
                              <span style={{ display: "block", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginTop: 2 }}>{opt.sub}</span>
                            </span>
                          </button>
                        ))}
                      </div>

                      {modelSource === "photo" && (
                        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
                          {/* Guidelines */}
                          <div style={{ flex: 1, minWidth: 220, background: "#FAFAF7", border: "1px dashed rgba(184,146,90,0.35)", padding: "12px 14px" }}>
                            <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)", marginBottom: 8 }}>
                              For the best result
                            </p>
                            {[
                              ["✅", "Full body visible, facing forward"],
                              ["✅", "Arms slightly away from your body"],
                              ["✅", "Plain background, good lighting"],
                              ["❌", "No oversized jackets"],
                              ["❌", "Don't crop your feet"],
                              ["❌", "No mirror selfies"],
                            ].map(([mark, text], i) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                                <span style={{ fontSize: 11 }}>{mark}</span>
                                <span style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.6)", letterSpacing: "0.02em" }}>{text}</span>
                              </div>
                            ))}
                          </div>

                          {/* Upload */}
                          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
                            <label
                              htmlFor="lookbook-photo-input"
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                                border: `1.5px dashed ${photoPreviewUrl ? GOLD : "rgba(0,0,0,0.2)"}`, borderRadius: 4,
                                height: 160, cursor: "pointer", background: photoPreviewUrl ? "#000" : "#FAFAF7", overflow: "hidden", position: "relative",
                              }}
                            >
                              {photoPreviewUrl ? (
                                <img src={photoPreviewUrl} alt="Your uploaded photo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              ) : (
                                <>
                                  <Upload size={22} color="rgba(0,0,0,0.35)" />
                                  <span style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.4)" }}>
                                    Click to upload a full-body photo
                                  </span>
                                </>
                              )}
                              {uploadPhoto.isPending && (
                                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Spinner />
                                </div>
                              )}
                            </label>
                            <input
                              id="lookbook-photo-input"
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) void handlePhotoSelected(file);
                                e.target.value = "";
                              }}
                            />
                            {uploadedPhotoUrl && !uploadPhoto.isPending && (
                              <p style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.1em", color: "#2D7D46", margin: 0 }}>
                                <Check size={12} /> Photo ready
                              </p>
                            )}
                            {photoUploadError && (
                              <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.05em", color: "#c0392b", margin: 0 }}>
                                {photoUploadError}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 20, alignItems: "flex-start" }}>

                      {/* ── Tops panel (left) ── */}
                      <GarmentPanel
                        title="Tops"
                        items={tops}
                        selectedId={selection.top?.productId ?? null}
                        onSelect={p => selectItem("top", p)}
                        isMobile={isMobile}
                      />

                      {/* ── Result canvas ── */}
                      <div
                        style={{
                          position: "relative",
                          flex: 1,
                          width: isMobile ? "100%" : undefined,
                          height: isMobile ? 480 : 680,
                          background: generation.status === "succeeded"
                            ? "#000"
                            : `linear-gradient(180deg, ${CANVAS_BG} 0%, ${CANVAS_BG} 82%, #E2DCD2 82%, #E2DCD2 100%)`,
                          border: "1px solid rgba(184,146,90,0.22)",
                          borderRadius: 6,
                          boxShadow: "0 18px 40px -18px rgba(20,15,5,0.28)",
                          overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {/* Status pin */}
                        <div style={{
                          position: "absolute", top: 12, left: 12, zIndex: 10,
                          background: "#0A0A0A", color: "#fff",
                          fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                          padding: "6px 11px", borderRadius: 3,
                        }}>
                          {generation.status === "succeeded" ? "Your AI Try-On" :
                            isGenerating ? "Generating…" :
                            hasSelection ? "Ready to Generate" : "Build Your Look"}
                        </div>

                        {generation.status === "succeeded" ? (
                          <>
                            {/* Top-right: download + fullscreen */}
                            <div style={{
                              position: "absolute", top: 12, right: 12, zIndex: 10,
                              display: "flex", gap: 6,
                            }}>
                              {[
                                { icon: <Download size={14} />, onClick: handleDownload, title: "Download image" },
                                { icon: <Maximize2 size={14} />, onClick: () => setIsFullscreen(true), title: "Full screen" },
                              ].map(({ icon, onClick, title }, i) => (
                                <button
                                  key={i}
                                  onClick={onClick}
                                  title={title}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: 32, height: 32,
                                    background: "rgba(0,0,0,0.65)", color: "#fff",
                                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4,
                                    cursor: "pointer", backdropFilter: "blur(4px)",
                                  }}
                                >
                                  {icon}
                                </button>
                              ))}
                            </div>

                            {/* Bottom-right: zoom controls */}
                            <div style={{
                              position: "absolute", bottom: 12, right: 12, zIndex: 10,
                              display: "flex", gap: 6,
                            }}>
                              {[
                                { icon: <ZoomIn size={14} />, onClick: zoomIn, title: "Zoom in" },
                                { icon: <ZoomOut size={14} />, onClick: zoomOut, title: "Zoom out", disabled: zoom <= 1 },
                                { icon: <RotateCcw size={14} />, onClick: zoomReset, title: "Reset zoom", disabled: zoom === 1 },
                              ].map(({ icon, onClick, title, disabled }, i) => (
                                <button
                                  key={i}
                                  onClick={onClick}
                                  title={title}
                                  disabled={disabled}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: 32, height: 32,
                                    background: "rgba(0,0,0,0.65)", color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
                                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4,
                                    cursor: disabled ? "default" : "pointer", backdropFilter: "blur(4px)",
                                  }}
                                >
                                  {icon}
                                </button>
                              ))}
                              {zoom !== 1 && (
                                <div style={{
                                  display: "flex", alignItems: "center", padding: "0 10px",
                                  background: "rgba(0,0,0,0.65)", color: "#fff",
                                  fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.1em",
                                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4,
                                  backdropFilter: "blur(4px)",
                                }}>
                                  {Math.round(zoom * 100)}%
                                </div>
                              )}
                            </div>
                            <div style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <img
                                src={generation.resultImageUrl}
                                alt="AI-generated try-on result"
                                draggable={false}
                                style={{
                                  width: `${zoom * 100}%`, height: `${zoom * 100}%`,
                                  objectFit: "contain", transition: "width 0.2s, height 0.2s",
                                }}
                              />
                            </div>
                          </>
                        ) : isGenerating ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "0 20px" }}>
                            <Spinner />

                            {/* Stage label */}
                            {(() => {
                              const gc = jobStatus?.garmentCount ?? 1;
                              const pc = jobStatus?.processedCount ?? 0;
                              const st = jobStatus?.status;
                              let label: string;
                              let sub: string;
                              if (elapsedSecs >= 60) {
                                label = "Taking longer than usual…";
                                sub = "Still working — you can keep waiting or try again.";
                              } else if (elapsedSecs >= 25 || (st === "processing" && pc >= gc && gc > 0)) {
                                label = "Almost done — finishing touches…";
                                sub = "Saving your look";
                              } else if (st === "processing" && gc > 1) {
                                label = pc === 0 ? "Fitting first garment…" : "Fitting second garment…";
                                sub = `Step ${pc + 1} of ${gc}`;
                              } else if (st === "processing") {
                                label = "Fitting garment to your avatar…";
                                sub = "Usually takes 20–35 seconds";
                              } else {
                                label = "Preparing your look…";
                                sub = "Sending to AI model";
                              }
                              return (
                                <>
                                  <p style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.2em", color: GOLD, margin: 0, textTransform: "uppercase", textAlign: "center" }}>
                                    {label}
                                  </p>
                                  <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.4)", margin: 0, textAlign: "center", lineHeight: 1.6 }}>
                                    {sub}
                                  </p>
                                </>
                              );
                            })()}

                            {/* Elapsed counter */}
                            <p style={{ fontFamily: FONT_UI, fontSize: 9, color: "rgba(0,0,0,0.28)", margin: 0, letterSpacing: "0.1em" }}>
                              {elapsedSecs}s elapsed
                            </p>

                            {/* Timeout retry option */}
                            {elapsedSecs >= 60 && (
                              <button
                                onClick={handleGenerate}
                                style={{
                                  fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                                  background: "#0A0A0A", color: "#fff", border: "none", padding: "9px 20px", cursor: "pointer", marginTop: 4,
                                }}
                              >
                                Try Again
                              </button>
                            )}
                          </div>
                        ) : generation.status === "failed" ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 24 }}>
                            <AlertTriangle size={26} color="#c0392b" />
                            <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "#c0392b", margin: 0, textAlign: "center", letterSpacing: "0.05em", maxWidth: 280 }}>
                              {generation.error}
                            </p>
                            {outOfCredits ? (
                              <button
                                onClick={() => setShowBuyCredits(true)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                                  background: "#c0392b", color: "#fff", border: "none", padding: "9px 20px", cursor: "pointer", marginTop: 4,
                                }}
                              >
                                <ShoppingBag size={12} /> Buy More Credits
                              </button>
                            ) : (
                              <>
                                <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.4)", margin: "0", textAlign: "center", letterSpacing: "0.04em", maxWidth: 260, lineHeight: 1.6 }}>
                                  No credit was charged — your balance is safe.
                                </p>
                                <button
                                  onClick={handleGenerate}
                                  style={{
                                    fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                                    background: "#0A0A0A", color: "#fff", border: "none", padding: "9px 20px", cursor: "pointer", marginTop: 6,
                                  }}
                                >
                                  Try Again
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 24 }}>
                            <Wand2 size={30} color="rgba(0,0,0,0.25)" />
                            <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.4)", letterSpacing: "0.1em", textAlign: "center", maxWidth: 280, lineHeight: 1.7, margin: 0 }}>
                              {hasSelection
                                ? "Ready when you are — click Generate Look below."
                                : "Select a dress, or a top and/or bottom, from your saved pieces."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* ── Bottoms panel (middle-right) ── */}
                      <GarmentPanel
                        title="Bottoms"
                        items={bottoms}
                        selectedId={selection.bottom?.productId ?? null}
                        onSelect={p => selectItem("bottom", p)}
                        isMobile={isMobile}
                      />

                      {/* ── Dresses panel (right) ── */}
                      <GarmentPanel
                        title="Dresses"
                        items={dresses}
                        selectedId={selection.dress?.productId ?? null}
                        onSelect={p => selectItem("dress", p)}
                        isMobile={isMobile}
                      />
                    </div>

                    {/* ── Current selection scorecard ── */}
                    <div style={{ background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
                      <div style={{ padding: "12px 16px 8px", borderBottom: "1px dashed rgba(0,0,0,0.1)" }}>
                        <span style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>
                          Current Selection
                        </span>
                      </div>
                      {(["dress", "top", "bottom"] as const).map((role, i, arr) => {
                        const item = selection[role];
                        const label = role === "top" ? "Top" : role === "bottom" ? "Bottom" : "Dress";
                        const disabledByDress = role !== "dress" && !!selection.dress;
                        return (
                          <div
                            key={role}
                            style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                              borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                              opacity: disabledByDress ? 0.4 : 1,
                            }}
                          >
                            <span style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, width: 64, flexShrink: 0 }}>
                              {label}
                            </span>
                            <span style={{
                              fontFamily: FONT_DISPLAY, fontSize: 16, flex: 1, minWidth: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              color: item ? "#0A0A0A" : "rgba(0,0,0,0.35)", fontStyle: item ? "normal" : "italic",
                            }}>
                              {item ? item.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "") : disabledByDress ? "Not used with a dress" : `Select a ${label.toLowerCase()}`}
                            </span>
                            {item && (
                              <button
                                onClick={() => removeItem(role)}
                                title={`Remove ${label.toLowerCase()}`}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: 22, height: 22, background: "transparent", border: "none",
                                  color: "rgba(0,0,0,0.4)", cursor: "pointer", flexShrink: 0,
                                }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action controls */}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
                      background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "12px 14px",
                    }}>
                      <button
                        onClick={randomizeOutfit}
                        disabled={!hasAnySaved || isGenerating}
                        title="Pick random saved pieces"
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                          letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 16px",
                          border: `1px solid ${hasAnySaved ? GOLD : "rgba(0,0,0,0.12)"}`, background: "transparent",
                          cursor: hasAnySaved && !isGenerating ? "pointer" : "not-allowed",
                          color: hasAnySaved ? GOLD : "rgba(0,0,0,0.25)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Sparkles size={13} /> Surprise Me
                      </button>
                      <button
                        onClick={clearSelection}
                        disabled={!hasSelection || isGenerating}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                          letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 16px",
                          border: "1px solid rgba(0,0,0,0.12)", background: "transparent",
                          cursor: !hasSelection || isGenerating ? "not-allowed" : "pointer",
                          color: !hasSelection ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.6)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <X size={13} /> Clear
                      </button>

                      <div style={{ flex: 1 }} />

                      {/* Credit badge */}
                      {creditsRemaining !== null && (
                        <button
                          onClick={() => setShowBuyCredits(true)}
                          title="Buy more AI credits"
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                            padding: "7px 12px", border: `1px solid ${creditsRemaining === 0 ? "#c0392b" : "rgba(184,146,90,0.4)"}`,
                            background: creditsRemaining === 0 ? "rgba(192,57,43,0.06)" : "transparent",
                            color: creditsRemaining === 0 ? "#c0392b" : "rgba(0,0,0,0.5)",
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          <Zap size={11} />
                          {creditsRemaining} Credit{creditsRemaining !== 1 ? "s" : ""}
                        </button>
                      )}

                      {outOfCredits ? (
                        <button
                          onClick={() => setShowBuyCredits(true)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                            background: "#c0392b", color: "#fff", border: "none",
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          <ShoppingBag size={13} /> Buy More Credits
                        </button>
                      ) : (
                        <button
                          onClick={handleGenerate}
                          disabled={!canGenerate || isGenerating}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                            background: (!canGenerate || isGenerating) ? "rgba(0,0,0,0.15)" : GOLD,
                            color: "#fff", border: "none",
                            cursor: (!canGenerate || isGenerating) ? "not-allowed" : "pointer",
                            transition: "background 0.3s", whiteSpace: "nowrap",
                          }}
                        >
                          <Wand2 size={13} /> {isGenerating ? "Generating…" : "Generate Look"}
                        </button>
                      )}
                    </div>

                    {/* Save controls — only shown once a result exists */}
                    {generation.status === "succeeded" && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
                        background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "12px 14px",
                      }}>
                        <input
                          value={outfitName}
                          onChange={e => setOutfitName(e.target.value)}
                          placeholder="Name your look…"
                          style={{
                            flex: 1, minWidth: 120, fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.1em",
                            border: "1px solid rgba(0,0,0,0.1)", padding: "9px 12px",
                            outline: "none", background: "#FAFAF7", color: "#0A0A0A",
                          }}
                        />
                        <button
                          onClick={handleSave}
                          disabled={createOutfit.isPending}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                            background: saveSuccess ? "#2D7D46" : "#0A0A0A",
                            color: "#fff", border: "none",
                            cursor: createOutfit.isPending ? "not-allowed" : "pointer",
                            transition: "background 0.3s", whiteSpace: "nowrap",
                          }}
                        >
                          {saveSuccess ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Look</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Saved outfits tab ── */}
            {activeTab === "saved" && (
              <div>
                {outfitsLoading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ height: 220, background: "#E8E4DE", animation: "pulse 1.5s ease-in-out infinite" }} />
                    ))}
                  </div>
                ) : savedOutfits.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", border: "1px dashed rgba(184,146,90,0.35)" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: "rgba(0,0,0,0.4)", marginBottom: 8 }}>
                      No saved looks yet
                    </p>
                    <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.35)", letterSpacing: "0.12em", marginBottom: 20 }}>
                      Generate a try-on and save it to see it here
                    </p>
                    <button
                      onClick={() => setActiveTab("builder")}
                      style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", background: GOLD, color: "#fff", border: "none", padding: "10px 28px", cursor: "pointer" }}
                    >
                      Open Style Studio
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                    {savedOutfits.map(outfit => {
                      const items = outfit.items as LookbookLookItem[];
                      return (
                        <div
                          key={outfit.id}
                          style={{ background: "#fff", border: "1px solid rgba(184,146,90,0.18)", overflow: "hidden" }}
                        >
                          <div style={{ position: "relative", height: 260, background: "#000", overflow: "hidden" }}>
                            <img
                              src={outfit.resultImageUrl}
                              alt={outfit.name}
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                            />
                            <button
                              style={{
                                position: "absolute", top: 8, right: 8,
                                background: "rgba(255,255,255,0.9)", borderRadius: "50%",
                                width: 28, height: 28, border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.10)", zIndex: 5,
                              }}
                              onClick={() => handleDeleteOutfit(outfit.id)}
                              title="Delete outfit"
                            >
                              <Trash2 size={12} color="#e53e3e" />
                            </button>
                          </div>

                          <div style={{ padding: "12px 14px" }}>
                            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: "#0A0A0A", marginBottom: 3 }}>
                              {outfit.name}
                            </p>
                            <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.12em", color: "rgba(0,0,0,0.38)", marginBottom: 12 }}>
                              {items.length} piece{items.length !== 1 ? "s" : ""}&nbsp;·&nbsp;{new Date(outfit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            <button
                              onClick={() => loadOutfit(outfit)}
                              style={{
                                fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                                background: "transparent", border: `1px solid ${GOLD}`, color: GOLD,
                                padding: "7px 16px", cursor: "pointer", width: "100%",
                                transition: "background 0.2s, color 0.2s",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = GOLD; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = GOLD; }}
                            >
                              View in Style Studio
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </section>
      </Show>

      {/* ── Sign-in prompt for guests ──────────────────────────────────────────── */}
      <Show when="signed-out">
        <section style={{ background: "#F5F2EC", padding: "64px 24px", textAlign: "center", borderBottom: "1px solid rgba(184,146,90,0.2)" }}>
          <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>
            Personal Lookbook
          </p>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 400, color: "#0A0A0A", marginBottom: 14 }}>
            Style Your Ka.Sha Wardrobe
          </h2>
          <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.45)", letterSpacing: "0.1em", marginBottom: 28, maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.8 }}>
            Sign in to heart products, save your favourite pieces, and generate an AI virtual try-on to see how they look on you.
          </p>
          <Link href="/sign-in">
            <button style={{
              fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase",
              background: "#0A0A0A", color: "#fff", border: "none", padding: "14px 44px", cursor: "pointer",
            }}>
              Sign In to Start
            </button>
          </Link>
        </section>
      </Show>

      {/* ── Fullscreen image viewer ── */}
      {isFullscreen && generation.status === "succeeded" && (
        <div
          onClick={() => setIsFullscreen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.96)", zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Close */}
          <button
            onClick={() => setIsFullscreen(false)}
            title="Exit full screen (Esc)"
            style={{
              position: "absolute", top: 16, right: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6,
              color: "#fff", cursor: "pointer",
            }}
          >
            <Minimize2 size={18} />
          </button>

          {/* Download inside fullscreen too */}
          <button
            onClick={e => { e.stopPropagation(); void handleDownload(); }}
            title="Download image"
            style={{
              position: "absolute", top: 16, right: 64,
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 14px", height: 40,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6,
              color: "#fff", cursor: "pointer",
              fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
            }}
          >
            <Download size={14} /> Download
          </button>

          {/* Image — click does not propagate so backdrop click closes */}
          <img
            src={generation.resultImageUrl}
            alt="AI-generated try-on result"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "92vw", maxHeight: "90vh",
              objectFit: "contain",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          />

          {/* Hint */}
          <p style={{
            position: "absolute", bottom: 18,
            fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
          }}>
            Press Esc or click outside to close
          </p>
        </div>
      )}

      {/* ── Buy Credits Modal ───────────────────────────────────────────────── */}
      {showBuyCredits && (
        <div
          onClick={() => { setShowBuyCredits(false); setCreditPurchaseError(null); setPendingOrder(null); setPaymentDismissed(false); setPaymentVerified(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(10,10,10,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", maxWidth: 460, width: "100%", padding: "32px 28px", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
                  AI Credits
                </p>
                <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: "#0A0A0A", margin: 0 }}>
                  Top Up Your Studio
                </h3>
              </div>
              <button
                onClick={() => { setShowBuyCredits(false); setCreditPurchaseError(null); setPendingOrder(null); setPaymentDismissed(false); setPaymentVerified(false); }}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.35)", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Payment success ─────────────────────────────────────────── */}
            {paymentVerified && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <CheckCircle size={44} color="#27ae60" style={{ marginBottom: 12 }} />
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: "#0A0A0A", marginBottom: 6 }}>Payment confirmed!</p>
                <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: "0.05em" }}>
                  Your credits have been added. Closing…
                </p>
              </div>
            )}

            {/* ── "I already paid" panel — shown after Razorpay modal dismissal ── */}
            {!paymentVerified && paymentDismissed && pendingOrder && (
              <div style={{ background: "rgba(184,146,90,0.06)", border: `1px solid rgba(184,146,90,0.25)`, padding: "18px 16px", marginBottom: 20 }}>
                <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "#0A0A0A", letterSpacing: "0.06em", marginBottom: 10, lineHeight: 1.6 }}>
                  Did you complete the UPI payment on your phone? Click below to verify it — credits will be added instantly.
                </p>
                <button
                  onClick={() => void checkOrderStatus(pendingOrder.razorpayOrderId, pendingOrder.packageId)}
                  disabled={checkingPayment}
                  style={{
                    width: "100%", fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.18em",
                    textTransform: "uppercase", background: GOLD, color: "#fff", border: "none",
                    padding: "11px 0", cursor: checkingPayment ? "not-allowed" : "pointer", opacity: checkingPayment ? 0.7 : 1,
                  }}
                >
                  {checkingPayment ? "Checking payment…" : "✓ I've already paid — verify now"}
                </button>
                {!checkingPayment && (
                  <p style={{ fontFamily: FONT_UI, fontSize: 9, color: "rgba(0,0,0,0.35)", textAlign: "center", marginTop: 8, marginBottom: 0, letterSpacing: "0.06em" }}>
                    Or choose a package below to try a different payment method
                  </p>
                )}
              </div>
            )}

            {!paymentVerified && (
              <>
                <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: "0.05em", lineHeight: 1.7, marginBottom: 22 }}>
                  Each AI credit powers one photorealistic try-on. Credits never expire.
                  {creditsRemaining !== null && (
                    <span style={{ display: "block", marginTop: 4, color: creditsRemaining === 0 ? "#c0392b" : "rgba(0,0,0,0.4)" }}>
                      You currently have <strong>{creditsRemaining}</strong> credit{creditsRemaining !== 1 ? "s" : ""}.
                    </span>
                  )}
                </p>

                {creditPackages.length === 0 && (
                  <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.4)", textAlign: "center", padding: "20px 0" }}>
                    Loading packages…
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {creditPackages.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => handleBuyPackage(pkg)}
                      disabled={purchaseCredits.isPending || verifyPayment.isPending}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px", border: `1px solid rgba(184,146,90,0.3)`,
                        background: "transparent", cursor: purchaseCredits.isPending || verifyPayment.isPending ? "not-allowed" : "pointer",
                        textAlign: "left", transition: "border-color 0.2s, background 0.2s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = GOLD; (e.currentTarget as HTMLButtonElement).style.background = "rgba(184,146,90,0.04)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(184,146,90,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, background: "rgba(184,146,90,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Zap size={16} color={GOLD} />
                        </div>
                        <div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: "#0A0A0A", margin: 0 }}>
                            {pkg.name}
                          </p>
                          {pkg.bonusCredits > 0 && (
                            <p style={{ fontFamily: FONT_UI, fontSize: 9, color: GOLD, letterSpacing: "0.1em", margin: 0, marginTop: 2 }}>
                              +{pkg.bonusCredits} bonus credit{pkg.bonusCredits > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: FONT_UI, fontSize: 14, color: GOLD, fontWeight: 600, margin: 0, letterSpacing: "0.02em" }}>
                          ₹{Math.round(pkg.priceInPaise / 100)}
                        </p>
                        <p style={{ fontFamily: FONT_UI, fontSize: 9, color: "rgba(0,0,0,0.35)", margin: 0, marginTop: 2, letterSpacing: "0.08em" }}>
                          ₹{Math.round(pkg.priceInPaise / pkg.creditsAmount / 100)} / credit
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {creditPurchaseError && (
                  <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "#c0392b", letterSpacing: "0.05em", textAlign: "center", marginBottom: 14 }}>
                    {creditPurchaseError}
                  </p>
                )}

                {(purchaseCredits.isPending || verifyPayment.isPending) && (
                  <p style={{ fontFamily: FONT_UI, fontSize: 10, color: GOLD, letterSpacing: "0.1em", textAlign: "center", marginBottom: 14 }}>
                    Processing…
                  </p>
                )}

                <p style={{ fontFamily: FONT_UI, fontSize: 9, color: "rgba(0,0,0,0.3)", letterSpacing: "0.08em", textAlign: "center", margin: 0 }}>
                  Secure checkout via Razorpay · UPI, card, netbanking accepted
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(10,10,10,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", maxWidth: 420, width: "100%", padding: "28px 26px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
          >
            <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>
              Confirm Your Look
            </p>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: "#0A0A0A", marginBottom: 14 }}>
              Ready to generate?
            </h3>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#F5F2EC", flexShrink: 0, border: `1px solid ${GOLD}` }}>
                {modelSource === "photo" && photoPreviewUrl ? (
                  <img src={photoPreviewUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img
                    src={`/api/public/avatars/avatar-${gender}.png`}
                    alt={`${gender} model`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                  />
                )}
              </div>
              <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.05em", margin: 0 }}>
                Model: {modelSource === "photo" ? "Your uploaded photo" : `AI ${gender === "female" ? "female" : "male"} avatar`}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {selectedItems.map(item => (
                <div key={item.productId} style={{ width: 52, height: 52, background: "#F5F2EC", overflow: "hidden", border: "1px solid rgba(184,146,90,0.25)" }}>
                  <img src={getAssetUrl(item.thumbnailUrl)} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>

            <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: "0.04em", lineHeight: 1.7, marginBottom: 14 }}>
              This will use <strong style={{ color: GOLD }}>1 AI credit</strong>. Rendering usually takes under a minute.
            </p>
            {creditsRemaining !== null && (
              <p style={{ fontFamily: FONT_UI, fontSize: 10, color: creditsRemaining <= 1 ? "#c0392b" : "rgba(0,0,0,0.4)", letterSpacing: "0.04em", lineHeight: 1.6, marginBottom: 22 }}>
                You have {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} remaining.
                {creditsRemaining <= 1 && " Top up after this run so you never miss a look."}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                  background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "rgba(0,0,0,0.6)",
                  padding: "10px 20px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={runGenerate}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                  letterSpacing: "0.2em", textTransform: "uppercase", background: GOLD, color: "#fff",
                  border: "none", padding: "10px 20px", cursor: "pointer",
                }}
              >
                <Wand2 size={13} /> Generate Look
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}

function Spinner() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: "ka-spin 0.9s linear infinite" }}>
      <style>{`@keyframes ka-spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="14" cy="14" r="10" fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="48" strokeDashoffset="16" strokeLinecap="round" />
    </svg>
  );
}

function GarmentPanel({
  title, items, selectedId, onSelect, isMobile,
}: {
  title: string;
  items: WardrobeItem[];
  selectedId: number | null;
  onSelect: (p: WardrobeItem) => void;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <div style={{ width: "100%", background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase" }}>{title}</span>
        </div>
        {items.length === 0 ? (
          <p style={{ fontFamily: FONT_UI, fontSize: 9, color: "rgba(0,0,0,0.35)", padding: "14px 12px", letterSpacing: "0.06em" }}>
            No saved {title.toLowerCase()} yet
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", overflowX: "auto", WebkitOverflowScrolling: "touch" as "touch" }}>
            {items.map(p => {
              const isSelected = selectedId === p.productId;
              return (
                <button
                  key={p.productId}
                  onClick={() => onSelect(p)}
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 4, padding: "8px 6px", width: 76,
                    background: "transparent", border: isSelected ? `1px solid ${GOLD}` : "1px solid rgba(0,0,0,0.07)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ position: "relative", width: 44, height: 56 }}>
                    <img src={getAssetUrl(p.thumbnailUrl)} alt={p.name}
                      style={{ width: 44, height: 56, objectFit: "contain", background: "#F5F2EC" }} />
                    {isSelected && (
                      <div style={{
                        position: "absolute", top: -4, right: -4, width: 15, height: 15, borderRadius: "50%",
                        background: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      }}>
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontFamily: FONT_UI, fontSize: 7, letterSpacing: "0.06em", color: isSelected ? GOLD : "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
                    {p.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "").slice(0, 12)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: 200, flexShrink: 0, background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase" }}>{title}</p>
      </div>
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 680, overflowY: "auto" }}>
        {items.length === 0 ? (
          <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", padding: "8px 4px", lineHeight: 1.7 }}>
            No saved {title.toLowerCase()} yet. Heart one from the shop to see it here.
          </p>
        ) : items.map(p => {
          const isSelected = selectedId === p.productId;
          return (
            <button
              key={p.productId}
              onClick={() => onSelect(p)}
              title={`Wear this ${title.slice(0, -1).toLowerCase()}`}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px",
                background: isSelected ? "rgba(184,146,90,0.08)" : "transparent",
                border: isSelected ? `1px solid ${GOLD}` : "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer",
              }}
            >
              <img src={getAssetUrl(p.thumbnailUrl)} alt={p.name}
                style={{ width: 40, height: 50, objectFit: "contain", background: "#F5F2EC", flexShrink: 0 }} />
              <span style={{
                fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.03em", textAlign: "left",
                color: isSelected ? GOLD : "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", flex: 1, minWidth: 0,
              }}>
                {p.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}
              </span>
              {isSelected && <Check size={13} color={GOLD} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
