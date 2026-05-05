import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";

// ── Design tokens (from KaSha Homepage Mockup v4) ────────────────────────────
const T = {
  charcoal: "#1c1c1c",
  cream: "#f7f3ee",
  divider: "#ece8e2",
  gold: "#9b8b6e",
  bodyGrey: "#6b6560",
  muted: "#a09890",
  yellow: "#FEC200",
  heroGold: "#f0d89a",
  red: "#c0302a",
  blue: "#3a6aaa",
  blush: "#c8a0b0",
};

// ── HERO SLIDES ──────────────────────────────────────────────────────────────
const HERO_SLIDES = [
  {
    img: "/images/product-jacket.png",
    eyebrow: "NEW COLLECTION — 2026",
    titlePre: "Redefining",
    titleEm: "the Modern",
    titlePost: "Game.",
    body: "Elevated performance wear for those who treat golf as a lifestyle, not just a sport.",
    cta1: { label: "SHOP NEW ARRIVALS", href: "/products" },
    cta2: { label: "EXPLORE COLLECTIONS", href: "/products" },
  },
  {
    img: "/images/product-tshirt.png",
    eyebrow: "BUTTERFLY EDITION",
    titlePre: "Bloom",
    titleEm: "across the",
    titlePost: "Fairway.",
    body: "Hand-drawn prints meet performance fabrics. Made for the contemporary player.",
    cta1: { label: "SHOP PRINTS", href: "/products?category=fabric-tshirt" },
    cta2: { label: "VIEW LOOKBOOK", href: "/heritage" },
  },
  {
    img: "/images/product-trousers.png",
    eyebrow: "WOMEN'S EDIT",
    titlePre: "Crafted",
    titleEm: "for her",
    titlePost: "Game.",
    body: "Tailored cuts, refined fabrics. The Ka.Sha women's collection.",
    cta1: { label: "SHOP WOMEN", href: "/products?gender=women" },
    cta2: { label: "OUR STORY", href: "/heritage" },
  },
  {
    img: "/images/product-jacket.png",
    eyebrow: "ON-COURSE EDITION",
    titlePre: "Print.",
    titleEm: "Performance.",
    titlePost: "Polish.",
    body: "Limited print drops, ready for the fairway.",
    cta1: { label: "EXPLORE", href: "/products" },
    cta2: { label: "CUSTOMISE", href: "/products/1/customize" },
  },
];

