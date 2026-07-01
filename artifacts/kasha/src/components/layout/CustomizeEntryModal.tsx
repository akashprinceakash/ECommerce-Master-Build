/**
 * CustomizeEntryModal — Studio entry point.
 * Two tabs: Bespoke Studio (existing) · Social Clubs (Q Club measurements order)
 */
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useListProducts, getListProductsQueryKey, useCreateClubOrder } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { parseSku } from "@/components/3d/sku-config";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── Bespoke: Canonical entry-point SKUs ──────────────────────────────────────
const ENTRY_SKUS = {
  solid:   "KS1000BPINK",
  printed: "KS1000BGP003",
} as const;

const FIXED_TILE_CONFIG = [
  { key: "solid" as const,   label: "Solid",   desc: "Clean base colours, ready to personalise", accent: "#6b8fa3", icon: "◼" },
  { key: "printed" as const, label: "Printed", desc: "All-over prints from the KA.SHA library",  accent: "#a36b6b", icon: "✦" },
];

function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern") return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  if (result.type === "print")   return `/products/${productId}/customize?entry=1&style=print&design=${encodeURIComponent(sku)}`;
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

// ── Q Club garment options ────────────────────────────────────────────────────
const QCLUB_GARMENTS = [
  { key: "men_polo",   label: "Men's Polo",   icon: "👔", desc: "Classic performance polo" },
  { key: "women_polo", label: "Women's Polo", icon: "👗", desc: "Tailored women's polo" },
  { key: "boys_polo",  label: "Boys' Polo",   icon: "🧒", desc: "Junior performance polo" },
  { key: "girls_polo", label: "Girls' Polo",  icon: "👧", desc: "Junior girls' polo" },
] as const;

type QClubGarmentKey = typeof QCLUB_GARMENTS[number]["key"];

// ── Measurement fields ────────────────────────────────────────────────────────
const MEASUREMENT_FIELDS = [
  { key: "height",       label: "Height",         unit: "cm", placeholder: "e.g. 175" },
  { key: "weight",       label: "Weight",         unit: "kg", placeholder: "e.g. 70"  },
  { key: "chest",        label: "Chest / Bust",   unit: "cm", placeholder: "e.g. 96"  },
  { key: "waist",        label: "Waist",          unit: "cm", placeholder: "e.g. 80"  },
  { key: "hip",          label: "Hip",            unit: "cm", placeholder: "e.g. 100" },
  { key: "shoulder",     label: "Shoulder Width", unit: "cm", placeholder: "e.g. 44"  },
  { key: "sleeveLength", label: "Sleeve Length",  unit: "cm", placeholder: "e.g. 62"  },
  { key: "neck",         label: "Neck",           unit: "cm", placeholder: "e.g. 38"  },
  { key: "torsoLength",  label: "Body Length",    unit: "cm", placeholder: "e.g. 72"  },
  { key: "inseam",       label: "Inseam",         unit: "cm", placeholder: "e.g. 78"  },
] as const;

type MeasurementKey = typeof MEASUREMENT_FIELDS[number]["key"];
type Measurements = Partial<Record<MeasurementKey, string>>;

// ── Colours ──────────────────────────────────────────────────────────────────
const GOLD = "#c9a84c";
const NAVY = "#0d1b35";
const CREAM = "#fafaf7";

