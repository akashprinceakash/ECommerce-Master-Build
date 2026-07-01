import { useState } from "react";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useCreateClubOrder } from "@workspace/api-client-react";

const GOLD  = "#B8925A";
const NAVY  = "#0d1b35";
const CREAM = "#fafaf7";

// ── Q Club polo variants ──────────────────────────────────────────────────────
const QCLUB_VARIANTS = [
  { key: "red_wave",    label: "Red Wave",    image: "/q-club/polo-red.jpeg",    bg: "#6b0a0a" },
  { key: "slate_wave",  label: "Slate Wave",  image: "/q-club/polo-slate.jpeg",  bg: "#2a3a4a" },
  { key: "navy_wave",   label: "Navy Wave",   image: "/q-club/polo-navy.jpeg",   bg: "#0a1428" },
  { key: "maroon_wave", label: "Maroon Wave", image: "/q-club/polo-maroon.jpeg", bg: "#3a0a14" },
] as const;

type VariantKey = typeof QCLUB_VARIANTS[number]["key"];

// ── Measurement fields ────────────────────────────────────────────────────────
const FIELDS = [
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

type MeasKey = typeof FIELDS[number]["key"];

export default function SocialClubsPage() {
  const { user, isLoaded } = useUser();

  // Q Club flow state
  type Step = "landing" | "variant" | "measurements" | "success";
  const [step, setStep]                         = useState<Step>("landing");
  const [selectedVariant, setSelectedVariant]   = useState<VariantKey | null>(null);
  const [measurements, setMeasurements]         = useState<Partial<Record<MeasKey, string>>>({});
  const [notes, setNotes]                       = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState("");

  const { mutateAsync: createClubOrder } = useCreateClubOrder();

  const variantInfo = QCLUB_VARIANTS.find(v => v.key === selectedVariant);

  function reset() {
    setStep("landing");
    setSelectedVariant(null);
    setMeasurements({});
    setNotes("");
    setError("");
  }

  async function handleSubmit() {
    if (!selectedVariant) return;
    setSubmitting(true);
    setError("");
    try {
      await createClubOrder({
        data: {
          clubName: "Q Club",
          garmentType: selectedVariant,
          measurements: { ...measurements },
          notes: notes || undefined,
        },
      });
      setStep("success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      {/* ── Hero ───────────────────────────────────────────────────────────────── */}
      <section style={{ background: NAVY, padding: "80px 24px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: GOLD, marginBottom: 16, fontWeight: 500 }}>
            KA.SHA Partnerships
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: CREAM, margin: "0 0 16px", lineHeight: 1.15 }}>
            Social Golf Clubs
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 14, color: "rgba(250,250,247,0.65)", letterSpacing: ".04em", lineHeight: 1.8, margin: 0 }}>
            Give your group a shared identity without anyone feeling like they settled.<br />
            Partner clubs receive exclusive garment options and bespoke measurement ordering.
          </p>
        </div>
      </section>

      {/* ── Divider ────────────────────────────────────────────────────────────── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <section style={{ background: CREAM, padding: "60px 24px 80px", minHeight: "60vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* ── Step: landing — partner clubs list ──────────────────────────── */}
          {step === "landing" && (
            <>
              <div style={{ marginBottom: 40, textAlign: "center" }}>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>
                  Current Partners
                </div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: "#1a1a18", margin: 0 }}>
                  Select Your Club
                </h2>
              </div>

              {/* Q Club card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setStep("variant")}
                onKeyDown={e => e.key === "Enter" && setStep("variant")}
                style={{ display: "flex", gap: 0, borderRadius: 14, overflow: "hidden", border: `1.5px solid rgba(201,168,76,0.22)`, background: "#fff", cursor: "pointer", transition: "all 0.24s", boxShadow: "0 4px 18px rgba(26,26,24,0.07)", maxWidth: 680, margin: "0 auto 16px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 14px 40px ${GOLD}28`; (e.currentTarget as HTMLElement).style.borderColor = `${GOLD}55`; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 18px rgba(26,26,24,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.22)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                {/* Q emblem */}
                <div style={{ flexShrink: 0, width: 120, background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "24px 16px" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 700, color: GOLD, lineHeight: 1 }}>Q</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(201,168,76,0.7)" }}>Club</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, padding: "22px 24px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#1a1a18" }}>Q Club</span>
                    <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: NAVY, padding: "3px 10px", borderRadius: 99 }}>Partner</span>
                  </div>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", letterSpacing: ".03em", lineHeight: 1.7, margin: "0 0 14px" }}>
                    Exclusive wave-camo polo collection for Q Club members. Choose your colourway and submit your custom measurements for a perfectly tailored fit.
                  </p>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: GOLD }}>
                    Order Now →
                  </span>
                </div>
              </div>

              <p style={{ textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic", marginTop: 24 }}>
                More partner clubs coming soon
              </p>

              {/* Auth nudge if not signed in */}
              {isLoaded && !user && (
                <div style={{ marginTop: 40, padding: "22px 28px", background: "#f4f0e8", borderRadius: 12, border: `1px solid ${GOLD}22`, textAlign: "center", maxWidth: 480, marginInline: "auto" }}>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, margin: "0 0 14px" }}>
                    Sign in to place your Q Club order and track your measurements history.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/sign-in" style={{ padding: "10px 24px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
                    <Link href="/sign-up" style={{ padding: "9px 24px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Create Account</Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step: variant — 4 polo colour cards ─────────────────────────── */}
          {step === "variant" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <BackBtn onClick={() => setStep("landing")} />
                <div>
                  <Breadcrumb parts={["Social Clubs", "Q Club"]} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Choose Your Polo</h2>
                </div>
              </div>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#8a8780", letterSpacing: ".03em", marginBottom: 28, marginTop: -20 }}>
                Four exclusive Q Club wave-camo designs, each with the signature gold Q logo
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 18 }}>
                {QCLUB_VARIANTS.map(v => (
                  <button key={v.key}
                    onClick={() => { setSelectedVariant(v.key); setStep("measurements"); }}
                    style={{ padding: 0, border: "2px solid rgba(26,26,24,0.08)", borderRadius: 14, background: "#fff", cursor: "pointer", overflow: "hidden", transition: "all 0.22s", boxShadow: "0 2px 10px rgba(26,26,24,0.06)", textAlign: "left" }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = GOLD; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 34px ${GOLD}24`; }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "rgba(26,26,24,0.08)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
                  >
                    {/* Product image */}
                    <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: v.bg, position: "relative" }}>
                      <img src={v.image} alt={`Q Club ${v.label} polo`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.52)", backdropFilter: "blur(4px)", color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99 }}>
                        {v.label}
                      </div>
                    </div>
                    <div style={{ padding: "12px 14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18", marginBottom: 2 }}>Q Club Polo</div>
                        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, color: "#8a8780", letterSpacing: ".05em" }}>{v.label} · Wave Camo</div>
                      </div>
                      <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: ".1em", textTransform: "uppercase" }}>Select →</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Step: measurements form ──────────────────────────────────────── */}
          {step === "measurements" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                <BackBtn onClick={() => setStep("variant")} />
                <div>
                  <Breadcrumb parts={["Social Clubs", "Q Club", variantInfo?.label ?? ""]} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Your Measurements</h2>
                </div>
              </div>

              {/* Auth gate */}
              {isLoaded && !user ? (
                <div style={{ padding: "32px 28px", background: "#f4f0e8", borderRadius: 14, border: `1px solid ${GOLD}22`, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, margin: "0 0 16px" }}>
                    Please sign in to submit your Q Club order.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/sign-in" style={{ padding: "10px 24px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
                    <Link href="/sign-up" style={{ padding: "9px 24px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Create Account</Link>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 680, margin: "0 auto" }}>
                  {/* Selected polo preview strip */}
                  {variantInfo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: "#f4f0e8", borderRadius: 12, marginBottom: 28, border: `1px solid ${GOLD}22` }}>
                      <img src={variantInfo.image} alt={variantInfo.label} style={{ width: 64, height: 64, objectFit: "cover", objectPosition: "center top", borderRadius: 8, flexShrink: 0, border: `1px solid ${GOLD}22` }} />
                      <div>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: "#1a1a18" }}>Q Club Polo — {variantInfo.label}</div>
                        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#8a8780", letterSpacing: ".04em", marginTop: 3 }}>Wave Camo · Custom Measurements</div>
                      </div>
                      <button onClick={() => setStep("variant")} style={{ marginLeft: "auto", fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: ".1em", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
                        Change
                      </button>
                    </div>
                  )}

                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", letterSpacing: ".03em", lineHeight: 1.7, marginBottom: 24 }}>
                    Enter all measurements in centimetres (cm) and weight in kg. Leave any field blank if you're unsure — our team will follow up.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 20 }}>
                    {FIELDS.map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 6 }}>
                          {f.label} <span style={{ color: "#b8b5ae", fontWeight: 400 }}>({f.unit})</span>
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={f.placeholder}
                          value={measurements[f.key] ?? ""}
                          onChange={e => setMeasurements(prev => ({ ...prev, [f.key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(26,26,24,0.12)", borderRadius: 8, fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#1a1a18", background: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.18s" }}
                          onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}18`; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(26,26,24,0.12)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 6 }}>
                      Additional Notes <span style={{ color: "#b8b5ae", fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Any special requests, fitting preferences, or notes for our team…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(26,26,24,0.12)", borderRadius: 8, fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#1a1a18", background: "#fff", outline: "none", resize: "vertical", minHeight: 76, boxSizing: "border-box", transition: "border-color 0.18s" }}
                      onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}18`; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(26,26,24,0.12)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>

                  {error && (
                    <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#c0392b", marginBottom: 14, textAlign: "center" }}>{error}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ width: "100%", padding: "15px", borderRadius: 99, background: submitting ? "#d4c5a0" : `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", border: "none", fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : `0 4px 18px ${GOLD}44`, transition: "all 0.22s" }}
                  >
                    {submitting ? "Submitting…" : "Submit Q Club Order"}
                  </button>
                  <p style={{ marginTop: 12, textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic" }}>
                    Our team will review and confirm your order shortly
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step: success ────────────────────────────────────────────────── */}
          {step === "success" && (
            <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto", padding: "20px 0" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #d4edda, #c3e6cb)", border: "2px solid #a8d5b5", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>✓</div>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: GOLD, marginBottom: 10, fontWeight: 500 }}>Order Received</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "#1a1a18", margin: "0 0 14px" }}>
                Your Q Club order is placed
              </h2>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#6b6b68", lineHeight: 1.8, marginBottom: 32 }}>
                We've received your measurements for the <strong>{variantInfo?.label}</strong> polo. Our team will be in touch shortly to confirm and finalise your order.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={reset} style={{ padding: "12px 28px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", border: "none", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 4px 16px ${GOLD}44` }}>
                  Order Another
                </button>
                <Link href="/" style={{ display: "inline-block", padding: "11px 28px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>
                  Back to Home
                </Link>
              </div>
            </div>
          )}

        </div>
      </section>
    </Layout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(26,26,24,0.14)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#666", transition: "all 0.18s", boxShadow: "0 1px 6px rgba(26,26,24,0.07)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f4f0e8"; (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,26,24,0.14)"; }}
    >‹</button>
  );
}

function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: GOLD, fontWeight: 600, marginBottom: 4 }}>
      {parts.filter(Boolean).join(" · ")}
    </div>
  );
}
