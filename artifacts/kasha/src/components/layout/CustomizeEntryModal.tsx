/**
 * CustomizeEntryModal — shown when "Custom Studio" is clicked from the navbar.
 * Presents three premium category cards so the user picks a garment type first,
 * then routes them to the products listing pre-filtered for that type.
 */
import { useLocation } from "wouter";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  {
    key: "solid",
    title: "Solid T-Shirts",
    subtitle: "Pure colour. Infinite expression.",
    description: "Start from a clean canvas. Choose your base colour, add zone accents, prints, logos and text.",
    icon: "◻",
    href: "/products?type=tshirts&subtype=solid",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #f5e9c8 100%)",
    preview: (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg, #ede9e1 0%, #d4c5a9 100%)",
      }}>
        <div style={{ fontSize: 56, opacity: 0.35 }}>👕</div>
      </div>
    ),
  },
  {
    key: "pattern",
    title: "Pattern T-Shirts",
    subtitle: "Bold designs. Bespoke craftsmanship.",
    description: "Select from our KA.SHA signature pattern library. Customise body and pattern colours independently.",
    icon: "◈",
    href: "/products?type=tshirts&subtype=pattern",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #ede9e1 100%)",
    preview: (
      <div style={{
        width: "100%", height: "100%",
        background: "repeating-linear-gradient(45deg, rgba(201,168,76,0.18) 0px, rgba(201,168,76,0.18) 8px, transparent 8px, transparent 20px), linear-gradient(135deg, #ede9e1, #c9b89e)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 56, opacity: 0.3 }}>👕</div>
      </div>
    ),
  },
  {
    key: "printed",
    title: "Printed T-Shirts",
    subtitle: "Artistry meets athleticism.",
    description: "Start with a signature KA.SHA print design. Personalise with text, logos and custom artwork.",
    icon: "⬡",
    href: "/products?type=tshirts&subtype=printed",
    accent: "#c9a84c",
    bg: "linear-gradient(135deg, #fafaf7 60%, #e8e5df 100%)",
    preview: (
      <div style={{
        width: "100%", height: "100%",
        background: "repeating-linear-gradient(30deg, rgba(26,26,24,0.06) 0px, rgba(26,26,24,0.06) 4px, transparent 4px, transparent 16px), repeating-linear-gradient(-30deg, rgba(201,168,76,0.1) 0px, rgba(201,168,76,0.1) 4px, transparent 4px, transparent 16px), linear-gradient(135deg, #e8e5df, #ccc9c2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 56, opacity: 0.3 }}>👕</div>
      </div>
    ),
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
      <div style={{
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
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {CATEGORIES.map((cat) => (
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
              <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", flexShrink: 0 }}>
                {cat.preview}
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
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 28,
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, color: "#b8b5ae",
          letterSpacing: ".08em", fontStyle: "italic",
        }}>
          Browse the collection, then click "Personalise This T-Shirt" on any product to begin
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
