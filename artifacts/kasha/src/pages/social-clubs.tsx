import { useState } from "react";
import { useUser } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useListProducts, getListProductsQueryKey, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAssetUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const GOLD  = "#B8925A";
const NAVY  = "#0d1b35";
const CREAM = "#fafaf7";

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

type Step = "landing" | "products" | "measurements" | "done";

type QProduct = {
  id: number;
  name: string;
  description: string;
  priceInPaise: number;
  thumbnailUrl: string | null;
  sku: string | null;
  sizes: string[];
};

export default function SocialClubsPage() {
  const { user, isLoaded } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep]                         = useState<Step>("landing");
  const [selectedProduct, setSelectedProduct]   = useState<QProduct | null>(null);
  const [selectedSize, setSelectedSize]         = useState("");
  const [measurements, setMeasurements]         = useState<Partial<Record<MeasKey, string>>>({});
  const [notes, setNotes]                       = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState("");

  const addToCart = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
    },
  });

  // Fetch Q Club products (category = q_club)
  const { data: allProducts, isLoading: loadingProducts } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), enabled: step === "products" || step === "landing" } }
  );

  const qClubProducts = (allProducts ?? []).filter(
    p => p.available && p.category === "q_club"
  );

  function reset() {
    setStep("landing");
    setSelectedProduct(null);
    setSelectedSize("");
    setMeasurements({});
    setNotes("");
    setError("");
  }

  async function handleAddToCart() {
    if (!selectedProduct || !selectedSize) return;
    setSubmitting(true);
    setError("");
    try {
      const measurementsPayload: Record<string, string> = {};
      FIELDS.forEach(f => {
        const v = measurements[f.key];
        if (v && v.trim()) measurementsPayload[f.key] = v.trim();
      });
      if (notes.trim()) measurementsPayload["notes"] = notes.trim();

      await addToCart.mutateAsync({
        data: {
          productId: selectedProduct.id,
          quantity: 1,
          size: selectedSize,
          measurements: Object.keys(measurementsPayload).length > 0 ? measurementsPayload : undefined,
        },
      });
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectProduct(p: QProduct) {
    setSelectedProduct(p);
    setSelectedSize(p.sizes?.[0] ?? "M");
    setStep("measurements");
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
            Partner clubs receive exclusive garments with custom measurement ordering.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <section style={{ background: CREAM, padding: "60px 24px 80px", minHeight: "60vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* ── Step: landing ─────────────────────────────────────────────── */}
          {step === "landing" && (
            <>
              <div style={{ marginBottom: 40, textAlign: "center" }}>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>Current Partners</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Select Your Club</h2>
              </div>

              {/* Q Club card */}
              <div
                role="button" tabIndex={0}
                onClick={() => setStep("products")}
                onKeyDown={e => e.key === "Enter" && setStep("products")}
                style={{ display: "flex", gap: 0, borderRadius: 14, overflow: "hidden", border: `1.5px solid rgba(201,168,76,0.22)`, background: "#fff", cursor: "pointer", transition: "all 0.24s", boxShadow: "0 4px 18px rgba(26,26,24,0.07)", maxWidth: 680, margin: "0 auto 16px" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = `0 14px 40px ${GOLD}28`; el.style.borderColor = `${GOLD}55`; el.style.transform = "translateY(-3px)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 4px 18px rgba(26,26,24,0.07)"; el.style.borderColor = "rgba(201,168,76,0.22)"; el.style.transform = "translateY(0)"; }}
              >
                <div style={{ flexShrink: 0, width: 120, background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "24px 16px" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 700, color: GOLD, lineHeight: 1 }}>Q</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(201,168,76,0.7)" }}>Club</span>
                </div>
                <div style={{ flex: 1, padding: "22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#1a1a18" }}>Q Club</span>
                    <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: NAVY, padding: "3px 10px", borderRadius: 99 }}>Partner</span>
                  </div>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", letterSpacing: ".03em", lineHeight: 1.7, margin: "0 0 14px" }}>
                    Exclusive wave-camo polo collection for Q Club members. Choose your product and submit your custom measurements for a perfectly tailored fit.
                  </p>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: GOLD }}>Browse Products →</span>
                </div>
              </div>

              <p style={{ textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic", marginTop: 24 }}>
                More partner clubs coming soon
              </p>

              {isLoaded && !user && (
                <div style={{ marginTop: 40, padding: "22px 28px", background: "#f4f0e8", borderRadius: 12, border: `1px solid ${GOLD}22`, textAlign: "center", maxWidth: 480, marginInline: "auto" }}>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, margin: "0 0 14px" }}>
                    Sign in to browse Q Club products and place your order.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/sign-in" style={{ padding: "10px 24px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
                    <Link href="/sign-up" style={{ padding: "9px 24px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Create Account</Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step: product selection ─────────────────────────────────────── */}
          {step === "products" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <BackBtn onClick={() => setStep("landing")} />
                <div>
                  <Breadcrumb parts={["Social Clubs", "Q Club"]} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Q Club Collection</h2>
                </div>
              </div>

              {/* Auth gate */}
              {isLoaded && !user ? (
                <AuthGate />
              ) : loadingProducts ? (
                <ProductSkeleton />
              ) : qClubProducts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#8a8780" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏌️</div>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#1a1a18", marginBottom: 8 }}>Collection Coming Soon</p>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#8a8780" }}>Q Club products are being added by our admin team. Please check back soon.</p>
                </div>
              ) : (
                <>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#8a8780", letterSpacing: ".03em", marginBottom: 28 }}>
                    Select the garment you'd like to order. You'll enter your measurements on the next step.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
                    {qClubProducts.map(p => (
                      <ProductCard key={p.id} product={p} onSelect={() => selectProduct(p as QProduct)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Step: measurements ──────────────────────────────────────────── */}
          {step === "measurements" && selectedProduct && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                <BackBtn onClick={() => setStep("products")} />
                <div>
                  <Breadcrumb parts={["Social Clubs", "Q Club", selectedProduct.name]} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Your Measurements</h2>
                </div>
              </div>

              {/* Auth gate */}
              {isLoaded && !user ? (
                <AuthGate />
              ) : (
                <div style={{ maxWidth: 680, margin: "0 auto" }}>
                  {/* Selected product strip */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: "#f4f0e8", borderRadius: 12, marginBottom: 28, border: `1px solid ${GOLD}22` }}>
                    <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#e8e4db", flexShrink: 0, border: `1px solid ${GOLD}22` }}>
                      {selectedProduct.thumbnailUrl ? (
                        <img src={getAssetUrl(selectedProduct.thumbnailUrl) ?? ""} alt={selectedProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: GOLD }}>Q</div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: "#1a1a18" }}>{selectedProduct.name}</div>
                      <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#8a8780", letterSpacing: ".04em", marginTop: 3 }}>
                        {formatPrice(selectedProduct.priceInPaise)} · {selectedProduct.sku ?? "Q Club"}
                      </div>
                    </div>
                    <button onClick={() => setStep("products")} style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: ".1em", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
                      Change
                    </button>
                  </div>

                  {/* Size selection */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 10 }}>
                      Select Size
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(selectedProduct.sizes ?? ["S", "M", "L", "XL"]).map(sz => (
                        <button key={sz} onClick={() => setSelectedSize(sz)}
                          style={{ width: 44, height: 44, border: selectedSize === sz ? `2px solid ${GOLD}` : "1.5px solid rgba(26,26,24,0.15)", borderRadius: 6, background: selectedSize === sz ? `${GOLD}12` : "#fff", cursor: "pointer", fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 600, color: selectedSize === sz ? "#1a1a18" : "#6b6b68", transition: "all 0.16s" }}
                        >{sz}</button>
                      ))}
                    </div>
                  </div>

                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", letterSpacing: ".03em", lineHeight: 1.7, marginBottom: 24 }}>
                    Enter all measurements in centimetres (cm) and weight in kg. Leave any field blank if unsure — our team will follow up to confirm.
                  </p>

                  {/* Measurement grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 20 }}>
                    {FIELDS.map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 6 }}>
                          {f.label} <span style={{ color: "#b8b5ae", fontWeight: 400 }}>({f.unit})</span>
                        </label>
                        <input type="text" inputMode="decimal" placeholder={f.placeholder}
                          value={measurements[f.key] ?? ""}
                          onChange={e => setMeasurements(prev => ({ ...prev, [f.key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(26,26,24,0.12)", borderRadius: 8, fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#1a1a18", background: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.18s" }}
                          onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}18`; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(26,26,24,0.12)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: "block", fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b68", marginBottom: 6 }}>
                      Notes <span style={{ color: "#b8b5ae", fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea rows={3} placeholder="Any special fitting requests or notes for our team…"
                      value={notes} onChange={e => setNotes(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(26,26,24,0.12)", borderRadius: 8, fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#1a1a18", background: "#fff", outline: "none", resize: "vertical", minHeight: 76, boxSizing: "border-box", transition: "border-color 0.18s" }}
                      onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}18`; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(26,26,24,0.12)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>

                  {error && <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#c0392b", marginBottom: 14, textAlign: "center" }}>{error}</p>}

                  <button onClick={handleAddToCart} disabled={submitting || !selectedSize}
                    style={{ width: "100%", padding: "15px", borderRadius: 99, background: (submitting || !selectedSize) ? "#d4c5a0" : `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", border: "none", fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", cursor: (submitting || !selectedSize) ? "not-allowed" : "pointer", boxShadow: (submitting || !selectedSize) ? "none" : `0 4px 18px ${GOLD}44`, transition: "all 0.22s" }}
                  >
                    {submitting ? "Adding to Cart…" : "Add to Cart"}
                  </button>
                  <p style={{ marginTop: 12, textAlign: "center", fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".06em", fontStyle: "italic" }}>
                    Your measurements will be saved with this order · Proceed to checkout to complete payment
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step: added to cart ─────────────────────────────────────────── */}
          {step === "done" && (
            <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto", padding: "20px 0" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #d4edda, #c3e6cb)", border: "2px solid #a8d5b5", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>✓</div>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: GOLD, marginBottom: 10, fontWeight: 500 }}>Added to Cart</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "#1a1a18", margin: "0 0 14px" }}>
                {selectedProduct?.name} is in your cart
              </h2>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#6b6b68", lineHeight: 1.8, marginBottom: 32 }}>
                Your measurements have been saved with this item. Proceed to checkout to complete your order — payment, shipping, and delivery will follow the standard order flow.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/checkout" style={{ display: "inline-block", padding: "13px 32px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none", boxShadow: `0 4px 16px ${GOLD}44` }}>
                  Proceed to Checkout
                </Link>
                <button onClick={reset} style={{ padding: "12px 28px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", background: "#fff", cursor: "pointer" }}>
                  Order Another
                </button>
              </div>
            </div>
          )}

        </div>
      </section>
    </Layout>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ product, onSelect }: { product: any; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      style={{ padding: 0, border: "2px solid rgba(26,26,24,0.08)", borderRadius: 14, background: "#fff", cursor: "pointer", overflow: "hidden", transition: "all 0.22s", boxShadow: "0 2px 10px rgba(26,26,24,0.06)", textAlign: "left", display: "flex", flexDirection: "column" }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = GOLD; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 34px ${GOLD}24`; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "rgba(26,26,24,0.08)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
    >
      <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#1a1a18", position: "relative" }}>
        {product.thumbnailUrl ? (
          <img src={getAssetUrl(product.thumbnailUrl) ?? ""} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 700, color: GOLD, opacity: 0.6 }}>Q</div>
        )}
        <div style={{ position: "absolute", top: 8, left: 8, background: NAVY, color: GOLD, fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 99 }}>
          Q Club
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: "#1a1a18", marginBottom: 4, lineHeight: 1.25 }}>{product.name}</div>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#8a8780", letterSpacing: ".03em", lineHeight: 1.6, margin: "0 0 12px", flex: 1 }}>
          {product.description?.substring(0, 80)}{(product.description?.length ?? 0) > 80 ? "…" : ""}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18" }}>{formatPrice(product.priceInPaise)}</span>
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: ".1em", textTransform: "uppercase" }}>Select →</span>
        </div>
      </div>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(26,26,24,0.14)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#666", transition: "all 0.18s", boxShadow: "0 1px 6px rgba(26,26,24,0.07)" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#f4f0e8"; el.style.borderColor = GOLD; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#fff"; el.style.borderColor = "rgba(26,26,24,0.14)"; }}
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

function AuthGate() {
  return (
    <div style={{ padding: "32px 28px", background: "#f4f0e8", borderRadius: 14, border: `1px solid ${GOLD}22`, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, margin: "0 0 16px" }}>
        Please sign in to place your Q Club order.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/sign-in" style={{ padding: "10px 24px", borderRadius: 99, background: `linear-gradient(135deg, ${GOLD}, #b8925a)`, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
        <Link href="/sign-up" style={{ padding: "9px 24px", borderRadius: 99, border: "1.5px solid rgba(26,26,24,0.18)", color: "#1a1a18", fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", textDecoration: "none" }}>Create Account</Link>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(26,26,24,0.07)", animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite` }}>
          <div style={{ aspectRatio: "1/1", background: "linear-gradient(160deg, #f0ede6, #e8e4db)" }} />
          <div style={{ padding: "14px 16px 16px" }}>
            <div style={{ width: "70%", height: 16, borderRadius: 4, background: "#ede9e1", marginBottom: 8 }} />
            <div style={{ width: "90%", height: 10, borderRadius: 4, background: "#ede9e1", marginBottom: 4 }} />
            <div style={{ width: "40%", height: 10, borderRadius: 4, background: "#ede9e1" }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.85} }`}</style>
    </div>
  );
}
