import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  type LookbookOutfit,
} from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Save, X, CheckCircle, Heart, Plus, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

const GOLD = "#B8925A";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";
const CANVAS_BG = "#EDE9E3";

type CanvasItem = {
  id: string;
  productId: number;
  name: string;
  thumbnailUrl: string;
  x: number;
  y: number;
  width: number;
  defaultWidth: number;
  bgRemoved?: boolean;
};

type DragState = {
  itemId: string;
  startMouseX: number;
  startMouseY: number;
  startItemX: number;
  startItemY: number;
} | null;

// ── Background removal — corner sampling + near-white detection ──────────────
async function stripBackground(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("img load failed"));
    img.src = src;
  });

  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const w = c.width;
  const h = c.height;

  // Sample 8×8 corner squares + every 3rd border pixel for reliable BG color
  const samples: [number, number, number][] = [];
  const CS = Math.max(4, Math.min(8, Math.floor(Math.min(w, h) / 12)));
  const corners: [number, number][] = [[0, 0], [w - CS, 0], [0, h - CS], [w - CS, h - CS]];
  for (const [bx, by] of corners) {
    for (let cy = 0; cy < CS; cy++) {
      for (let cx = 0; cx < CS; cx++) {
        const idx = ((by + cy) * w + (bx + cx)) * 4;
        if (idx >= 0 && idx + 3 < p.length && p[idx + 3] > 0)
          samples.push([p[idx], p[idx + 1], p[idx + 2]]);
      }
    }
  }
  for (let x = 0; x < w; x += 3) {
    samples.push([p[(0*w+x)*4], p[(0*w+x)*4+1], p[(0*w+x)*4+2]]);
    samples.push([p[((h-1)*w+x)*4], p[((h-1)*w+x)*4+1], p[((h-1)*w+x)*4+2]]);
  }
  for (let y = 0; y < h; y += 3) {
    samples.push([p[(y*w)*4], p[(y*w)*4+1], p[(y*w)*4+2]]);
    samples.push([p[(y*w+w-1)*4], p[(y*w+w-1)*4+1], p[(y*w+w-1)*4+2]]);
  }

  const n = samples.length || 1;
  const bgR = samples.reduce((s, v) => s + v[0], 0) / n;
  const bgG = samples.reduce((s, v) => s + v[1], 0) / n;
  const bgB = samples.reduce((s, v) => s + v[2], 0) / n;

  // Calibrate tolerance based on how light the background is
  const isWhiteBg = bgR > 230 && bgG > 230 && bgB > 230;
  const isLightBg = bgR > 185 && bgG > 185 && bgB > 185;
  const HARD_TOL = isWhiteBg ? 88 : isLightBg ? 68 : 55;
  const SOFT_TOL = isWhiteBg ? 125 : isLightBg ? 98 : 82;

  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2];

    // Always remove near-pure-white for light-background images
    if (isLightBg && r > 242 && g > 242 && b > 242) { p[i + 3] = 0; continue; }

    const dist = Math.max(Math.abs(r - bgR), Math.abs(g - bgG), Math.abs(b - bgB));
    if (dist < HARD_TOL) {
      p[i + 3] = 0;
    } else if (dist < SOFT_TOL) {
      p[i + 3] = Math.round(((dist - HARD_TOL) / (SOFT_TOL - HARD_TOL)) * 255);
    }
  }

  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

