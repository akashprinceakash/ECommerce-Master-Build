import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";

import heroImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.24_1777970409892.jpeg";
import collectionsImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.26_1777970409889.jpeg";
import topSellersImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.26_(1)_1777970409888.jpeg";
import tailorImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.26_(2)_1777970409887.jpeg";
import printsImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.27_1777970409886.jpeg";
import eventsImg from "@assets/WhatsApp_Image_2026-05-04_at_16.42.28_1777970409885.jpeg";

const G = "Georgia, 'Times New Roman', serif";

// 4 hero slides
const HERO_SLIDES = [
  {
    eyebrow: "Premium Golf Wear 2025",
    line1: "Authority",
    line1Italic: "in fit.",
    line2: "Personality",
    line2Italic: "in detail.",
    sub: "Tailored elegance for the modern player.",
    img: heroImg,
    primary: { label: "Shop New", href: "/products" },
    ghost:   { label: "Customise", href: "/products/1/customize" },
  },
  {
    eyebrow: "On the Course · Spring Edit",
    line1: "Crafted",
    line1Italic: "for swing.",
    line2: "Designed",
    line2Italic: "for stance.",
    sub: "Performance fabrics built for movement.",
    img: heroImg,
    primary: { label: "Explore Edit", href: "/products" },
    ghost:   { label: "View Lookbook", href: "/heritage" },
  },
  {
    eyebrow: "Women's Edit",
    line1: "Strength",
    line1Italic: "in form.",
    line2: "Grace",
    line2Italic: "in motion.",
    sub: "A collection built around the modern woman golfer.",
    img: heroImg,
    primary: { label: "Shop Women", href: "/products?gender=women" },
    ghost:   { label: "Discover", href: "/heritage" },
  },
  {
    eyebrow: "Print Edition",
    line1: "Bold",
    line1Italic: "where it counts.",
    line2: "Quiet",
    line2Italic: "where it should.",
    sub: "Signature Ka.Sha prints on the season's silhouettes.",
    img: heroImg,
    primary: { label: "Browse Prints", href: "/products?category=prints" },
    ghost:   { label: "Customise", href: "/products/1/customize" },
  },
];

