import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";

// Real photos from the uploaded zip
import p01 from "@assets/kasha-photo-01.jpeg"; // group of 4 golfers
import p02 from "@assets/kasha-photo-02.jpeg"; // navy cap
import p03 from "@assets/kasha-photo-03.jpeg"; // 3-panel floral
import p04 from "@assets/kasha-photo-04.jpeg"; // couple in pink floral
import p05 from "@assets/kasha-photo-05.jpeg"; // butterfly print man
import p06 from "@assets/kasha-photo-06.jpeg"; // 4 in marbled polos
import p07 from "@assets/kasha-photo-07.jpeg"; // solo swing man
import p08 from "@assets/kasha-photo-08.jpeg"; // happy group of 4
import p09 from "@assets/kasha-photo-09.jpeg"; // woman swinging on blue
import p10 from "@assets/kasha-photo-10.jpeg"; // dark linear print polo
import p11 from "@assets/kasha-photo-11.jpeg"; // olive KA.SHA horse polo
import p12 from "@assets/kasha-photo-12.jpeg"; // blue marble swing
import p13 from "@assets/kasha-photo-13.jpeg"; // women's black polo
import p15 from "@assets/kasha-photo-15.jpeg"; // green QClub polo
import p20 from "@assets/kasha-photo-20.jpeg"; // 3-panel butterfly/floral
import p25 from "@assets/kasha-photo-25.jpeg"; // 6 green trousers grid

// Fairway Favourites — catalog polo line drawings (KS1000B–KS1006B)
import ff1 from "@assets/Picture1_1777975346800.png"; // KS1000B blue floral
import ff2 from "@assets/Picture2_1777975346800.png"; // KS1001B light blue + brown trim
import ff3 from "@assets/Picture3_1777975346799.png"; // KS1002B olive/black panel
import ff4 from "@assets/Picture4_1777975346799.png"; // KS1003B pink/black panel
import ff5 from "@assets/Picture5_1777975346798.png"; // KS1004B dark green w/ white piping

const G = "Georgia, 'Times New Roman', serif";
const MAXW = "max-w-[1280px]";

const HERO_SLIDES = [
  {
    eyebrow: "Premium Golf Wear 2025",
    line1: "Authority", line1Italic: "in fit.",
    line2: "Personality", line2Italic: "in detail.",
    sub: "Tailored elegance for the modern player.",
    img: p01,
    primary: { label: "Shop New", href: "/products" },
    ghost:   { label: "Customise", href: "/products/1/customize" },
  },
  {
    eyebrow: "Women's Edit",
    line1: "Strength", line1Italic: "in form.",
    line2: "Grace", line2Italic: "in motion.",
    sub: "A collection built around the modern woman golfer.",
    img: p09,
    primary: { label: "Shop Women", href: "/products?gender=women" },
    ghost:   { label: "Discover", href: "/heritage" },
  },
  {
    eyebrow: "Print Edition",
    line1: "Bold", line1Italic: "where it counts.",
    line2: "Quiet", line2Italic: "where it should.",
    sub: "Signature Ka.Sha prints on the season's silhouettes.",
    img: p06,
    primary: { label: "Browse Prints", href: "/products?category=prints" },
    ghost:   { label: "Customise", href: "/products/1/customize" },
  },
  {
    eyebrow: "On the Course",
    line1: "Crafted", line1Italic: "for swing.",
    line2: "Designed", line2Italic: "for stance.",
    sub: "Performance fabrics built for movement.",
    img: p07,
    primary: { label: "Explore Edit", href: "/products" },
    ghost:   { label: "View Lookbook", href: "/heritage" },
  },
];