// ── Auth-gate (shared) ────────────────────────────────────────────────────────
function AuthGate({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: "linear-gradient(135deg, #fdf6e3, #f5e9c4)",
        border: "1.5px solid rgba(201,168,76,0.3)",
        margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
      }}>✦</div>
      <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>KA.SHA Studio</div>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#1a1a18", margin: "0 0 10px", lineHeight: 1.25 }}>Sign in to continue</h2>
      <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#6b6b68", lineHeight: 1.7, letterSpacing: ".02em", marginBottom: 24 }}>
        Create an account or sign in to place your order and save your preferences.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a href="/sign-up" onClick={onClose} style={{ display: "block", padding: "12px 24px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none", boxShadow: `0 4px 16px ${GOLD}44` }}>
          Create Account
        </a>
        <a href="/sign-in" onClick={onClose} style={{ display: "block", padding: "11px 24px", borderRadius: 99, background: "transparent", border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>
          Sign In
        </a>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<"bespoke" | "social">("bespoke");

  // Q Club state
  const [qStep, setQStep] = useState<"clubs" | "garment" | "measurements" | "success">("clubs");
  const [selectedGarment, setSelectedGarment] = useState<QClubGarmentKey | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { mutateAsync: createClubOrder } = useCreateClubOrder();

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: allProducts, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), enabled: isOpen && activeTab === "bespoke" } }
  );

  if (!isOpen) return null;

  // ── Reset Q Club state when switching tabs ─────────────────────────────────
  function switchTab(tab: "bespoke" | "social") {
    setActiveTab(tab);
    if (tab === "social") { setQStep("clubs"); setSelectedGarment(null); setMeasurements({}); setNotes(""); setSubmitError(""); }
  }

  // ── Bespoke helpers ────────────────────────────────────────────────────────
  function resolveProduct(sku: string) {
    return (allProducts ?? []).find(p => (p.sku ?? "").toUpperCase() === sku.toUpperCase() && p.available) ?? null;
  }

  function handleBespokeSelect(productId: number, sku: string) {
    onClose();
    navigate(buildHref(productId, sku) + "&from=modal");
  }

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
  };

  // ── Q Club submit ──────────────────────────────────────────────────────────
  async function handleQClubSubmit() {
    if (!selectedGarment) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createClubOrder({
        data: {
          clubName: "Q Club",
          garmentType: selectedGarment,
          measurements,
          notes: notes || undefined,
        },
      });
      setQStep("success");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Back navigation within Q Club flow ────────────────────────────────────
  function qBack() {
    if (qStep === "measurements") { setQStep("garment"); setSelectedGarment(null); }
    else if (qStep === "garment") { setQStep("clubs"); }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26,26,24,0.62)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cem-sheet" style={{ background: CREAM, borderRadius: 20, maxWidth: 760, width: "calc(100vw - 32px)", padding: "36px 32px 38px", position: "relative", animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 32px 80px rgba(26,26,24,0.24), 0 8px 24px rgba(26,26,24,0.12)", maxHeight: "92vh", overflowY: "auto" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 18, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(26,26,24,0.12)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#8a8780", transition: "all 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1.5px solid rgba(26,26,24,0.1)", marginBottom: 28, marginTop: 4 }}>
          {(["bespoke", "social"] as const).map(tab => {
            const labels = { bespoke: "Bespoke Studio", social: "Social Clubs" };
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => switchTab(tab)} style={{ flex: 1, padding: "10px 8px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: active ? NAVY : "#a0998e", borderBottom: active ? `2.5px solid ${GOLD}` : "2.5px solid transparent", marginBottom: -1.5, transition: "all 0.2s" }}>
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── Auth gate ────────────────────────────────────────────────────── */}
        {isLoaded && !user ? (
          <AuthGate onClose={onClose} />
        ) : activeTab === "bespoke" ? (
          /* ── Bespoke Studio tab ──────────────────────────────────────────── */
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>KA.SHA Bespoke Studio</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "#1a1a18", letterSpacing: ".02em", margin: "0 0 8px", lineHeight: 1.2 }}>Choose Your Style</h2>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", letterSpacing: ".04em", fontStyle: "italic", margin: 0 }}>Select a style — the 3D studio opens ready for your customisation</p>
            </div>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.4, marginBottom: 28 }} />
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div style={{ position: "relative" }}>
                <button onClick={() => scroll("left")} className="cem-nav-btn cem-nav-left" aria-label="Scroll left">‹</button>
                <button onClick={() => scroll("right")} className="cem-nav-btn cem-nav-right" aria-label="Scroll right">›</button>
                <div ref={scrollRef} className="cem-tiles">
                  {FIXED_TILE_CONFIG.map(tile => {
                    const sku = ENTRY_SKUS[tile.key];
                    const product = resolveProduct(sku);
                    return (
                      <StyleTile key={tile.key} label={tile.label} desc={tile.desc} accent={tile.accent} icon={tile.icon}
                        thumbnail={product ? (getAssetUrl(product.thumbnailUrl) ?? "") : ""}
                        productName={product?.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "") ?? ""}
                        disabled={!product}
                        onSelect={() => product && handleBespokeSelect(product.id, sku)}
                      />
                    );
                  })}
                  {(allProducts ?? []).filter(p => p.available && parseSku(p.sku ?? "").type === "pattern").map(p => (
                    <StyleTile key={p.id} label="Pattern" desc={p.description ?? "Bespoke geometric & signature pattern"} accent="#6ba37a" icon="◈"
                      thumbnail={getAssetUrl(p.thumbnailUrl) ?? ""}
                      productName={p.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "")}
                      disabled={false}
                      onSelect={() => handleBespokeSelect(p.id, p.sku ?? "")}
                    />
                  ))}
                </div>
              </div>
            )}
            <p style={{ textAlign: "center", marginTop: 24, fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".08em", fontStyle: "italic" }}>
              The 3D model loads with the product's colour or print pre-applied · Customise freely from there
            </p>
          </>
        ) : (
          /* ── Social Clubs tab ────────────────────────────────────────────── */
          <SocialClubsTab
            step={qStep}
            selectedGarment={selectedGarment}
            measurements={measurements}
            notes={notes}
            submitting={submitting}
            submitError={submitError}
            onSelectGarment={g => { setSelectedGarment(g); setQStep("measurements"); }}
            onMeasurementChange={(k, v) => setMeasurements(prev => ({ ...prev, [k]: v }))}
            onNotesChange={setNotes}
            onSubmit={handleQClubSubmit}
            onBack={qBack}
            onDone={() => { onClose(); setQStep("clubs"); setSelectedGarment(null); setMeasurements({}); setNotes(""); }}
            onSelectClub={() => setQStep("garment")}
          />
        )}
      </div>

      <style>{`
        @keyframes cemFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cemSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cemPulse   { 0%,100% { opacity:.5 } 50% { opacity:.85 } }
        .cem-sheet::-webkit-scrollbar { width: 4px; }
        .cem-sheet::-webkit-scrollbar-track { background: transparent; }
        .cem-sheet::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 99px; }
        .cem-tiles {
          display: flex; flex-direction: row; gap: 16px;
          overflow-x: auto; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 4px 2px 12px; scrollbar-width: none;
        }
        .cem-tiles::-webkit-scrollbar { display: none; }
        .cem-tile { flex: 0 0 200px; scroll-snap-align: start; }
        .cem-nav-btn {
          position: absolute; top: 50%; transform: translateY(-60%);
          width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid rgba(201,168,76,0.35);
          background: rgba(250,250,247,0.95); color: #1a1a18;
          font-size: 22px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 2; box-shadow: 0 2px 10px rgba(26,26,24,0.1); transition: all 0.2s;
        }
        .cem-nav-btn:hover { background: #c9a84c; color: #fff; border-color: #c9a84c; }
        .cem-nav-left  { left: -14px; }
        .cem-nav-right { right: -14px; }
        .cem-meas-input {
          width: 100%; padding: 7px 10px; border: 1.5px solid rgba(26,26,24,0.12);
          border-radius: 6px; font-family: 'Jost', sans-serif; font-size: 12px;
          color: #1a1a18; background: #fff; outline: none; transition: border-color 0.18s;
          box-sizing: border-box;
        }
        .cem-meas-input:focus { border-color: #c9a84c; }
        .cem-meas-input::placeholder { color: #bbb; }
        @media (max-width: 640px) {
          .cem-sheet { padding: 20px 14px 24px !important; border-radius: 14px !important; width: calc(100vw - 16px) !important; }
          .cem-tile { flex: 0 0 72vw; }
          .cem-nav-left  { left: -10px; }
          .cem-nav-right { right: -10px; }
        }
      `}</style>
    </div>
  );
}

