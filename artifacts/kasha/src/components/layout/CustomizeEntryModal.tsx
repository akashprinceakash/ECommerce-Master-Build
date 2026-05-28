/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * Gender selector (Men / Women) then a carousel of all available styles
 * (Solid Polo, Print Polo, KA.SHA Signature Patterns).
 * Solid and Print thumbnails are fetched live from the product API so they
 * always match the actual product photo — same approach as the product listing.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useGetProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GENDERS = ["Men", "Women"] as const;
type Gender = typeof GENDERS[number];

interface CarouselItem {
  key: string;
  label: string;
  tag: string;
  thumbnail: string;
  href: string;
}

// Product IDs
// 34 = base polo tee (solid studio entry point)
// 26 = KS1000BGP001 printed golf tee
// Patterns use their own product IDs with R2 thumbnail previews
const PATTERN_ITEMS: CarouselItem[] = [
  {
    key: "pattern-1001",
    label: "Pattern 1001",
    tag: "Pattern",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449525478-157065178.webp",
    href: "/products/34/customize?style=pattern&design=KS1001B",
  },
  {
    key: "pattern-1002",
    label: "Pattern 1002",
    tag: "Pattern",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449004280-642782439.webp",
    href: "/products/31/customize?style=pattern&design=KS1002B",
  },
  {
    key: "pattern-1003",
    label: "Pattern 1003",
    tag: "Pattern",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449254970-226857725.webp",
    href: "/products/35/customize?style=pattern&design=KS1003B",
  },
  {
    key: "pattern-1004",
    label: "Pattern 1004",
    tag: "Pattern",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449327778-896276668.webp",
    href: "/products/36/customize?style=pattern&design=KS1004B",
  },
  {
    key: "pattern-1005",
    label: "Pattern 1005",
    tag: "Pattern",
    thumbnail: "/api/public/thumbnails/KS1001BBeige-Brown-1.png",
    href: "/products/32/customize?style=pattern&design=KS1005B",
  },
];

const VISIBLE = 3; // cards visible at once on desktop

