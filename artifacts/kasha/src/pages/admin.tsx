import { useState, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Pencil, Trash2, Upload, X, Check,
  ShieldCheck, Package, Users, Eye, ArrowLeft, BarChart3, ShoppingBag, UserCog, Download, ImageIcon,
} from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { getApiUrl, getAssetUrl } from "@/lib/api";
import { PATTERNS, patternUrl } from "@/components/3d/patterns";

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  gender?: string | null;
  subType?: string | null;
  sku?: string | null;
  stock: number;
  priceInPaise: number;
  modelUrl: string;
  thumbnailUrl?: string | null;
  additionalImages?: string | null;
  available: boolean;
  sizes: string[];
  defaultColor: string;
}

interface UserDesign {
  id: number;
  userId: string;
  userEmail: string;
  userName: string;
  productId: number;
  productName: string | null;
  productModelUrl: string | null;
  productThumbnailUrl: string | null;
  name: string;
  color: string;
  size: string;
  partsEnabled: Record<string, any> | null;
  canvasData: string | null;
  previewImageUrl: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  sideImageUrl: string | null;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "polo",
  gender: "",
  subType: "",
  sku: "",
  stock: 100,
  priceText: "",
  modelUrl: "",
  thumbnailUrl: "",
  additionalImages: "",
  available: true,
  sizes: ["S", "M", "L", "XL"],
  defaultColor: "#ffffff",
};

function isLightHex(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  } catch { return false; }
}