// ── Social Clubs Tab ──────────────────────────────────────────────────────────
function SocialClubsTab({
  step, selectedGarment, measurements, notes, submitting, submitError,
  onSelectClub, onSelectGarment, onMeasurementChange, onNotesChange,
  onSubmit, onBack, onDone,
}: {
  step: "clubs" | "garment" | "measurements" | "success";
  selectedGarment: QClubGarmentKey | null;
  measurements: Measurements;
  notes: string;
  submitting: boolean;
  submitError: string;
  onSelectClub: () => void;
  onSelectGarment: (g: QClubGarmentKey) => void;
  onMeasurementChange: (k: MeasurementKey, v: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onDone: () => void;
}) {
  if (step === "success") {
    return (
      <div style={{ textAlign: "center", padding: "32px 0 16px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #d4edda, #c3e6cb)", border: "1.5px solid #a8d5b5", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>Order Received</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: "0 0 12px" }}>Your Q Club order is placed</h2>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, marginBottom: 28 }}>
          We've received your measurements and will be in touch to confirm the details. Thank you!
        </p>
        <button onClick={onDone} style={{ padding: "12px 36px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", border: "none", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 4px 16px ${GOLD}44` }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {step !== "clubs" && (
          <button onClick={onBack} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "1.5px solid rgba(26,26,24,0.12)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#666", transition: "all 0.18s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >‹</button>
        )}
        <div style={{ flex: 1, textAlign: step === "clubs" ? "center" : "left" }}>
          {step === "clubs" && (
            <>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 6, fontWeight: 500 }}>Social Clubs</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Select Your Club</h2>
            </>
          )}
          {step === "garment" && (
            <>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 4, fontWeight: 500 }}>Q Club · Social Clubs</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Choose Your Garment</h2>
            </>
          )}
          {step === "measurements" && (
            <>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 4, fontWeight: 500 }}>Q Club · {QCLUB_GARMENTS.find(g => g.key === selectedGarment)?.label}</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Your Measurements</h2>
            </>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.35, marginBottom: 24 }} />

      {/* ── Clubs list ──────────────────────────────────────────────────────── */}
      {step === "clubs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ClubCard
            name="Q Club"
            description="Partner club — order your polo with custom measurements"
            badge="Partner"
            badgeColor={NAVY}
            onClick={onSelectClub}
          />
          <div style={{ textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic", marginTop: 8 }}>
            More clubs coming soon
          </div>
        </div>
      )}

      {/* ── Garment selection ────────────────────────────────────────────────── */}
      {step === "garment" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {QCLUB_GARMENTS.map(g => (
              <button key={g.key} onClick={() => onSelectGarment(g.key)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "22px 16px", border: `1.5px solid ${NAVY}22`, borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.22s", boxShadow: "0 2px 10px rgba(26,26,24,0.05)" }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = GOLD; el.style.transform = "translateY(-3px)"; el.style.boxShadow = `0 10px 28px ${GOLD}22, 0 4px 12px rgba(26,26,24,0.08)`; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = `${NAVY}22`; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.05)"; }}
              >
                <span style={{ fontSize: 32 }}>{g.icon}</span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18", marginBottom: 3 }}>{g.label}</div>
                  <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9.5, color: "#8a8780", letterSpacing: ".04em" }}>{g.desc}</div>
                </div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 8.5, fontWeight: 600, color: GOLD, letterSpacing: ".1em", textTransform: "uppercase" }}>Select →</div>
              </button>
            ))}
          </div>
          <p style={{ marginTop: 18, textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic" }}>
            Women's, Boys' and Girls' follow the same measurement flow
          </p>
        </>
      )}

      {/* ── Measurements form ────────────────────────────────────────────────── */}
      {step === "measurements" && (
        <>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#6b6b68", lineHeight: 1.7, marginBottom: 20, marginTop: -4 }}>
            Enter your measurements in centimetres (cm) or kilograms (kg) as indicated. Fill in as many as you can — leave blank if unsure.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 20 }}>
            {MEASUREMENT_FIELDS.map(field => (
              <div key={field.key}>
                <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 5 }}>
                  {field.label} <span style={{ color: "#b8b5ae", fontWeight: 400 }}>({field.unit})</span>
                </label>
                <input
                  className="cem-meas-input"
                  type="text"
                  inputMode="decimal"
                  placeholder={field.placeholder}
                  value={measurements[field.key] ?? ""}
                  onChange={e => onMeasurementChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 5 }}>
              Additional Notes <span style={{ color: "#b8b5ae", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              className="cem-meas-input"
              rows={3}
              placeholder="Any special requests or fitting notes…"
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
              style={{ resize: "vertical", minHeight: 64 }}
            />
          </div>
          {submitError && (
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#c0392b", marginBottom: 14, textAlign: "center" }}>{submitError}</p>
          )}
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{ width: "100%", padding: "14px", borderRadius: 99, background: submitting ? "#d4c5a0" : `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", border: "none", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : `0 4px 16px ${GOLD}44`, transition: "all 0.2s" }}
          >
            {submitting ? "Submitting…" : "Submit Q Club Order"}
          </button>
          <p style={{ marginTop: 12, textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic" }}>
            Our team will review and confirm your order shortly
          </p>
        </>
      )}
    </>
  );
}

// ── Club card ─────────────────────────────────────────────────────────────────
function ClubCard({ name, description, badge, badgeColor, onClick }: { name: string; description: string; badge: string; badgeColor: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 22px", border: `1.5px solid ${NAVY}18`, borderRadius: 14, background: "#fff", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.22s", boxShadow: "0 2px 10px rgba(26,26,24,0.05)" }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = GOLD; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 10px 28px ${GOLD}22`; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = `${NAVY}18`; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.05)"; }}
    >
      {/* Club crest placeholder */}
      <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg, ${NAVY}18, ${NAVY}0c)`, border: `1.5px solid ${NAVY}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: "-.02em" }}>Q</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: "#1a1a18" }}>{name}</span>
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: badgeColor, padding: "2px 8px", borderRadius: 99 }}>{badge}</span>
        </div>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 10.5, color: "#8a8780", letterSpacing: ".03em", lineHeight: 1.6, margin: 0 }}>{description}</p>
      </div>
      <span style={{ fontSize: 20, color: "#c0bbb4", flexShrink: 0 }}>›</span>
    </button>
  );
}

