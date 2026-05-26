/**
 * PersonalizeModal — shown when "Personalise This T-Shirt" is clicked on the PDP.
 * Two options: Quick Personalisation (logo/text only) or Full Customisation.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { parseSku } from "@/components/3d/sku-config";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName?: string;
  productSku?: string;
}

export function PersonalizeModal({ isOpen, onClose, productId, productName, productSku }: Props) {
  const [, navigate] = useLocation();
  const [selectedMode, setSelectedMode] = useState<"quick"|"full"|null>(null);

  if (!isOpen) return null;

  function handleSelect(mode: "quick"|"full") {
    setSelectedMode(mode);
    setTimeout(() => {
      onClose();
      if (mode === "quick") {
        // Pass design info even in quick mode so the studio auto-applies the
        // correct pattern + colors when the user arrives at the logo/text step.
        let quickDesignParam = "";
        let quickStyleParam = "";
        if (productSku) {
          const skuResult = parseSku(productSku);
          if (skuResult.type === "pattern") {
            quickStyleParam = "&style=pattern";
            quickDesignParam = `&design=${encodeURIComponent(productSku)}`;
          } else if (skuResult.type === "print") {
            quickStyleParam = "&style=print";
          }
        }
        navigate(`/products/${productId}/customize?mode=quick${quickStyleParam}${quickDesignParam}`);
      } else {
        // Derive style + design from SKU so the customizer skips Step 1
        let styleParam = "";
        let designParam = "";
        if (productSku) {
          const skuResult = parseSku(productSku);
          if (skuResult.type === "pattern") {
            styleParam = "&style=pattern";
            // Pass the FULL SKU (e.g. KS1002B-BB) so the studio derives the correct colorway
            designParam = `&design=${encodeURIComponent(productSku)}`;
          } else if (skuResult.type === "print") {
            styleParam = "&style=print";
          } else {
            styleParam = "&style=solid";
          }
        }
        navigate(`/products/${productId}/customize?entry=1${styleParam}${designParam}`);
      }
    }, 160);
  }

  const OPTIONS = [
    {
      key: "quick" as const,
      icon: "✦",
      title: "Quick Personalisation",
      badge: "Popular",
      subtitle: "Add your personal touch",
      description: "Upload a logo, add name or text, choose placement and size. Perfect for team kits, corporate orders, or a personal monogram.",
      features: [
        "Upload your logo or crest",
        "Add name, number or text",
        "Choose placement — front, back, sleeves",
        "Resize & reposition freely",
      ],
      time: "~2 min",
    },
    {
      key: "full" as const,
      icon: "◈",
      title: "Full Customisation",
      badge: "Complete Control",
      subtitle: "Design it from scratch",
      description: "Complete creative control. Customise base colour, apply patterns, add prints, upload logos, add text — every part of the garment, exactly how you want it.",
      features: [
        "Choose base colour & zone colours",
        "Apply KA.SHA bespoke patterns",
        "Add prints across garment zones",
        "Upload logos & add custom text",
      ],
      time: "~5 min",
    },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(26,26,24,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "pmFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pm-sheet" style={{
        background: "#fafaf7",
        borderRadius: 20,
        maxWidth: 720,
        width: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        padding: "40px 36px 44px",
        position: "relative",
        animation: "pmSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
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
            fontSize: 16, color: "#8a8780", transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Header */}
        <div style={{ marginBottom: 30 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 8, fontWeight: 600,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".01em", margin: "0 0 6px",
          }}>Personalise This T-Shirt</h2>
          {productName && (
            <div style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 11, color: "#8a8780",
              letterSpacing: ".06em", fontStyle: "italic",
            }}>{productName.replace(/\s*\[gt:GT\d+\]\s*$/, "")}</div>
          )}
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.35, marginBottom: 28,
        }} />

        <p style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: 12, color: "#8a8780",
          letterSpacing: ".04em", marginBottom: 24, lineHeight: 1.6,
        }}>
          Choose how you'd like to personalise your garment:
        </p>

        {/* Option cards */}
        <div className="pm-options-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {OPTIONS.map(opt => {
            const isSelected = selectedMode === opt.key;
            const isOther = selectedMode !== null && selectedMode !== opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.key)}
                style={{
                  padding: "24px 22px",
                  border: isSelected
                    ? "2px solid #c9a84c"
                    : "1.5px solid rgba(26,26,24,0.12)",
                  borderRadius: 14, cursor: "pointer",
                  background: isSelected ? "#1a1a18" : "#ffffff",
                  textAlign: "left",
                  transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  boxShadow: isSelected
                    ? "0 12px 40px rgba(201,168,76,0.28), 0 4px 16px rgba(26,26,24,0.18)"
                    : "0 2px 12px rgba(26,26,24,0.05)",
                  display: "flex", flexDirection: "column", gap: 10,
                  opacity: isOther ? 0.55 : 1,
                  transform: isSelected ? "translateY(-2px)" : "none",
                }}
                onMouseEnter={e => {
                  if (selectedMode !== null) return;
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(-3px)";
                  el.style.borderColor = "#c9a84c";
                  el.style.boxShadow = "0 8px 28px rgba(201,168,76,0.18)";
                  el.style.background = "#fdf9ee";
                }}
                onMouseLeave={e => {
                  if (selectedMode !== null) return;
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "none";
                  el.style.borderColor = "rgba(26,26,24,0.12)";
                  el.style.boxShadow = "0 2px 12px rgba(26,26,24,0.05)";
                  el.style.background = "#ffffff";
                }}
              >
                {/* Badge + icon */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontSize: 22, lineHeight: 1,
                    color: "#c9a84c",
                  }}>{opt.icon}</span>
                  <span style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase",
                    fontWeight: 700,
                    background: isSelected ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)",
                    color: "#c9a84c",
                    padding: "3px 8px", borderRadius: 99,
                  }}>{opt.badge}</span>
                </div>

                {/* Title */}
                <div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 20, fontWeight: 600,
                    color: isSelected ? "#ffffff" : "#1a1a18",
                    letterSpacing: ".01em", lineHeight: 1.2, marginBottom: 3,
                  }}>{opt.title}</div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 13, fontStyle: "italic",
                    color: isSelected ? "rgba(255,255,255,0.55)" : "#8a8780",
                  }}>{opt.subtitle}</div>
                </div>

                {/* Description */}
                <div style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: 11, lineHeight: 1.6,
                  color: isSelected ? "rgba(255,255,255,0.6)" : "#6b6865",
                }}>{opt.description}</div>

                {/* Feature list */}
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {opt.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <span style={{ color: "#c9a84c", fontSize: 10, marginTop: 2, flexShrink: 0 }}>✦</span>
                      <span style={{
                        fontFamily: "'Jost', sans-serif",
                        fontSize: 10, lineHeight: 1.5,
                        color: isSelected ? "rgba(255,255,255,0.7)" : "#6b6865",
                      }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Footer */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: 10, borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.1)" : "rgba(26,26,24,0.07)"}`,
                  marginTop: 4,
                }}>
                  <span style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase",
                    color: isSelected ? "rgba(255,255,255,0.4)" : "#b8b5ae",
                  }}>Est. {opt.time}</span>
                  <span style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
                    color: isSelected ? "#c9a84c" : "#1a1a18",
                  }}>{isSelected ? "Opening…" : "Select →"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 24,
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, color: "#b8b5ae",
          letterSpacing: ".07em", fontStyle: "italic",
        }}>
          All customisations are reviewed before production · Customised pieces are non-returnable
        </p>
      </div>

      <style>{`
        @keyframes pmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pmSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @media (max-width: 600px) {
          .pm-sheet { padding: 24px 16px 28px !important; border-radius: 16px !important; width: calc(100vw - 20px) !important; }
          .pm-options-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
