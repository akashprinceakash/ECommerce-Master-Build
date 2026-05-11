import { Layout } from "@/components/layout/Layout";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import { type Gender, getLastGender as _getLastGender, setLastGender } from "@/lib/genderPreference";

type ItemType = "tshirts" | "trousers" | "skirts" | "bottoms";
type StyleFilter = "patterns" | "prints";

const TSHIRT_CATEGORIES = ["t-shirt", "polo", "fabric-tshirt", "pattern", "shirts"];
const TROUSER_CATEGORIES = ["pants"];
const PATTERN_CATEGORIES = ["pattern"];
// Prints = printable t-shirt/polo SKUs, excluding patterns (which are their own
// filter) and excluding non-tshirt cuts like the kurta-style "shirts" category.
const PRINT_CATEGORIES = ["t-shirt", "polo", "fabric-tshirt"];
// Names that explicitly signal a print/seasonal/limited drop. Used alongside
// the category filter so seeded print SKUs always make it through.
const PRINT_NAME_HINTS = ["print", "flair", "seasonal", "limited"];

// Explicit gender mapping for the existing catalog. Products without a
// "men/women" keyword in their name need a deterministic assignment so that
// "Men → T-shirts" and "Women → T-shirts" don't show the same items.
// Anything not listed here is treated as unisex (visible under both Men and
// Women). Kids has no dedicated SKUs yet, so it shows the unisex set with
// the kids fallback imagery.
const PRODUCT_GENDER: Record<number, "men" | "women" | "unisex"> = {
  1: "men",      // The Silk Kurta
  2: "unisex",   // The Linen Trouser
  3: "men",      // The Khadi Jacket
  4: "men",      // T-shirt1
  5: "women",    // Signature T-shirt
  6: "women",    // T-shirt5
  7: "men",      // Signature Polo
  8: "women",    // Pattern01 T-shirt
  9: "men",      // Polo001
  10: "women",   // Pologt
  11: "men",     // KS1000B (fabric tee)
  18: "men",     // KS1007B Classic
  19: "women",   // KS1008B Sport Side
  20: "men",     // KS1009B Triple Tone
  21: "women",   // KS1010B Wave Panel
  22: "men",     // KS1011B Hourglass
  23: "women",   // KS1012B Pinstripe
  24: "men",     // KS1013B Raglan
};

const GENDER_TOKENS: Record<Gender, string[]> = {
  men: ["men", "men's", "mens", "male"],
  women: ["women", "women's", "womens", "female", "skort", "ladies"],
  kids: ["kid", "kids", "kid's", "junior", "youth", "child"],
};

const COLLECTION_IMAGES = Array.from({ length: 27 }, (_, i) => `/images/collection/look-${i + 1}.jpeg`);
const KIDS_FALLBACK_IMAGE = "/images/hero/slide-kids.png";

