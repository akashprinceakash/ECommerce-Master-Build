/**
 * CustomizeEntryModal — shown when "Custom Studio" is clicked from the navbar.
 * Presents three premium category cards so the user picks a garment type first,
 * then routes them directly to the Bespoke Studio for that type.
 */
import { useLocation } from "wouter";
import { getAssetUrl } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Category {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  href: string;
  accent: string;
  bg: string;
  thumbnail: string;
  thumbnailFit: "cover" | "contain";
  thumbnailBg: string;
  useApiUrl: boolean;
}

const CATEGORIES: Category[] = [
  {
    key: "solid",
    title: "Solid T-Shirts",
    subtitle: "Pure colour. Infinite expression.",
    description: "Start from a clean canvas. Choose your base colour, add zone accents, prints, logos and text.",
    icon: "◻",
    href: "/customize?type=solid",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #f5e9c8 100%)",
    thumbnail: "/images/designs/KD004.png",
    thumbnailFit: "cover",
    thumbnailBg: "#ede9e1",
    useApiUrl: false,
  },
  {
    key: "pattern",
    title: "Pattern T-Shirts",
    subtitle: "Bold designs. Bespoke craftsmanship.",
    description: "Select from our KA.SHA signature pattern library. Customise body and pattern colours independently.",
    icon: "◈",
    href: "/customize?type=pattern",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #ede9e1 100%)",
    thumbnail: "/api/public/thumbnails/KS1002BOLIVEGREEN-BLACK01.webp",
    thumbnailFit: "contain",
    thumbnailBg: "#f0ede8",
    useApiUrl: true,
  },
  {
    key: "printed",
    title: "Printed T-Shirts",
    subtitle: "Artistry meets athleticism.",
    description: "Start with a signature KA.SHA print design. Personalise with text, logos and custom artwork.",
    icon: "⬡",
    href: "/customize?type=printed",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #e8e5df 100%)",
    thumbnail: "/api/public/thumbnails/KS1000BGP001-01.webp",
    thumbnailFit: "contain",
    thumbnailBg: "#f0ede8",
    useApiUrl: true,
  },
];

export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();

  if (!isOpen) return null;

  function handleSelect(href: string) {
    onClose();
    navigate(href);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(26,26,24,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "fadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cem-sheet" style={{
        background: "#fafaf7",
        borderRadius: 20,
        maxWidth: 900,
        width: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        padding: "40px 36px 44px",
        position: "relative",
        animation: "slideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 32px 80px rgba(26,26,24,0.22), 0 8px 24px rgba(26,26,24,0.12)",
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
            fontSize: 16, color: "#8a8780",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 10, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 34, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: 0, lineHeight: 1.2,
          }}>What would you like<br/>to customise?</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 12, color: "#8a8780", marginTop: 10,
            letterSpacing: ".04em", fontStyle: "italic",
          }}>Select a garment type to begin your bespoke journey</p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 32,
        }} />

        {/* Category cards */}
        <div className="cem-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {CATEGORIES.map((cat) => {
            const imgSrc = cat.useApiUrl
              ? (getAssetUrl(cat.thumbnail) ?? cat.thumbnail)
              : cat.thumbnail;

            return (
              <button
                key={cat.key}
                onClick={() => handleSelect(cat.href)}
                style={{
                  padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
                  borderRadius: 14, cursor: "pointer", background: "#ffffff",
                  textAlign: "left", overflow: "hidden",
                  transition: "all 0.32s cubic-bezier(0.16,1,0.3,1)",
                  boxShadow: "0 2px 12px rgba(26,26,24,0.06)",
                  display: "flex", flexDirection: "column",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "#c9a84c";
                  el.style.transform = "translateY(-4px)";
                  el.style.boxShadow = "0 12px 40px rgba(201,168,76,0.18), 0 4px 16px rgba(26,26,24,0.08)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(26,26,24,0.09)";
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "0 2px 12px rgba(26,26,24,0.06)";
                }}
              >
                {/* Preview area */}
                <div style={{
                  width: "100%", aspectRatio: "4/3", overflow: "hidden",
                  flexShrink: 0, background: cat.thumbnailBg, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img
                    src={imgSrc}
                    alt={cat.title}
                    style={{
                      width: "100%", height: "100%",
                      objectFit: cat.thumbnailFit,
                      objectPosition: "center",
                      display: "block",
                      padding: cat.thumbnailFit === "contain" ? "8px" : "0",
                    }}
                  />
                </div>

                {/* Text content */}
                <div style={{ padding: "18px 18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
                    color: "#c9a84c", fontWeight: 600,
                  }}>{cat.icon} {cat.key}</div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 20, fontWeight: 600, color: "#1a1a18",
                    letterSpacing: ".02em", lineHeight: 1.2,
                  }}>{cat.title}</div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 13, color: "#8a8780",
                    fontStyle: "italic", lineHeight: 1.4,
                  }}>{cat.subtitle}</div>
                  <div style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 11, color: "#8a8780",
                    lineHeight: 1.6, marginTop: 4,
                  }}>{cat.description}</div>

                  {/* CTA row */}
                  <div style={{
                    marginTop: "auto", paddingTop: 14,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase",
                      color: "#c9a84c", fontWeight: 600,
                    }}>Explore & Customise</span>
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "#1a1a18", color: "#c9a84c",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, flexShrink: 0,
                    }}>→</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 28,
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, color: "#b8b5ae",
          letterSpacing: ".08em", fontStyle: "italic",
        }}>
          You'll customise the design now — choose a specific product later to add to cart
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @media (max-width: 600px) {
          .cem-sheet { padding: 24px 16px 28px !important; border-radius: 16px !important; width: calc(100vw - 20px) !important; }
          .cem-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
