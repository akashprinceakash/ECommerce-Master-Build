import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useUser, Show } from "@clerk/react";
import {
  useListOrders,
  useListLookbookOutfits,
  getListLookbookOutfitsQueryKey,
  useCreateLookbookOutfit,
  useDeleteLookbookOutfit,
  useListProducts,
  getListProductsQueryKey,
  getListOrdersQueryKey,
  type LookbookOutfit,
} from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Save, X, CheckCircle, ShoppingBag, Plus, RotateCcw } from "lucide-react";

const GOLD = "#B8925A";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";

type CanvasItem = {
  id: string;
  productId: number;
  name: string;
  thumbnailUrl: string;
  x: number;
  y: number;
  width: number;
};

type DragState = {
  itemId: string;
  startMouseX: number;
  startMouseY: number;
  startItemX: number;
  startItemY: number;
} | null;

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
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: orders = [] } = useListOrders({ query: { enabled: !!user, queryKey: getListOrdersQueryKey() } });
  const { data: savedOutfits = [], isLoading: outfitsLoading } = useListLookbookOutfits({
    query: { enabled: !!user, queryKey: getListLookbookOutfitsQueryKey() },
  });
  const { data: allProducts = [] } = useListProducts({}, {
    query: { queryKey: getListProductsQueryKey({}), staleTime: 5 * 60 * 1000 },
  });
  const createOutfit = useCreateLookbookOutfit();
  const deleteOutfit = useDeleteLookbookOutfit();

  const purchasedProducts = useMemo(() => {
    const seen = new Set<number>();
    const result: Array<{ productId: number; name: string; thumbnailUrl: string; priceInPaise: number }> = [];
    for (const order of orders) {
      for (const item of (order as any).items ?? []) {
        const p = item.product;
        if (p && p.thumbnailUrl && !seen.has(p.id)) {
          seen.add(p.id);
          result.push({ productId: p.id, name: p.name, thumbnailUrl: p.thumbnailUrl, priceInPaise: p.priceInPaise });
        }
      }
    }
    return result;
  }, [orders]);

  const addToCanvas = useCallback((product: { productId: number; name: string; thumbnailUrl: string }) => {
    setCanvasItems(prev => {
      const offset = prev.length * 22;
      return [...prev, {
        id: `${product.productId}-${Date.now()}`,
        productId: product.productId,
        name: product.name,
        thumbnailUrl: product.thumbnailUrl,
        x: Math.min(60 + offset, 280),
        y: Math.min(30 + offset, 180),
        width: 170,
      }];
    });
  }, []);

  const removeFromCanvas = useCallback((id: string) => {
    setCanvasItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = canvasItems.find(i => i.id === itemId);
    if (!item) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ itemId, startMouseX: e.clientX, startMouseY: e.clientY, startItemX: item.x, startItemY: item.y });
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
      ...i, id: `${i.productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    })));
    setOutfitName(outfit.name);
    setActiveTab("builder");
  };

  const handleDeleteOutfit = async (id: number) => {
    await deleteOutfit.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListLookbookOutfitsQueryKey() });
  };

  return (
    <Layout>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0a0c14", padding: "120px 24px 80px", textAlign: "center" }}>
        <p style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 20 }}>
          Ka.Sha
        </p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 400, color: "#fff", lineHeight: 1.05, marginBottom: 24, letterSpacing: "0.03em" }}>
          The Lookbook
        </h1>
        <p style={{ fontFamily: FONT_UI, fontSize: 13, letterSpacing: "0.25em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
          Performance Refined &nbsp;·&nbsp; Luxury Defined
        </p>
      </section>

      {/* ── Outfit Planner (signed-in only) ──────────────────────────────────── */}
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
              <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.45)", letterSpacing: "0.1em" }}>
                Drag your purchased pieces onto the canvas to visualise outfit combinations
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
                {purchasedProducts.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "60px 24px",
                    background: "#fff", border: "1px dashed rgba(184,146,90,0.35)",
                  }}>
                    <ShoppingBag size={36} style={{ color: "rgba(0,0,0,0.2)", marginBottom: 16 }} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: "rgba(0,0,0,0.45)", marginBottom: 8 }}>
                      No purchased garments yet
                    </p>
                    <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.35)", letterSpacing: "0.1em", marginBottom: 24 }}>
                      Complete an order to start building outfits
                    </p>
                    <Link href="/products">
                      <button style={{
                        fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase",
                        background: GOLD, color: "#fff", border: "none", padding: "12px 36px", cursor: "pointer",
                      }}>
                        Shop the Collection
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

                    {/* Wardrobe sidebar */}
                    <div style={{
                      width: 200, flexShrink: 0, background: "#fff",
                      border: "1px solid rgba(184,146,90,0.2)", padding: "16px 12px",
                    }}>
                      <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>
                        Your Garments
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {purchasedProducts.map(p => (
                          <button
                            key={p.productId}
                            onClick={() => addToCanvas(p)}
                            title="Click to add to canvas"
                            style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "8px",
                              background: "transparent", border: "1px solid rgba(0,0,0,0.07)",
                              cursor: "pointer", textAlign: "left", transition: "border-color 0.2s, background 0.2s",
                              width: "100%",
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = GOLD;
                              (e.currentTarget as HTMLElement).style.background = "rgba(184,146,90,0.05)";
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.07)";
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                          >
                            <img
                              src={getAssetUrl(p.thumbnailUrl)}
                              alt={p.name}
                              style={{ width: 44, height: 44, objectFit: "contain", background: "#F5F2EC", flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.1em", color: "#0A0A0A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Plus size={9} color={GOLD} />
                                <span style={{ fontFamily: FONT_UI, fontSize: 8, color: GOLD, letterSpacing: "0.15em" }}>ADD</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Canvas area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div
                        ref={canvasRef}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{
                          position: "relative",
                          height: 480,
                          background: "#FFFFFF",
                          border: "1px solid rgba(184,146,90,0.2)",
                          overflow: "hidden",
                          userSelect: "none",
                          backgroundImage: `
                            linear-gradient(rgba(184,146,90,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(184,146,90,0.04) 1px, transparent 1px)
                          `,
                          backgroundSize: "32px 32px",
                        }}
                      >
                        {/* Empty state */}
                        {canvasItems.length === 0 && (
                          <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            flexDirection: "column", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                          }}>
                            <div style={{
                              width: 80, height: 80, borderRadius: "50%", background: "rgba(184,146,90,0.08)",
                              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
                            }}>
                              <Plus size={28} color="rgba(184,146,90,0.5)" />
                            </div>
                            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: "rgba(0,0,0,0.2)", marginBottom: 6 }}>
                              Your outfit canvas
                            </p>
                            <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.15em", color: "rgba(0,0,0,0.2)" }}>
                              Click any garment on the left to add it here
                            </p>
                          </div>
                        )}

                        {/* Canvas items */}
                        {canvasItems.map((item, idx) => (
                          <div
                            key={item.id}
                            onPointerDown={e => handlePointerDown(e, item.id)}
                            onMouseEnter={() => setHoveredCanvasItem(item.id)}
                            onMouseLeave={() => setHoveredCanvasItem(null)}
                            style={{
                              position: "absolute",
                              left: item.x,
                              top: item.y,
                              width: item.width,
                              cursor: dragState?.itemId === item.id ? "grabbing" : "grab",
                              zIndex: dragState?.itemId === item.id ? 100 : idx + 1,
                              boxShadow: hoveredCanvasItem === item.id || dragState?.itemId === item.id
                                ? "0 8px 32px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.08)",
                              transition: dragState?.itemId === item.id ? "none" : "box-shadow 0.2s",
                              background: "#fff",
                              outline: hoveredCanvasItem === item.id ? `1.5px solid ${GOLD}` : "1.5px solid transparent",
                            }}
                          >
                            <img
                              src={getAssetUrl(item.thumbnailUrl)}
                              alt={item.name}
                              draggable={false}
                              style={{ width: "100%", display: "block", objectFit: "contain", aspectRatio: "3/4", pointerEvents: "none" }}
                            />
                            {/* Item label + remove */}
                            <div style={{
                              position: "absolute", bottom: 0, left: 0, right: 0,
                              background: "rgba(255,255,255,0.92)", padding: "4px 6px",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              opacity: hoveredCanvasItem === item.id || dragState?.itemId === item.id ? 1 : 0,
                              transition: "opacity 0.18s",
                            }}>
                              <span style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.08em", color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                                {item.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}
                              </span>
                              <button
                                onPointerDown={e => e.stopPropagation()}
                                onClick={() => removeFromCanvas(item.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#666", display: "flex" }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save controls */}
                      <div style={{
                        display: "flex", gap: 12, alignItems: "center",
                        background: "#fff", border: "1px solid rgba(184,146,90,0.2)", padding: "14px 16px",
                      }}>
                        <input
                          value={outfitName}
                          onChange={e => setOutfitName(e.target.value)}
                          placeholder="Name your outfit…"
                          style={{
                            flex: 1, fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.1em",
                            border: "1px solid rgba(0,0,0,0.1)", padding: "9px 12px",
                            outline: "none", background: "#FAFAF7", color: "#0A0A0A",
                          }}
                        />
                        <button
                          onClick={() => setCanvasItems([])}
                          disabled={canvasItems.length === 0}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 16px",
                            border: "1px solid rgba(0,0,0,0.12)", background: "transparent", cursor: canvasItems.length === 0 ? "not-allowed" : "pointer",
                            color: canvasItems.length === 0 ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.6)",
                          }}
                        >
                          <RotateCcw size={13} /> Clear
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={canvasItems.length === 0 || createOutfit.isPending}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_UI, fontSize: 10,
                            letterSpacing: "0.2em", textTransform: "uppercase", padding: "10px 20px",
                            background: canvasItems.length === 0 ? "rgba(0,0,0,0.15)" : saveSuccess ? "#2D7D46" : "#0A0A0A",
                            color: "#fff", border: "none", cursor: canvasItems.length === 0 ? "not-allowed" : "pointer",
                            transition: "background 0.3s",
                          }}
                        >
                          {saveSuccess ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Look</>}
                        </button>
                      </div>
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
                        <div style={{ position: "relative", height: 160, background: "#F5F2EC", overflow: "hidden" }}>
                          <div style={{ position: "relative", width: "100%", height: "100%" }}>
                            {(outfit.items as CanvasItem[]).slice(0, 4).map((item, i) => (
                              <img
                                key={i}
                                src={getAssetUrl(item.thumbnailUrl)}
                                alt={item.name}
                                style={{
                                  position: "absolute",
                                  left: `${15 + i * 22}%`,
                                  top: "10%",
                                  width: "38%",
                                  objectFit: "contain",
                                  zIndex: i + 1,
                                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))",
                                }}
                              />
                            ))}
                          </div>
                          <div style={{
                            position: "absolute", top: 8, right: 8,
                            background: "#fff", borderRadius: "50%", width: 28, height: 28,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                          }}
                            onClick={() => handleDeleteOutfit(outfit.id)}
                          >
                            <Trash2 size={12} color="#e53e3e" />
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px" }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: "#0A0A0A", marginBottom: 2 }}>
                            {outfit.name}
                          </p>
                          <p style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.12em", color: "rgba(0,0,0,0.4)", marginBottom: 12 }}>
                            {(outfit.items as CanvasItem[]).length} piece{(outfit.items as CanvasItem[]).length !== 1 ? "s" : ""} &nbsp;·&nbsp; {new Date(outfit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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

      {/* Sign-in prompt for guests */}
      <Show when="signed-out">
        <section style={{ background: "#F5F2EC", padding: "64px 24px", textAlign: "center", borderBottom: "1px solid rgba(184,146,90,0.2)" }}>
          <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>
            Outfit Planner
          </p>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 400, color: "#0A0A0A", marginBottom: 12 }}>
            Visualise Your Ka.Sha Wardrobe
          </h2>
          <p style={{ fontFamily: FONT_UI, fontSize: 12, color: "rgba(0,0,0,0.45)", letterSpacing: "0.1em", marginBottom: 28, maxWidth: 480, margin: "0 auto 28px" }}>
            Sign in to drag and combine your purchased garments into outfit combinations
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
