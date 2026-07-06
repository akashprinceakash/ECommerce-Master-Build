import { useEffect, useState, useCallback, useMemo } from "react";
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
  type LookbookOutfit,
  type LookbookLookItem,
} from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Save, CheckCircle, Heart, Sparkles, Check, X, Wand2, AlertTriangle } from "lucide-react";

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

  const handleGenerate = useCallback(async () => {
    const items = selection.dress
      ? [selection.dress]
      : [selection.top, selection.bottom].filter((x): x is WardrobeItem => !!x);
    if (items.length === 0 || submitTryOn.isPending) return;
    try {
      const res = await submitTryOn.mutateAsync({
        data: { gender, productIds: items.map(i => i.productId) },
      });
      setGeneration({ status: "generating", jobId: res.jobId });
    } catch (err) {
      setGeneration({ status: "failed", error: err instanceof Error ? err.message : "Failed to start try-on" });
    }
  }, [selection, gender, submitTryOn]);

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
                          <img
                            src={generation.resultImageUrl}
                            alt="AI-generated try-on result"
                            draggable={false}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : isGenerating ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                            <Spinner />
                            <p style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.2em", color: GOLD, margin: 0, textTransform: "uppercase" }}>
                              Rendering your look…
                            </p>
                            <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.4)", margin: 0, maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
                              This can take up to a minute — the AI is fitting the garment to your avatar.
                            </p>
                          </div>
                        ) : generation.status === "failed" ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 24 }}>
                            <AlertTriangle size={26} color="#c0392b" />
                            <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "#c0392b", margin: 0, textAlign: "center", letterSpacing: "0.05em", maxWidth: 280 }}>
                              {generation.error}
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

                      <button
                        onClick={handleGenerate}
                        disabled={!hasSelection || isGenerating}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                          letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                          background: (!hasSelection || isGenerating) ? "rgba(0,0,0,0.15)" : GOLD,
                          color: "#fff", border: "none",
                          cursor: (!hasSelection || isGenerating) ? "not-allowed" : "pointer",
                          transition: "background 0.3s", whiteSpace: "nowrap",
                        }}
                      >
                        <Wand2 size={13} /> {isGenerating ? "Generating…" : "Generate Look"}
                      </button>
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