export default function LookbookPage() {
  useEffect(() => { document.title = "Lookbook — Ka.Sha"; }, []);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [outfitName, setOutfitName] = useState("My Outfit");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");
  const [hoveredCanvasItem, setHoveredCanvasItem] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [strippingIds, setStrippingIds] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  // Saved products = products that are in the user's saved list
  const savedProducts = useMemo(() => {
    const idSet = new Set(savedIds);
    return allProducts.filter(p => idSet.has(p.id)).map(p => ({
      productId: p.id,
      name: p.name,
      thumbnailUrl: p.thumbnailUrl ?? "",
    }));
  }, [savedIds, allProducts]);

  // ── Canvas logic ──────────────────────────────────────────────────────────
  const addToCanvas = useCallback(async (product: { productId: number; name: string; thumbnailUrl: string }) => {
    setStrippingIds(prev => new Set(prev).add(product.productId));

    let finalUrl: string = getAssetUrl(product.thumbnailUrl) ?? product.thumbnailUrl;
    let bgRemoved = false;
    try {
      finalUrl = await stripBackground(finalUrl);
      bgRemoved = true;
    } catch {
      finalUrl = getAssetUrl(product.thumbnailUrl) ?? product.thumbnailUrl;
      bgRemoved = false;
    } finally {
      setStrippingIds(prev => {
        const next = new Set(prev);
        next.delete(product.productId);
        return next;
      });
    }

    setCanvasItems(prev => {
      const offset = prev.length * 24;
      return [...prev, {
        id: `${product.productId}-${Date.now()}`,
        productId: product.productId,
        name: product.name,
        thumbnailUrl: finalUrl,
        x: Math.min(60 + offset, 280),
        y: Math.min(24 + offset, 160),
        width: 170,
        defaultWidth: 170,
        bgRemoved,
      }];
    });
  }, []);

  const removeFromCanvas = useCallback((id: string) => {
    setCanvasItems(prev => prev.filter(item => item.id !== id));
    setSelectedItemId(prev => prev === id ? null : prev);
  }, []);

  const resizeItem = useCallback((id: string, delta: number) => {
    setCanvasItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, width: Math.max(60, Math.min(460, item.width + delta)) }
        : item
    ));
  }, []);

  const resetItem = useCallback((id: string) => {
    setCanvasItems(prev => prev.map(item =>
      item.id === id ? { ...item, width: item.defaultWidth } : item
    ));
  }, []);

  const fitItem = useCallback((id: string) => {
    if (!canvasRef.current) return;
    const canvasH = canvasRef.current.clientHeight;
    const targetH = Math.round(canvasH * 0.72);
    setCanvasItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const imgEl = document.querySelector<HTMLImageElement>(`[data-item-id="${id}"] img`);
      const naturalW = imgEl?.naturalWidth || 1;
      const naturalH = imgEl?.naturalHeight || 1;
      const newWidth = Math.round(targetH * (naturalW / naturalH));
      return { ...item, width: Math.max(60, Math.min(460, newWidth)) };
    }));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = canvasItems.find(i => i.id === itemId);
    if (!item) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ itemId, startMouseX: e.clientX, startMouseY: e.clientY, startItemX: item.x, startItemY: item.y });
    setSelectedItemId(itemId);
    // Bring to front
    setCanvasItems(prev => {
      const idx = prev.findIndex(i => i.id === itemId);
      if (idx < 0) return prev;
      return [...prev.filter(i => i.id !== itemId), prev[idx]];
    });
  }, [canvasItems]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState || !canvasRef.current) return;
    const canvas = canvasRef.current.getBoundingClientRect();
    const dx = e.clientX - dragState.startMouseX;
    const dy = e.clientY - dragState.startMouseY;
    setCanvasItems(prev => prev.map(item =>
      item.id === dragState.itemId
        ? {
            ...item,
            x: Math.max(0, Math.min(canvas.width - item.width, dragState.startItemX + dx)),
            y: Math.max(0, Math.min(canvas.height - 60, dragState.startItemY + dy)),
          }
        : item
    ));
  }, [dragState]);

  const handlePointerUp = useCallback(() => setDragState(null), []);

  const handleSave = async () => {
    if (canvasItems.length === 0 || createOutfit.isPending) return;
    await createOutfit.mutateAsync({
      data: {
        name: outfitName.trim() || "My Outfit",
        items: canvasItems.map(i => ({
          productId: i.productId, name: i.name,
          thumbnailUrl: i.thumbnailUrl, x: i.x, y: i.y, width: i.width,
        })),
      },
    });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const loadOutfit = (outfit: LookbookOutfit) => {
    setCanvasItems((outfit.items as CanvasItem[]).map(i => ({
      ...i,
      id: `${i.productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      defaultWidth: i.defaultWidth ?? i.width,
    })));
    setOutfitName(outfit.name);
    setSelectedItemId(null);
    setActiveTab("builder");
  };

  const handleDeleteOutfit = async (id: number) => {
    await deleteOutfit.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
  };

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
          Curate &nbsp;·&nbsp; Style &nbsp;·&nbsp; Inspire
        </p>
        <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", maxWidth: 500, margin: "0 auto" }}>
          Tap the ♡ on any product to save it here, then drag pieces onto the canvas to build your perfect outfit.
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
                Outfit Planner
              </h2>
              <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.42)", letterSpacing: "0.1em" }}>
                Save your favourite pieces with ♡, then drag them onto the canvas to build looks
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
                  {tab === "builder" ? "Outfit Canvas" : `Saved Looks (${savedOutfits.length})`}
                </button>
              ))}
            </div>

            {/* ── Builder tab ── */}
            {activeTab === "builder" && (
              <>
                {/* Empty state: no saved products */}
                {!savedLoading && savedProducts.length === 0 && (
                  <div style={{
                    textAlign: "center", padding: "72px 24px",
                    background: "#fff", border: "1px dashed rgba(184,146,90,0.35)",
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "rgba(184,146,90,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 20px",
                    }}>
                      <Heart size={28} color="rgba(184,146,90,0.5)" />
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: "#0A0A0A", marginBottom: 10 }}>
                      Your Lookbook is empty
                    </p>
                    <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.42)", letterSpacing: "0.12em", marginBottom: 28, maxWidth: 400, margin: "0 auto 28px", lineHeight: 1.8 }}>
                      Tap the ♡ icon on any product to save it here.<br />
                      Then drag your pieces onto the canvas to style your look.
                    </p>
                    <Link href="/products">
                      <button style={{
                        fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                        background: GOLD, color: "#fff", border: "none", padding: "13px 40px", cursor: "pointer",
                      }}>
                        Explore the Collection
                      </button>
                    </Link>
                  </div>
                )}

                {/* Loading skeleton */}
                {savedLoading && (
                  <div style={{ height: 320, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: "ka-spin 0.9s linear infinite" }}>
                      <style>{`@keyframes ka-spin { to { transform: rotate(360deg); } }`}</style>
                      <circle cx="14" cy="14" r="10" fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="48" strokeDashoffset="16" strokeLinecap="round" />
                    </svg>
                  </div>
                )}

                {/* Builder layout */}
                {!savedLoading && savedProducts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 20, alignItems: "flex-start" }}>

                    {/* ── Saved Pieces Sidebar / Mobile Strip ── */}
                    {isMobile ? (
                      /* Mobile: horizontal scrollable strip */
                      <div style={{ width: "100%", background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
                        <div style={{
                          padding: "10px 12px 8px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Heart size={11} fill={GOLD} color={GOLD} />
                            <span style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase" }}>My Saved Pieces</span>
                          </div>
                          <Link href="/products" style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                            <Plus size={9} color={GOLD} />
                            <span style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.15em", color: GOLD }}>ADD MORE</span>
                          </Link>
                        </div>
                        <div style={{ display: "flex", gap: 8, padding: "10px 12px", overflowX: "auto", WebkitOverflowScrolling: "touch" as "touch" }}>
                          {savedProducts.map(p => {
                            const isStripping = strippingIds.has(p.productId);
                            return (
                              <button
                                key={p.productId}
                                onClick={() => !isStripping && addToCanvas(p)}
                                disabled={isStripping}
                                style={{
                                  flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                                  gap: 4, padding: "8px 6px", width: 76,
                                  background: "transparent", border: "1px solid rgba(0,0,0,0.07)",
                                  cursor: isStripping ? "not-allowed" : "pointer",
                                  opacity: isStripping ? 0.65 : 1,
                                }}
                              >
                                <div style={{ position: "relative", width: 44, height: 56 }}>
                                  <img src={getAssetUrl(p.thumbnailUrl)} alt={p.name}
                                    style={{ width: 44, height: 56, objectFit: "contain", background: "#F5F2EC" }} />
                                  {isStripping && (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,242,236,0.8)" }}>
                                      <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "ka-spin 0.9s linear infinite" }}>
                                        <circle cx="7" cy="7" r="5" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="24" strokeDashoffset="8" strokeLinecap="round" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontFamily: FONT_UI, fontSize: 7, letterSpacing: "0.06em", color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
                                  {p.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "").slice(0, 12)}
                                </span>
                                <span style={{ fontFamily: FONT_UI, fontSize: 7, color: GOLD, letterSpacing: "0.12em" }}>
                                  {isStripping ? "Loading…" : "+ ADD"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Desktop: vertical sidebar */
                      <div style={{ width: 220, flexShrink: 0, background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
                        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Heart size={12} fill={GOLD} color={GOLD} />
                          <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase" }}>My Saved Pieces</p>
                        </div>
                        <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                          {savedProducts.map(p => {
                            const isStripping = strippingIds.has(p.productId);
                            return (
                              <button
                                key={p.productId}
                                onClick={() => !isStripping && addToCanvas(p)}
                                disabled={isStripping}
                                title={isStripping ? "Removing background…" : "Add to canvas"}
                                style={{
                                  display: "flex", alignItems: "center", gap: 10, padding: "8px",
                                  background: "transparent", border: "1px solid rgba(0,0,0,0.07)",
                                  cursor: isStripping ? "not-allowed" : "pointer",
                                  textAlign: "left", transition: "border-color 0.2s, background 0.2s",
                                  width: "100%", opacity: isStripping ? 0.65 : 1,
                                }}
                                onMouseEnter={e => { if (!isStripping) { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.background = "rgba(184,146,90,0.04)"; } }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.07)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                              >
                                <div style={{ position: "relative", width: 48, height: 60, flexShrink: 0 }}>
                                  <img src={getAssetUrl(p.thumbnailUrl)} alt={p.name}
                                    style={{ width: 48, height: 60, objectFit: "contain", background: "#F5F2EC", display: "block", filter: isStripping ? "grayscale(0.4)" : "none", transition: "filter 0.2s" }} />
                                  {isStripping && (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,242,236,0.75)" }}>
                                      <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "ka-spin 0.9s linear infinite" }}>
                                        <circle cx="8" cy="8" r="6" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.08em", color: "#0A0A0A", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
                                    {p.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}
                                  </p>
                                  {isStripping ? (
                                    <span style={{ fontFamily: FONT_UI, fontSize: 8, color: GOLD, letterSpacing: "0.08em" }}>Removing BG…</span>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                      <Plus size={9} color={GOLD} />
                                      <span style={{ fontFamily: FONT_UI, fontSize: 8, color: GOLD, letterSpacing: "0.15em" }}>ADD TO BOARD</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                          <Link href="/products" style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                            <Heart size={9} color={GOLD} />
                            <span style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.18em", color: GOLD, textTransform: "uppercase" }}>Save More Pieces</span>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* ── Canvas area ── */}
                    <div style={{ flex: 1, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div
                        ref={canvasRef}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onClick={() => setSelectedItemId(null)}
                        style={{
                          position: "relative",
                          height: isMobile ? Math.max(360, Math.min(window.innerWidth - 48, 480)) : 680,
                          background: CANVAS_BG,
                          border: "1px solid rgba(184,146,90,0.22)",
                          overflow: "hidden",
                          userSelect: "none",
                          touchAction: "none",
                        }}
                      >
                        {/* Empty canvas state */}
                        {canvasItems.length === 0 && strippingIds.size === 0 && (
                          <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            flexDirection: "column", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                          }}>
                            <div style={{
                              width: 80, height: 80, borderRadius: "50%",
                              background: "rgba(184,146,90,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
                            }}>
                              <Plus size={28} color="rgba(184,146,90,0.45)" />
                            </div>
                            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: "rgba(0,0,0,0.22)", marginBottom: 6 }}>
                              Your outfit canvas
                            </p>
                            <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.15em", color: "rgba(0,0,0,0.22)", textAlign: "center" }}>
                              Click any piece on the left to add it here
                            </p>
                          </div>
                        )}

                        {/* ── Canvas toolbar — top right, targets selected item ── */}
                        {selectedItemId && canvasItems.find(i => i.id === selectedItemId) && (
                          <div
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            style={{
                              position: "absolute", top: 10, right: isMobile ? 10 : 56,
                              zIndex: 300, display: "flex", alignItems: "center", gap: isMobile ? 10 : 16,
                              background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)",
                              border: "1px solid rgba(0,0,0,0.08)", padding: "5px 12px",
                              borderRadius: 3, boxShadow: "0 2px 10px rgba(0,0,0,0.09)",
                            }}
                          >
                            {[
                              { icon: <ZoomIn size={13} />, label: "ZOOM IN",  action: () => resizeItem(selectedItemId, 24) },
                              { icon: <ZoomOut size={13} />, label: "ZOOM OUT", action: () => resizeItem(selectedItemId, -24) },
                              { icon: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4"/></svg>, label: "FIT", action: () => fitItem(selectedItemId) },
                              { icon: <RotateCcw size={13} />, label: "RESET",   action: () => resetItem(selectedItemId) },
                            ].map(btn => (
                              <button
                                key={btn.label}
                                onClick={btn.action}
                                style={{
                                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                                  background: "transparent", border: "none", cursor: "pointer", padding: "3px 2px",
                                  color: "#0A0A0A",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                                onMouseLeave={e => (e.currentTarget.style.color = "#0A0A0A")}
                              >
                                {btn.icon}
                                {!isMobile && (
                                  <span style={{ fontFamily: FONT_UI, fontSize: 7, letterSpacing: "0.15em", whiteSpace: "nowrap" }}>{btn.label}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ── Right side panel — size slider for selected item ── */}
                        {!isMobile && selectedItemId && (() => {
                          const sel = canvasItems.find(i => i.id === selectedItemId);
                          if (!sel) return null;
                          return (
                            <div
                              onPointerDown={e => e.stopPropagation()}
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
                                background: "#fff", border: "1px solid rgba(0,0,0,0.1)",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.10)", borderRadius: 4, overflow: "hidden",
                              }}
                            >
                              {/* + */}
                              <button
                                onClick={() => resizeItem(sel.id, 24)}
                                style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.07)", cursor: "pointer", fontSize: 18, color: "#0A0A0A" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(184,146,90,0.08)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >+</button>
                              {/* Vertical slider */}
                              <div style={{ width: 36, height: 96, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0", background: "#FAFAF7" }}>
                                <input
                                  type="range" min={60} max={460} value={sel.width}
                                  onChange={e => setCanvasItems(prev => prev.map(i => i.id === sel.id ? { ...i, width: Number(e.target.value) } : i))}
                                  style={{ width: 80, height: 20, transform: "rotate(-90deg)", cursor: "pointer", accentColor: GOLD }}
                                />
                              </div>
                              {/* - */}
                              <button
                                onClick={() => resizeItem(sel.id, -24)}
                                style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(0,0,0,0.07)", cursor: "pointer", fontSize: 18, color: "#0A0A0A" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(184,146,90,0.08)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >−</button>
                              {/* fit */}
                              <button
                                onClick={() => fitItem(sel.id)}
                                style={{ width: 36, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.15em", color: GOLD, textTransform: "lowercase" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(184,146,90,0.08)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >fit</button>
                            </div>
                          );
                        })()}

                        {/* Loading indicator when stripping */}
                        {canvasItems.length === 0 && strippingIds.size > 0 && (
                          <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            flexDirection: "column", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                          }}>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ animation: "ka-spin 0.9s linear infinite", marginBottom: 14 }}>
                              <circle cx="16" cy="16" r="12" fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="56" strokeDashoffset="20" strokeLinecap="round" />
                            </svg>
                            <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", color: GOLD }}>
                              Removing background…
                            </p>
                          </div>
                        )}

                        {/* Canvas items */}
                        {canvasItems.map((item, idx) => {
                          const isActive = hoveredCanvasItem === item.id || selectedItemId === item.id || dragState?.itemId === item.id;
                          const scalePct = Math.round((item.width / (item.defaultWidth || 190)) * 100);
                          return (
                            <div
                              key={item.id}
                              data-item-id={item.id}
                              onPointerDown={e => handlePointerDown(e, item.id)}
                              onMouseEnter={() => setHoveredCanvasItem(item.id)}
                              onMouseLeave={() => setHoveredCanvasItem(null)}
                              style={{
                                position: "absolute",
                                left: item.x,
                                top: item.y,
                                width: item.width,
                                cursor: dragState?.itemId === item.id ? "grabbing" : "grab",
                                zIndex: dragState?.itemId === item.id ? 100 : selectedItemId === item.id ? 50 : idx + 1,
                                filter: item.bgRemoved && isActive
                                  ? "drop-shadow(0 8px 22px rgba(0,0,0,0.20))"
                                  : item.bgRemoved
                                    ? "drop-shadow(0 3px 10px rgba(0,0,0,0.10))"
                                    : "none",
                                transition: dragState?.itemId === item.id ? "none" : "filter 0.2s",
                                outline: selectedItemId === item.id ? `2px solid ${GOLD}` : "2px solid transparent",
                                outlineOffset: -1,
                              }}
                            >
                              <img
                                src={item.thumbnailUrl}
                                alt={item.name}
                                draggable={false}
                                style={{
                                  width: "100%", display: "block",
                                  objectFit: "contain",
                                  pointerEvents: "none",
                                  mixBlendMode: item.bgRemoved ? "normal" : "multiply",
                                }}
                              />

                              {/* Remove button — top right */}
                              <button
                                onPointerDown={e => e.stopPropagation()}
                                onClick={() => removeFromCanvas(item.id)}
                                style={{
                                  position: "absolute", top: 4, right: 4,
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  opacity: isActive ? 1 : 0,
                                  transition: "opacity 0.15s",
                                }}
                              >
                                <X size={11} color="#fff" />
                              </button>

                              {/* Resize toolbar — bottom center */}
                              <div
                                onPointerDown={e => e.stopPropagation()}
                                style={{
                                  position: "absolute", bottom: 0, left: 0, right: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  gap: 0,
                                  opacity: isActive ? 1 : 0,
                                  transition: "opacity 0.15s",
                                }}
                              >
                                <div style={{
                                  display: "inline-flex", alignItems: "center",
                                  background: "rgba(10,10,10,0.80)",
                                  backdropFilter: "blur(6px)",
                                  borderRadius: "12px 12px 0 0",
                                  overflow: "hidden",
                                }}>
                                  {/* Shrink */}
                                  <button
                                    onClick={() => resizeItem(item.id, -20)}
                                    title="Shrink"
                                    style={{
                                      width: 28, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                      background: "transparent", border: "none", cursor: "pointer",
                                      color: "#fff", borderRight: "1px solid rgba(255,255,255,0.12)",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <ZoomOut size={11} color="#fff" />
                                  </button>
                                  {/* Scale % display */}
                                  <span style={{
                                    fontFamily: FONT_UI, fontSize: 9, color: "rgba(255,255,255,0.75)",
                                    padding: "0 8px", letterSpacing: "0.06em", minWidth: 34, textAlign: "center",
                                    userSelect: "none",
                                  }}>
                                    {scalePct}%
                                  </span>
                                  {/* Grow */}
                                  <button
                                    onClick={() => resizeItem(item.id, 20)}
                                    title="Grow"
                                    style={{
                                      width: 28, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                      background: "transparent", border: "none", cursor: "pointer",
                                      borderLeft: "1px solid rgba(255,255,255,0.12)", borderRight: "1px solid rgba(255,255,255,0.12)",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <ZoomIn size={11} color="#fff" />
                                  </button>
                                  {/* Reset */}
                                  <button
                                    onClick={() => resetItem(item.id)}
                                    title="Reset size"
                                    style={{
                                      width: 28, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                      background: "transparent", border: "none", cursor: "pointer",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <RotateCcw size={10} color={scalePct === 100 ? "rgba(255,255,255,0.3)" : GOLD} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Save controls */}
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
                          onClick={() => { setCanvasItems([]); setSelectedItemId(null); }}
                          disabled={canvasItems.length === 0}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 16px",
                            border: "1px solid rgba(0,0,0,0.12)", background: "transparent",
                            cursor: canvasItems.length === 0 ? "not-allowed" : "pointer",
                            color: canvasItems.length === 0 ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.6)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <RotateCcw size={13} /> Clear
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={canvasItems.length === 0 || createOutfit.isPending}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                            background: canvasItems.length === 0 ? "rgba(0,0,0,0.15)" : saveSuccess ? "#2D7D46" : "#0A0A0A",
                            color: "#fff", border: "none",
                            cursor: canvasItems.length === 0 ? "not-allowed" : "pointer",
                            transition: "background 0.3s", whiteSpace: "nowrap",
                          }}
                        >
                          {saveSuccess ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Look</>}
                        </button>
                      </div>
                      {/* Hint */}
                      <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.38)", letterSpacing: "0.1em", textAlign: "center", margin: 0 }}>
                        Tap a piece to select it · use <strong style={{ color: "rgba(0,0,0,0.5)" }}>+ / −</strong> to resize · drag to reposition
                      </p>
                    </div>
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
                      Build an outfit on the canvas and save it to see it here
                    </p>
                    <button
                      onClick={() => setActiveTab("builder")}
                      style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", background: GOLD, color: "#fff", border: "none", padding: "10px 28px", cursor: "pointer" }}
                    >
                      Open Canvas
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                    {savedOutfits.map(outfit => (
                      <div
                        key={outfit.id}
                        style={{ background: "#fff", border: "1px solid rgba(184,146,90,0.18)", overflow: "hidden" }}
                      >
                        {/* Outfit thumbnail preview */}
                        <div style={{ position: "relative", height: 180, background: CANVAS_BG, overflow: "hidden" }}>
                          {(outfit.items as CanvasItem[]).slice(0, 4).map((item, i) => (
                            <img
                              key={i}
                              src={getAssetUrl(item.thumbnailUrl)}
                              alt={item.name}
                              style={{
                                position: "absolute",
                                left: `${10 + i * 20}%`,
                                top: "8%",
                                width: "42%",
                                objectFit: "contain",
                                zIndex: i + 1,
                                filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.14))",
                              }}
                            />
                          ))}
                          <button
                            style={{
                              position: "absolute", top: 8, right: 8,
                              background: "rgba(255,255,255,0.9)", borderRadius: "50%",
                              width: 28, height: 28, border: "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
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
                            {(outfit.items as CanvasItem[]).length} piece{(outfit.items as CanvasItem[]).length !== 1 ? "s" : ""}&nbsp;·&nbsp;{new Date(outfit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
                            Load onto Canvas
                          </button>
                        </div>
                      </div>
                    ))}
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
            Sign in to heart products, save your favourite pieces, and build stunning outfit combinations on your personal style board.
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