// ── Style tile (Bespoke) ──────────────────────────────────────────────────────
function StyleTile({ label, desc, accent, icon, thumbnail, productName, disabled, onSelect }: {
  label: string; desc: string; accent: string; icon: string;
  thumbnail: string; productName: string; disabled: boolean; onSelect: () => void;
}) {
  return (
    <button onClick={onSelect} disabled={disabled} className="cem-tile"
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 0, border: `1.5px solid ${accent}33`, borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer", background: "#fff", overflow: "hidden", textAlign: "left", transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 2px 10px rgba(26,26,24,0.06)", opacity: disabled ? 0.45 : 1, minWidth: 0 }}
      onMouseEnter={e => { if (disabled) return; const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 36px ${accent}28, 0 4px 14px rgba(26,26,24,0.08)`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${accent}33`; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
    >
      <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: `linear-gradient(160deg, ${accent}12, ${accent}06)`, flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {thumbnail ? (
          <img src={thumbnail} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block", padding: "8px" }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }} />
        ) : (
          <span style={{ fontSize: 36, opacity: 0.18, color: accent }}>{icon}</span>
        )}
        <div style={{ position: "absolute", top: 10, left: 10, background: accent, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 99, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>{label}</div>
      </div>
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18", lineHeight: 1.25, marginBottom: 4 }}>{productName || `${label} T-Shirt`}</div>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 9.5, color: "#8a8780", letterSpacing: ".04em", lineHeight: 1.6, margin: "0 0 10px" }}>{desc}</p>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 8.5, fontWeight: 600, color: accent, letterSpacing: ".1em", textTransform: "uppercase" }}>{disabled ? "Coming Soon" : "Open in Studio →"}</div>
      </div>
    </button>
  );
}

// ── Loading skeleton (Bespoke) ────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="cem-tiles">
      {[0, 1, 2].map(i => (
        <div key={i} style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(26,26,24,0.07)", animation: "cemPulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}>
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
