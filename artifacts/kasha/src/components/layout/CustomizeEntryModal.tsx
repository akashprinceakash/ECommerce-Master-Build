/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * Fetches all Men's T-shirt products live from the API and groups them into
 * three labelled sections: Solid T-Shirts · Printed T-Shirts · Pattern T-Shirts.
 * Clicking any card navigates to the studio with style + design params so the
 * 3D model renders with that product's colours/print/pattern pre-applied.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { parseSku } from "@/components/3d/sku-config";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GENDERS = ["Men", "Women"] as const;
type Gender = typeof GENDERS[number];

const BOTTOMS_CATS = ["trousers","trouser","pants","chinos","shorts","short","skort","skorts","skirts","skirt","bottoms"];
const MEN_TOKENS   = ["men","men's","mens","male"];

type StyleType = "Solid" | "Printed" | "Pattern";

interface StyleItem {
  id: number;
  name: string;
  type: StyleType;
  thumbnail: string;
  href: string;
}

/** Build the customize URL so the studio pre-applies the product's design on load. */
function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern") {
    // Pass full SKU (inc. colorway e.g. KS1001B-RB) so the studio applies the right colors
    return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  }
  if (result.type === "print") {
    // Pass SKU as design so the studio knows which exact print to pre-apply
    return `/products/${productId}/customize?entry=1&style=print&design=${encodeURIComponent(sku)}`;
  }
  // Solid — pass full SKU (e.g. KS1000BROYALBLUE) so the correct color is applied
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

function inferType(sku: string, category: string): StyleType {
  const result = parseSku(sku);
  if (result.type === "print")   return "Printed";
  if (result.type === "pattern") return "Pattern";
  if (result.type === "solid")   return "Solid";
  const h = category.toLowerCase();
  if (h.includes("print"))   return "Printed";
  if (h.includes("pattern")) return "Pattern";
  return "Solid";
}

const SECTION_CONFIG: { type: StyleType; label: string; sublabel: string; accent: string }[] = [
  { type: "Solid",   label: "Solid T-Shirts",   sublabel: "Clean base colours, ready to personalise", accent: "#6b8fa3" },
  { type: "Printed", label: "Printed T-Shirts",  sublabel: "All-over prints from the KA.SHA library",  accent: "#a36b6b" },
  { type: "Pattern", label: "Pattern T-Shirts",  sublabel: "Bespoke geometric & signature patterns",    accent: "#6ba37a" },
];

