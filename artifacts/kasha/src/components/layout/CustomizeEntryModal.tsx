/**
 * CustomizeEntryModal — shown when "Custom Studio" is clicked from the navbar.
 * Presents 7 style options: Solid, Print, and the 5 KA.SHA Signature Patterns.
 * Each card shows an actual product thumbnail and navigates directly to that
 * product's Bespoke Studio with the correct design pre-loaded from its SKU.
 */
import { useLocation } from "wouter";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── Curated style entries — each maps to a specific product & design ──────────
// thumbnail:  real product photo from the API
// href:       /products/:id/customize?style=X&design=Y
//             ?style  — pre-selects userStyle in the customizer (skips Step 1)
//             ?design — overrides which KA.SHA design to apply (for pattern cards)
// ─────────────────────────────────────────────────────────────────────────────
const WIDE_OPTIONS = [
  {
    key: "solid",
    label: "Solid",
    title: "Solid Polo",
    subtitle: "Pure colour, infinite expression",
    desc: "Start from a clean canvas — choose your base colour, add zone accents, prints, logos and text.",
    thumbnail: "/api/public/thumbnails/KS1002BOLIVEGREEN-BLACK01.png",
    href: "/products/34/customize?style=solid",
  },
  {
    key: "print",
    label: "Print",
    title: "Printed Polo",
    subtitle: "Artistry meets athleticism",
    desc: "Begin with a signature KA.SHA print. Personalise with zone prints, custom text and logos.",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/KS1000BGP001-01.png",
    href: "/products/26/customize?style=print",
  },
];

const PATTERN_OPTIONS = [
  {
    key: "pattern-1001",
    label: "Pattern 1001",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449525478-157065178.webp",
    href: "/products/34/customize?style=pattern&design=KS1001B",
  },
  {
    key: "pattern-1002",
    label: "Pattern 1002",
    thumbnail: "/api/public/thumbnails/KS1001BSKYBLUE-BROWN01.png",
    href: "/products/31/customize?style=pattern&design=KS1002B",
  },
  {
    key: "pattern-1003",
    label: "Pattern 1003",
    thumbnail: "/api/public/thumbnails/KS1003BPINK-BLACK01.png",
    href: "/products/35/customize?style=pattern&design=KS1003B",
  },
  {
    key: "pattern-1004",
    label: "Pattern 1004",
    thumbnail: "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/thumb-1779449327778-896276668.webp",
    href: "/products/36/customize?style=pattern&design=KS1004B",
  },
  {
    key: "pattern-1005",
    label: "Pattern 1005",
    thumbnail: "/api/public/thumbnails/KS1001BBeige-Brown-1.png",
    href: "/products/32/customize?style=pattern&design=KS1005B",
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
        background: "rgba(26,26,24,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)",
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
        padding: "40px 32px 44px",
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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 10, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: 0, lineHeight: 1.2,
          }}>Choose Your Style</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 12, color: "#8a8780", marginTop: 8,
            letterSpacing: ".04em", fontStyle: "italic",
          }}>Select a t-shirt — the design loads instantly, ready for you to personalise</p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 24,
        }} />

        {/* Wide cards: Solid + Print */}
        <div className="cem-wide-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {WIDE_OPTIONS.map(opt => (
            <WideCard key={opt.key} opt={opt} onSelect={handleSelect} />
          ))}
        </div>

        {/* Pattern section label */}
        <div style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase",
          color: "#c9a84c", fontWeight: 600, marginBottom: 12,
        }}>
          KA.SHA Signature Patterns
        </div>

        {/* Pattern cards: 5 across */}
        <div className="cem-pattern-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {PATTERN_OPTIONS.map(opt => (
            <PatternCard key={opt.key} opt={opt} onSelect={handleSelect} />
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 24,
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, color: "#b8b5ae",
          letterSpacing: ".08em", fontStyle: "italic",
        }}>
          Your design is pre-loaded from the product SKU — customise colours, prints and logos in the studio
        </p>
      </div>

      <style>{`
        @keyframes cemFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cemSlideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @media (max-width: 620px) {
          .cem-sheet { padding: 24px 14px 28px !important; border-radius: 14px !important; width: calc(100vw - 16px) !important; }
          .cem-wide-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .cem-pattern-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }
        @media (max-width: 380px) {
          .cem-wide-grid { grid-template-columns: 1fr !important; }
          .cem-pattern-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

// ── Wide card (Solid / Print) ─────────────────────────────────────────────────
interface WideOpt { key: string; label: string; title: string; subtitle: string; desc: string; thumbnail: string; href: string; }
function WideCard({ opt, onSelect }: { opt: WideOpt; onSelect: (h: string) => void }) {
  return (
    <button
      onClick={() => onSelect(opt.href)}
      style={{
        padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
        borderRadius: 14, cursor: "pointer", background: "#ffffff",
        textAlign: "left", overflow: "hidden",
        transition: "all 0.28s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 2px 12px rgba(26,26,24,0.06)",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#c9a84c";
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 10px 36px rgba(201,168,76,0.18), 0 4px 12px rgba(26,26,24,0.06)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(26,26,24,0.09)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 12px rgba(26,26,24,0.06)";
      }}
    >
      <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", flexShrink: 0, background: "#ede9e1" }}>
        <img src={opt.thumbnail} alt={opt.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
        />
      </div>
      <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#c9a84c", fontWeight: 600 }}>
          {opt.label}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, color: "#1a1a18", letterSpacing: ".02em", lineHeight: 1.2 }}>
          {opt.title}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: "#8a8780", fontStyle: "italic" }}>
          {opt.subtitle}
        </div>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", lineHeight: 1.55, marginTop: 3 }}>
          {opt.desc}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" as const, color: "#c9a84c", fontWeight: 600 }}>
            Customise →
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Pattern card (compact) ────────────────────────────────────────────────────
interface PatOpt { key: string; label: string; thumbnail: string; href: string; }
function PatternCard({ opt, onSelect }: { opt: PatOpt; onSelect: (h: string) => void }) {
  return (
    <button
      onClick={() => onSelect(opt.href)}
      style={{
        padding: 0, border: "1.5px solid rgba(26,26,24,0.09)",
        borderRadius: 12, cursor: "pointer", background: "#ffffff",
        textAlign: "left", overflow: "hidden",
        transition: "all 0.28s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 2px 10px rgba(26,26,24,0.05)",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#c9a84c";
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 8px 28px rgba(201,168,76,0.16), 0 3px 10px rgba(26,26,24,0.06)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(26,26,24,0.09)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.05)";
      }}
    >
      <div style={{ width: "100%", aspectRatio: "3/4", overflow: "hidden", flexShrink: 0, background: "#ede9e1" }}>
        <img src={opt.thumbnail} alt={opt.label}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
        />
      </div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#1a1a18", fontWeight: 600, lineHeight: 1.3 }}>
          {opt.label}
        </div>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, color: "#c9a84c", marginTop: 3, letterSpacing: ".08em" }}>
          Customise →
        </div>
      </div>
    </button>
  );
}
