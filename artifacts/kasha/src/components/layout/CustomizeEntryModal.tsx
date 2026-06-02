/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * Shows Men's T-shirts grouped into three sections: Solid, Printed, Pattern.
 * No Women's tab. Clicking any product navigates directly to the studio
 * with the correct SKU-based default design pre-applied on the 3D model.
 */
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { parseSku } from "@/components/3d/sku-config";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const BOTTOMS_CATS = ["trousers", "trouser", "pants", "chinos", "shorts", "short", "skort", "skorts", "skirts", "skirt", "bottoms"];
const MEN_TOKENS   = ["men", "men's", "mens", "male"];

interface StyleItem {
  id: number;
  name: string;
  type: "solid" | "print" | "pattern";
  thumbnail: string;
  href: string;
}

function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern") {
    return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  }
  if (result.type === "print") {
    const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
    return `/products/${productId}/customize?entry=1&style=print${designParam}`;
  }
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

function inferType(sku: string, category: string): "solid" | "print" | "pattern" {
  const result = parseSku(sku);
  if (result.type === "print")   return "print";
  if (result.type === "pattern") return "pattern";
  if (result.type === "solid")   return "solid";
  const haystack = category.toLowerCase();
  if (haystack.includes("print"))   return "print";
  if (haystack.includes("pattern")) return "pattern";
  return "solid";
}

const SECTION_META: Record<"solid"|"print"|"pattern", { label: string; sub: string; color: string }> = {
  solid:   { label: "Solid T-Shirts",   sub: "Classic single-colour garments — personalise with your logo or text", color: "#6b8fa3" },
  print:   { label: "Printed T-Shirts", sub: "All-over print garments — add logos or swap the background pattern",  color: "#a36b6b" },
  pattern: { label: "Pattern T-Shirts", sub: "Structured zone designs — customise colours and design layers",        color: "#6ba37a" },
};

