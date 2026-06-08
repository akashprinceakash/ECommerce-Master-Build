import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";

const GOLD = "#B8925A";
const TX = "#0A0A0A";
const MUTED = "rgba(0,0,0,0.55)";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";
const BG = "#FAFAF7";

type Row = (string | number)[];

function MeasurementTable({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT_UI, fontSize: 13, minWidth: 420 }}>
        <thead>
          <tr style={{ background: "#0A0A0A" }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "12px 18px",
                textAlign: i === 0 ? "left" : "center",
                color: GOLD, fontWeight: 600,
                letterSpacing: "0.2em", fontSize: 11,
                textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#F5F2EC" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "11px 18px",
                  textAlign: ci === 0 ? "left" : "center",
                  color: ci === 0 ? TX : MUTED,
                  fontWeight: ci === 0 ? 700 : 400,
                  letterSpacing: ci === 0 ? "0.15em" : "0.06em",
                  fontSize: 13,
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ChartView = "body" | "garment";

interface SectionData {
  title: string;
  body: { headers: string[]; rows: Row[] };
  garment: { headers: string[]; rows: Row[] };
}

function Section({ data, view }: { data: SectionData; view: ChartView }) {
  const table = view === "body" ? data.body : data.garment;
  const subtitle = view === "body"
    ? "Body measurements · inches"
    : "Garment measurements · inches";
  return (
    <div style={{ marginBottom: 52 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(22px, 2.5vw, 30px)", fontWeight: 400, color: TX, letterSpacing: "0.02em", marginBottom: 6 }}>
          {data.title}
        </h2>
        <p style={{ fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.12em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>
          {subtitle}
        </p>
        <div style={{ width: 32, height: 1, background: GOLD, marginTop: 10 }} />
      </div>
      <MeasurementTable headers={table.headers} rows={table.rows} />
    </div>
  );
}

function GenderDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
      <div style={{ height: 1, flex: 1, background: "rgba(0,0,0,0.08)" }} />
      <span style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: "rgba(0,0,0,0.08)" }} />
    </div>
  );
}

// ── Chart data ────────────────────────────────────────────────────────────────

const MEN_TSHIRT: SectionData = {
  title: "T-Shirts",
  body: {
    headers: ["Size", "Chest", "Length", "Shoulder", "Sleeve Length"],
    rows: [
      ["XS", 34, 29, 16, "8.5"],
      ["S", 36, 29, "16.5", "8.5"],
      ["M", 38, 29, 17, 9],
      ["L", 40, 29, "17.5", "9.5"],
      ["XL", 42, 29, 18, "9.5"],
      ["XXL", 45, 29, 19, 10],
    ],
  },
  garment: {
    headers: ["Size", "Chest", "Length", "Shoulder", "Sleeve Length"],
    rows: [
      ["XS", 38, 28, 16, "8.5"],
      ["S", 40, 29, "16.5", "8.5"],
      ["M", 42, 29, 17, 9],
      ["L", 44, 29, "17.5", "9.5"],
      ["XL", 46, 29, 18, "9.5"],
      ["XXL", 49, 29, 19, 10],
    ],
  },
};

const MEN_PANTS: SectionData = {
  title: "Pants",
  body: {
    headers: ["Size", "Waist", "Length", "Hip", "Thigh"],
    rows: [
      ["XS", 28, 42, 36, 21],
      ["S", 30, 42, 38, 22],
      ["M", 32, 42, 40, 23],
      ["L", 34, 42, 42, 24],
      ["XL", 36, 42, 44, 25],
      ["XXL", 38, 42, 46, 26],
    ],
  },
  garment: {
    headers: ["Size", "Waist", "Length", "Hip", "Thigh"],
    rows: [
      ["XS", 28, 42, "38.5", "23.5"],
      ["S", 30, 42, "40.5", "24.5"],
      ["M", 32, 42, "42.5", "25.5"],
      ["L", 34, 42, "44.5", "26.5"],
      ["XL", 36, 42, "46.5", "27.5"],
      ["XXL", 38, 42, "48.5", "28.5"],
    ],
  },
};

const MEN_SHORTS: SectionData = {
  title: "Shorts",
  body: {
    headers: ["Size", "Waist", "Length", "Hip", "Thigh"],
    rows: [
      ["XS", 28, "19.5", 36, 21],
      ["S", 30, "19.5", 38, 22],
      ["M", 32, 20, 40, 23],
      ["L", 34, 20, 42, 24],
      ["XL", 36, "20.5", 44, 25],
      ["XXL", 38, 21, 46, 26],
    ],
  },
  garment: {
    headers: ["Size", "Waist", "Length", "Hip", "Thigh"],
    rows: [
      ["XS", 28, "19.5", "38.5", "24.5"],
      ["S", 30, "19.5", "40.5", "25.5"],
      ["M", 32, 20, "42.5", "26.5"],
      ["L", 34, 20, "44.5", "27.5"],
      ["XL", 36, "20.5", "46.5", "28.5"],
      ["XXL", 38, 21, "48.5", "29.5"],
    ],
  },
};

const WOMEN_TSHIRT: SectionData = {
  title: "T-Shirts",
  body: {
    headers: ["Size", "Chest", "Length", "Shoulder", "Sleeve Length", "Waist"],
    rows: [
      ["XS", 32, "24.5", 13, "6.5", 30],
      ["S", 34, 25, "13.5", "6.5", 32],
      ["M", 36, "25.5", 14, 7, 34],
      ["L", 38, "25.5", "14.5", "7.5", 36],
      ["XL", 40, 26, 15, "7.5", 38],
      ["XXL", 45, 26, "15.5", "7.5", 43],
    ],
  },
  garment: {
    headers: ["Size", "Chest", "Length", "Shoulder", "Sleeve Length", "Waist"],
    rows: [
      ["XS", 35, "24.5", 13, "6.5", 33],
      ["S", 37, 25, "13.5", "6.5", 35],
      ["M", 39, "25.5", 14, 7, 37],
      ["L", 41, "25.5", "14.5", 7, 39],
      ["XL", 43, 26, 15, "7.5", 41],
      ["XXL", 45, 26, "15.5", "7.5", 43],
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function SizeGuidePage() {
  useEffect(() => { document.title = "Size Guide — Ka.Sha"; }, []);
  const [view, setView] = useState<ChartView>("body");

  return (
    <Layout>
      {/* Header */}
      <div style={{ background: "#F5F2EC", borderBottom: "1px solid rgba(184,146,90,0.25)", padding: "52px 24px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>
          Ka.Sha — Sizing
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 400, color: TX, letterSpacing: "0.02em", marginBottom: 14 }}>
          Size Guide
        </h1>
        <p style={{ fontFamily: FONT_UI, fontSize: 13, letterSpacing: "0.1em", color: MUTED, maxWidth: 580, margin: "0 auto", lineHeight: 1.8 }}>
          Toggle between <strong>body measurements</strong> (your actual body) and <strong>garment measurements</strong> (finished garment dimensions).
          When between sizes, we recommend sizing up for a more relaxed fit.
        </p>
      </div>

      <div style={{ background: BG, minHeight: "calc(100vh - 64px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 80px" }}>

          {/* Tip banner */}
          <div style={{
            background: "rgba(184,146,90,0.08)", border: "1px solid rgba(184,146,90,0.3)",
            padding: "14px 20px", marginBottom: 36, display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <span style={{ color: GOLD, fontSize: 18, lineHeight: 1, marginTop: 1 }}>✦</span>
            <p style={{ fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.08em", color: MUTED, lineHeight: 1.7 }}>
              <strong style={{ color: TX }}>Need a perfect fit?</strong> Use our <strong>Custom Studio</strong> to enter your exact measurements and get a garment made precisely to your body — no guesswork required.
            </p>
          </div>

          {/* ── Chart type toggle ── */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 52 }}>
            <div style={{
              display: "inline-flex",
              border: `1px solid rgba(184,146,90,0.4)`,
              overflow: "hidden",
            }}>
              {(["body", "garment"] as ChartView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "10px 28px",
                    fontFamily: FONT_UI,
                    fontSize: 10,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: "pointer",
                    background: view === v ? TX : "transparent",
                    color: view === v ? "#fff" : MUTED,
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {v === "body" ? "Body Measurements" : "Garment Measurements"}
                </button>
              ))}
            </div>
          </div>

          {/* Context note */}
          <div style={{
            background: view === "body" ? "rgba(10,10,10,0.03)" : "rgba(184,146,90,0.06)",
            border: `1px solid ${view === "body" ? "rgba(0,0,0,0.08)" : "rgba(184,146,90,0.2)"}`,
            padding: "10px 16px", marginBottom: 48,
            fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.06em", color: MUTED, lineHeight: 1.6,
          }}>
            {view === "body"
              ? "↑ These are your body measurements. Use a measuring tape directly on your body to find the right size."
              : "↑ These are the finished garment dimensions — the actual size of the clothing after production."}
          </div>

          {/* ── MEN ── */}
          <div style={{ marginBottom: 60 }}>
            <GenderDivider label="Men" />
            <Section data={MEN_TSHIRT} view={view} />
            <Section data={MEN_PANTS} view={view} />
            <Section data={MEN_SHORTS} view={view} />
          </div>

          {/* ── WOMEN ── */}
          <div>
            <GenderDivider label="Women" />
            <Section data={WOMEN_TSHIRT} view={view} />
          </div>

          {/* How to measure */}
          <div style={{
            marginTop: 56, padding: "32px 28px",
            background: "#fff", border: "1px solid rgba(184,146,90,0.2)",
          }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, color: TX, marginBottom: 20 }}>
              How to Measure
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
              {[
                { label: "Chest", desc: "Measure around the fullest part of your chest, keeping the tape horizontal." },
                { label: "Waist", desc: "Measure around your natural waistline, at the narrowest part of your torso." },
                { label: "Hip", desc: "Measure around the fullest part of your hips, about 8 inches below your waist." },
                { label: "Shoulder", desc: "Measure from the tip of one shoulder to the tip of the other, across the back." },
                { label: "Length", desc: "Measure from the highest point of your shoulder down to where you'd like the garment to end." },
                { label: "Thigh", desc: "Measure around the fullest part of your thigh when standing naturally." },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
                    {item.label}
                  </p>
                  <p style={{ fontFamily: FONT_UI, fontSize: 12, color: MUTED, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <p style={{ fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.12em", color: MUTED, marginBottom: 20 }}>
              Still unsure? Our team is happy to help you find the right fit.
            </p>
            <a
              href="https://mail.google.com/mail/?view=cm&to=support@kashaonline.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block", fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.3em",
                textTransform: "uppercase", background: GOLD, color: "#fff",
                padding: "14px 44px", textDecoration: "none",
              }}
            >
              Contact Us
            </a>
          </div>

        </div>
      </div>
    </Layout>
  );
}
