import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const GOLD = "#B8925A";

export default function LookbookPage() {
  useEffect(() => { document.title = "Lookbook — Ka.sha"; }, []);

  const { data: products, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), staleTime: 5 * 60 * 1000 } }
  );

  const items = (products ?? []).filter(p => p.thumbnailUrl);

  return (
    <Layout>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0a0c14", padding: "120px 24px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 11,
          letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 20,
        }}>
          Ka.sha — SS 2026
        </p>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 400,
          color: "#fff", lineHeight: 1.05, marginBottom: 24, letterSpacing: "0.03em",
        }}>
          The Lookbook
        </h1>
        <p style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 13, letterSpacing: "0.25em",
          color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
        }}>
          Performance Refined &nbsp;·&nbsp; Luxury Defined
        </p>
      </section>

      {/* ── Editorial intro ───────────────────────────────────────────────── */}
      <section style={{ background: "#F9F8F6", padding: "64px 24px 0", textAlign: "center" }}>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(17px, 2vw, 22px)",
          color: "rgba(0,0,0,0.55)", maxWidth: 680, margin: "0 auto",
          lineHeight: 1.8, letterSpacing: "0.02em",
        }}>
          Designed for the discerning golfer who refuses to choose between form and function.
          Each piece in the Ka.sha collection carries the quiet confidence of bespoke craftsmanship.
        </p>
      </section>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <section style={{ background: "#F9F8F6", padding: "56px 24px 80px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {isLoading && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  breakInside: "avoid", marginBottom: 16,
                  background: "#E8E4DE", aspectRatio: i % 3 === 0 ? "3/4" : "4/5",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(0,0,0,0.4)" }}>
              <p style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 13, letterSpacing: "0.15em" }}>
                Lookbook coming soon — check back shortly.
              </p>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
              {items.map((product, i) => {
                const imgSrc = getAssetUrl(product.thumbnailUrl) || "";
                return (
                  <Link key={product.id} href={`/products/${product.id}`}>
                    <div
                      className="group"
                      style={{
                        breakInside: "avoid",
                        marginBottom: 16,
                        position: "relative",
                        overflow: "hidden",
                        cursor: "pointer",
                        background: "#EDEBE6",
                      }}
                    >
                      <img
                        src={imgSrc}
                        alt={product.name}
                        loading={i < 6 ? "eager" : "lazy"}
                        decoding="async"
                        style={{
                          width: "100%",
                          display: "block",
                          objectFit: "cover",
                          transition: "transform 0.6s ease",
                        }}
                        className="group-hover:scale-105"
                      />
                      {/* Hover overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)",
                          display: "flex",
                          alignItems: "flex-end",
                          padding: "16px 14px",
                        }}
                      >
                        <div>
                          <p style={{
                            fontFamily: "'Josefin Sans', sans-serif", fontSize: 12,
                            letterSpacing: "0.1em", color: "#fff",
                            marginBottom: 3,
                          }}>
                            {product.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}
                          </p>
                          <p style={{
                            fontFamily: "'Josefin Sans', sans-serif", fontSize: 11,
                            letterSpacing: "0.08em", color: GOLD,
                          }}>
                            {formatPrice(product.priceInPaise)} &nbsp;→
                          </p>
                        </div>
                      </div>

                      {/* Always-visible edition label on featured images */}
                      {i % 7 === 0 && (
                        <div style={{
                          position: "absolute", top: 12, left: 12,
                          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                          padding: "4px 10px",
                        }}>
                          <span style={{
                            fontFamily: "'Josefin Sans', sans-serif", fontSize: 9,
                            letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase",
                          }}>
                            SS 2026
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* CTA */}
          {!isLoading && items.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 56 }}>
              <Link href="/products" style={{
                display: "inline-block",
                background: GOLD, color: "#fff",
                fontFamily: "'Josefin Sans', sans-serif", fontSize: 12,
                letterSpacing: "0.3em", textTransform: "uppercase",
                padding: "16px 48px", textDecoration: "none",
              }}>
                Shop the Collection
              </Link>
            </div>
          )}

        </div>
      </section>

    </Layout>
  );
}