async function exportPartPNGs(design: UserDesign) {
  const canvasData = design.canvasData ? JSON.parse(design.canvasData) : {};
  const partColors: Record<string, string> = canvasData.partColors ?? {};
  const parts = ["collar", "front", "back", "leftSleeve", "rightSleeve"] as const;

  for (const part of parts) {
    const color = partColors[part] ?? "#CCCCCC";
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);

    const textColor = isLightHex(color) ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
    ctx.fillStyle = textColor;
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(part.replace(/([A-Z])/g, " $1").trim().toUpperCase(), 256, 230);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = isLightHex(color) ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    ctx.fillText("KA·SHA", 256, 290);
    ctx.fillText(color.toUpperCase(), 256, 320);

    const link = document.createElement("a");
    link.download = `${(design.name ?? "design").replace(/\s+/g, "-")}-${part}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    await new Promise(r => setTimeout(r, 150));
  }
}

async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) return clerk.session.getToken();
    return null;
  } catch { return null; }
}

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const isFormData = opts?.body instanceof FormData;
  const headers: Record<string, string> = { ...(opts?.headers as any) };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Design Viewer Modal ───────────────────────────────────────────────────────
function DesignViewerModal({ design, onClose }: { design: UserDesign; onClose: () => void }) {
  const [mvReady, setMvReady] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!document.querySelector('script[data-mv-loader]')) {
      const s = document.createElement("script");
      s.type = "module";
      s.setAttribute("data-mv-loader", "1");
      s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      s.onload = () => setMvReady(true);
      document.head.appendChild(s);
    } else {
      setMvReady(true);
    }
  }, []);

  // Parse all the rich design data we now persist alongside each customization
  const parsedDesign = useMemo(() => {
    try {
      const parsed = design.canvasData ? JSON.parse(design.canvasData) : {};
      const canvasJSON = (() => {
        try {
          return typeof parsed.canvasJSON === "string"
            ? JSON.parse(parsed.canvasJSON)
            : parsed.canvasJSON;
        } catch { return null; }
      })();
      const objects: any[] = canvasJSON?.objects ?? [];
      const counts: Record<string, number> = {};
      const texts: string[] = [];
      let logoCount = 0;
      let shapeCount = 0;
      for (const o of objects) {
        const t = o.type || "object";
        counts[t] = (counts[t] ?? 0) + 1;
        if (t === "i-text" || t === "text" || t === "textbox" || t === "Text" || t === "FabricText" || t === "IText") {
          if (o.text) texts.push(o.text);
        }
        if (t === "image" || t === "Image" || t === "FabricImage") logoCount++;
        if (["rect","circle","triangle","polygon","line","path","Rect","Circle","Triangle","Polygon","Line","Path"].includes(t)) shapeCount++;
      }
      return {
        textureUrl: parsed.textureUrl as string | undefined,
        matColors: (parsed.matColors as string[] | undefined) ?? (design.partsEnabled as any)?.matColors ?? [],
        canvasBg: parsed.canvasBg as string | undefined,
        primaryColor: parsed.primaryColor as string | undefined,
        secondaryColor: parsed.secondaryColor as string | undefined,
        presetName: parsed.presetName as string | undefined ?? (design.partsEnabled as any)?.presetName,
        garmentState: parsed.garmentState as Record<string, any> | undefined,
        objectCount: objects.length,
        counts, texts, logoCount, shapeCount,
      };
    } catch {
      return { matColors: [], objectCount: 0, counts: {}, texts: [], logoCount: 0, shapeCount: 0 } as any;
    }
  }, [design]);

  // Restore exact design on model load — uses the SAME robust iterate-all
  // pattern as the customizer so it works on arbitrary GLBs.
  useEffect(() => {
    if (!viewerRef.current || !mvReady) return;
    const mv = viewerRef.current;
    const handleLoad = async () => {
      const model = mv.model;
      if (!model?.materials?.length) return;
      const mats: any[] = Array.from(model.materials);
      // Per-material colors first (non-body trims, sleeves, collars, etc.)
      mats.forEach((mat: any, i: number) => {
        const hex = parsedDesign.matColors?.[i];
        if (hex && i > 0) {
          try { mat.pbrMetallicRoughness.setBaseColorFactor(hex); } catch {}
        }
      });
      // Then bake the design texture onto the first material that accepts one.
      const texSrc = parsedDesign.textureUrl || design.previewImageUrl;
      if (texSrc) {
        try {
          const tex = await mv.createTexture(texSrc);
          for (const mat of mats) {
            try {
              mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
              mat.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
              break;
            } catch {}
          }
        } catch {}
      }
    };
    mv.addEventListener("load", handleLoad);
    return () => mv.removeEventListener("load", handleLoad);
  }, [design, mvReady, parsedDesign]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: "#100d0b", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 3D Viewer */}
        <div className="flex-1 min-h-[300px] md:min-h-[500px] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          {design.productModelUrl && mvReady ? (
            <model-viewer
              ref={viewerRef}
              src={design.productModelUrl}
              camera-controls
              auto-rotate
              rotation-per-second="8deg"
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1"
              style={{ width: "100%", height: "100%", minHeight: "300px", "--poster-color": "transparent" } as any}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/40 p-8">
              <Package className="w-12 h-12" />
              <p className="text-sm">No 3D model available</p>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="w-full md:w-72 p-6 overflow-y-auto" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 className="text-lg font-bold text-white mb-1">{design.name}</h2>
          <p className="text-xs text-white/40 mb-4">Customer Design</p>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Customer</p>
              <p className="text-white font-medium">{design.userName}</p>
              <p className="text-white/60 text-xs">{design.userEmail}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Product</p>
              <p className="text-white">{design.productName ?? "—"}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Size</p>
                <p className="text-white">{design.size}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Color</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: design.color }} />
                  <span className="text-white text-xs">{design.color}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-white text-xs">{new Date(design.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Material Colors */}
          {parsedDesign.matColors?.length > 0 && (
            <div className="mt-5">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Material Colors</p>
              <div className="flex flex-wrap gap-2">
                {parsedDesign.matColors.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
                    <span className="text-white/70 text-[10px] font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset */}
          {parsedDesign.presetName && (
            <div className="mt-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Preset</p>
              <p className="text-white text-sm">{parsedDesign.presetName}</p>
            </div>
          )}

          {/* Garment State */}
          {parsedDesign.garmentState && (
            <div className="mt-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Garment Parts</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(["sleeves","collar","placket","panel","stripe"] as const).map(k => (
                  <div key={k} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <span className="text-white/60 capitalize">{k}</span>
                    <span className={parsedDesign.garmentState?.[k] ? "text-emerald-400" : "text-white/30"}>
                      {parsedDesign.garmentState?.[k] ? "ON" : "off"}
                    </span>
                  </div>
                ))}
                {parsedDesign.garmentState?.pattern && parsedDesign.garmentState.pattern !== "none" && (
                  <div className="col-span-2 flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <span className="text-white/60">Pattern</span>
                    <span className="text-white">{parsedDesign.garmentState.pattern}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Design Elements summary */}
          {parsedDesign.objectCount > 0 && (
            <div className="mt-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Design Elements ({parsedDesign.objectCount})</p>
              <div className="space-y-1 text-xs">
                {parsedDesign.texts?.length > 0 && (
                  <div className="bg-white/5 rounded px-2 py-1.5">
                    <span className="text-white/40">Text: </span>
                    <span className="text-white">{parsedDesign.texts.map((t: string) => `"${t}"`).join(", ")}</span>
                  </div>
                )}
                {parsedDesign.logoCount > 0 && (
                  <div className="bg-white/5 rounded px-2 py-1">
                    <span className="text-white/40">Logos / Images: </span>
                    <span className="text-white">{parsedDesign.logoCount}</span>
                  </div>
                )}
                {parsedDesign.shapeCount > 0 && (
                  <div className="bg-white/5 rounded px-2 py-1">
                    <span className="text-white/40">Shapes: </span>
                    <span className="text-white">{parsedDesign.shapeCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3-view snapshot strip */}
          {(design.frontImageUrl || design.backImageUrl || design.sideImageUrl) && (
            <div className="mt-5">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Design Snapshots</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Front", url: design.frontImageUrl },
                  { label: "Back",  url: design.backImageUrl  },
                  { label: "Side",  url: design.sideImageUrl  },
                ].map(({ label, url }) => (
                  <div key={label}>
                    <p className="text-white/30 text-[9px] text-center mb-1 uppercase tracking-widest">{label}</p>
                    <div className="rounded overflow-hidden border border-white/10 bg-black/40 aspect-square flex items-center justify-center">
                      {url
                        ? <img src={url} alt={`${label} view`} className="w-full h-full object-contain" />
                        : <span className="text-white/20 text-[10px]">—</span>
                      }
                    </div>
                    {url && (
                      <a
                        href={url}
                        download={`${design.name}-${label.toLowerCase()}.png`}
                        className="block text-center text-[9px] text-white/30 hover:text-white/60 mt-1 transition-colors"
                        title={`Download ${label} view`}
                      >↓ save</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback: legacy single preview + flat texture */}
          {!design.frontImageUrl && (design.previewImageUrl || parsedDesign.textureUrl) && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {design.previewImageUrl && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">3D Preview</p>
                  <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40">
                    <img src={design.previewImageUrl} alt="3D Preview" className="w-full aspect-square object-contain" />
                  </div>
                </div>
              )}
              {parsedDesign.textureUrl && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Flat Texture</p>
                  <div className="rounded-lg overflow-hidden border border-white/10" style={{ background: parsedDesign.canvasBg ?? "#222" }}>
                    <img src={parsedDesign.textureUrl} alt="Flat Texture" className="w-full aspect-square object-contain" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flat Texture always shown when 3-view is available */}
          {design.frontImageUrl && parsedDesign.textureUrl && (
            <div className="mt-3">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Flat Texture</p>
              <div className="rounded-lg overflow-hidden border border-white/10" style={{ background: parsedDesign.canvasBg ?? "#222" }}>
                <img src={parsedDesign.textureUrl} alt="Flat Texture" className="w-full aspect-square object-contain" />
              </div>
            </div>
          )}

          {!design.frontImageUrl && !design.previewImageUrl && !parsedDesign.textureUrl && (
            <div className="mt-5 p-4 rounded-lg border border-white/10 text-center">
              <p className="text-white/40 text-xs">No canvas design saved yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modelFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "orders" | "users" | "designs" | "site" | "skuassets">("dashboard");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [uploadingHeroIdx, setUploadingHeroIdx] = useState<number | null>(null);
  const [heroImageUrls, setHeroImageUrls] = useState<(string | null)[]>([null, null, null, null]);
  const [viewingDesign, setViewingDesign] = useState<UserDesign | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // SKU Assets form state
  const skuAssetFileRef = useRef<HTMLInputElement>(null);
  const [skuAssetForm, setSkuAssetForm] = useState({ sku: "", assetType: "print" as "print" | "pattern" | "solid_colour" });
  const [uploadingSkuAsset, setUploadingSkuAsset] = useState(false);

  useEffect(() => {
    if (!user) return;
    getToken().then(async (token) => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${getApiUrl()}/api/admin/check`, { headers });
        setIsAdmin(res.ok);
      } catch { setIsAdmin(false); }
    });
  }, [user]);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch("/api/admin/products"),
    enabled: isAdmin === true,
  });

  const { data: designs = [], isLoading: loadingDesigns } = useQuery<UserDesign[]>({
    queryKey: ["admin-designs"],
    queryFn: () => apiFetch("/api/admin/customizations"),
    enabled: isAdmin === true && activeTab === "designs",
  });

  const { data: siteSettings } = useQuery<Record<string, unknown>>({
    queryKey: ["site-settings"],
    queryFn: () => apiFetch("/api/site-settings"),
    enabled: isAdmin === true,
  });

  const { data: skuAssets = [], isLoading: loadingSkuAssets } = useQuery<{
    id: number; sku: string; assetType: string; fileUrl: string; fileName: string; createdAt: string;
  }[]>({
    queryKey: ["admin-sku-assets"],
    queryFn: () => apiFetch("/api/admin/sku-assets"),
    enabled: isAdmin === true && activeTab === "skuassets",
  });

  const { data: hiddenPatternsData, refetch: refetchHidden } = useQuery<{ hiddenPatterns: string[] }>({
    queryKey: ["admin-hidden-patterns"],
    queryFn: () => apiFetch("/api/admin/site-settings/hidden-patterns"),
    enabled: isAdmin === true && activeTab === "skuassets",
  });
  const hiddenPatterns: string[] = hiddenPatternsData?.hiddenPatterns ?? [];
  const [savingHidden, setSavingHidden] = useState(false);

  async function togglePattern(id: string) {
    const next = hiddenPatterns.includes(id)
      ? hiddenPatterns.filter(x => x !== id)
      : [...hiddenPatterns, id];
    setSavingHidden(true);
    try {
      await apiFetch("/api/admin/site-settings/hidden-patterns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenPatterns: next }),
      });
      await refetchHidden();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingHidden(false); }
  }

  useEffect(() => {
    if (!siteSettings?.hero_banners) return;
    const banners = siteSettings.hero_banners as { slideIndex: number; imageUrl: string }[];
    const urls: (string | null)[] = [null, null, null, null];
    for (const b of banners) {
      if (b.slideIndex >= 0 && b.slideIndex < 4) urls[b.slideIndex] = b.imageUrl;
    }
    setHeroImageUrls(urls);
  }, [siteSettings]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product created" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => apiFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product updated" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteDesignMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/customizations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-designs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast({ title: "Design deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(false); };

  const startEdit = (p: Product) => {
    setForm({
      ...p,
      priceText: (p.priceInPaise / 100).toFixed(2),
      thumbnailUrl: p.thumbnailUrl ?? "",
      additionalImages: p.additionalImages ?? "",
      gender: p.gender ?? "",
      subType: p.subType ?? "",
      sku: p.sku ?? "",
      stock: p.stock ?? 100,
    });
    setEditingId(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    const data = { ...form, priceInPaise: Math.round(parseFloat(form.priceText || "0") * 100) };
    if (!data.name || !data.modelUrl) { toast({ title: "Name and Model URL are required", variant: "destructive" }); return; }
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingModel(true);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append("model", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/model`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, modelUrl: url }));
      toast({ title: "Model uploaded" });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingModel(false); if (e.target) e.target.value = ""; }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const token = await getToken();
      const { compressImage } = await import("@/lib/imageCompression");
      const compressed = await compressImage(file, { maxPx: 1200, quality: 0.82 });
      const fd = new FormData(); fd.append("thumbnail", compressed);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/thumbnail`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, thumbnailUrl: url }));
      const savedKB = Math.round((file.size - compressed.size) / 1024);
      toast({ title: "Thumbnail uploaded", description: savedKB > 0 ? `Compressed by ${savedKB} KB` : undefined });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingThumb(false); if (e.target) e.target.value = ""; }
  };

  function safeParseImages(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string");
      if (typeof parsed === "string" && parsed.startsWith("http")) return [parsed];
      return [];
    } catch {
      if (raw.startsWith("http")) return [raw];
      return [];
    }
  }

  const handleExtraImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingExtra(true);
    try {
      const token = await getToken();
      const { compressImages } = await import("@/lib/imageCompression");
      const compressed = await compressImages(files, { maxPx: 1200, quality: 0.82 });
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const urls: string[] = [];
      for (const file of compressed) {
        const fd = new FormData(); fd.append("thumbnail", file);
        const res = await fetch(`${getApiUrl()}/api/admin/upload/thumbnail`, { method: "POST", body: fd, headers });
        if (!res.ok) throw new Error(await res.text());
        const { url } = await res.json();
        urls.push(url);
      }
      setForm(f => {
        const existing = safeParseImages(f.additionalImages);
        return { ...f, additionalImages: JSON.stringify([...existing, ...urls]) };
      });
      toast({ title: `${urls.length} image${urls.length > 1 ? "s" : ""} uploaded` });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingExtra(false); if (e.target) e.target.value = ""; }
  };

  const handleHeroUpload = async (slideIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeroIdx(slideIndex);
    try {
      const token = await getToken();
      const { compressImage } = await import("@/lib/imageCompression");
      const compressed = await compressImage(file, { maxPx: 1920, quality: 0.80 });
      const fd = new FormData(); fd.append("hero", compressed);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/hero`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      const newUrls = [...heroImageUrls];
      newUrls[slideIndex] = url;
      setHeroImageUrls(newUrls);
      const banners = newUrls
        .map((imageUrl, idx) => (imageUrl ? { slideIndex: idx, imageUrl } : null))
        .filter((b): b is { slideIndex: number; imageUrl: string } => b !== null);
      await fetch(`${getApiUrl()}/api/admin/site-settings/hero-banners`, {
        method: "PUT",
        body: JSON.stringify({ banners }),
        headers: { ...headers, "Content-Type": "application/json" },
      });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      const savedKB = Math.round((file.size - compressed.size) / 1024);
      toast({ title: `Slide ${slideIndex + 1} updated`, description: savedKB > 0 ? `Compressed by ${savedKB} KB` : undefined });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingHeroIdx(null); if (e.target) e.target.value = ""; }
  };

  const removeExtraImage = (idx: number) => {
    setForm(f => {
      const imgs = safeParseImages(f.additionalImages);
      imgs.splice(idx, 1);
      return { ...f, additionalImages: imgs.length ? JSON.stringify(imgs) : "" };
    });
  };

  // ── Loading / Access Guards ──
  if (!isLoaded || isAdmin === null) {
    return <Layout><div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div></Layout>;
  }

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <ShieldCheck className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-4xl font-serif">Sign in Required</h1>
          <p className="text-muted-foreground">Please sign in to access the admin panel.</p>
          <a href="/sign-in" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary transition-colors pb-1">SIGN IN</a>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-4xl font-serif">Admin Access Required</h1>
          <p className="text-muted-foreground max-w-md">You do not have permission to access this page. Contact your administrator to grant access.</p>
          <a href="/" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary pb-1">RETURN TO COLLECTION</a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-serif tracking-wider">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Signed in as {user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-8">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3, count: 0 },
            { id: "products", label: "Products", icon: Package, count: products.length },
            { id: "orders", label: "Orders", icon: ShoppingBag, count: 0 },
            { id: "users", label: "Users", icon: UserCog, count: 0 },
            { id: "designs", label: "Designs", icon: Users, count: designs.length },
            { id: "site", label: "Site", icon: ImageIcon, count: 0 },
            { id: "skuassets", label: "SKU Assets", icon: Upload, count: skuAssets.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {activeTab === "dashboard" && <AdminDashboard />}
        {activeTab === "orders" && <AdminOrders />}
        {activeTab === "users" && <AdminUsers />}

        {activeTab === "products" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">All Products</h2>
              <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-none text-xs tracking-widest">
                <Plus className="w-4 h-4" /> ADD PRODUCT
              </Button>
            </div>

            {/* Form */}
            {showForm && (
              <div className="border border-border mb-8 p-6 bg-card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold">{editingId ? "Edit Product" : "New Product"}</h3>
                  <button onClick={resetForm}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Product Name *</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Signature Polo" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="h-10 border border-input bg-background px-3 text-sm rounded-none">
                      {["polo", "shorts", "trousers", "jacket", "t-shirt", "hoodie", "accessories"].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Gender</label>
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="h-10 border border-input bg-background px-3 text-sm rounded-none">
                      <option value="">— Any —</option>
                      <option value="men">Men</option>
                      <option value="women">Women</option>
                      <option value="kids">Kids</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Sub Type (Customiser)</label>
                    <select value={form.subType} onChange={e => setForm(f => ({ ...f, subType: e.target.value }))} className="h-10 border border-input bg-background px-3 text-sm rounded-none">
                      <option value="">— Not Set —</option>
                      <option value="solid">Solid (colours only)</option>
                      <option value="printed">Printed (print library)</option>
                      <option value="pattern">Pattern (GT geometric)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">SKU</label>
                    <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. KS-POLO-001" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Stock Units</label>
                    <Input type="number" min={0} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} placeholder="100" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Description *</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the product..." rows={3} className="border border-input bg-background px-3 py-2 text-sm rounded-none resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Price (₹) *</label>
                    <Input type="number" value={form.priceText} onChange={e => setForm(f => ({ ...f, priceText: e.target.value }))} placeholder="e.g. 12500" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Default Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.defaultColor} onChange={e => setForm(f => ({ ...f, defaultColor: e.target.value }))} className="w-10 h-10 cursor-pointer border border-input rounded-none p-0" />
                      <span className="text-sm text-muted-foreground">{form.defaultColor}</span>
                    </div>
                  </div>

                  {/* 3D Model Upload */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">3D Model (.glb / .gltf) *</label>
                    <div className="flex gap-2">
                      <Input value={form.modelUrl} onChange={e => setForm(f => ({ ...f, modelUrl: e.target.value }))} placeholder="Paste URL or upload .glb file →" className="rounded-none flex-1 text-sm" />
                      <label className="cursor-pointer shrink-0">
                        <div className={`h-10 px-4 flex items-center gap-2 border border-input text-sm font-medium transition-colors ${uploadingModel ? "opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                          {uploadingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>Upload .glb</span>
                        </div>
                        <input ref={modelFileRef} type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="hidden" disabled={uploadingModel} />
                      </label>
                    </div>
                    {form.modelUrl && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> {form.modelUrl.split("/").pop()}</p>
                    )}
                  </div>

                  {/* Thumbnail Upload */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Product Thumbnail Image</label>
                    <div className="flex gap-2">
                      <Input value={form.thumbnailUrl || ""} onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="Paste image URL or upload →" className="rounded-none flex-1 text-sm" />
                      <label className="cursor-pointer shrink-0">
                        <div className={`h-10 px-4 flex items-center gap-2 border border-input text-sm font-medium transition-colors ${uploadingThumb ? "opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                          {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>Upload Image</span>
                        </div>
                        <input ref={thumbFileRef} type="file" accept="image/*" onChange={handleThumbUpload} className="hidden" disabled={uploadingThumb} />
                      </label>
                    </div>
                    {form.thumbnailUrl && (
                      <img src={getAssetUrl(form.thumbnailUrl)} alt="Thumbnail" className="h-24 w-24 object-cover border border-input mt-1" />
                    )}
                  </div>

                  {/* Additional Images Upload */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Additional Gallery Images</label>
                    <p className="text-xs text-muted-foreground">These appear as clickable thumbnails below the main product image on the product page.</p>
                    <label className="cursor-pointer w-fit">
                      <div className={`h-10 px-4 flex items-center gap-2 border border-input text-sm font-medium transition-colors ${uploadingExtra ? "opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                        {uploadingExtra ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>Upload Additional Images</span>
                      </div>
                      <input type="file" accept="image/*" multiple onChange={handleExtraImageUpload} className="hidden" disabled={uploadingExtra} />
                    </label>
                    {(() => {
                      const imgs = safeParseImages(form.additionalImages);
                      return imgs.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {imgs.map((url, idx) => (
                            <div key={idx} className="relative group">
                              <img src={url} alt={`Extra ${idx + 1}`} className="h-20 w-20 object-cover border border-input" />
                              <button
                                type="button"
                                onClick={() => removeExtraImage(idx)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Availability</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4" />
                      <span className="text-sm">Product is live and purchasable</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                  <Button variant="outline" onClick={resetForm} className="rounded-none text-xs tracking-widest">CANCEL</Button>
                  <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="rounded-none text-xs tracking-widest flex items-center gap-2">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? "SAVE CHANGES" : "CREATE PRODUCT"}
                  </Button>
                </div>
              </div>
            )}

            {/* Products Table */}
            {loadingProducts ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-none">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No products yet.</p>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-3 text-sm underline text-primary">Add your first product</button>
              </div>
            ) : (
              <div className="border border-border overflow-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/30">
                    <tr>
                      {["#", "Product", "Category", "Price", "Status", "3D Model", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={`border-t border-border ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.thumbnailUrl
                              ? <img src={getAssetUrl(p.thumbnailUrl)} alt="" className="w-10 h-10 object-cover border border-border shrink-0" />
                              : <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 text-[9px] font-bold text-muted-foreground">IMG</div>
                            }
                            <div>
                              <p className="font-semibold leading-tight">{p.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{p.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{p.category}</td>
                        <td className="px-4 py-3 font-medium">{formatPrice(p.priceInPaise)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-1 tracking-wider font-semibold ${p.available ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            {p.available ? "LIVE" : "HIDDEN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <a href={p.modelUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline hover:no-underline truncate block">
                            {p.modelUrl.split("/").pop() || "View"}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEdit(p)} className="p-1 hover:text-primary transition-colors" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id); }} className="p-1 hover:text-red-500 transition-colors" title="Delete" disabled={deleteMutation.isPending}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── USER DESIGNS TAB ── */}
        {activeTab === "designs" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Customer Designs</h2>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-designs"] })} className="text-xs text-muted-foreground hover:text-foreground underline">Refresh</button>
            </div>

            {loadingDesigns ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>
            ) : designs.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No customer designs yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Designs appear here when customers customize and save products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {designs.map(d => (
                  <div key={d.id} className="border border-border bg-card flex flex-col overflow-hidden hover:border-primary transition-colors group">
                    {/* Preview — prefer front-view snapshot, fall back to legacy preview, then product thumb */}
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {(d.frontImageUrl || d.previewImageUrl) ? (
                        <img src={d.frontImageUrl ?? d.previewImageUrl!} alt={d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : d.productThumbnailUrl ? (
                        <img src={d.productThumbnailUrl} alt={d.name} className="w-full h-full object-cover opacity-50" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs font-bold">NO PREVIEW</div>
                      )}
                      {(d.frontImageUrl || d.previewImageUrl) && (
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] px-2 py-0.5 tracking-wider font-semibold">CUSTOMIZED</span>
                      )}
                      {/* 3-view indicator badge */}
                      {d.frontImageUrl && d.backImageUrl && d.sideImageUrl && (
                        <span className="absolute top-2 right-2 bg-black/60 text-white/70 text-[8px] px-1.5 py-0.5 rounded tracking-wider">3-VIEW</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.productName ?? "Unknown product"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" style={{ background: d.color }} />
                        <span>Size {d.size}</span>
                        <span>·</span>
                        <span className="truncate">{d.userEmail}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">{new Date(d.updatedAt).toLocaleDateString()}</p>
                      <div className="mt-auto flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none text-[10px] tracking-widest flex-1 flex items-center justify-center gap-2"
                          onClick={() => setViewingDesign(d)}
                        >
                          <Eye className="w-3 h-3" /> VIEW
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none text-[10px] tracking-widest flex items-center justify-center gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-300"
                          title="Export part colour PNGs"
                          onClick={() => exportPartPNGs(d)}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none text-[10px] tracking-widest flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                          title="Delete this customer design"
                          disabled={deleteDesignMutation.isPending && deleteDesignMutation.variables === d.id}
                          onClick={() => {
                            if (confirm(`Delete design "${d.name}" by ${d.userEmail ?? "this customer"}? This cannot be undone.`)) {
                              deleteDesignMutation.mutate(d.id);
                            }
                          }}
                        >
                          {deleteDesignMutation.isPending && deleteDesignMutation.variables === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          {deleteDesignMutation.isPending && deleteDesignMutation.variables === d.id ? "DELETING" : "DELETE"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

        {/* ── SITE TAB ── */}
        {activeTab === "site" && (
          <div>
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-1">Hero Banners</h2>
              <p className="text-sm text-muted-foreground">Upload optimised images for the homepage carousel. Images are automatically compressed and converted to WebP before being saved to the CDN.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                "Men's Collection (Slide 1)",
                "Men's T-Shirts (Slide 2)",
                "Women's Collection (Slide 3)",
                "All Products (Slide 4)",
              ].map((label, idx) => {
                const currentUrl = heroImageUrls[idx];
                const isUploading = uploadingHeroIdx === idx;
                const inputId = `hero-upload-${idx}`;
                return (
                  <div key={idx} className="border border-border rounded-sm overflow-hidden">
                    <div className="relative bg-[#F2F3F7]" style={{ aspectRatio: "16/9" }}>
                      {currentUrl ? (
                        <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground">No image set</span>
                        </div>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-[#B8925A]" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-between gap-3 bg-white border-t border-border">
                      <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
                      <label htmlFor={inputId} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border border-input font-medium cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none" : "hover:bg-accent"}`}>
                        <Upload className="w-3 h-3" />
                        {currentUrl ? "Replace" : "Upload"}
                      </label>
                      <input
                        id={inputId}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => handleHeroUpload(idx, e)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Recommended: landscape photos, minimum 1920×1080 px. The system resizes and converts to WebP automatically.</p>
          </div>
        )}

        {/* ── SKU ASSETS TAB ── */}
        {activeTab === "skuassets" && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1">SKU Asset Manager</h2>
              <p className="text-sm text-muted-foreground">
                Upload print, pattern, or solid-colour assets tied to a specific product SKU.
                These assets are served to the customiser to drive the design flow.
              </p>
            </div>

            {/* ── GP Print Library Manager ── */}
            <div className="border border-border rounded-sm p-5 mb-8 bg-card">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold tracking-wide">GP Print Library</h3>
                <span className="text-xs text-muted-foreground">{hiddenPatterns.length} hidden · {PATTERNS.length - hiddenPatterns.length} visible</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Toggle any print to hide it from the customiser. Changes take effect immediately for customers.</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3">
                {PATTERNS.map(p => {
                  const isHidden = hiddenPatterns.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={savingHidden}
                      onClick={() => togglePattern(p.id)}
                      title={isHidden ? `Show ${p.label}` : `Hide ${p.label}`}
                      className={`relative flex flex-col items-center gap-1.5 p-1.5 rounded border transition-all ${
                        isHidden
                          ? "border-destructive/40 bg-destructive/5 opacity-50"
                          : "border-border hover:border-primary bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="relative w-full aspect-square overflow-hidden rounded-sm bg-muted">
                        <img
                          src={patternUrl(p.file)}
                          alt={p.label}
                          className="w-full h-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
                        />
                        {isHidden && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <X className="w-4 h-4 text-destructive" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium tracking-wide leading-none">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upload form */}
            <div className="border border-border rounded-sm p-5 mb-8 bg-card">
              <h3 className="text-sm font-semibold tracking-wide mb-4">Upload New Asset</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Product SKU</label>
                  <Input
                    value={skuAssetForm.sku}
                    onChange={e => setSkuAssetForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    placeholder="e.g. KS1000BGP001"
                    className="rounded-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Asset Type</label>
                  <select
                    value={skuAssetForm.assetType}
                    onChange={e => setSkuAssetForm(f => ({ ...f, assetType: e.target.value as any }))}
                    className="w-full h-9 border border-input bg-background px-3 text-xs rounded-none"
                  >
                    <option value="print">Print</option>
                    <option value="pattern">Pattern</option>
                    <option value="solid_colour">Solid Colour</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">File (image / texture)</label>
                  <input
                    ref={skuAssetFileRef}
                    type="file"
                    accept="image/*,.glb,.gltf"
                    className="w-full h-9 text-xs file:mr-2 file:py-1 file:px-3 file:border-0 file:bg-muted file:text-xs file:font-medium cursor-pointer"
                  />
                </div>
              </div>
              <Button
                disabled={uploadingSkuAsset || !skuAssetForm.sku.trim()}
                onClick={async () => {
                  const file = skuAssetFileRef.current?.files?.[0];
                  if (!file || !skuAssetForm.sku.trim()) return;
                  setUploadingSkuAsset(true);
                  try {
                    const fd = new FormData();
                    fd.append("sku", skuAssetForm.sku.trim());
                    fd.append("assetType", skuAssetForm.assetType);
                    fd.append("file", file);
                    await apiFetch("/api/admin/sku-assets", { method: "POST", body: fd });
                    queryClient.invalidateQueries({ queryKey: ["admin-sku-assets"] });
                    setSkuAssetForm({ sku: "", assetType: "print" });
                    if (skuAssetFileRef.current) skuAssetFileRef.current.value = "";
                    toast({ title: "Asset uploaded", description: `${skuAssetForm.sku} · ${skuAssetForm.assetType}` });
                  } catch (e: any) {
                    toast({ title: "Upload failed", description: e.message, variant: "destructive" });
                  } finally {
                    setUploadingSkuAsset(false);
                  }
                }}
                className="rounded-none text-xs tracking-widest"
              >
                {uploadingSkuAsset ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />Uploading…</> : <><Upload className="w-3 h-3 mr-2" />UPLOAD ASSET</>}
              </Button>
            </div>

            {/* Asset list */}
            {loadingSkuAssets ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : skuAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No assets uploaded yet.</div>
            ) : (
              <div className="border border-border rounded-sm overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">SKU</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">File</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Preview</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Uploaded</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuAssets.map(a => (
                      <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-semibold text-primary">{a.sku}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            a.assetType === "print" ? "bg-blue-50 text-blue-700" :
                            a.assetType === "pattern" ? "bg-amber-50 text-amber-700" :
                            "bg-emerald-50 text-emerald-700"
                          }`}>
                            {a.assetType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate">{a.fileName}</td>
                        <td className="px-4 py-2.5">
                          {/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(a.fileName) ? (
                            <img src={a.fileUrl} alt={a.sku} className="w-10 h-10 object-cover rounded border border-border" />
                          ) : (
                            <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">View</a>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete asset for SKU ${a.sku}?`)) return;
                              try {
                                await apiFetch(`/api/admin/sku-assets/${a.id}`, { method: "DELETE" });
                                queryClient.invalidateQueries({ queryKey: ["admin-sku-assets"] });
                                toast({ title: "Asset deleted" });
                              } catch (e: any) {
                                toast({ title: "Error", description: e.message, variant: "destructive" });
                              }
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Design Viewer Modal */}
      {viewingDesign && (
        <DesignViewerModal design={viewingDesign} onClose={() => setViewingDesign(null)} />
      )}
    </Layout>
  );
}