export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const [gender, setGender] = useState<Gender>("Men");
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
            position: "absolute", top: 16, right: 18, width: 32, height: 32,
            borderRadius: "50%", border: "1px solid rgba(26,26,24,0.12)",
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
          }}><span style={{ fontSize: 24 }}>✦</span></div>
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
            fontFamily: "'Jost', sans-serif", fontSize: 12,
            color: "#6b6b68", lineHeight: 1.7, letterSpacing: ".02em", marginBottom: 28,
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
              background: "transparent", border: "1.5px solid rgba(26,26,24,0.18)",
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

  // ── Build items from live API ──────────────────────────────────────────────
  const menItems: StyleItem[] = (allProducts ?? [])
    .filter(p => {
      if (!p.available) return false;
      const g = (p.gender ?? "").toLowerCase();
      if (!MEN_TOKENS.some(t => g.includes(t))) return false;
      const cat = (p.category ?? "").toLowerCase();
      return !BOTTOMS_CATS.includes(cat);
    })
    .map(p => {
      const sku = p.sku ?? "";
      return {
        id:        p.id,
        name:      p.name.replace(/\s*\[gt:GT\d+\]\s*$/i, ""),
        type:      inferType(sku, p.category ?? ""),
        thumbnail: getAssetUrl(p.thumbnailUrl) ?? "",
        href:      buildHref(p.id, sku),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleSelect(href: string) {
    onClose();
    const sep = href.includes("?") ? "&" : "?";
    navigate(href + sep + "from=modal");
  }

  const grouped = {
    Solid:   menItems.filter(i => i.type === "Solid"),
    Printed: menItems.filter(i => i.type === "Printed"),
    Pattern: menItems.filter(i => i.type === "Pattern"),
  };

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
        padding: "32px 28px 36px", position: "relative",
        animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)",
      }}>

        {/* Close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 18, width: 32, height: 32,
          borderRadius: "50%", border: "1px solid rgba(26,26,24,0.12)",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#8a8780", transition: "all 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif", fontSize: 10,
            letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 8, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: 0, lineHeight: 1.2,
          }}>Choose Your T-Shirt</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif", fontSize: 11,
            color: "#8a8780", marginTop: 6, letterSpacing: ".04em", fontStyle: "italic",
          }}>
            Select any style — the 3D model loads with your chosen product's design pre-applied
          </p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 20,
        }} />

        {/* Gender selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {GENDERS.map(g => (
            <button key={g} onClick={() => setGender(g)} style={{
              padding: "6px 20px", borderRadius: 99,
              border: `1.5px solid ${gender === g ? "#c9a84c" : "rgba(26,26,24,0.14)"}`,
              background: gender === g ? "rgba(201,168,76,0.1)" : "transparent",
              color: gender === g ? "#c9a84c" : "#6b6b68",
              fontFamily: "'Jost', sans-serif", fontSize: 11,
              letterSpacing: ".08em", textTransform: "uppercase",
              fontWeight: gender === g ? 700 : 400,
              cursor: "pointer", transition: "all .18s",
            }}>{g}</button>
          ))}
        </div>

        {/* Content */}
        {gender === "Women" ? (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            background: "linear-gradient(135deg, #fdfbf6, #f5efe0)",
            borderRadius: 16, border: "1px solid rgba(201,168,76,0.2)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.7 }}>✦</div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 600, color: "#1a1a18",
              letterSpacing: ".02em", marginBottom: 10,
            }}>Coming Soon</div>
            <p style={{
              fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#8a8780",
              letterSpacing: ".05em", lineHeight: 1.7, maxWidth: 340, margin: "0 auto",
            }}>
              The KA.SHA Women's Bespoke Studio is being crafted with care.
              Check back shortly — or explore our <strong style={{ color: "#c9a84c" }}>Men's collection</strong> while you wait.
            </p>
            <button onClick={() => setGender("Men")} style={{
              marginTop: 24, padding: "10px 28px", borderRadius: 99,
              border: "1.5px solid #c9a84c", background: "transparent",
              fontFamily: "'Jost', sans-serif", fontSize: 10,
              letterSpacing: ".12em", textTransform: "uppercase",
              color: "#c9a84c", fontWeight: 700, cursor: "pointer",
            }}>View Men's Styles</button>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {SECTION_CONFIG.map(sec => {
              const items = grouped[sec.type];
              if (items.length === 0) return null;
              return (
                <section key={sec.type}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: sec.accent, display: "inline-block", flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 18, fontWeight: 600, color: "#1a1a18",
                        letterSpacing: ".01em",
                      }}>{sec.label}</span>
                    </div>
                    <span style={{
                      fontFamily: "'Jost', sans-serif", fontSize: 10,
                      color: "#b8b5ae", letterSpacing: ".04em", fontStyle: "italic",
                    }}>{sec.sublabel}</span>
                  </div>

                  {/* Horizontal scroll row */}
                  <div
                    className="cem-scroll"
                    style={{
                      display: "flex", gap: 12,
                      overflowX: "auto", overflowY: "hidden",
                      paddingBottom: 10, paddingLeft: 2, paddingRight: 2,
                      scrollSnapType: "x mandatory",
                      WebkitOverflowScrolling: "touch",
                      cursor: "grab",
                    }}
                    onMouseDown={e => { e.currentTarget.style.cursor = "grabbing"; }}
                    onMouseUp={e => { e.currentTarget.style.cursor = "grab"; }}
                    onMouseLeave={e => { e.currentTarget.style.cursor = "grab"; }}
                  >
                    {items.map(item => (
                      <div key={item.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }} className="cem-card-wrap">
                        <ProductCard item={item} accent={sec.accent} onSelect={handleSelect} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 20,
          fontFamily: "'Jost', sans-serif", fontSize: 10,
          color: "#b8b5ae", letterSpacing: ".08em", fontStyle: "italic",
        }}>
          The 3D model loads with the product's colour or print pre-applied · Customise freely from there
        </p>
      </div>

      <style>{`
        @keyframes cemFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cemSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cemPulse   { 0%,100% { opacity:.5 } 50% { opacity:.85 } }
        .cem-scroll::-webkit-scrollbar { height: 4px; }
        .cem-scroll::-webkit-scrollbar-track { background: rgba(26,26,24,0.05); border-radius: 99px; }
        .cem-scroll::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.35); border-radius: 99px; }
        .cem-card-wrap { width: 160px; }
        @media (max-width: 620px) {
          .cem-sheet { padding:16px 12px 22px !important; border-radius:14px !important; width:calc(100vw - 16px) !important; }
          .cem-card-wrap { width: 140px; }
        }
        @media (max-width: 400px) {
          .cem-card-wrap { width: 128px; }
        }
      `}</style>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ item, accent, onSelect }: {
  item: StyleItem;
  accent: string;
  onSelect: (h: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.href)}
      style={{
        padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
        borderRadius: 12, cursor: "pointer", background: "#ffffff",
        overflow: "hidden", textAlign: "left", width: "100%",
        transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 2px 8px rgba(26,26,24,0.06)",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#c9a84c";
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 10px 28px rgba(201,168,76,0.18), 0 4px 12px rgba(26,26,24,0.07)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(26,26,24,0.09)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 8px rgba(26,26,24,0.06)";
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%", aspectRatio: "1/1", overflow: "hidden",
        background: "linear-gradient(160deg, #f7f4ee, #edeae3)",
        flexShrink: 0, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.18"; }}
          />
        ) : (
          <span style={{ fontSize: 26, opacity: 0.3 }}>✦</span>
        )}
        {/* "Opens in Studio" label on hover via CSS isn't easy — use a subtle overlay dot */}
      </div>

      {/* Info */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginBottom: 3,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: accent, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Jost', sans-serif", fontSize: 7.5, fontWeight: 700,
            letterSpacing: ".12em", textTransform: "uppercase", color: accent,
          }}>{item.type}</span>
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
          color: "#1a1a18", lineHeight: 1.25, marginBottom: 4,
        }}>{item.name}</div>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8, color: "#c9a84c", letterSpacing: ".08em",
        }}>Open in Studio →</div>
      </div>
    </button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {["Solid T-Shirts", "Printed T-Shirts", "Pattern T-Shirts"].map(label => (
        <div key={label}>
          <div style={{
            width: 140, height: 16, borderRadius: 6,
            background: "linear-gradient(90deg, #ede9e1, #e0dbd2, #ede9e1)",
            marginBottom: 12, animation: "cemPulse 1.4s ease-in-out infinite",
          }} />
          <div style={{ display: "flex", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                width: 160, height: 200, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(160deg, #f0ede6, #e8e4db)",
                animation: "cemPulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
