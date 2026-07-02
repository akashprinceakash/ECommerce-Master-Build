import { useState } from "react";
import { useUser } from "@clerk/react";
import { Link, useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { getAssetUrl, getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";

async function fetchQClubProducts() {
  const base = getApiUrl();
  const url = `${base}/api/products?category=q_club`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch Q Club products");
  return res.json() as Promise<QProduct[]>;
}

const GOLD  = "#B8925A";
const NAVY  = "#0d1b35";
const CREAM = "#fafaf7";

type QProduct = {
  id: number;
  name: string;
  description: string;
  priceInPaise: number;
  thumbnailUrl: string | null;
  additionalImages: string | null;
  sku: string | null;
  sizes: string[];
  available: boolean;
};

type Step = "landing" | "products";

export default function SocialClubsPage() {
  const { user, isLoaded } = useUser();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [step, setStep] = useState<Step>(params.get("step") === "products" ? "products" : "landing");

  const { data: qClubProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["q-club-products"],
    queryFn: fetchQClubProducts,
    refetchOnMount: true,
    staleTime: 0,
  });

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
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
            Partner clubs receive exclusive garments with priority ordering.
          </p>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <section style={{ background: CREAM, padding: "60px 24px 80px", minHeight: "60vh" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* ── Step: landing ──────────────────────────────────────────────── */}
          {step === "landing" && (
            <>
              <div style={{ marginBottom: 40, textAlign: "center" }}>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>Current Partners</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Select Your Club</h2>
              </div>

              {/* Q Club card */}
              <div
                style={{ display: "flex", gap: 0, borderRadius: 14, overflow: "hidden", border: `1.5px solid rgba(201,168,76,0.22)`, background: "#fff", transition: "all 0.24s", boxShadow: "0 4px 18px rgba(26,26,24,0.07)", maxWidth: 680, margin: "0 auto 16px" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = `0 14px 40px ${GOLD}28`; el.style.borderColor = `${GOLD}55`; el.style.transform = "translateY(-3px)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 4px 18px rgba(26,26,24,0.07)"; el.style.borderColor = "rgba(201,168,76,0.22)"; el.style.transform = "translateY(0)"; }}
              >
                {/* Left accent */}
                <div style={{ flexShrink: 0, width: 120, background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "24px 16px" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 700, color: GOLD, lineHeight: 1 }}>Q</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(201,168,76,0.7)" }}>Club</span>
                </div>

                {/* Right content */}
                <div style={{ flex: 1, padding: "22px 24px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#1a1a18" }}>Q Club</span>
                    <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: NAVY, padding: "3px 10px", borderRadius: 99 }}>Partner</span>
                  </div>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", letterSpacing: ".03em", lineHeight: 1.7, margin: "0 0 18px", flex: 1 }}>
                    Exclusive wave-camo polo collection for Q Club members. Select your product, choose your size, and complete your order.
                  </p>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setStep("products")}
                      style={{
                        fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 700,
                        letterSpacing: ".12em", textTransform: "uppercase",
                        background: `linear-gradient(135deg, ${GOLD}, #b8925a)`,
                        color: "#fff", border: "none", borderRadius: 99,
                        padding: "9px 22px", cursor: "pointer",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      Q Club →
                    </button>
                    <Link
                      href="/connect?type=bulk-order"
                      style={{
                        fontFamily: "'Jost', sans-serif", fontSize: 10, fontWeight: 600,
                        letterSpacing: ".12em", textTransform: "uppercase",
                        border: `1.5px solid rgba(201,168,76,0.45)`, color: GOLD,
                        borderRadius: 99, padding: "8px 22px",
                        textDecoration: "none", display: "inline-flex", alignItems: "center",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${GOLD}12`; (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.45)"; }}
                    >
                      Enquiry
                    </Link>
                  </div>
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

          {/* ── Step: product grid ──────────────────────────────────────────── */}
          {step === "products" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <BackBtn onClick={() => setStep("landing")} />
                <div>
                  <Breadcrumb parts={["Social Clubs", "Q Club"]} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", margin: 0 }}>Q Club Collection</h2>
                </div>
              </div>

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
                    Select a garment to view details, choose your size, and add to cart.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 24 }}>
                    {qClubProducts.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </section>
    </Layout>
  );
}

// ── Product card — links to the standard product detail page ──────────────────
function ProductCard({ product }: { product: QProduct }) {
  const [imgIdx, setImgIdx] = useState(0);

  const mainImg = product.thumbnailUrl ? getAssetUrl(product.thumbnailUrl) ?? "" : null;
  let extraImgs: string[] = [];
  if (product.additionalImages) {
    try {
      const parsed = JSON.parse(product.additionalImages);
      if (Array.isArray(parsed)) extraImgs = parsed.map(u => getAssetUrl(u) || u).filter(Boolean);
      else if (typeof parsed === "string" && parsed.startsWith("http")) extraImgs = [parsed];
    } catch {
      if (product.additionalImages.startsWith("http")) extraImgs = [product.additionalImages];
    }
  }
  const gallery = [mainImg, ...extraImgs].filter(Boolean) as string[];

  return (
    <Link
      href={`/products/${product.id}`}
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", border: "2px solid rgba(26,26,24,0.08)", borderRadius: 14, background: "#fff", overflow: "hidden", transition: "border-color 0.22s, transform 0.22s, box-shadow 0.22s", boxShadow: "0 2px 10px rgba(26,26,24,0.06)" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = GOLD; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 34px ${GOLD}24`; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(26,26,24,0.08)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
    >
      {/* Image area */}
      <div style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", background: "#1a1a18", position: "relative" }}>
        {gallery.length > 0 ? (
          gallery.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`${product.name} — view ${idx + 1}`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", opacity: idx === imgIdx ? 1 : 0, transition: "opacity 0.4s ease", zIndex: idx === imgIdx ? 1 : 0 }}
            />
          ))
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 700, color: GOLD }}>Q</span>
          </div>
        )}

        {/* Q Club badge */}
        <div style={{ position: "absolute", top: 10, left: 10, background: NAVY, color: GOLD, fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 99, zIndex: 10 }}>
          Q Club
        </div>

        {/* Image count badge + dot nav */}
        {gallery.length > 1 && (
          <div style={{ position: "absolute", bottom: 8, right: 0, left: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 10 }}
            onClick={e => e.preventDefault()}
          >
            {gallery.map((_, idx) => (
              <button
                key={idx}
                onClick={e => { e.preventDefault(); setImgIdx(idx); }}
                style={{ width: idx === imgIdx ? 18 : 5, height: 5, borderRadius: 3, background: idx === imgIdx ? GOLD : "rgba(255,255,255,0.6)", border: "none", padding: 0, cursor: "pointer", transition: "width 0.28s, background 0.28s" }}
                aria-label={`Image ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip (additional images as small squares) */}
      {gallery.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "8px 10px 0", overflowX: "auto" }}
          onClick={e => e.preventDefault()}
        >
          {gallery.map((src, idx) => (
            <button
              key={idx}
              onClick={e => { e.preventDefault(); setImgIdx(idx); }}
              style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 5, overflow: "hidden", border: `1.5px solid ${idx === imgIdx ? GOLD : "rgba(26,26,24,0.1)"}`, background: "#f0ede8", cursor: "pointer", padding: 0, transition: "border-color 0.18s" }}
              aria-label={`View image ${idx + 1}`}
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={{ padding: gallery.length > 1 ? "10px 18px 18px" : "16px 18px 20px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, color: "#1a1a18", marginBottom: 6, lineHeight: 1.25 }}>
          {product.name}
        </div>
        {product.description && (
          <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.description}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 15, fontWeight: 700, color: "#1a1a18" }}>
            {formatPrice(product.priceInPaise)}
          </span>
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: GOLD }}>
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(26,26,24,0.14)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.16s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,26,24,0.14)"; }}
      aria-label="Go back"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: "#c4bfb6", fontSize: 10 }}>›</span>}
          <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, color: i === parts.length - 1 ? GOLD : "#8a8780", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: i === parts.length - 1 ? 600 : 400 }}>{p}</span>
        </span>
      ))}
    </div>
  );
}

function AuthGate() {
  return (
    <div style={{ padding: "40px 24px", background: "#f4f0e8", borderRadius: 12, border: `1px solid ${GOLD}22`, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "#6b6b68", lineHeight: 1.7, margin: "0 0 14px" }}>
        Sign in to browse Q Club products and place your order.
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ border: "2px solid rgba(26,26,24,0.06)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          <div style={{ width: "100%", aspectRatio: "1 / 1", background: "linear-gradient(90deg, #f0ede8 25%, #e8e4dc 50%, #f0ede8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
          <div style={{ padding: "16px 18px" }}>
            <div style={{ height: 18, borderRadius: 4, background: "#f0ede8", marginBottom: 8 }} />
            <div style={{ height: 12, borderRadius: 4, background: "#f0ede8", width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