const SWATCHES_BY_INDEX = [
  ["#6b8a73", "#a09890", "#c8a0b0"],
  ["#c0302a", "#3a6aaa", "#6b8a73", "#f0d89a", "#f7f3ee"],
  ["#3a6aaa", "#1c1c1c", "#c0302a", "#a09890"],
  ["#c8a0b0", "#3a6aaa", "#9b8b6e", "#f7f3ee", "#1c1c1c"],
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"MEN" | "WOMEN" | "KIDS">("MEN");
  const [slide, setSlide] = useState(0);
  const [tailorColor, setTailorColor] = useState(0);

  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );
  const topSellers = products?.slice(0, 4) || [];

  // auto-advance hero every 5.5s
  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5500);
    return () => clearInterval(id);
  }, []);

  const categories = {
    MEN: [
      { title: "T-shirts",          chip: "T-SHIRTS",  href: "/products?category=clothing&gender=men", img: "/images/product-tshirt.png" },
      { title: "Trousers",          chip: "TROUSERS",  href: "/products?category=trousers&gender=men", img: "/images/product-trousers.png" },
      { title: "Caps & Accessories", chip: "CAPS",      href: "/products?category=accessories&gender=men", img: "/images/product-jacket.png" },
    ],
    WOMEN: [
      { title: "Polos & Tops",      chip: "TOPS",      href: "/products?category=clothing&gender=women", img: "/images/product-tshirt.png" },
      { title: "Bottoms",           chip: "BOTTOMS",   href: "/products?category=trousers&gender=women", img: "/images/product-trousers.png" },
      { title: "Caps & Accessories", chip: "CAPS",      href: "/products?category=accessories&gender=women", img: "/images/product-jacket.png" },
    ],
    KIDS: [
      { title: "Junior Tops",       chip: "TOPS",      href: "/products?category=clothing&gender=kids", img: "/images/product-tshirt.png" },
      { title: "Junior Bottoms",    chip: "BOTTOMS",   href: "/products?category=trousers&gender=kids", img: "/images/product-trousers.png" },
      { title: "Junior Caps",       chip: "CAPS",      href: "/products?category=accessories&gender=kids", img: "/images/product-jacket.png" },
    ],
  };

  const prints = [
    { title: "The Garden Polo",  sub: "Floral print",   img: printsImg },
    { title: "Marble Wave",      sub: "Lifestyle crop", img: printsImg },
    { title: "Collar Detail",    sub: "Contrast trim",  img: printsImg },
    { title: "Trouser Pocket",   sub: "Crafted detail", img: printsImg },
  ];

  const eventThumbs = [
    { label: "Tournament Kits",  img: eventsImg },
    { label: "Corporate Days",   img: eventsImg },
    { label: "Women's Series",   img: eventsImg },
    { label: "Junior Programme", img: eventsImg },
  ];

  const slideData = HERO_SLIDES[slide];

  return (
    <Layout>

      {/* ───────────── HERO CAROUSEL — 540px full-bleed ───────────── */}
      <section className="relative w-full overflow-hidden bg-[#1c1c1c]" style={{ height: 540 }}>
        {HERO_SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0, pointerEvents: i === slide ? "auto" : "none" }}
          >
            <img src={s.img} alt="" className="w-full h-full object-cover object-center" />
            {/* L→R gradient 58% → 0% */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0) 60%)" }} />
          </div>
        ))}

        {/* Slide content */}
        <div className="relative z-10 h-full max-w-[940px] mx-auto px-9 flex flex-col justify-center">
          <div className="max-w-[460px]">
            <p className="text-[10px] tracking-[0.3em] text-white/85 uppercase mb-5">{slideData.eyebrow}</p>
            <h1 style={{ fontFamily: G }} className="text-[42px] leading-[1.1] text-white">
              {slideData.line1}{" "}
              <em style={{ color: "#f0d89a" }} className="not-italic font-normal italic">{slideData.line1Italic}</em>
              <br />
              {slideData.line2}{" "}
              <em style={{ color: "#f0d89a" }} className="not-italic font-normal italic">{slideData.line2Italic}</em>
            </h1>
            <p className="text-[13px] text-white/85 mt-5 leading-relaxed">{slideData.sub}</p>

            <div className="mt-7 flex gap-3">
              <Link href={slideData.primary.href}>
                <button className="bg-white text-[#1c1c1c] text-[9px] tracking-[0.25em] px-7 py-3 uppercase hover:bg-[#f7f3ee] transition-colors">
                  {slideData.primary.label}
                </button>
              </Link>
              <Link href={slideData.ghost.href}>
                <button className="border border-white text-white text-[9px] tracking-[0.25em] px-7 py-3 uppercase hover:bg-white/10 transition-colors">
                  {slideData.ghost.label}
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Counter top-right */}
        <div className="absolute top-7 right-9 z-10 text-[10px] tracking-[0.25em] text-white/70 uppercase">
          {String(slide + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
        </div>

        {/* Slide dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="h-[3px] rounded-full bg-white transition-all"
              style={{ width: i === slide ? 28 : 14, opacity: i === slide ? 1 : 0.5 }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ───────────── BLACK MARQUEE STRIP ───────────── */}
      <section className="bg-[#1c1c1c] py-3.5 overflow-hidden">
        <div className="max-w-[940px] mx-auto px-9 text-center text-[10px] tracking-[0.3em] text-white uppercase">
          Golf T-shirts &nbsp;·&nbsp; Performance Trousers &nbsp;·&nbsp; Caps &amp; Accessories &nbsp;·&nbsp; Tailor Your Play &nbsp;·&nbsp; Every Piece Customisable &nbsp;·&nbsp; Men · Women · Kids
        </div>
      </section>

      {/* ───────────── COLLECTIONS — Shop by Category ───────────── */}
      <section className="bg-white pt-[50px] pb-14">
        <div className="max-w-[940px] mx-auto px-9">
          <div className="text-center mb-9">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Shop by Category</p>
            <h2 style={{ fontFamily: G }} className="text-[26px] text-[#1c1c1c] mb-3">The Ka.Sha Collections</h2>
            <p className="text-[12px] text-[#6b6560]">Fit. Fabric. Print. Every Piece Fully Customisable.</p>
          </div>

          {/* MEN/WOMEN/KIDS tabs */}
          <div className="flex justify-center gap-0 mb-9">
            {(["MEN", "WOMEN", "KIDS"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-7 py-2 text-[10px] tracking-[0.25em] uppercase transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-[#1c1c1c] text-[#1c1c1c]"
                    : "border-transparent text-[#a09890] hover:text-[#1c1c1c]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
            {categories[activeTab].map(cat => (
              <Link key={cat.title} href={cat.href} className="group block">
                <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ height: 320 }}>
                  <img
                    src={cat.img}
                    alt={cat.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  {/* white pill chip */}
                  <span className="absolute top-3 left-3 bg-white text-[8px] tracking-[0.25em] text-[#1c1c1c] uppercase px-3 py-1.5">
                    {cat.chip}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <h3 style={{ fontFamily: G }} className="text-[14px] text-[#1c1c1c]">{cat.title}</h3>
                  <span className="text-[9px] tracking-[0.25em] text-[#6b6560] group-hover:text-[#1c1c1c] transition-colors uppercase flex items-center gap-1.5">
                    Explore <span className="inline-block w-5 h-px bg-current" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── TOP SELLERS — The Fairway Favourites ───────────── */}
      <section className="bg-white pt-[50px] pb-14">
        <div className="max-w-[940px] mx-auto px-9">
          <div className="text-center mb-9">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Top Sellers</p>
            <h2 style={{ fontFamily: G }} className="text-[26px] text-[#1c1c1c]">The Fairway Favourites</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px]">
            {(topSellers.length > 0 ? topSellers : [0,1,2,3] as any).map((product: any, i: number) => {
              const isReal = topSellers.length > 0;
              const swatches = SWATCHES_BY_INDEX[i % SWATCHES_BY_INDEX.length];
              return (
                <Link
                  key={isReal ? product.id : i}
                  href={isReal ? `/products/${product.id}` : "/products"}
                  className="group block"
                >
                  <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ height: 220 }}>
                    {isReal && product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.name}
                        className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <img src={topSellersImg} alt="" className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]" />
                    )}
                    {i === 0 && (
                      <span className="absolute top-2 left-2 bg-white border border-[#ece8e2] text-[8px] tracking-[0.2em] text-[#1c1c1c] uppercase px-2 py-1">
                        Best Seller
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: G }} className="text-[13px] text-[#1c1c1c] mt-3">
                    {isReal ? product.name : ["The QClub Polo", "The Marble Polo", "The Scroll Polo", "Ka.Sha Yellow Tee"][i]}
                  </h3>
                  <p className="text-[11px] text-[#a09890] mt-0.5">
                    {isReal ? formatPrice(product.priceInPaise) : ["₹4,500.00", "₹4,200.00", "₹4,500.00", "₹3,800.00"][i]}
                  </p>
                  {/* swatches */}
                  <div className="flex gap-[5px] mt-2">
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

      {/* ───────────── TAILOR YOUR PLAY — split panel ───────────── */}
      <section className="bg-white pt-[50px] pb-14">
        <div className="max-w-[940px] mx-auto px-9">
          <div className="grid grid-cols-1 md:grid-cols-2 border border-[#ece8e2]">
            {/* LEFT — cream */}
            <div className="bg-[#f7f3ee] p-10 md:p-12">
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mb-4">Tailor Your Play</p>
              <h2 style={{ fontFamily: G }} className="text-[26px] text-[#1c1c1c] leading-[1.15]">
                Your game.<br />Your choices.
              </h2>

              <ol className="mt-7 space-y-3">
                {[
                  "Select your style — polo, tee or collar",
                  "Choose a print or solid from the palette",
                  "Upload your logo and drag to position",
                  "Review &amp; get your Ka.Sha",
                ].map((step, i) => (
                  <li key={i} className="flex gap-4 items-baseline">
                    <span className="text-[11px] tracking-[0.15em] text-[#9b8b6e]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12px] text-[#6b6560]" dangerouslySetInnerHTML={{ __html: step }} />
                  </li>
                ))}
              </ol>

              <Link href="/products/1/customize">
                <button className="mt-8 bg-[#1c1c1c] text-white text-[9px] tracking-[0.3em] px-8 py-3.5 uppercase hover:bg-black transition-colors">
                  Start Customising
                </button>
              </Link>
            </div>

            {/* RIGHT — white preview */}
            <div className="bg-white p-10 md:p-12 flex flex-col items-center justify-center">
              <img src={tailorImg} alt="Customise preview" className="max-h-[280px] w-auto object-contain" />
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mt-6">Choose Colour</p>
              <div className="flex gap-3 mt-3">
                {["#c0302a", "#6b8a73", "#3a6aaa", "#c8a0b0", "#f7f3ee"].map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setTailorColor(i)}
                    aria-label={`Colour ${i + 1}`}
                    className="rounded-full border transition-all"
                    style={{
                      width: 18, height: 18, background: c,
                      borderColor: tailorColor === i ? "#1c1c1c" : "#ece8e2",
                      outline: tailorColor === i ? "2px solid #1c1c1c" : "none",
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
      <section className="bg-white pt-[50px] pb-14">
        <div className="max-w-[940px] mx-auto px-9">
          <div className="text-center mb-9">
            <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] mb-3 uppercase">Prints Showcase</p>
            <h2 style={{ fontFamily: G }} className="text-[26px] text-[#1c1c1c] leading-[1.2]">
              Structured where it matters.<br />Expressive where it shows.
            </h2>
            <p className="text-[12px] text-[#6b6560] mt-3">Collar · Stitch · Fabric · Logo detail</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
            {prints.map(p => (
              <div key={p.title} className="group block cursor-pointer">
                <div className="relative overflow-hidden bg-[#f7f3ee]" style={{ height: 200 }}>
                  <img
                    src={p.img}
                    alt={p.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  {/* white 92% strip */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2" style={{ background: "rgba(255,255,255,0.92)" }}>
                    <div style={{ fontFamily: G }} className="text-[12px] text-[#1c1c1c] leading-tight">{p.title}</div>
                    <div className="text-[9px] tracking-[0.2em] text-[#9b8b6e] uppercase mt-0.5">{p.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── EVENTS GALLERY ───────────── */}
      <section className="bg-white pt-[50px] pb-14">
        <div className="max-w-[940px] mx-auto px-9">
          <div className="flex items-end justify-between mb-7">
            <div>
              <p className="text-[9px] tracking-[0.3em] text-[#9b8b6e] uppercase mb-2">On the course</p>
              <h2 style={{ fontFamily: G }} className="text-[26px] text-[#1c1c1c]">
                Your event. Our customised expertise.
              </h2>
            </div>
            <Link href="/heritage">
              <span className="text-[10px] tracking-[0.25em] text-[#9b8b6e] hover:text-[#1c1c1c] transition-colors uppercase flex items-center gap-1.5 whitespace-nowrap">
                View all events <span>»</span>
              </span>
            </Link>
          </div>

          {/* Main row 2fr : 1fr */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-[10px] mb-[10px]">
            {/* Left big */}
            <div className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 300 }}>
              <img src={eventsImg} alt="" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)" }} />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <p className="text-[9px] tracking-[0.3em] text-white/80 uppercase mb-2">Corporate &amp; Teams</p>
                <h3 style={{ fontFamily: G }} className="text-[20px] leading-tight">
                  Tournament kits,<br />team activations.
                </h3>
                <Link href="/heritage">
                  <button className="mt-4 text-[9px] tracking-[0.3em] text-[#f0d89a] uppercase border-b border-[#f0d89a] pb-0.5 hover:text-white hover:border-white transition-colors">
                    Enquire now
                  </button>
                </Link>
              </div>
            </div>
            {/* Right */}
            <div className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 300 }}>
              <img src={eventsImg} alt="" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)" }} />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <p className="text-[9px] tracking-[0.3em] text-white/80 uppercase mb-2">Women's Golf</p>
                <h3 style={{ fontFamily: G }} className="text-[18px] leading-tight">
                  Authority in fit.<br />Personality in detail.
                </h3>
                <Link href="/products?gender=women">
                  <button className="mt-3 text-[9px] tracking-[0.3em] text-[#f0d89a] uppercase border-b border-[#f0d89a] pb-0.5 hover:text-white hover:border-white transition-colors">
                    Shop Women
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Thumb row 4 cols */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
            {eventThumbs.map(t => (
              <div key={t.label} className="relative overflow-hidden bg-[#1c1c1c]" style={{ height: 140 }}>
                <img src={t.img} alt={t.label} className="w-full h-full object-cover object-center" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-3 py-2 text-[8px] tracking-[0.25em] text-white uppercase">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand strip & footer rendered by <Footer /> via <Layout> */}
    </Layout>
  );
}
