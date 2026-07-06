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
import { getAssetUrl, toProxiedUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Save, CheckCircle, Heart, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import avatarMale from "@/assets/lookbook/avatar-male.png";
import avatarFemale from "@/assets/lookbook/avatar-female.png";

const GOLD = "#B8925A";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";
const CANVAS_BG = "#EDE9E3";

type Gender = "male" | "female";
type Role = "top" | "bottom";

// Categories mapped onto the two avatar slots. Anything not listed here
// (e.g. accessories) is simply not shown in the builder — it has no
// sensible place on a single top/bottom silhouette.
const TOP_CATEGORIES = new Set(["polo", "t-shirt", "hoodie", "jacket", "dress"]);
const BOTTOM_CATEGORIES = new Set(["shorts", "trousers", "skorts"]);

// Anchor boxes (percentages of the avatar image) that a garment is fit into.
// Tuned to the photoreal avatar's shoulder/waist/ankle proportions so garment
// cutouts land on the torso and legs instead of floating over empty space.
const ANCHORS: Record<Role, { top: number; bottom: number; left: number; right: number }> = {
  top: { top: 16.5, bottom: 42.5, left: 29, right: 71 },
  bottom: { top: 41, bottom: 93, left: 34, right: 66 },
};

type SlotItem = {
  productId: number;
  name: string;
  thumbnailUrl: string;
  bgRemoved: boolean;
  scale: number; // 1 = default fit
};

// ── Background removal — corner sampling + near-white detection ──────────────
async function stripBackground(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("img load failed"));
    img.src = toProxiedUrl(src);
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

function categoryRole(category: string): Role | null {
  const c = category.toLowerCase();
  if (TOP_CATEGORIES.has(c)) return "top";
  if (BOTTOM_CATEGORIES.has(c)) return "bottom";
  return null;
}

export default function LookbookPage() {
  useEffect(() => { document.title = "Lookbook — Ka.Sha"; }, []);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [gender, setGender] = useState<Gender>("female");
  const [slots, setSlots] = useState<Record<Role, SlotItem | null>>({ top: null, bottom: null });
  const [outfitName, setOutfitName] = useState("My Outfit");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");
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

  // Saved products = products the user has hearted, split into tops / bottoms
  const { tops, bottoms } = useMemo(() => {
    const idSet = new Set(savedIds);
    const tops: { productId: number; name: string; thumbnailUrl: string }[] = [];
    const bottoms: { productId: number; name: string; thumbnailUrl: string }[] = [];
    for (const p of allProducts) {
      if (!idSet.has(p.id)) continue;
      const role = categoryRole(p.category);
      if (!role) continue;
      const entry = { productId: p.id, name: p.name, thumbnailUrl: p.thumbnailUrl ?? "" };
      (role === "top" ? tops : bottoms).push(entry);
    }
    return { tops, bottoms };
  }, [savedIds, allProducts]);

  const hasAnySaved = tops.length > 0 || bottoms.length > 0;
  const hasStyledItem = !!slots.top || !!slots.bottom;

  // ── Slot logic ────────────────────────────────────────────────────────────
  const selectItem = useCallback(async (
    role: Role,
    product: { productId: number; name: string; thumbnailUrl: string },
  ) => {
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

    setSlots(prev => ({
      ...prev,
      [role]: { productId: product.productId, name: product.name, thumbnailUrl: finalUrl, bgRemoved, scale: 1 },
    }));
  }, []);

  // Single global outfit zoom — adjusts whatever is currently styled (top
  // and/or bottom) together, so the controls stay simple: Zoom In / Zoom Out /
  // Reset Outfit, always visible, rather than a separate control per slot.
  const zoomOutfit = useCallback((delta: number) => {
    setSlots(prev => {
      const next = { ...prev };
      (["top", "bottom"] as const).forEach(role => {
        const item = prev[role];
        if (!item) return;
        const nextScale = Math.max(0.6, Math.min(1.6, item.scale + delta));
        next[role] = { ...item, scale: nextScale };
      });
      return next;
    });
  }, []);

  const resetOutfit = useCallback(() => {
    setSlots(prev => {
      const next = { ...prev };
      (["top", "bottom"] as const).forEach(role => {
        const item = prev[role];
        if (!item) return;
        next[role] = { ...item, scale: 1 };
      });
      return next;
    });
  }, []);

  const handleSave = async () => {
    const items = (["top", "bottom"] as const)
      .filter(role => slots[role])
      .map(role => {
        const item = slots[role]!;
        const anchor = ANCHORS[role];
        return {
          productId: item.productId,
          name: item.name,
          thumbnailUrl: item.thumbnailUrl,
          x: anchor.left,
          y: anchor.top,
          width: item.scale,
          role,
          gender,
        };
      });
    if (items.length === 0 || createOutfit.isPending) return;
    await createOutfit.mutateAsync({
      data: { name: outfitName.trim() || "My Outfit", items },
    });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const loadOutfit = (outfit: LookbookOutfit) => {
    const next: Record<Role, SlotItem | null> = { top: null, bottom: null };
    let loadedGender: Gender = gender;
    for (const raw of outfit.items as Array<{ productId: number; name: string; thumbnailUrl: string; width: number; role?: Role; gender?: Gender }>) {
      const role: Role = raw.role ?? "top";
      next[role] = { productId: raw.productId, name: raw.name, thumbnailUrl: raw.thumbnailUrl, bgRemoved: true, scale: raw.width || 1 };
      if (raw.gender) loadedGender = raw.gender;
    }
    setSlots(next);
    setGender(loadedGender);
    setOutfitName(outfit.name);
    setActiveTab("builder");
  };

  const handleDeleteOutfit = async (id: number) => {
    await deleteOutfit.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
  };

  const avatarSrc = gender === "male" ? avatarMale : avatarFemale;

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
          Tap the ♡ on any product to save it here, then choose a top and a bottom to see them styled together.
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
                Save your favourite pieces with ♡, then style them on your avatar
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
                {/* Loading skeleton */}
                {savedLoading && (
                  <div style={{ height: 320, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: "ka-spin 0.9s linear infinite" }}>
                      <style>{`@keyframes ka-spin { to { transform: rotate(360deg); } }`}</style>
                      <circle cx="14" cy="14" r="10" fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="48" strokeDashoffset="16" strokeLinecap="round" />
                    </svg>
                  </div>
                )}

                {/* Builder layout — avatar always shown wearing its default outfit,
                    even before the wardrobe has any saved pieces. */}
                {!savedLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {!hasAnySaved && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
                        background: "rgba(184,146,90,0.08)", border: "1px dashed rgba(184,146,90,0.4)", padding: "12px 16px",
                      }}>
                        <Heart size={16} color={GOLD} style={{ flexShrink: 0 }} />
                        <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.06em", margin: 0, flex: 1, minWidth: 200 }}>
                          Your avatar starts dressed in our classic white tee and trousers. Tap ♡ on any product to save it here, then click it to style it on.
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

                    {/* On-page instructions + avatar toggle */}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between",
                      background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "14px 18px",
                    }}>
                      <p style={{ fontFamily: FONT_UI, fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.06em", lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
                        Choose a top on the left and a bottom on the right — each click styles it onto your avatar,
                        replacing whatever was there before. Select the item on the avatar and use the zoom controls to fine-tune the fit.
                      </p>
                      <div style={{ display: "flex", gap: 0, border: "1px solid rgba(0,0,0,0.12)" }}>
                        {(["female", "male"] as const).map(g => (
                          <button
                            key={g}
                            onClick={() => setGender(g)}
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
                        strippingIds={strippingIds}
                        selectedId={slots.top?.productId ?? null}
                        onSelect={p => selectItem("top", p)}
                        isMobile={isMobile}
                      />

                      {/* ── Avatar canvas ── */}
                      <div
                        ref={canvasRef}
                        style={{
                          position: "relative",
                          flex: 1,
                          width: isMobile ? "100%" : undefined,
                          height: isMobile ? 480 : 680,
                          background: CANVAS_BG,
                          border: "1px solid rgba(184,146,90,0.22)",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={avatarSrc}
                          alt={gender === "male" ? "Male avatar" : "Female avatar"}
                          draggable={false}
                          style={{
                            position: "absolute", inset: 0, width: "100%", height: "100%",
                            objectFit: "contain", pointerEvents: "none", userSelect: "none",
                          }}
                        />

                        {(["top", "bottom"] as const).map(role => {
                          const item = slots[role];
                          if (!item) return null;
                          const a = ANCHORS[role];
                          const boxW = a.right - a.left;
                          const boxH = a.bottom - a.top;
                          const scale = item.scale;
                          return (
                            <div
                              key={role}
                              style={{
                                position: "absolute",
                                left: `${a.left - (boxW * (scale - 1)) / 2}%`,
                                top: `${a.top - (boxH * (scale - 1)) / 2}%`,
                                width: `${boxW * scale}%`,
                                height: `${boxH * scale}%`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                zIndex: role === "top" ? 2 : 1,
                                filter: item.bgRemoved
                                  ? "drop-shadow(0 6px 16px rgba(0,0,0,0.16))"
                                  : "none",
                              }}
                            >
                              <img
                                src={item.thumbnailUrl}
                                alt={item.name}
                                draggable={false}
                                style={{
                                  width: "100%", height: "100%", objectFit: "contain",
                                  pointerEvents: "none",
                                  mixBlendMode: item.bgRemoved ? "normal" : "multiply",
                                }}
                              />
                            </div>
                          );
                        })}

                        {/* Controls — Zoom In / Zoom Out / Reset Outfit, always visible
                            (not hover-gated), applying to the whole outfit at once. */}
                        <div style={{
                          position: "absolute", top: 10, right: 10, zIndex: 10,
                          display: "flex", alignItems: "center", gap: 2,
                          background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)",
                          border: "1px solid rgba(0,0,0,0.08)", borderRadius: 4,
                          boxShadow: "0 2px 10px rgba(0,0,0,0.09)", padding: "5px 6px",
                        }}>
                          <button
                            onClick={() => zoomOutfit(-0.1)}
                            disabled={!hasStyledItem}
                            title="Zoom out"
                            style={{ ...controlBtnStyle, opacity: hasStyledItem ? 1 : 0.4, cursor: hasStyledItem ? "pointer" : "not-allowed" }}
                          >
                            <ZoomOut size={13} />
                            <span>Zoom Out</span>
                          </button>
                          <div style={{ width: 1, height: 16, background: "rgba(0,0,0,0.1)" }} />
                          <button
                            onClick={() => zoomOutfit(0.1)}
                            disabled={!hasStyledItem}
                            title="Zoom in"
                            style={{ ...controlBtnStyle, opacity: hasStyledItem ? 1 : 0.4, cursor: hasStyledItem ? "pointer" : "not-allowed" }}
                          >
                            <ZoomIn size={13} />
                            <span>Zoom In</span>
                          </button>
                          <div style={{ width: 1, height: 16, background: "rgba(0,0,0,0.1)" }} />
                          <button
                            onClick={resetOutfit}
                            disabled={!hasStyledItem}
                            title="Reset outfit"
                            style={{ ...controlBtnStyle, opacity: hasStyledItem ? 1 : 0.4, cursor: hasStyledItem ? "pointer" : "not-allowed" }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset Outfit</span>
                          </button>
                        </div>

                        {strippingIds.size > 0 && (
                          <div style={{
                            position: "absolute", bottom: 18, left: 0, right: 0, display: "flex",
                            alignItems: "center", justifyContent: "center", gap: 8, pointerEvents: "none",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "ka-spin 0.9s linear infinite" }}>
                              <style>{`@keyframes ka-spin { to { transform: rotate(360deg); } }`}</style>
                              <circle cx="8" cy="8" r="6" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                            </svg>
                            <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", color: GOLD, margin: 0 }}>
                              Styling…
                            </p>
                          </div>
                        )}
                      </div>

                      {/* ── Bottoms panel (right) ── */}
                      <GarmentPanel
                        title="Bottoms"
                        items={bottoms}
                        strippingIds={strippingIds}
                        selectedId={slots.bottom?.productId ?? null}
                        onSelect={p => selectItem("bottom", p)}
                        isMobile={isMobile}
                      />
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
                        onClick={() => { setSlots({ top: null, bottom: null }); }}
                        disabled={!slots.top && !slots.bottom}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                          letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 16px",
                          border: "1px solid rgba(0,0,0,0.12)", background: "transparent",
                          cursor: !slots.top && !slots.bottom ? "not-allowed" : "pointer",
                          color: !slots.top && !slots.bottom ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.6)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <RotateCcw size={13} /> Clear
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={(!slots.top && !slots.bottom) || createOutfit.isPending}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                          letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 22px",
                          background: (!slots.top && !slots.bottom) ? "rgba(0,0,0,0.15)" : saveSuccess ? "#2D7D46" : "#0A0A0A",
                          color: "#fff", border: "none",
                          cursor: (!slots.top && !slots.bottom) ? "not-allowed" : "pointer",
                          transition: "background 0.3s", whiteSpace: "nowrap",
                        }}
                      >
                        {saveSuccess ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Look</>}
                      </button>
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
                      Style an outfit and save it to see it here
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
                      const items = outfit.items as Array<{ productId: number; name: string; thumbnailUrl: string; role?: Role; gender?: Gender }>;
                      const outfitGender = items.find(i => i.gender)?.gender ?? "female";
                      return (
                        <div
                          key={outfit.id}
                          style={{ background: "#fff", border: "1px solid rgba(184,146,90,0.18)", overflow: "hidden" }}
                        >
                          {/* Outfit thumbnail preview */}
                          <div style={{ position: "relative", height: 200, background: CANVAS_BG, overflow: "hidden" }}>
                            <img
                              src={outfitGender === "male" ? avatarMale : avatarFemale}
                              alt=""
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                            />
                            {items.map((item, i) => {
                              const a = ANCHORS[item.role ?? "top"];
                              return (
                                <img
                                  key={i}
                                  src={getAssetUrl(item.thumbnailUrl) ?? item.thumbnailUrl}
                                  alt={item.name}
                                  style={{
                                    position: "absolute",
                                    left: `${a.left}%`, top: `${a.top}%`,
                                    width: `${a.right - a.left}%`, height: `${a.bottom - a.top}%`,
                                    objectFit: "contain",
                                    zIndex: item.role === "top" ? 2 : 1,
                                    filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.14))",
                                  }}
                                />
                              );
                            })}
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
                              Load onto Avatar
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
            Sign in to heart products, save your favourite pieces, and style them onto an avatar to see how they look together.
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

const controlBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  background: "transparent", border: "none",
  padding: "5px 8px", color: "#0A0A0A",
  fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
  whiteSpace: "nowrap",
};

function GarmentPanel({
  title, items, strippingIds, selectedId, onSelect, isMobile,
}: {
  title: string;
  items: { productId: number; name: string; thumbnailUrl: string }[];
  strippingIds: Set<number>;
  selectedId: number | null;
  onSelect: (p: { productId: number; name: string; thumbnailUrl: string }) => void;
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
              const isStripping = strippingIds.has(p.productId);
              const isSelected = selectedId === p.productId;
              return (
                <button
                  key={p.productId}
                  onClick={() => !isStripping && onSelect(p)}
                  disabled={isStripping}
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 4, padding: "8px 6px", width: 76,
                    background: "transparent", border: isSelected ? `1px solid ${GOLD}` : "1px solid rgba(0,0,0,0.07)",
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
    <div style={{ width: 220, flexShrink: 0, background: "#fff", border: "1px solid rgba(184,146,90,0.2)" }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase" }}>{title}</p>
      </div>
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 680, overflowY: "auto" }}>
        {items.length === 0 ? (
          <p style={{ fontFamily: FONT_UI, fontSize: 10, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", padding: "8px 4px", lineHeight: 1.7 }}>
            No saved {title.toLowerCase()} yet. Heart a {title.slice(0, -1).toLowerCase()} from the shop to see it here.
          </p>
        ) : items.map(p => {
          const isStripping = strippingIds.has(p.productId);
          const isSelected = selectedId === p.productId;
          return (
            <button
              key={p.productId}
              onClick={() => !isStripping && onSelect(p)}
              disabled={isStripping}
              title={isStripping ? "Styling…" : `Wear this ${title.slice(0, -1).toLowerCase()}`}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px",
                background: isSelected ? "rgba(184,146,90,0.08)" : "transparent",
                border: isSelected ? `1px solid ${GOLD}` : "1px solid rgba(0,0,0,0.07)",
                cursor: isStripping ? "not-allowed" : "pointer",
                textAlign: "left", transition: "border-color 0.2s, background 0.2s",
                width: "100%", opacity: isStripping ? 0.65 : 1,
              }}
              onMouseEnter={e => { if (!isStripping && !isSelected) { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.background = "rgba(184,146,90,0.04)"; } }}
              onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.07)"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
            >
              <div style={{ position: "relative", width: 48, height: 60, flexShrink: 0 }}>
                <img src={getAssetUrl(p.thumbnailUrl)} alt={p.name}
                  style={{ width: 48, height: 60, objectFit: "contain", background: "#F5F2EC" }} />
                {isStripping && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,242,236,0.8)" }}>
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
                  <span style={{ fontFamily: FONT_UI, fontSize: 8, color: GOLD, letterSpacing: "0.08em" }}>Styling…</span>
                ) : (
                  <span style={{ fontFamily: FONT_UI, fontSize: 8, color: GOLD, letterSpacing: "0.15em" }}>
                    {isSelected ? "CURRENTLY WORN" : "CLICK TO WEAR"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