const SWATCHES_BY_INDEX = [
  ["#6b8a73", "#a09890", "#c8a0b0"],
  ["#3a6aaa", "#1c1c1c", "#c0302a", "#a09890"],
  ["#1c1c1c", "#6b6560", "#f7f3ee"],
  ["#9b8b6e", "#6b8a73", "#f0d89a", "#1c1c1c"],
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"MEN" | "WOMEN" | "KIDS">("MEN");
  const [slide, setSlide] = useState(0);
  const [tailorColor, setTailorColor] = useState(0);

  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );
  const apiTopSellers = products?.slice(0, 4) || [];

  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5500);
    return () => clearInterval(id);
  }, []);

  const categories = {
    MEN: [
      { title: "Golf T-shirts",       chip: "T-SHIRTS",  href: "/products?category=clothing&gender=men", img: p10 },
      { title: "Performance Trousers", chip: "TROUSERS",  href: "/products?category=trousers&gender=men", img: p25 },
      { title: "Caps & Accessories",   chip: "CAPS",      href: "/products?category=accessories&gender=men", img: p02 },
    ],
    WOMEN: [
      { title: "Polos & Tops",         chip: "TOPS",      href: "/products?category=clothing&gender=women", img: p13 },
      { title: "Performance Bottoms",  chip: "BOTTOMS",   href: "/products?category=trousers&gender=women", img: p09 },
      { title: "Caps & Accessories",   chip: "CAPS",      href: "/products?category=accessories&gender=women", img: p02 },
    ],
    KIDS: [
      { title: "Junior Tops",          chip: "TOPS",      href: "/products?category=clothing&gender=kids", img: p08 },
      { title: "Junior Bottoms",       chip: "BOTTOMS",   href: "/products?category=trousers&gender=kids", img: p25 },
      { title: "Junior Caps",          chip: "CAPS",      href: "/products?category=accessories&gender=kids", img: p02 },
    ],
  };

  const fallbackTopSellers = [
    { name: "The QClub Polo",   price: "₹4,500.00", img: p15, badge: "Best Seller" },
    { name: "Marble Wave Polo", price: "₹4,200.00", img: p12, badge: null },
    { name: "Linear Tee",       price: "₹3,800.00", img: p10, badge: null },
    { name: "KA.SHA Horse Polo", price: "₹4,800.00", img: p11, badge: "New" },
  ];

  const prints = [
    { title: "The Garden Polo",  sub: "Floral print",   img: p03 },
    { title: "Butterfly Edition", sub: "Statement",      img: p05 },
    { title: "Marble Wave",      sub: "Lifestyle crop", img: p20 },
    { title: "Pink Bloom",       sub: "Couple's set",   img: p04 },
  ];

  const slideData = HERO_SLIDES[slide];

  return (
    <Layout>

      {/* ───────────── HERO CAROUSEL — full-bleed 600px ───────────── */}
      <section className="relative w-full overflow-hidden bg-[#1c1c1c]" style={{ height: 600 }}>
        {HERO_SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0, pointerEvents: i === slide ? "auto" : "none" }}
          >
            <img src={s.img} alt={`${s.line1} ${s.line1Italic} ${s.line2} ${s.line2Italic}`} className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%)" }} />
          </div>
        ))}

        <div className={`relative z-10 h-full ${MAXW} mx-auto px-10 flex flex-col justify-center`}>
          <div className="max-w-[520px]">
            <p className="text-[10px] tracking-[0.3em] text-white/85 uppercase mb-5">{slideData.eyebrow}</p>
            <h1 style={{ fontFamily: G }} className="text-[48px] md:text-[56px] leading-[1.05] text-white">
              {slideData.line1}{" "}
              <em style={{ color: "#f0d89a", fontStyle: "italic", fontWeight: 400 }}>{slideData.line1Italic}</em>
              <br />
              {slideData.line2}{" "}
              <em style={{ color: "#f0d89a", fontStyle: "italic", fontWeight: 400 }}>{slideData.line2Italic}</em>
            </h1>
            <p className="text-[14px] text-white/85 mt-5 leading-relaxed">{slideData.sub}</p>

            <div className="mt-7 flex gap-3">
              <Link href={slideData.primary.href} className="bg-white text-[#1c1c1c] text-[10px] tracking-[0.25em] px-7 py-3.5 uppercase hover:bg-[#f7f3ee] transition-colors">
                {slideData.primary.label}
              </Link>
              <Link href={slideData.ghost.href} className="border border-white text-white text-[10px] tracking-[0.25em] px-7 py-3.5 uppercase hover:bg-white/10 transition-colors">
                {slideData.ghost.label}
              </Link>
            </div>
          </div>
        </div>

        <div className={`absolute top-7 right-10 z-10 text-[10px] tracking-[0.25em] text-white/70 uppercase`}>
          {String(slide + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
        </div>

        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="h-[3px] rounded-full bg-white transition-all"
              style={{ width: i === slide ? 32 : 14, opacity: i === slide ? 1 : 0.5 }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ───────────── BLACK MARQUEE STRIP ───────────── */}
      <section className="bg-[#1c1c1c] py-3.5">
        <div className={`${MAXW} mx-auto px-10 text-center text-[10px] tracking-[0.3em] text-white uppercase`}>
          Golf T-shirts &nbsp;·&nbsp; Performance Trousers &nbsp;·&nbsp; Caps &amp; Accessories &nbsp;·&nbsp; Tailor Your Play &nbsp;·&nbsp; Every Piece Customisable &nbsp;·&nbsp; Men · Women · Kids
        </div>
      </section>

      {/* ───────────── COLLECTIONS ───────────── */}
      <section className="bg-white pt-16 pb-16">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="text-center mb-10">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Shop by Category</p>
            <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c] mb-3">The Ka.Sha Collections</h2>
            <p className="text-[12px] text-[#6b6560] tracking-wide">Fit. Fabric. Print. Every Piece Fully Customisable.</p>
          </div>

          <div className="flex justify-center gap-0 mb-9 border-b border-[#ece8e2]">
            {(["MEN", "WOMEN", "KIDS"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-9 py-3 text-[10px] tracking-[0.25em] uppercase transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-[#1c1c1c] text-[#1c1c1c]"
                    : "border-transparent text-[#a09890] hover:text-[#1c1c1c]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {categories[activeTab].map(cat => (
              <Link key={cat.title} href={cat.href} className="group block">
                <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ aspectRatio: "3/4" }}>
                  <img
                    src={cat.img}
                    alt={cat.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                  <span className="absolute top-3 left-3 bg-white text-[8px] tracking-[0.25em] text-[#1c1c1c] uppercase px-3 py-1.5">
                    {cat.chip}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <h3 style={{ fontFamily: G }} className="text-[16px] text-[#1c1c1c]">{cat.title}</h3>
                  <span className="text-[10px] tracking-[0.25em] text-[#6b6560] group-hover:text-[#1c1c1c] transition-colors uppercase flex items-center gap-1.5">
                    Explore <span className="inline-block w-5 h-px bg-current" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── TOP SELLERS ───────────── */}
      <section className="bg-[#fbfaf8] pt-16 pb-16 border-y border-[#ece8e2]">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="text-center mb-10">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Top Sellers</p>
            <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c]">Bestsellers This Season</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {(apiTopSellers.length > 0 ? apiTopSellers : fallbackTopSellers as any[]).map((product: any, i: number) => {
              const isReal = apiTopSellers.length > 0;
              const swatches = SWATCHES_BY_INDEX[i % SWATCHES_BY_INDEX.length];
              const fallback = fallbackTopSellers[i] || fallbackTopSellers[0];
              return (
                <Link
                  key={isReal ? product.id : i}
                  href={isReal ? `/products/${product.id}` : "/products"}
                  className="group block"
                >
                  <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ aspectRatio: "3/4" }}>
                    <img
                      src={isReal && product.thumbnailUrl ? product.thumbnailUrl : fallback.img}
                      alt={isReal ? product.name : fallback.name}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                    {fallback.badge && (
                      <span className="absolute top-2 left-2 bg-white border border-[#ece8e2] text-[8px] tracking-[0.2em] text-[#1c1c1c] uppercase px-2 py-1">
                        {fallback.badge}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: G }} className="text-[14px] text-[#1c1c1c] mt-3">
                    {isReal ? product.name : fallback.name}
                  </h3>
                  <p className="text-[12px] text-[#a09890] mt-0.5">
                    {isReal ? formatPrice(product.priceInPaise) : fallback.price}
                  </p>
                  <div className="flex gap-[6px] mt-2.5">
                    {swatches.map((c, j) => (
                      <span
                        key={j}
                        className="inline-block rounded-full border border-[#ece8e2]"
                        style={{ width: 14, height: 14, background: c }}
                      />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── FAIRWAY FAVOURITES (catalog: KS1000B–KS1006B) ───────────── */}
      <section className="bg-white pt-16 pb-16 border-b border-[#ece8e2]">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">The Catalogue</p>
              <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c]">Fairway Favourites</h2>
              <p className="text-[13px] text-[#6b6560] mt-2 max-w-[520px]">
                Signature polos in breathable Poly-Sorona dry-fit. Pick a style, then customise prints, panels and colourways.
              </p>
            </div>
            <Link href="/products" className="hidden md:inline-block text-[10px] tracking-[0.3em] text-[#9b8b6e] hover:text-[#1c1c1c] transition-colors uppercase whitespace-nowrap">
              View full catalogue »
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { id: 10, sku: "KS1000B", img: ff1, name: "Signature Floral Polo",     swatch: "#a9c4d4", kind: "Fabric" as const },
              { id: 11, sku: "KS1001B", img: ff2, name: "Trim Detail Polo",          swatch: "#cfdde6", kind: "Fabric" as const },
              { id: 12, sku: "KS1002B", img: ff3, name: "Sport Side Panel Polo",     swatch: "#5a6a3a", kind: "Pattern" as const },
              { id: 13, sku: "KS1003B", img: ff4, name: "Hourglass Panel Polo",      swatch: "#e8b9c4", kind: "Pattern" as const },
              { id: 14, sku: "KS1004B", img: ff5, name: "Classic Piping Polo",       swatch: "#1f3a2a", kind: "Pattern" as const },
              { id: 15, sku: "KS1005B", img: ff3, name: "Triple Tone Polo",          swatch: "#3a3a3a", kind: "Pattern" as const },
              { id: 16, sku: "KS1006B", img: ff5, name: "Wave Panel Polo",           swatch: "#2a3a4a", kind: "Pattern" as const },
            ].map((item) => (
              <Link key={item.sku} href={`/products/${item.id}`} className="group block">
                <div className="relative overflow-hidden bg-[#f7f3ee] flex items-center justify-center" style={{ aspectRatio: "3/4" }}>
                  <img
                    src={item.img}
                    alt={`${item.name} — ${item.sku}`}
                    className="w-full h-full object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <span className="absolute top-3 left-3 bg-white border border-[#ece8e2] text-[8px] tracking-[0.25em] text-[#1c1c1c] uppercase px-2 py-1">
                    {item.kind}
                  </span>
                </div>
                <div className="flex items-start justify-between pt-3">
                  <div>
                    <h3 style={{ fontFamily: G }} className="text-[14px] text-[#1c1c1c] leading-tight">{item.name}</h3>
                    <p className="text-[10px] tracking-[0.2em] text-[#9b8b6e] uppercase mt-1">{item.sku}</p>
                  </div>
                  <p className="text-[13px] text-[#1c1c1c] whitespace-nowrap">₹2,000</p>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <span
                    className="inline-block rounded-full border border-[#ece8e2]"
                    style={{ width: 14, height: 14, background: item.swatch }}
                  />
                  <span className="text-[10px] text-[#a09890] tracking-[0.15em] uppercase">Customisable</span>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-[11px] text-[#a09890] text-center mt-10 tracking-[0.05em]">
            Poly 55% · Sorona 45% · 105 GSM · Sizes S / M / L / XL + Custom · Made to order
          </p>
        </div>
      </section>

      {/* ───────────── PATTERN CATEGORIES ───────────── */}
      <section className="bg-[#f7f3ee] pt-16 pb-16 border-b border-[#ece8e2]">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="text-center mb-10">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Pattern Categories</p>
            <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c] leading-[1.15]">
              Seven panel languages.<br />One signature silhouette.
            </h2>
            <p className="text-[12px] text-[#6b6560] mt-3 max-w-[560px] mx-auto">
              Every pattern style ships as its own product. Pick the cut, then recolour the zones — the panel layout stays as-designed.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { id: "classic",     label: "Classic",     productId: 14, swatch: "#1f3a2a" },
              { id: "sport-side",  label: "Sport Side",  productId: 12, swatch: "#5a6a3a" },
              { id: "triple-tone", label: "Triple Tone", productId: 15, swatch: "#3a3a3a" },
              { id: "wave-panel",  label: "Wave Panel",  productId: 16, swatch: "#2a3a4a" },
              { id: "hourglass",   label: "Hourglass",   productId: 13, swatch: "#e8b9c4" },
              { id: "pinstripe",   label: "Pinstripe",   productId: null, swatch: "#cfdde6" },
              { id: "raglan",      label: "Raglan",      productId: null, swatch: "#a9c4d4" },
            ].map((cat) => {
              const inner = (
                <div className="group block">
                  <div className="aspect-square bg-white border border-[#ece8e2] flex items-center justify-center transition-colors group-hover:border-[#1c1c1c]">
                    <span
                      className="block rounded-full"
                      style={{ width: 56, height: 56, background: cat.swatch, border: "1px solid rgba(0,0,0,0.08)" }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-[12px] tracking-[0.12em] text-[#1c1c1c] uppercase font-semibold">{cat.label}</div>
                    {cat.productId === null && (
                      <div className="text-[9px] tracking-[0.18em] text-[#a09890] mt-1 uppercase">Coming Soon</div>
                    )}
                  </div>
                </div>
              );
              return cat.productId !== null ? (
                <Link key={cat.id} href={`/products/${cat.productId}`} aria-label={`${cat.label} pattern polo`}>
                  {inner}
                </Link>
              ) : (
                <div key={cat.id} aria-label={`${cat.label} pattern polo (coming soon)`}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── TAILOR YOUR PLAY ───────────── */}
      <section className="bg-white pt-16 pb-16">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="grid grid-cols-1 md:grid-cols-2 border border-[#ece8e2]">
            <div className="bg-[#f7f3ee] p-12 md:p-14">
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mb-5">Tailor Your Play</p>
              <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c] leading-[1.1]">
                Your game.<br />Your choices.
              </h2>

              <ol className="mt-8 space-y-4">
                {[
                  "Select your style — polo, tee or collar",
                  "Choose a print or solid from the palette",
                  "Upload your logo and drag to position",
                  "Review & get your Ka.Sha",
                ].map((step, i) => (
                  <li key={i} className="flex gap-5 items-baseline">
                    <span className="text-[12px] tracking-[0.15em] text-[#9b8b6e] shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[13px] text-[#6b6560]">{step}</span>
                  </li>
                ))}
              </ol>

              <Link href="/products/1/customize" className="mt-9 inline-block bg-[#1c1c1c] text-white text-[10px] tracking-[0.3em] px-9 py-4 uppercase hover:bg-black transition-colors">
                Start Customising
              </Link>
            </div>

            <div className="bg-white p-8 flex flex-col items-center justify-center min-h-[420px]">
              <img src={p11} alt="Customise preview" className="max-h-[340px] w-auto object-contain" />
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mt-6">Choose Colour</p>
              <div className="flex gap-3 mt-3">
                {["#c0302a", "#6b8a73", "#3a6aaa", "#c8a0b0", "#f7f3ee"].map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setTailorColor(i)}
                    aria-label={`Colour ${i + 1}`}
                    className="rounded-full transition-all"
                    style={{
                      width: 22, height: 22, background: c,
                      border: tailorColor === i ? "2px solid #1c1c1c" : "1px solid #ece8e2",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── PRINTS SHOWCASE ───────────── */}
      <section className="bg-white pt-16 pb-16">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="text-center mb-10">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Prints Showcase</p>
            <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c] leading-[1.15]">
              Structured where it matters.<br />Expressive where it shows.
            </h2>
            <p className="text-[12px] text-[#6b6560] tracking-wide mt-3">Collar · Stitch · Fabric · Logo detail</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {prints.map(p => (
              <div key={p.title} className="group block cursor-pointer">
                <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ aspectRatio: "1/1" }}>
                  <img
                    src={p.img}
                    alt={p.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5" style={{ background: "rgba(255,255,255,0.94)" }}>
                    <div style={{ fontFamily: G }} className="text-[13px] text-[#1c1c1c] leading-tight">{p.title}</div>
                    <div className="text-[9px] tracking-[0.2em] text-[#9b8b6e] uppercase mt-0.5">{p.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── EVENTS GALLERY ───────────── */}
      <section className="bg-white pt-16 pb-16">
        <div className={`${MAXW} mx-auto px-10`}>
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mb-2">On the course</p>
              <h2 style={{ fontFamily: G }} className="text-[32px] md:text-[36px] text-[#1c1c1c]">
                Your event. Our customised expertise.
              </h2>
            </div>
            <Link href="/heritage">
              <span className="text-[10px] tracking-[0.25em] text-[#9b8b6e] hover:text-[#1c1c1c] transition-colors uppercase flex items-center gap-1.5 whitespace-nowrap">
                View all events <span>»</span>
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 mb-4">
            <div className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 380 }}>
              <img src={p01} alt="Group of golfers in KA.SHA tournament kits" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 50%)" }} />
              <div className="absolute bottom-7 left-8 right-8 text-white">
                <p className="text-[9px] tracking-[0.3em] text-white/85 uppercase mb-3">Corporate &amp; Teams</p>
                <h3 style={{ fontFamily: G }} className="text-[26px] leading-tight">
                  Tournament kits,<br />team activations.
                </h3>
                <Link href="/heritage" className="mt-5 inline-block text-[10px] tracking-[0.3em] text-[#f0d89a] uppercase border-b border-[#f0d89a] pb-1 hover:text-white hover:border-white transition-colors">
                  Enquire now
                </Link>
              </div>
            </div>
            <div className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 380 }}>
              <img src={p09} alt="Woman golfer mid-swing in KA.SHA apparel" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 50%)" }} />
              <div className="absolute bottom-7 left-7 right-7 text-white">
                <p className="text-[9px] tracking-[0.3em] text-white/85 uppercase mb-3">Women's Golf</p>
                <h3 style={{ fontFamily: G }} className="text-[20px] leading-tight">
                  Authority in fit.<br />Personality in detail.
                </h3>
                <Link href="/products?gender=women" className="mt-4 inline-block text-[10px] tracking-[0.3em] text-[#f0d89a] uppercase border-b border-[#f0d89a] pb-1 hover:text-white hover:border-white transition-colors">
                  Shop Women
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tournament Kits",  img: p07 },
              { label: "Corporate Days",   img: p08 },
              { label: "Women's Series",   img: p13 },
              { label: "Junior Programme", img: p06 },
            ].map(t => (
              <div key={t.label} className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 180 }}>
                <img src={t.img} alt={t.label} className="w-full h-full object-cover object-center" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-3 py-2.5 text-[9px] tracking-[0.25em] text-white uppercase">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </Layout>
  );
}
