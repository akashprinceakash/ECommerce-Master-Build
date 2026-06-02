/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * Three fixed style tiles (Solid · Printed · Pattern), each linked to a
 * canonical example product SKU. Clicking a tile opens that product's studio.
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

// ── Canonical entry-point SKUs ──────────────────────────────────────────────
const ENTRY_SKUS = {
  solid:   "KS1000BPINK",
  printed: "KS1000BGP003",
  pattern: "KS1001B-RB",
} as const;

const TILE_CONFIG = [
  {
    key:      "solid" as const,
    label:    "Solid",
    desc:     "Clean base colours, ready to personalise",
    accent:   "#6b8fa3",
    icon:     "◼",
  },
  {
    key:      "printed" as const,
    label:    "Printed",
    desc:     "All-over prints from the KA.SHA library",
    accent:   "#a36b6b",
    icon:     "✦",
  },
  {
    key:      "pattern" as const,
    label:    "Pattern",
    desc:     "Bespoke geometric & signature patterns",
    accent:   "#6ba37a",
    icon:     "◈",
  },
];

function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern")
    return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  if (result.type === "print")
    return `/products/${productId}/customize?entry=1&style=print&design=${encodeURIComponent(sku)}`;
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const { user, isLoaded } = useUser();

  const { data: allProducts, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), enabled: isOpen } }
  );

  if (!isOpen) return null;

  // ── Auth gate ─────────────────────────────────────────────────────────────
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

  // ── Resolve each tile's product from the fetched list ─────────────────────
  function resolveProduct(sku: string) {
    return (allProducts ?? []).find(
      p => (p.sku ?? "").toUpperCase() === sku.toUpperCase() && p.available
    ) ?? null;
  }

  function handleSelect(productId: number, sku: string) {
    onClose();
    navigate(buildHref(productId, sku) + "&from=modal");
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
        maxWidth: 720, width: "calc(100vw - 32px)",
        padding: "36px 32px 38px", position: "relative",
        animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)",
        maxHeight: "92vh", overflowY: "auto",
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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Jost', sans-serif", fontSize: 10,
            letterSpacing: ".2em", textTransform: "uppercase",
            color: "#c9a84c", marginBottom: 8, fontWeight: 500,
          }}>KA.SHA Bespoke Studio</div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28, fontWeight: 600, color: "#1a1a18",
            letterSpacing: ".02em", margin: "0 0 8px", lineHeight: 1.2,
          }}>Choose Your Style</h2>
          <p style={{
            fontFamily: "'Jost', sans-serif", fontSize: 11,
            color: "#8a8780", letterSpacing: ".04em", fontStyle: "italic", margin: 0,
          }}>
            Select a style — the 3D studio opens ready for your customisation
          </p>
        </div>

        {/* Gold divider */}
        <div style={{
          height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          opacity: 0.4, marginBottom: 28,
        }} />

        {/* Three style tiles */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="cem-tiles">
            {TILE_CONFIG.map(tile => {
              const sku     = ENTRY_SKUS[tile.key];
              const product = resolveProduct(sku);
              return (
                <StyleTile
                  key={tile.key}
                  label={tile.label}
                  desc={tile.desc}
                  accent={tile.accent}
                  icon={tile.icon}
                  thumbnail={product ? (getAssetUrl(product.thumbnailUrl) ?? "") : ""}
                  productName={product?.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "") ?? ""}
                  disabled={!product}
                  onSelect={() => product && handleSelect(product.id, sku)}
                />
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 24,
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
        .cem-sheet::-webkit-scrollbar { width: 4px; }
        .cem-sheet::-webkit-scrollbar-track { background: transparent; }
        .cem-sheet::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 99px; }
        .cem-tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) {
          .cem-sheet { padding: 20px 14px 24px !important; border-radius: 14px !important; width: calc(100vw - 16px) !important; }
          .cem-tiles { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
        }
        @media (max-width: 420px) {
          .cem-tiles { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}

// ── Style tile ────────────────────────────────────────────────────────────────
function StyleTile({
  label, desc, accent, icon, thumbnail, productName, disabled, onSelect,
}: {
  label: string;
  desc: string;
  accent: string;
  icon: string;
  thumbnail: string;
  productName: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="cem-tile"
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch",
        padding: 0, border: `1.5px solid ${accent}33`,
        borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer",
        background: "#fff", overflow: "hidden", textAlign: "left",
        transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 2px 10px rgba(26,26,24,0.06)",
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = accent;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = `0 14px 36px ${accent}28, 0 4px 14px rgba(26,26,24,0.08)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `${accent}33`;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)";
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%", aspectRatio: "4/3", overflow: "hidden",
        background: `linear-gradient(160deg, ${accent}12, ${accent}06)`,
        flexShrink: 0, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={label}
            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center center", display: "block", padding: "8px" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }}
          />
        ) : (
          <span style={{ fontSize: 36, opacity: 0.18, color: accent }}>{icon}</span>
        )}
        {/* Style badge */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          background: accent, color: "#fff",
          fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700,
          letterSpacing: ".14em", textTransform: "uppercase",
          padding: "4px 9px", borderRadius: 99,
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}>{label}</div>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600,
          color: "#1a1a18", lineHeight: 1.25, marginBottom: 4,
        }}>
          {productName || `${label} T-Shirt`}
        </div>
        <p style={{
          fontFamily: "'Jost', sans-serif", fontSize: 9.5, color: "#8a8780",
          letterSpacing: ".04em", lineHeight: 1.6, margin: "0 0 10px",
        }}>{desc}</p>
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: 8.5, fontWeight: 600,
          color: accent, letterSpacing: ".1em", textTransform: "uppercase",
        }}>
          {disabled ? "Coming Soon" : "Open in Studio →"}
        </div>
      </div>
    </button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="cem-tiles">
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          borderRadius: 14, overflow: "hidden",
          border: "1.5px solid rgba(26,26,24,0.07)",
          animation: "cemPulse 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
        }}>
          <div style={{ aspectRatio: "4/3", background: "linear-gradient(160deg, #f0ede6, #e8e4db)" }} />
          <div style={{ padding: "14px 14px 16px" }}>
            <div style={{ width: "70%", height: 14, borderRadius: 4, background: "#ede9e1", marginBottom: 8 }} />
            <div style={{ width: "90%", height: 10, borderRadius: 4, background: "#ede9e1", marginBottom: 4 }} />
            <div style={{ width: "50%", height: 10, borderRadius: 4, background: "#ede9e1" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
