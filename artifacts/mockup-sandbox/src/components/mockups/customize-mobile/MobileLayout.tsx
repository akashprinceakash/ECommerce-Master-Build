import { useState } from "react";

const V = {
  bg: "#fafaf7",
  panel: "#f5f2ec",
  accent: "#c9a84c",
  accentLight: "#f5edd6",
  text: "#1a1a1a",
  muted: "#7a7060",
  border: "#e8e2d6",
  navBg: "#1a1a1a",
  navText: "#c9a84c",
  white: "#ffffff",
};

const TOOLS = [
  { id: "products", icon: "👕", label: "Product" },
  { id: "colors", icon: "🎨", label: "Colors" },
  { id: "prints", icon: "◈", label: "Prints" },
  { id: "patterns", icon: "◆", label: "Patterns" },
  { id: "text", icon: "Aa", label: "Text" },
  { id: "logo", icon: "🖼", label: "Logo" },
  { id: "order", icon: "🛒", label: "Order" },
];

const COLOR_ZONES = ["All", "Front", "Back", "Sleeves"];
const COLORS = [
  "#1a1a1a","#2c3e50","#c9a84c","#d4a017","#e8e2d6",
  "#ffffff","#8b0000","#003366","#2d5a27","#5c3317",
  "#a0522d","#708090","#c0c0c0","#4a4a4a","#6b4c3b",
  "#1f3a5f",
];

