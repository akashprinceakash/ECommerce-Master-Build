import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Search, X } from "lucide-react";

const GOLD = "#B8925A";
const BG = "#FAFAF7";
const CARD = "#FFFFFF";
const BD = "rgba(0,0,0,0.08)";
const TX = "#0A0A0A";
const MUTED = "rgba(0,0,0,0.5)";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  gender?: string | null;
  subType?: string | null;
  priceInPaise: number;
  thumbnailUrl?: string | null;
  available: boolean;
}

async function searchProducts(q: string): Promise<Product[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${getApiUrl()}/api/products?q=${encodeURIComponent(q.trim())}`);
  if (!res.ok) return [];
  return res.json();
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    document.title = "Search — KA.SHA";
    inputRef.current?.focus();
  }, []);

  const { data: results = [], isFetching } = useQuery<Product[]>({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchProducts(debouncedQuery),
    enabled: debouncedQuery.length > 1,
  });

  const showEmpty = debouncedQuery.length > 1 && !isFetching && results.length === 0;

  return (
    <Layout>
      <div style={{ background: BG, color: TX, minHeight: "calc(100vh - 64px)" }}>
        {/* Search Header */}
        <div
          style={{
            background: "#F5F2EC",
            borderBottom: `1px solid rgba(184,146,90,0.25)`,
            padding: "48px 24px 36px",
          }}
        >
          <div className="max-w-[760px] mx-auto">
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: 8,
                letterSpacing: "0.45em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Search the Collection
            </div>
            <div
              className="flex items-center gap-3"
              style={{
                background: CARD,
                border: `1.5px solid ${query ? GOLD : BD}`,
                padding: "14px 18px",
                transition: "border-color 0.2s",
              }}
            >
              <Search
                style={{ width: 18, height: 18, color: query ? GOLD : MUTED, flexShrink: 0, transition: "color 0.2s" }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, category, style…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  color: TX,
                  letterSpacing: "0.01em",
                }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: MUTED }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              )}
              {isFetching && (
                <div
                  style={{
                    width: 16, height: 16, border: `2px solid ${BD}`, borderTopColor: GOLD,
                    borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0,
                  }}
                />
              )}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          {/* Result count */}
          {debouncedQuery.length > 1 && !isFetching && results.length > 0 && (
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: 9,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 24,
              }}
            >
              {results.length} result{results.length !== 1 ? "s" : ""} for "{debouncedQuery}"
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Search style={{ width: 40, height: 40, color: "rgba(0,0,0,0.12)" }} />
              <p
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 20,
                  color: MUTED,
                  letterSpacing: "0.02em",
                }}
              >
                No products found for "{debouncedQuery}"
              </p>
              <p style={{ fontFamily: FONT_UI, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>
                Try a different keyword or browse the collection
              </p>
              <Link
                href="/products"
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 9,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: GOLD,
                  textDecoration: "none",
                  borderBottom: `1px solid ${GOLD}`,
                  paddingBottom: 1,
                  marginTop: 4,
                }}
              >
                Browse All Products
              </Link>
            </div>
          )}

          {/* Idle state */}
          {debouncedQuery.length <= 1 && !isFetching && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  color: MUTED,
                  letterSpacing: "0.02em",
                }}
              >
                What are you looking for?
              </p>
              <p style={{ fontFamily: FONT_UI, fontSize: 10, color: MUTED, letterSpacing: "0.08em", marginBottom: 8 }}>
                Type at least 2 characters to search
              </p>
              <div className="flex gap-3 flex-wrap justify-center mt-2">
                {["polo", "jacket", "shorts", "solid", "printed"].map(s => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 9,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      color: GOLD,
                      background: "rgba(184,146,90,0.08)",
                      border: `1px solid rgba(184,146,90,0.25)`,
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product grid */}
          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {results.map(product => (
                <Link key={product.id} href={`/products/${product.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      background: CARD,
                      border: `1px solid ${BD}`,
                      overflow: "hidden",
                      transition: "border-color 0.2s",
                    }}
                    className="group hover:border-[#B8925A] transition-all"
                  >
                    <div
                      className="aspect-square overflow-hidden"
                      style={{ background: "#F5F2EC" }}
                    >
                      {product.thumbnailUrl ? (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: "rgba(0,0,0,0.15)" }}>
                          <span style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase" }}>
                            {product.category}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <p
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 16,
                          fontWeight: 400,
                          color: TX,
                          letterSpacing: "0.02em",
                          marginBottom: 4,
                        }}
                      >
                        {product.name}
                      </p>
                      {product.gender && (
                        <p style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
                          {product.gender}
                        </p>
                      )}
                      <p
                        style={{
                          fontFamily: FONT_UI,
                          fontSize: 11,
                          letterSpacing: "0.05em",
                          color: GOLD,
                        }}
                      >
                        {formatPrice(product.priceInPaise)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