export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const [gender, setGender] = useState<Gender>("Men");
  const [startIdx, setStartIdx] = useState(0);

  // Fetch real product data so thumbnails always match the product listing page
  const { data: solidProduct } = useGetProduct(34, {
    query: { queryKey: getGetProductQueryKey(34), enabled: isOpen },
  });
  const { data: printProduct } = useGetProduct(26, {
    query: { queryKey: getGetProductQueryKey(26), enabled: isOpen },
  });

  if (!isOpen) return null;

  const solidThumb = getAssetUrl(solidProduct?.thumbnailUrl) ?? "";
  const printThumb  = getAssetUrl(printProduct?.thumbnailUrl)  ?? "";

  const MEN_ITEMS: CarouselItem[] = [
    {
      key: "solid",
      label: "Solid Polo",
      tag: "Solid",
      thumbnail: solidThumb,
      href: "/products/34/customize?style=solid",
    },
    {
      key: "print",
      label: "Print Polo",
      tag: "Print",
      thumbnail: printThumb,
      href: "/products/26/customize?style=print",
    },
    ...PATTERN_ITEMS,
  ];

  const GENDER_ITEMS: Record<Gender, CarouselItem[] | null> = {
    Men: MEN_ITEMS,
    Women: null,
  };

  const items = GENDER_ITEMS[gender]; // null means "coming soon"
  const total = items ? items.length : 0;
  const canPrev = startIdx > 0;
  const canNext = startIdx + VISIBLE < total;

  function handleSelect(href: string) {
    onClose();
    const sep = href.includes("?") ? "&" : "?";
    navigate(href + sep + "from=modal");
  }

  function prev() { setStartIdx(i => Math.max(0, i - 1)); }
  function next() { setStartIdx(i => Math.min(total - VISIBLE, i + 1)); }

  const visible = items ? items.slice(startIdx, startIdx + VISIBLE) : [];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(26,26,24,0.62)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cem-sheet" style={{
        background: "#fafaf7",
        borderRadius: 20,
        maxWidth: 780,
        width: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        padding: "34px 28px 38px",
        position: "relative",
        animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)",
      }}>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
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
          }}>Select a style — it loads instantly in the studio, ready to personalise</p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 20,
        }} />

        {/* Gender selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {GENDERS.map(g => (
            <button
              key={g}
              onClick={() => { setGender(g); setStartIdx(0); }}
              style={{
                padding: "6px 18px",
                borderRadius: 99,
                border: `1.5px solid ${gender === g ? "#c9a84c" : "rgba(26,26,24,0.14)"}`,
                background: gender === g ? "rgba(201,168,76,0.1)" : "transparent",
                color: gender === g ? "#c9a84c" : "#6b6b68",
                fontFamily: "'Jost', sans-serif",
                fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
                fontWeight: gender === g ? 700 : 400,
                cursor: "pointer", transition: "all .18s",
              }}
            >{g}</button>
          ))}
        </div>

        {/* Carousel or Coming Soon */}
        {items === null ? (
          /* ── Women Coming Soon ─────────────────────────────────────── */
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
            <button
              onClick={() => { setGender("Men"); setStartIdx(0); }}
              style={{
                marginTop: 24, padding: "10px 28px", borderRadius: 99,
                border: "1.5px solid #c9a84c", background: "transparent",
                fontFamily: "'Jost', sans-serif", fontSize: 10,
                letterSpacing: ".12em", textTransform: "uppercase",
                color: "#c9a84c", fontWeight: 700, cursor: "pointer",
                transition: "all .2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >View Men's Styles</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Prev arrow */}
              <button
                onClick={prev}
                disabled={!canPrev}
                style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                  border: "1.5px solid rgba(26,26,24,0.15)",
                  background: canPrev ? "#fff" : "rgba(26,26,24,0.04)",
                  cursor: canPrev ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: canPrev ? "#1a1a18" : "#c8c8c4",
                  transition: "all .2s", boxShadow: canPrev ? "0 2px 8px rgba(26,26,24,0.08)" : "none",
                }}
              >‹</button>

              {/* Cards */}
              <div className="cem-carousel" style={{
                flex: 1, display: "grid",
                gridTemplateColumns: `repeat(${VISIBLE}, 1fr)`,
                gap: 12,
              }}>
                {visible.map(item => (
                  <CarouselCard key={item.key} item={item} onSelect={handleSelect} />
                ))}
              </div>

              {/* Next arrow */}
              <button
                onClick={next}
                disabled={!canNext}
                style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                  border: "1.5px solid rgba(26,26,24,0.15)",
                  background: canNext ? "#fff" : "rgba(26,26,24,0.04)",
                  cursor: canNext ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: canNext ? "#1a1a18" : "#c8c8c4",
                  transition: "all .2s", boxShadow: canNext ? "0 2px 8px rgba(26,26,24,0.08)" : "none",
                }}
              >›</button>
            </div>

            {/* Dot indicators */}
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 16 }}>
              {Array.from({ length: Math.max(1, total - VISIBLE + 1) }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => setStartIdx(i)}
                  style={{
                    width: i === startIdx ? 18 : 6, height: 6, borderRadius: 99,
                    background: i === startIdx ? "#c9a84c" : "#d4cfc6",
                    cursor: "pointer", transition: "all .2s",
                  }}
                />
              ))}
            </div>
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
        @media (max-width: 620px) {
          .cem-sheet { padding:18px 10px 24px !important; border-radius:14px !important; width:calc(100vw - 16px) !important; }
          .cem-carousel { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
        }
        @media (max-width: 380px) {
          .cem-carousel { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ── Carousel card ─────────────────────────────────────────────────────────────
function CarouselCard({ item, onSelect }: { item: CarouselItem; onSelect: (h: string) => void }) {
  return (
    <button
      onClick={() => onSelect(item.href)}
      style={{
        padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
        borderRadius: 14, cursor: "pointer", background: "#ffffff",
        overflow: "hidden", textAlign: "left",
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
      {/* Image */}
      <div style={{
        width: "100%", aspectRatio: "3/4", overflow: "hidden",
        background: "#f2efe9", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "10px 8px", boxSizing: "border-box",
      }}>
        <img
          src={item.thumbnail}
          alt={item.label}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }}
        />
      </div>

      {/* Label */}
      <div style={{ padding: "9px 10px 11px" }}>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8, letterSpacing: ".14em",
          textTransform: "uppercase", color: "#c9a84c", fontWeight: 700, marginBottom: 2,
        }}>{item.tag}</div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontWeight: 600,
          color: "#1a1a18", lineHeight: 1.2,
        }}>{item.label}</div>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8, color: "#c9a84c",
          marginTop: 5, letterSpacing: ".08em",
        }}>Customise →</div>
      </div>
    </button>
  );
}