export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const { user, isLoaded } = useUser();

  const { data: allProducts, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), enabled: isOpen } }
  );

  if (!isOpen) return null;

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (isLoaded && !user) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(26,26,24,0.62)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: "#fafaf7", borderRadius: 20,
          maxWidth: 420, width: "calc(100vw - 32px)",
          padding: "40px 32px 38px", position: "relative",
          animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)",
          textAlign: "center",
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 18,
            width: 32, height: 32, borderRadius: "50%",
            border: "1px solid rgba(26,26,24,0.12)",
            background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#8a8780",
          }}>×</button>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #fdf6e3, #f5e9c4)",
            border: "1.5px solid rgba(201,168,76,0.3)",
            margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 24 }}>✦</span>
          </div>
          <div style={{
            fontFamily: "'Jost', sans-serif", fontSize: 10,
            letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 10, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: "0 0 12px", lineHeight: 1.25,
          }}>Sign in to design<br />your garment</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 12, color: "#6b6b68", lineHeight: 1.7,
            letterSpacing: ".02em", marginBottom: 28,
          }}>
            Create an account or sign in so we can save your design choices and customisations for you to revisit anytime.
          </p>
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", opacity: 0.3, marginBottom: 24 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/sign-up" onClick={onClose} style={{
              display: "block", padding: "13px 24px", borderRadius: 99,
              background: "linear-gradient(135deg, #c9a84c, #b8925a)",
              color: "#fff", fontFamily: "'Jost', sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase", textDecoration: "none",
              boxShadow: "0 4px 16px rgba(201,168,76,0.3)",
            }}>Create Account</a>
            <a href="/sign-in" onClick={onClose} style={{
              display: "block", padding: "12px 24px", borderRadius: 99,
              background: "transparent",
              border: "1.5px solid rgba(26,26,24,0.18)",
              color: "#1a1a18", fontFamily: "'Jost', sans-serif",
              fontSize: 11, fontWeight: 600, letterSpacing: ".1em",
              textTransform: "uppercase", textDecoration: "none",
            }}>Sign In</a>
          </div>
          <p style={{
            marginTop: 20, fontFamily: "'Jost', sans-serif",
            fontSize: 10, color: "#b8b5ae", letterSpacing: ".05em", fontStyle: "italic",
          }}>Your designs are saved securely to your account</p>
        </div>
        <style>{`
          @keyframes cemFadeIn  { from { opacity:0 } to { opacity:1 } }
          @keyframes cemSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        `}</style>
      </div>
    );
  }

  // ── Build grouped Men's T-shirt items ─────────────────────────────────────
  const allItems: StyleItem[] = (allProducts ?? [])
    .filter(p => {
      if (!p.available) return false;
      const g = (p.gender ?? "").toLowerCase();
      const isMen = MEN_TOKENS.some(t => g.includes(t));
      if (!isMen) return false;
      const cat = (p.category ?? "").toLowerCase();
      return !BOTTOMS_CATS.includes(cat);
    })
    .map(p => {
      const sku = p.sku ?? "";
      return {
        id: p.id,
        name: p.name.replace(/\s*\[gt:GT\d+\]\s*$/i, ""),
        type: inferType(sku, p.category ?? ""),
        thumbnail: getAssetUrl(p.thumbnailUrl) ?? "",
        href: buildHref(p.id, sku),
      };
    });

  const grouped: Record<"solid"|"print"|"pattern", StyleItem[]> = {
    solid:   allItems.filter(i => i.type === "solid").sort((a,b) => a.name.localeCompare(b.name)),
    print:   allItems.filter(i => i.type === "print").sort((a,b) => a.name.localeCompare(b.name)),
    pattern: allItems.filter(i => i.type === "pattern").sort((a,b) => a.name.localeCompare(b.name)),
  };

  const sections = (["solid","print","pattern"] as const).filter(k => grouped[k].length > 0);

  function handleSelect(href: string) {
    onClose();
    const sep = href.includes("?") ? "&" : "?";
    navigate(href + sep + "from=modal");
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(26,26,24,0.62)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cem-sheet" style={{
        background: "#fafaf7", borderRadius: 20,
        maxWidth: 860, width: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        padding: "34px 28px 40px", position: "relative",
        animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)",
      }}>

        {/* Close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 18,
          width: 32, height: 32, borderRadius: "50%",
          border: "1px solid rgba(26,26,24,0.12)",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#8a8780", transition: "all 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 8, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: 0, lineHeight: 1.2,
          }}>Choose Your T-Shirt</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 11, color: "#8a8780", marginTop: 6,
            letterSpacing: ".04em", fontStyle: "italic",
          }}>Select a product — it opens in the studio with its design already applied</p>
        </div>

        <div style={{
          height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 28,
        }} />

        {/* Sections */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {[1,2,3].map(s => (
              <div key={s}>
                <div style={{ width: 140, height: 14, borderRadius: 6, background: "#e8e4db", marginBottom: 14, opacity: 0.6 }} />
                <div style={{ display: "flex", gap: 12 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{
                      width: 160, flexShrink: 0, borderRadius: 14,
                      background: "linear-gradient(135deg, #f0ede6, #e8e4db)",
                      aspectRatio: "1/1.35", animation: "pulse 1.4s ease-in-out infinite",
                      opacity: 0.5 + i * 0.07,
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#8a8780",
          }}>
            No products available yet. Check back soon.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {sections.map(key => {
              const meta = SECTION_META[key];
              const items = grouped[key];
              return (
                <div key={key}>
                  {/* Section header */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: meta.color, flexShrink: 0,
                      }} />
                      <div style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 18, fontWeight: 600, color: "#1a1a18",
                        letterSpacing: ".02em",
                      }}>{meta.label}</div>
                      <div style={{
                        fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 600,
                        letterSpacing: ".1em", textTransform: "uppercase",
                        color: meta.color, marginLeft: 2,
                        background: `${meta.color}18`, borderRadius: 4, padding: "2px 7px",
                      }}>{items.length}</div>
                    </div>
                    <div style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: 10, color: "#8a8780", letterSpacing: ".03em",
                      fontStyle: "italic", paddingLeft: 16,
                    }}>{meta.sub}</div>
                  </div>

                  {/* Horizontal scroll row */}
                  <div className="cem-scroll" style={{
                    display: "flex", gap: 12, overflowX: "auto", overflowY: "hidden",
                    paddingBottom: 12, paddingLeft: 2, paddingRight: 2,
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                  }}>
                    {items.map(item => (
                      <div key={item.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }} className="cem-card-wrap">
                        <CarouselCard item={item} accentColor={meta.color} onSelect={handleSelect} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{
          textAlign: "center", marginTop: 24,
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, color: "#b8b5ae",
          letterSpacing: ".08em", fontStyle: "italic",
        }}>
          Your design pre-loads from the product — personalise colours, prints and logos in the studio
        </p>
      </div>

      <style>{`
        @keyframes cemFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cemSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:.55 } 50% { opacity:.9 } }
        .cem-scroll::-webkit-scrollbar { height: 4px; }
        .cem-scroll::-webkit-scrollbar-track { background: rgba(26,26,24,0.05); border-radius: 99px; }
        .cem-scroll::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.4); border-radius: 99px; }
        .cem-card-wrap { width: 160px; }
        @media (max-width: 620px) {
          .cem-sheet { padding:18px 12px 28px !important; border-radius:14px !important; width:calc(100vw - 16px) !important; }
          .cem-card-wrap { width: 140px; }
        }
        @media (max-width: 400px) {
          .cem-card-wrap { width: 128px; }
        }
      `}</style>
    </div>
  );
}

function CarouselCard({
  item,
  accentColor,
  onSelect,
}: {
  item: StyleItem;
  accentColor: string;
  onSelect: (h: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.href)}
      style={{
        padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
        borderRadius: 14, cursor: "pointer", background: "#ffffff",
        overflow: "hidden", textAlign: "left", width: "100%",
        transition: "all 0.26s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 2px 10px rgba(26,26,24,0.05)",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#c9a84c";
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 10px 32px rgba(201,168,76,0.18), 0 4px 12px rgba(26,26,24,0.07)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(26,26,24,0.09)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.05)";
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%", aspectRatio: "1/1", overflow: "hidden",
        background: "linear-gradient(160deg, #f7f4ee 0%, #edeae3 100%)",
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
          />
        ) : (
          <div style={{ fontSize: 28, opacity: 0.3 }}>✦</div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: "9px 10px 11px" }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
          color: "#1a1a18", lineHeight: 1.25, marginBottom: 5,
        }}>{item.name}</div>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8,
          color: accentColor, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
        }}>Customise →</div>
      </div>
    </button>
  );
}