export default function Home() {
  const [tab, setTab] = useState<"MEN" | "WOMEN" | "KIDS">("MEN");
  const [slide, setSlide] = useState(0);
  const slideRef = useRef<number>(0);

  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );

  // Auto-advance hero every 5.5s per spec
  useEffect(() => {
    const id = setInterval(() => {
      slideRef.current = (slideRef.current + 1) % HERO_SLIDES.length;
      setSlide(slideRef.current);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  const fabricTees = (products || []).filter(p => p.category === "fabric-tshirt");
  const patternTees = (products || []).filter(p => p.category === "pattern");
  const topSellers = (products || []).slice(0, 4);

  const categoryTiles = {
    MEN: [
      { title: "T-Shirts",  href: "/products?category=fabric-tshirt", chip: "NEW IN", img: "/images/product-tshirt.png" },
      { title: "Trousers",  href: "/products?category=trousers",      chip: "ESSENTIAL", img: "/images/product-trousers.png" },
      { title: "Caps",      href: "/products?category=caps",          chip: "SHOP", img: "/images/product-jacket.png" },
    ],
    WOMEN: [
      { title: "Tops",      href: "/products?gender=women", chip: "WOMEN", img: "/images/product-tshirt.png" },
      { title: "Bottoms",   href: "/products?gender=women", chip: "WOMEN", img: "/images/product-trousers.png" },
      { title: "Caps",      href: "/products?gender=women", chip: "WOMEN", img: "/images/product-jacket.png" },
    ],
    KIDS: [
      { title: "Tops",      href: "/products?gender=kids", chip: "KIDS", img: "/images/product-tshirt.png" },
      { title: "Bottoms",   href: "/products?gender=kids", chip: "KIDS", img: "/images/product-trousers.png" },
      { title: "Caps",      href: "/products?gender=kids", chip: "KIDS", img: "/images/product-jacket.png" },
    ],
  };

  return (
    <Layout>
      {/* ─── 02 HERO CAROUSEL — 540px full-bleed ───────────────────────── */}
      <section className="relative w-full overflow-hidden" style={{ height: "540px", background: T.charcoal }}>
        {HERO_SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0, pointerEvents: i === slide ? "auto" : "none" }}
            aria-hidden={i !== slide}
          >
            <img src={s.img} alt="" className="w-full h-full object-cover object-center" />
            {/* Gradient L→R 58%→0% per spec */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.20) 58%, rgba(0,0,0,0) 100%)" }}
            />
            <div className="relative h-full max-w-[940px] mx-auto px-9 flex flex-col justify-center text-white">
              <span className="text-[10px] mb-4" style={{ letterSpacing: "0.3em", color: T.heroGold }}>
                {s.eyebrow}
              </span>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "42px", lineHeight: 1.1, fontWeight: 400, marginBottom: "18px" }}>
                {s.titlePre}<br />
                <em style={{ color: T.heroGold, fontStyle: "italic" }}>{s.titleEm}</em><br />
                {s.titlePost}
              </h1>
              <p className="max-w-md mb-7 text-sm leading-relaxed text-white/85">{s.body}</p>
              <div className="flex flex-wrap gap-3">
                <Link href={s.cta1.href}>
                  <button
                    className="bg-white hover:bg-gray-100 transition-colors px-7 py-3"
                    style={{ color: T.charcoal, fontSize: "9px", letterSpacing: "0.25em", fontWeight: 600 }}
                  >
                    {s.cta1.label}
                  </button>
                </Link>
                <Link href={s.cta2.href}>
                  <button
                    className="border border-white text-white hover:bg-white/10 transition-colors px-7 py-3"
                    style={{ fontSize: "9px", letterSpacing: "0.25em", fontWeight: 600 }}
                  >
                    {s.cta2.label}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Slide counter top-right per spec */}
        <div className="absolute top-6 right-9 text-white text-[10px] tracking-[0.2em] z-10">
          {String(slide + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
        </div>

        {/* Slide dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { slideRef.current = i; setSlide(i); }}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === slide ? "28px" : "10px",
                background: i === slide ? "#fff" : "rgba(255,255,255,0.5)",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ─── 03 CATEGORY GRID — 3 tiles, 320px ─────────────────────────── */}
      <section className="bg-white" style={{ padding: "50px 0" }}>
        <div className="max-w-[940px] mx-auto px-9">
          {/* Tabs */}
          <div className="flex justify-center gap-0 mb-6">
            {(["MEN", "WOMEN", "KIDS"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-2 transition-colors"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  borderBottom: `2px solid ${tab === t ? T.charcoal : "transparent"}`,
                  color: tab === t ? T.charcoal : T.bodyGrey,
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
            {categoryTiles[tab].map(c => (
              <Link key={c.title} href={c.href} className="group block">
                <div className="relative overflow-hidden bg-gray-100" style={{ height: "320px" }}>
                  <img
                    src={c.img}
                    alt={c.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  {/* Chip pill top-left */}
                  <span
                    className="absolute top-3 left-3 bg-white px-2.5 py-1"
                    style={{ fontSize: "8px", letterSpacing: "0.18em", color: T.charcoal, fontWeight: 600 }}
                  >
                    {c.chip}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "15px", color: T.charcoal }}>
                    {c.title}
                  </h3>
                  <span
                    className="flex items-center gap-1 transition-colors"
                    style={{ fontSize: "9px", letterSpacing: "0.2em", color: T.gold }}
                  >
                    EXPLORE
                    <span style={{ width: "20px", height: "1px", background: T.gold, display: "inline-block" }} />
                    <ArrowRight className="w-3 h-3" style={{ color: T.gold }} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 04 TOP SELLERS ─ 4 product cards (220px image) ───────────── */}
      <section className="bg-white" style={{ padding: "50px 0" }}>
        <div className="max-w-[940px] mx-auto px-9">
          <div className="text-center mb-10">
            <p className="mb-2" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>TOP SELLERS</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: T.charcoal }}>The Fairway Favourites</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px]">
            {(topSellers.length > 0 ? topSellers : [1,2,3,4]).map((p: any, i) => (
              typeof p === "number" ? (
                <div key={i} className="bg-gray-100 animate-pulse" style={{ height: "300px" }} />
              ) : (
                <Link key={p.id} href={`/products/${p.id}`} className="group block">
                  <div className="relative overflow-hidden bg-gray-100" style={{ height: "220px" }}>
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-black tracking-[0.2em]">KA.SHA</div>
                    )}
                    {/* White bordered badge per spec */}
                    <span
                      className="absolute top-2 left-2 bg-white px-2 py-0.5 border"
                      style={{ fontSize: "8px", letterSpacing: "0.18em", borderColor: T.divider, color: T.charcoal }}
                    >
                      BEST SELLER
                    </span>
                  </div>
                  <h3 className="mt-3" style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: T.charcoal }}>
                    {p.name?.replace(/\s*\[gt:GT\d+\]\s*$/, "") || "Product"}
                  </h3>
                  <div className="flex items-center justify-between mt-1">
                    <p style={{ fontSize: "11px", color: T.muted }}>{formatPrice(p.priceInPaise)}</p>
                    {/* Colour swatches — 14px circles, 5px gap */}
                    <div className="flex gap-[5px]">
                      {[T.red, T.blue, T.blush].map((c, idx) => (
                        <span key={idx} className="rounded-full border" style={{ width: "10px", height: "10px", background: c, borderColor: T.divider }} />
                      ))}
                    </div>
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>
      </section>

      {/* ─── MEN ▸ T-SHIRTS — Fabric + Pattern (KA.SHA v2 spec) ────────── */}
      <section style={{ background: T.cream, padding: "50px 0" }}>
        <div className="max-w-[940px] mx-auto px-9">
          <div className="text-center mb-8">
            <p className="mb-2" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>MEN ▸ T-SHIRTS</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: T.charcoal }}>Fabric &amp; Pattern T-Shirts</h2>
            <p className="mt-2" style={{ fontSize: "11px", color: T.bodyGrey }}>
              Choose a blank canvas to print on, or a pre-patterned silhouette to colour.
            </p>
          </div>

          {/* Fabric row */}
          <div className="mb-8">
            <h3 className="mb-3" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>FABRIC &amp; MATERIAL</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-[10px]">
              {(fabricTees.length > 0 ? fabricTees : Array(7).fill(null)).map((p, i) => (
                p ? (
                  <Link key={p.id} href={`/products/${p.id}`} className="group block">
                    <div className="bg-white overflow-hidden border" style={{ height: "200px", borderColor: T.divider }}>
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] font-black tracking-[0.2em]">{p.name}</div>
                      )}
                    </div>
                    <h4 className="mt-2 truncate" style={{ fontFamily: "Georgia, serif", fontSize: "12px", color: T.charcoal }}>{p.name}</h4>
                    <p style={{ fontSize: "11px", color: T.muted }}>{formatPrice(p.priceInPaise)}</p>
                  </Link>
                ) : (
                  <div key={i} className="bg-white animate-pulse" style={{ height: "200px" }} />
                )
              ))}
            </div>
          </div>

          {/* Pattern row */}
          <div>
            <h3 className="mb-3" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>PATTERNS</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-[10px]">
              {(patternTees.length > 0 ? patternTees : Array(7).fill(null)).map((p, i) => {
                if (!p) return <div key={i} className="bg-white animate-pulse" style={{ height: "200px" }} />;
                const cleanName = p.name.replace(/\s*\[gt:GT\d+\]\s*$/, "");
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="group block">
                    <div className="relative bg-white overflow-hidden border flex items-center justify-center" style={{ height: "200px", borderColor: T.divider }}>
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={cleanName} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                      ) : (
                        <span style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.gold, fontWeight: 600 }}>{cleanName.split(" ")[1] || "PATTERN"}</span>
                      )}
                      <span
                        className="absolute top-1.5 right-1.5 bg-white px-1.5 py-0.5 border"
                        style={{ fontSize: "7px", letterSpacing: "0.15em", borderColor: T.divider, color: T.charcoal }}
                      >
                        PATTERN
                      </span>
                    </div>
                    <h4 className="mt-2 truncate" style={{ fontFamily: "Georgia, serif", fontSize: "12px", color: T.charcoal }}>{cleanName}</h4>
                    <p style={{ fontSize: "11px", color: T.muted }}>{formatPrice(p.priceInPaise)}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 05 TAILOR YOUR PLAY + PRINTS SHOWCASE ─────────────────────── */}
      <section className="bg-white" style={{ padding: "50px 0" }}>
        <div className="max-w-[940px] mx-auto px-9">
          {/* Prints tiles row */}
          <div className="text-center mb-8">
            <p className="mb-2" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>PRINTS SHOWCASE</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: T.charcoal }}>Detail Gallery</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] mb-12">
            {[
              { label: "Verdant Polo",  sub: "Hand-drawn floral",   img: "/images/product-tshirt.png" },
              { label: "Marble Crimson", sub: "Fluid print close-up", img: "/images/product-jacket.png" },
              { label: "Collar Detail",  sub: "Contrast trim",       img: "/images/product-tshirt.png" },
              { label: "Trouser Crop",   sub: "Pocket detail",        img: "/images/product-trousers.png" },
            ].map((t, i) => (
              <Link key={i} href="/products?category=prints" className="group block relative overflow-hidden">
                <div className="overflow-hidden bg-gray-100" style={{ height: "200px" }}>
                  <img src={t.img} alt={t.label} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                </div>
                <div
                  className="absolute bottom-0 left-0 right-0 px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.92)" }}
                >
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "12px", color: T.charcoal }}>{t.label}</div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: T.gold }}>{t.sub.toUpperCase()}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Tailor Your Play — 2-col customiser panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 border" style={{ borderColor: T.divider }}>
            <div style={{ background: T.cream, padding: "40px 36px" }}>
              <p className="mb-3" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>TAILOR YOUR PLAY</p>
              <h3 className="mb-6" style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: T.charcoal, lineHeight: 1.2 }}>
                Make every piece <em style={{ color: T.gold }}>uniquely yours.</em>
              </h3>
              {[
                { n: "01", label: "Choose a silhouette" },
                { n: "02", label: "Pick a fabric or pattern" },
                { n: "03", label: "Add prints, text & logos" },
                { n: "04", label: "Order — we craft it" },
              ].map((s) => (
                <div key={s.n} className="flex items-baseline gap-3 mb-3">
                  <span style={{ fontFamily: "Georgia, serif", fontSize: "14px", color: T.gold, fontWeight: 600 }}>{s.n}</span>
                  <span style={{ fontSize: "11px", color: T.bodyGrey, letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
              ))}
              <Link href="/products/1/customize">
                <button
                  className="mt-6 hover:opacity-90 transition-opacity"
                  style={{ background: T.charcoal, color: "#fff", padding: "14px 28px", fontSize: "9px", letterSpacing: "0.25em", fontWeight: 600 }}
                >
                  START CUSTOMISING
                </button>
              </Link>
            </div>
            <div className="bg-white flex items-center justify-center" style={{ padding: "40px" }}>
              <img src="/images/product-tshirt.png" alt="Customiser preview" className="max-h-[280px] object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 06 EVENTS GALLERY ─────────────────────────────────────────── */}
      <section className="bg-white" style={{ padding: "50px 0" }}>
        <div className="max-w-[940px] mx-auto px-9">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="mb-2" style={{ fontSize: "9px", letterSpacing: "0.3em", color: T.gold }}>EVENTS</p>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", color: T.charcoal }}>On the Course With Ka.Sha</h2>
            </div>
            <Link href="/heritage">
              <span className="flex items-center gap-2" style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.gold }}>
                ALL EVENTS
                <span style={{ width: "24px", height: "1px", background: T.gold, display: "inline-block" }} />
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {/* Main 2fr+1fr row — 300px */}
          <div className="grid gap-[10px] mb-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
            {[
              { label: "QClub Invitational",     sub: "Pune · 2026", img: "/images/product-jacket.png" },
              { label: "Women's Open Edit",      sub: "Mumbai · 2026", img: "/images/product-trousers.png" },
            ].map((e, i) => (
              <div key={i} className="relative overflow-hidden bg-gray-100" style={{ height: "300px" }}>
                <img src={e.img} alt={e.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%)" }} />
                <div className="absolute bottom-4 left-4 text-white">
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "18px" }}>{e.label}</div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: T.heroGold }}>{e.sub.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Thumb row — 4 tiles, 140px */}
          <div className="grid grid-cols-4 gap-[10px]">
            {["Print Drop · Goa", "Pop-up · Delhi", "Press Day", "Course Edit"].map((label, i) => (
              <div key={i} className="relative overflow-hidden bg-gray-100" style={{ height: "140px" }}>
                <img src="/images/product-tshirt.png" alt={label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <div style={{ fontSize: "8px", letterSpacing: "0.2em", color: "#fff", fontWeight: 600 }}>
                    {label.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 07 BRAND STRIP ────────────────────────────────────────────── */}
      <section style={{ background: T.cream, padding: "32px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ fontFamily: "Georgia, serif", fontSize: "180px", color: T.charcoal, opacity: 0.04, letterSpacing: "0.1em" }}
        >
          KA.SHA
        </span>
        <p className="relative" style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: T.charcoal }}>
          <em style={{ color: T.gold }}>Premium Golf Wear,</em> crafted in India.
        </p>
      </section>
    </Layout>
  );
}