export default function ProductsPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(searchString);
  const genderParam = params.get("gender");
  const typeParam = params.get("type");

  const gender: Gender | undefined =
    genderParam === "men" || genderParam === "women" || genderParam === "kids" ? genderParam : undefined;
  const type: ItemType | undefined =
    typeParam === "tshirts" || typeParam === "trousers" || typeParam === "skirts" || typeParam === "bottoms"
      ? typeParam
      : undefined;
  const styleParam = params.get("style");
  const styleFilter: StyleFilter | undefined =
    styleParam === "patterns" || styleParam === "prints" ? styleParam : undefined;

  // Remember the user's most recent gender selection across navigations
  useEffect(() => {
    if (gender) setLastGender(gender);
  }, [gender]);

  // Fetch all products once; filter client-side by category + gender for snappy nav
  const { data: rawProducts, isLoading, error } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );

  const products = useMemo(() => {
    if (!rawProducts) return rawProducts;
    let list = rawProducts;

    if (type === "tshirts") {
      if (styleFilter === "patterns") {
        list = list.filter((p) => {
          const cat = (p.category || "").toLowerCase();
          const name = (p.name || "").toLowerCase();
          return PATTERN_CATEGORIES.includes(cat) || name.includes("pattern");
        });
      } else if (styleFilter === "prints") {
        list = list.filter((p) => {
          const cat = (p.category || "").toLowerCase();
          const name = (p.name || "").toLowerCase();
          // Exclude patterns; include explicit print SKUs OR generic t-shirt cuts
          if (PATTERN_CATEGORIES.includes(cat) || name.includes("pattern")) return false;
          return PRINT_CATEGORIES.includes(cat) || PRINT_NAME_HINTS.some((h) => name.includes(h));
        });
      } else {
        list = list.filter((p) => TSHIRT_CATEGORIES.includes((p.category || "").toLowerCase()));
      }
    } else if (type === "trousers") {
      list = list.filter((p) => TROUSER_CATEGORIES.includes((p.category || "").toLowerCase()));
    } else if (type === "bottoms") {
      // Kids bottoms — accept trousers-like categories. Skirt SKUs are coming soon.
      list = list.filter((p) => TROUSER_CATEGORIES.includes((p.category || "").toLowerCase()));
    } else if (type === "skirts") {
      // No skirt/skort SKUs in the catalog yet — return empty so the UI shows
      // the dedicated "Coming Soon" panel instead of unrelated items.
      list = [];
    }

    if (gender === "men" || gender === "women") {
      list = list.filter((p) => {
        // Honour explicit per-product gender mapping first
        const mapped = PRODUCT_GENDER[p.id];
        if (mapped) return mapped === gender || mapped === "unisex";
        // Fall back to keyword matching for any future products
        const tokens = GENDER_TOKENS[gender];
        const hay = `${p.name} ${p.description || ""}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
    } else if (gender === "kids") {
      // No dedicated kids SKUs yet — keyword match, otherwise show the unisex
      // set so the section isn't empty. Fallback imagery handles the visual.
      const tokens = GENDER_TOKENS.kids;
      const matched = list.filter((p) => {
        const hay = `${p.name} ${p.description || ""}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
      if (matched.length > 0) list = matched;
    }

    return list;
  }, [rawProducts, type, gender, styleFilter]);

  const buildHref = (g?: Gender, t?: ItemType, s?: StyleFilter) => {
    const sp = new URLSearchParams();
    if (g) sp.set("gender", g);
    if (t) sp.set("type", t);
    if (s) sp.set("style", s);
    const q = sp.toString();
    return q ? `/products?${q}` : "/products";
  };

  type SidebarItem = { label: string; type: ItemType; style?: StyleFilter };
  const sidebar: { label: string; gender: Gender; items: SidebarItem[] }[] = [
    {
      label: "Men",
      gender: "men",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Patterns", type: "tshirts", style: "patterns" },
        { label: "Prints", type: "tshirts", style: "prints" },
        { label: "Trousers", type: "trousers" },
      ],
    },
    {
      label: "Women",
      gender: "women",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Patterns", type: "tshirts", style: "patterns" },
        { label: "Prints", type: "tshirts", style: "prints" },
        { label: "Skirts / Skorts", type: "skirts" },
      ],
    },
    {
      label: "Kids",
      gender: "kids",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Patterns", type: "tshirts", style: "patterns" },
        { label: "Prints", type: "tshirts", style: "prints" },
        { label: "Bottoms", type: "bottoms" },
      ],
    },
  ];

  const typeLabel = (t?: ItemType) =>
    t === "tshirts" ? "T-shirts" : t === "trousers" ? "Trousers" : t === "skirts" ? "Skirts / Skorts" : t === "bottoms" ? "Bottoms" : null;
  const styleLabel = (s?: StyleFilter) => (s === "patterns" ? "Patterns" : s === "prints" ? "Prints" : null);

  const breadcrumb = [
    gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "All",
    typeLabel(type),
    styleLabel(styleFilter),
  ]
    .filter(Boolean)
    .join(" / ");

  const heading = gender || type
    ? `${gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "All"}${type ? " · " + typeLabel(type) : ""}${styleFilter ? " · " + styleLabel(styleFilter) : ""}`
    : "The Collection";

  const fallbackImageFor = (productId: number) => {
    if (gender === "kids") return KIDS_FALLBACK_IMAGE;
    return COLLECTION_IMAGES[productId % COLLECTION_IMAGES.length];
  };

  return (
    <Layout>
      {/* Page Header */}
      <div
        className="py-12 px-6"
        style={{
          background: "#F5F2EC",
          borderBottom: "1px solid rgba(184,146,90,0.3)",
        }}
      >
        <div className="max-w-[1400px] mx-auto">
          <div
            className="flex items-center gap-2 text-[10px] font-medium mb-5 uppercase"
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              letterSpacing: "0.28em",
              color: "rgba(0,0,0,0.5)",
            }}
          >
            <Link href="/" className="hover:!text-[#B8925A] transition-colors">HOME</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/products" className="hover:!text-[#B8925A] transition-colors">SHOP</Link>
            {breadcrumb && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span style={{ color: "#B8925A" }}>{breadcrumb}</span>
              </>
            )}
          </div>
          <h1
            className="text-neutral-900"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 400,
              letterSpacing: "0.02em",
            }}
          >
            {heading}
          </h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 self-start">
            <nav aria-label="Shop categories" className="text-sm">
              <Link
                href="/products"
                aria-current={!gender && !type ? "page" : undefined}
                className={`block py-3 text-[11px] tracking-[0.28em] uppercase font-medium ${
                  !gender && !type ? "text-[#B8925A]" : "text-neutral-900/60 hover:text-neutral-900"
                }`}
                style={{ fontFamily: "'Josefin Sans', sans-serif", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
              >
                All Products
              </Link>
              {sidebar.map((section) => {
                const sectionActive = gender === section.gender;
                return (
                  <div key={section.gender} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <Link
                      href={buildHref(section.gender, undefined)}
                      aria-current={sectionActive && !type ? "page" : undefined}
                      className={`block py-3 text-[11px] tracking-[0.28em] uppercase font-medium ${
                        sectionActive ? "text-[#B8925A]" : "text-neutral-900/80 hover:text-neutral-900"
                      }`}
                      style={{ fontFamily: "'Josefin Sans', sans-serif" }}
                    >
                      {section.label}
                    </Link>
                    <ul className="pb-2">
                      {section.items.map((it) => {
                        const itemActive =
                          sectionActive && type === it.type && (it.style ?? undefined) === styleFilter;
                        const isSubItem = !!it.style;
                        return (
                          <li key={`${it.type}-${it.style ?? "all"}`}>
                            <Link
                              href={buildHref(section.gender, it.type, it.style)}
                              aria-current={itemActive ? "page" : undefined}
                              className={`block py-1.5 text-[10px] tracking-[0.22em] uppercase border-l-2 ${
                                isSubItem ? "pl-7" : "pl-3"
                              } ${
                                itemActive
                                  ? "border-[#B8925A] text-[#B8925A] font-medium"
                                  : "border-transparent text-neutral-900/45 hover:text-neutral-900 hover:border-black/15"
                              }`}
                              style={{ fontFamily: "'Josefin Sans', sans-serif" }}
                            >
                              {it.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              {/* Quick "type only" links — adapt to the active gender */}
              <div className="mt-6" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
                <div
                  className="text-[9px] uppercase mb-3"
                  style={{ letterSpacing: "0.35em", color: "#B8925A" }}
                >
                  Browse by type
                </div>
                <Link
                  href={buildHref(gender, "tshirts")}
                  className={`block py-1.5 text-[10px] tracking-[0.22em] uppercase ${
                    type === "tshirts" && !styleFilter ? "text-[#B8925A] font-medium" : "text-neutral-900/45 hover:text-neutral-900"
                  }`}
                >
                  All T-shirts
                </Link>
                {gender === "women" ? (
                  <Link
                    href={buildHref(gender, "skirts")}
                    className={`block py-1.5 text-[10px] tracking-[0.22em] uppercase ${
                      type === "skirts" ? "text-[#B8925A] font-medium" : "text-neutral-900/45 hover:text-neutral-900"
                    }`}
                  >
                    All Skirts / Skorts
                  </Link>
                ) : gender === "kids" ? (
                  <Link
                    href={buildHref(gender, "bottoms")}
                    className={`block py-1.5 text-[10px] tracking-[0.22em] uppercase ${
                      type === "bottoms" ? "text-[#B8925A] font-medium" : "text-neutral-900/45 hover:text-neutral-900"
                    }`}
                  >
                    All Bottoms
                  </Link>
                ) : (
                  <Link
                    href={buildHref(gender, "trousers")}
                    className={`block py-1.5 text-[10px] tracking-[0.22em] uppercase ${
                      type === "trousers" ? "text-[#B8925A] font-medium" : "text-neutral-900/45 hover:text-neutral-900"
                    }`}
                  >
                    All Trousers
                  </Link>
                )}
              </div>
            </nav>
          </aside>

          {/* Product grid */}
          <div>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {Array.from({ length: 9 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="py-20 text-center text-neutral-900/45">
                <p>Failed to load products. Please try again later.</p>
              </div>
            ) : products?.length === 0 && type === "skirts" ? (
              <div
                className="p-12 md:p-16 text-center"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(184,146,90,0.3)",
                  borderRadius: 8,
                }}
              >
                <div
                  className="text-[9px] uppercase mb-3"
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    letterSpacing: "0.4em",
                    color: "#B8925A",
                  }}
                >
                  Coming Soon
                </div>
                <h2
                  className="text-neutral-900 mb-4"
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "clamp(28px, 3vw, 36px)",
                    fontWeight: 400,
                  }}
                >
                  Skirts &amp; Skorts
                </h2>
                <p
                  className="max-w-md mx-auto mb-8"
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 11,
                    color: "rgba(0,0,0,0.5)",
                    lineHeight: 1.8,
                    letterSpacing: "0.06em",
                  }}
                >
                  Tailored skirts and built-in skort shorts in our signature stretch fabric — landing in the next drop.
                  Want yours sooner? Build it in the Custom Studio today.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/products/1/customize"
                    className="text-[10px] uppercase text-white px-7 py-3.5 transition-all"
                    style={{
                      fontFamily: "'Josefin Sans', sans-serif",
                      letterSpacing: "0.28em",
                      background: "#B8925A",
                    }}
                  >
                    Open Custom Studio
                  </Link>
                  <Link
                    href={buildHref(gender, "tshirts")}
                    className="text-[10px] uppercase px-7 py-3.5 transition-all hover:!text-neutral-900"
                    style={{
                      fontFamily: "'Josefin Sans', sans-serif",
                      letterSpacing: "0.28em",
                      color: "rgba(0,0,0,0.6)",
                      border: "1px solid rgba(0,0,0,0.2)",
                    }}
                  >
                    Browse T-shirts
                  </Link>
                </div>
              </div>
            ) : products?.length === 0 ? (
              <div className="py-20 text-center text-neutral-900/45">
                <p className="mb-4">No products found in this category yet.</p>
                <button
                  onClick={() => navigate("/products")}
                  className="text-[11px] uppercase tracking-[0.22em] underline text-[#B8925A]"
                  style={{ fontFamily: "'Josefin Sans', sans-serif" }}
                >
                  View all products
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {products?.map((product, i) => {
                  const showFallback =
                    !product.thumbnailUrl ||
                    product.thumbnailUrl === "/images/product-tshirt.png" ||
                    gender === "kids";
                  const imgSrc = showFallback
                    ? fallbackImageFor(product.id)
                    : product.thumbnailUrl || product.modelUrl || undefined;

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}
                    >
                      <Link href={`/products/${product.id}`} className="group block">
                        <div
                          className="relative aspect-[3/4] overflow-hidden mb-3 transition-all"
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(184,146,90,0.3)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.08)")}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span
                                style={{
                                  color: "rgba(184,146,90,0.4)",
                                  fontFamily: "'Cormorant Garamond', serif",
                                  fontSize: 28,
                                  letterSpacing: "0.3em",
                                }}
                              >
                                KS
                              </span>
                            </div>
                          )}
                          {!product.available && (
                            <div
                              className="absolute top-2 right-2 text-neutral-900 text-[8px] uppercase px-2 py-0.5"
                              style={{
                                background: "#B8925A",
                                fontFamily: "'Josefin Sans', sans-serif",
                                letterSpacing: "0.2em",
                              }}
                            >
                              Sold Out
                            </div>
                          )}
                        </div>
                        <h3
                          className="text-neutral-900 mb-1 group-hover:!text-[#B8925A] transition-colors"
                          style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: 16,
                            fontWeight: 500,
                          }}
                        >
                          {product.name}
                        </h3>
                        <p
                          style={{
                            fontFamily: "'Josefin Sans', sans-serif",
                            fontSize: 10,
                            letterSpacing: "0.18em",
                            color: "#B8925A",
                          }}
                        >
                          {formatPrice(product.priceInPaise)}
                        </p>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ProductSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4] w-full rounded-none bg-black/[0.05]" />
      <Skeleton className="h-4 w-2/3 bg-black/[0.05]" />
      <Skeleton className="h-3 w-1/3 bg-black/[0.05]" />
    </div>
  );
}

export const getLastGender = _getLastGender;
