import { Layout } from "@/components/layout/Layout";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import { type Gender, getLastGender as _getLastGender, setLastGender } from "@/lib/genderPreference";

type ItemType = "tshirts" | "trousers";

const TSHIRT_CATEGORIES = ["t-shirt", "polo", "fabric-tshirt", "pattern", "shirts"];
const TROUSER_CATEGORIES = ["pants"];

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
    typeParam === "tshirts" || typeParam === "trousers" ? typeParam : undefined;

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
      list = list.filter((p) => TSHIRT_CATEGORIES.includes((p.category || "").toLowerCase()));
    } else if (type === "trousers") {
      list = list.filter((p) => TROUSER_CATEGORIES.includes((p.category || "").toLowerCase()));
    }

    if (gender) {
      const tokens = GENDER_TOKENS[gender];
      const matched = list.filter((p) => {
        const hay = `${p.name} ${p.description || ""}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
      // If no name keywords match, fall back to the type-filtered list so the page is never empty.
      if (matched.length > 0) list = matched;
    }

    return list;
  }, [rawProducts, type, gender]);

  const buildHref = (g?: Gender, t?: ItemType) => {
    const sp = new URLSearchParams();
    if (g) sp.set("gender", g);
    if (t) sp.set("type", t);
    const q = sp.toString();
    return q ? `/products?${q}` : "/products";
  };

  const sidebar: { label: string; gender: Gender; items: { label: string; type: ItemType }[] }[] = [
    {
      label: "Men",
      gender: "men",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Trousers", type: "trousers" },
      ],
    },
    {
      label: "Women",
      gender: "women",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Trousers", type: "trousers" },
      ],
    },
    {
      label: "Kids",
      gender: "kids",
      items: [
        { label: "T-shirts", type: "tshirts" },
        { label: "Trousers", type: "trousers" },
      ],
    },
  ];

  const breadcrumb = [
    gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "All",
    type === "tshirts" ? "T-shirts" : type === "trousers" ? "Trousers" : null,
  ]
    .filter(Boolean)
    .join(" / ");

  const heading = gender || type
    ? `${gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "All"}${type ? " · " + (type === "tshirts" ? "T-shirts" : "Trousers") : ""}`
    : "The Collection";

  const fallbackImageFor = (productId: number) => {
    if (gender === "kids") return KIDS_FALLBACK_IMAGE;
    return COLLECTION_IMAGES[productId % COLLECTION_IMAGES.length];
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-gray-50 border-b border-gray-200 py-10 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mb-4">
            <Link href="/" className="hover:text-black transition-colors">HOME</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/products" className="hover:text-black transition-colors">SHOP</Link>
            {breadcrumb && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-black uppercase">{breadcrumb}</span>
              </>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-black">{heading}</h1>
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
                className={`block py-2 text-[12px] tracking-[0.18em] uppercase font-semibold border-b border-gray-200 ${
                  !gender && !type ? "text-black" : "text-gray-500 hover:text-black"
                }`}
              >
                All Products
              </Link>
              {sidebar.map((section) => {
                const sectionActive = gender === section.gender;
                return (
                  <div key={section.gender} className="border-b border-gray-200">
                    <Link
                      href={buildHref(section.gender, undefined)}
                      aria-current={sectionActive && !type ? "page" : undefined}
                      className={`block py-3 text-[12px] tracking-[0.18em] uppercase font-semibold ${
                        sectionActive ? "text-black" : "text-gray-700 hover:text-black"
                      }`}
                    >
                      {section.label}
                    </Link>
                    <ul className="pb-2">
                      {section.items.map((it) => {
                        const itemActive = sectionActive && type === it.type;
                        return (
                          <li key={it.type}>
                            <Link
                              href={buildHref(section.gender, it.type)}
                              aria-current={itemActive ? "page" : undefined}
                              className={`block pl-3 py-1.5 text-[11px] tracking-[0.12em] uppercase border-l-2 ${
                                itemActive
                                  ? "border-black text-black font-medium"
                                  : "border-transparent text-gray-500 hover:text-black hover:border-gray-300"
                              }`}
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

              {/* Quick "type only" links — shows the active gender if one is set */}
              <div className="mt-6">
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-2">Browse by type</div>
                <Link
                  href={buildHref(gender, "tshirts")}
                  className={`block py-1.5 text-[11px] tracking-[0.12em] uppercase ${
                    type === "tshirts" ? "text-black font-medium" : "text-gray-500 hover:text-black"
                  }`}
                >
                  All T-shirts
                </Link>
                <Link
                  href={buildHref(gender, "trousers")}
                  className={`block py-1.5 text-[11px] tracking-[0.12em] uppercase ${
                    type === "trousers" ? "text-black font-medium" : "text-gray-500 hover:text-black"
                  }`}
                >
                  All Trousers
                </Link>
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
              <div className="py-20 text-center text-gray-500">
                <p>Failed to load products. Please try again later.</p>
              </div>
            ) : products?.length === 0 ? (
              <div className="py-20 text-center text-gray-500">
                <p className="mb-4">No products found in this category yet.</p>
                <button
                  onClick={() => navigate("/products")}
                  className="text-[12px] uppercase tracking-[0.18em] underline"
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
                        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-gray-300 font-black tracking-widest text-xl">KA.SHA</span>
                            </div>
                          )}
                          {!product.available && (
                            <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5">
                              SOLD OUT
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                        </div>
                        <h3 className="text-[13px] font-semibold text-black mb-0.5 group-hover:underline">
                          {product.name}
                        </h3>
                        <p className="text-[12px] text-gray-500">{formatPrice(product.priceInPaise)}</p>
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
      <Skeleton className="aspect-[3/4] w-full rounded-none bg-gray-100" />
      <Skeleton className="h-4 w-2/3 bg-gray-100" />
      <Skeleton className="h-3 w-1/3 bg-gray-100" />
    </div>
  );
}

export const getLastGender = _getLastGender;