export function MobileLayout() {
  const [activeTool, setActiveTool] = useState<string>("colors");
  const [activeZone, setActiveZone] = useState("All");
  const [selectedColor, setSelectedColor] = useState("#1a1a1a");
  const panelOpen = activeTool !== null;

  const viewerH = panelOpen ? 260 : 616;

  return (
    <div style={{
      width: 390, height: 844, background: V.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "'Jost', sans-serif", position: "relative",
    }}>

      {/* ── Top Bar ─────────────────────────────────────── */}
      <div style={{
        height: 52, background: V.bg, borderBottom: `1px solid ${V.border}`,
        display: "flex", alignItems: "center", padding: "0 12px",
        gap: 8, flexShrink: 0, zIndex: 10,
      }}>
        <button style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 13, color: V.muted, background: "none", border: "none",
          padding: "6px 8px", borderRadius: 6, cursor: "pointer",
        }}>
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 15, letterSpacing: 2, color: V.text }}>
          KA.SHA
        </span>
        <button style={{
          background: V.accent, color: V.white, border: "none",
          borderRadius: 20, padding: "6px 14px", fontSize: 12,
          fontWeight: 600, cursor: "pointer", letterSpacing: 0.5,
        }}>
          Order ₹
        </button>
      </div>

      {/* ── 3D Viewer ───────────────────────────────────── */}
      <div style={{
        height: viewerH, flexShrink: 0, position: "relative",
        background: "linear-gradient(160deg,#f0ece4 0%,#e8e2d6 100%)",
        transition: "height 0.3s ease", overflow: "hidden",
      }}>
        {/* Placeholder model viewer */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{
            width: 140, height: 200,
            background: "linear-gradient(135deg, #d4c9b4 0%, #b8ad9a 100%)",
            borderRadius: 12, opacity: 0.5,
          }} />
          <span style={{ fontSize: 11, color: V.muted, letterSpacing: 1 }}>3D MODEL VIEWER</span>
        </div>

        {/* Undo/Redo top-left */}
        <div style={{
          position: "absolute", top: 10, left: 12,
          display: "flex", gap: 4,
        }}>
          {["↩", "↪"].map((icon, i) => (
            <button key={i} style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.85)", border: `1px solid ${V.border}`,
              fontSize: 14, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>{icon}</button>
          ))}
        </div>

        {/* Design name top-right */}
        <div style={{
          position: "absolute", top: 10, right: 12,
          background: "rgba(255,255,255,0.85)", border: `1px solid ${V.border}`,
          borderRadius: 8, padding: "0 10px", height: 32,
          display: "flex", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: V.muted }}>Name your design…</span>
        </div>

        {/* View angle pills */}
        <div style={{
          position: "absolute", bottom: 12, left: 0, right: 0,
          display: "flex", justifyContent: "center", gap: 6,
        }}>
          {["Front", "Back", "Left", "Right", "360°"].map((v, i) => (
            <button key={v} style={{
              padding: "4px 10px", borderRadius: 20,
              background: i === 0 ? V.accent : "rgba(255,255,255,0.85)",
              border: `1px solid ${i === 0 ? V.accent : V.border}`,
              color: i === 0 ? V.white : V.text,
              fontSize: 11, fontWeight: 500, cursor: "pointer",
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* ── Tool Panel (slides up) ──────────────────────── */}
      {panelOpen && (
        <div style={{
          flex: 1, background: V.panel, overflowY: "auto",
          borderTop: `2px solid ${V.border}`,
          display: "flex", flexDirection: "column",
        }}>
          {activeTool === "colors" && (
            <div style={{ padding: "14px 16px 80px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: V.muted, margin: "0 0 12px" }}>
                COLOUR ZONE
              </p>
              {/* Zone selector */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {COLOR_ZONES.map(z => (
                  <button key={z} onClick={() => setActiveZone(z)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8,
                    background: z === activeZone ? V.accentLight : V.white,
                    border: `1px solid ${z === activeZone ? V.accent : V.border}`,
                    color: z === activeZone ? V.accent : V.text,
                    fontSize: 11, fontWeight: z === activeZone ? 600 : 400,
                    cursor: "pointer",
                  }}>{z}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: V.muted, margin: "0 0 12px" }}>
                PALETTE
              </p>
              {/* Color grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8,
              }}>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setSelectedColor(c)} style={{
                    width: "100%", aspectRatio: "1",
                    borderRadius: 6, background: c,
                    border: `2px solid ${c === selectedColor ? V.accent : "transparent"}`,
                    boxShadow: c === selectedColor ? `0 0 0 2px ${V.white}, 0 0 0 4px ${V.accent}` : "none",
                    cursor: "pointer",
                  }} />
                ))}
              </div>
              {/* Selected swatch */}
              <div style={{
                marginTop: 16, display: "flex", alignItems: "center",
                gap: 10, padding: "10px 12px", background: V.white,
                borderRadius: 8, border: `1px solid ${V.border}`,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: selectedColor, border: `1px solid ${V.border}` }} />
                <span style={{ fontSize: 12, color: V.text, fontFamily: "monospace" }}>{selectedColor}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: V.accent, fontWeight: 600 }}>Apply</span>
              </div>
            </div>
          )}

          {activeTool === "products" && (
            <div style={{ padding: "14px 16px 80px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: V.muted, margin: "0 0 12px" }}>GARMENT TYPE</p>
              {[
                { title: "Solid Colour", sub: "Clean base colour + custom parts" },
                { title: "KA.SHA Pattern", sub: "Signature bespoke designs", active: true },
                { title: "All-Over Print", sub: "Full garment print library" },
              ].map(item => (
                <div key={item.title} style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                  background: item.active ? V.accentLight : V.white,
                  border: `1px solid ${item.active ? V.accent : V.border}`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: item.active ? V.accent : V.text }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>{item.sub}</div>
                </div>
              ))}
            </div>
          )}

          {(activeTool === "order") && (
            <div style={{ padding: "14px 16px 80px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: V.muted, margin: "0 0 12px" }}>SELECT SIZE</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {["XS","S","M","L","XL","XXL"].map(s => (
                  <button key={s} style={{
                    width: 52, height: 44, borderRadius: 8,
                    background: s === "M" ? V.accent : V.white,
                    border: `1px solid ${s === "M" ? V.accent : V.border}`,
                    color: s === "M" ? V.white : V.text,
                    fontSize: 13, fontWeight: s === "M" ? 700 : 400, cursor: "pointer",
                  }}>{s}</button>
                ))}
              </div>
              <div style={{ padding: "14px", background: V.white, borderRadius: 10, border: `1px solid ${V.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: V.muted }}>KA.SHA Pattern Polo</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>₹8,500</span>
                </div>
                <button style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  background: V.accent, color: V.white, border: "none",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
                }}>Add to Cart</button>
              </div>
            </div>
          )}

          {(activeTool !== "colors" && activeTool !== "products" && activeTool !== "order") && (
            <div style={{ padding: "14px 16px 80px", textAlign: "center", color: V.muted, fontSize: 13, paddingTop: 40 }}>
              {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} panel
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Tab Bar ─────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 68, background: V.navBg,
        display: "flex", alignItems: "center",
        borderTop: `1px solid #333`,
        zIndex: 20, paddingBottom: 4,
      }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id === activeTool ? "colors" : tool.id)} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer",
            padding: "8px 2px",
          }}>
            <span style={{ fontSize: tool.id === "text" ? 14 : 18, lineHeight: 1 }}>
              {tool.icon}
            </span>
            <span style={{
              fontSize: 9, letterSpacing: 0.5,
              color: tool.id === activeTool ? V.navText : "#666",
              fontWeight: tool.id === activeTool ? 700 : 400,
            }}>{tool.label}</span>
            {tool.id === activeTool && (
              <div style={{
                position: "absolute", bottom: 4,
                width: 4, height: 4, borderRadius: 2, background: V.accent,
              }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
