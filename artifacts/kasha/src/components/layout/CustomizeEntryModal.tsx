/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * Fetches all Men's T-shirt products live from the API.
 * Derives style/design URL params from each product's SKU via parseSku(),
 * exactly mirroring the PersonalizeModal "Full Customisation" flow.
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

// Bottoms category tokens — anything NOT in this list is a t-shirt
const BOTTOMS_CATS = ["trousers", "trouser", "pants", "chinos", "shorts", "short", "skort", "skorts", "skirts", "skirt", "bottoms"];
const MEN_TOKENS   = ["men", "men's", "mens", "male"];

interface StyleItem {
  id: number;
  name: string;
  tag: string;
  sortKey: number;
  thumbnail: string;
  href: string;
}

function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern") {
    return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  }
  if (result.type === "print") {
    // Pass full SKU as ?design= so the customizer can resolve the exact print
    // via entryDesignRef even if the product.sku lookup fails for any reason.
    const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
    return `/products/${productId}/customize?entry=1&style=print${designParam}`;
  }
  // solid (or unknown → treat as solid)
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

function inferTag(sku: string, category: string): { tag: string; sortKey: number } {
  const result = parseSku(sku);
  if (result.type === "print")    return { tag: "Printed",  sortKey: 1 };
  if (result.type === "pattern")  return { tag: "Pattern",  sortKey: 2 };
  if (result.type === "solid")    return { tag: "Solid",    sortKey: 0 };
  // fallback: infer from category string
  const haystack = category.toLowerCase();
  if (haystack.includes("print")) return { tag: "Printed",  sortKey: 1 };
  if (haystack.includes("pattern")) return { tag: "Pattern", sortKey: 2 };
  return { tag: "Solid", sortKey: 0 };
}

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

  // ── Build men's t-shirt items from live API ────────────────────────────────
  const menItems: StyleItem[] = (allProducts ?? [])
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
      const { tag, sortKey } = inferTag(sku, p.category ?? "");
      return {
        id: p.id,
        name: p.name.replace(/\s*\[gt:GT\d+\]\s*$/i, ""),
        tag,
        sortKey,
        thumbnail: getAssetUrl(p.thumbnailUrl) ?? "",
        href: buildHref(p.id, sku),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

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
        maxWidth: 820, width: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        padding: "34px 28px 38px", position: "relative",
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
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 8, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: 0, lineHeight: 1.2,
          }}>Choose Your Style</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 11, color: "#8a8780", marginTop: 6,
            letterSpacing: ".04em", fontStyle: "italic",
          }}>Select a product — it loads instantly in the studio, ready to personalise</p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 20,
        }} />

        {/* Gender selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {GENDERS.map(g => (
            <button key={g} onClick={() => setGender(g)} style={{
              padding: "6px 18px", borderRadius: 99,
              border: `1.5px solid ${gender === g ? "#c9a84c" : "rgba(26,26,24,0.14)"}`,
              background: gender === g ? "rgba(201,168,76,0.1)" : "transparent",
              color: gender === g ? "#c9a84c" : "#6b6b68",
              fontFamily: "'Jost', sans-serif",
              fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
              fontWeight: gender === g ? 700 : 400,
              cursor: "pointer", transition: "all .18s",
            }}>{g}</button>
          ))}
        </div>

        {/* Content */}
        {gender === "Women" ? (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            background: "linear-gradient(135deg, #fdfbf6 0%, #f5efe0 100%)",
            borderRadius: 16, border: "1px solid rgba(201,168,76,0.2)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.7 }}>✦</div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 600, color: "#1a1a18",
              letterSpacing: ".02em", marginBottom: 10,
            }}>Coming Soon</div>
            <p style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 12, color: "#8a8780",
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
          <div style={{
            display: "flex", gap: 12, overflowX: "hidden", paddingBottom: 16,
          }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                width: 170, flexShrink: 0, borderRadius: 14,
                background: "linear-gradient(135deg, #f0ede6, #e8e4db)",
                aspectRatio: "1/1.35", animation: "pulse 1.4s ease-in-out infinite",
                opacity: 0.6 + i * 0.05,
              }} />
            ))}
          </div>
        ) : menItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "#8a8780", fontFamily: "'Jost', sans-serif", fontSize: 12 }}>
            No products available yet. Check back soon.
          </div>
        ) : (
          <>
            <div className="cem-scroll" style={{
              display: "flex", gap: 12, overflowX: "auto", overflowY: "hidden",
              paddingBottom: 16, paddingLeft: 2, paddingRight: 2,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              cursor: "grab",
            }}
            onMouseDown={e => { e.currentTarget.style.cursor = "grabbing"; }}
            onMouseUp={e => { e.currentTarget.style.cursor = "grab"; }}
            onMouseLeave={e => { e.currentTarget.style.cursor = "grab"; }}
            >
              {menItems.map(item => (
                <div key={item.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }} className="cem-card-wrap">
                  <CarouselCard item={item} onSelect={handleSelect} />
                </div>
              ))}
            </div>
            <div style={{
              fontFamily: "'Jost', sans-serif", fontSize: 9, color: "#c9c7c0",
              letterSpacing: ".06em", textAlign: "center", marginTop: 4, fontStyle: "italic",
            }}>Swipe to browse all styles →</div>
          </>
        )}

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 18,
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
        .cem-card-wrap { width: 170px; }
        @media (max-width: 620px) {
          .cem-sheet { padding:18px 12px 24px !important; border-radius:14px !important; width:calc(100vw - 16px) !important; }
          .cem-card-wrap { width: 150px; }
        }
        @media (max-width: 400px) {
          .cem-card-wrap { width: 135px; }
        }
      `}</style>
    </div>
  );
}

function CarouselCard({ item, onSelect }: { item: StyleItem; onSelect: (h: string) => void }) {
  const tagColor: Record<string, string> = {
    Solid:   "#6b8fa3",
    Printed: "#a36b6b",
    Pattern: "#6ba37a",
  };
  const col = tagColor[item.tag] ?? "#c9a84c";

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
        flexShrink: 0, position: "relative",
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
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 6, width: "100%", height: "100%",
          }}>
            <div style={{ fontSize: 28, opacity: 0.35 }}>✦</div>
          </div>
        )}
        {/* Type badge overlaid on image */}
        <div style={{
          position: "absolute", top: 7, left: 7,
          background: "rgba(255,255,255,0.92)",
          borderRadius: 6, padding: "2px 7px",
          fontFamily: "'Jost', sans-serif",
          fontSize: 7, fontWeight: 700, letterSpacing: ".12em",
          textTransform: "uppercase", color: col,
          backdropFilter: "blur(4px)",
        }}>{item.tag}</div>
      </div>

      {/* Label */}
      <div style={{ padding: "9px 10px 11px" }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
          color: "#1a1a18", lineHeight: 1.25, marginBottom: 4,
        }}>{item.name}</div>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8, color: "#c9a84c",
          letterSpacing: ".08em",
        }}>Customise →</div>
      </div>
    </button>
  );
}
