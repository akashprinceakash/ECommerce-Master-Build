import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";

// Image asset paths — extracted from kasha_final HTML mockup
const IMG = (n: number) => `/images/kasha/img${String(n).padStart(2, "0")}.jpeg`;

// Hero slides per mockup
const HERO_SLIDES = [
  {
    img: IMG(2),
    eyebrow: "PREMIUM GOLF WEAR 2025",
    title: <>Authority<br/>in fit.<br/><em>Personality<br/>in detail.</em></>,
    sub: "Tailored elegance for the modern player.",
    cta1: { label: "Shop Women", href: "/products?gender=women" },
    cta2: { label: "View Lookbook", href: "/heritage" },
  },
  {
    img: IMG(3),
    eyebrow: "PRINT EDITION · 2025",
    title: <>Bold inside<br/>a calm<br/><em>frame.</em></>,
    sub: "Structured where it matters.\nExpressive where it shows.",
    cta1: { label: "See Prints", href: "/products?category=fabric-tshirt" },
    cta2: { label: "Explore All", href: "/products" },
  },
  {
    img: IMG(4),
    eyebrow: "PREMIUM GOLF WEAR 2025",
    title: <>You bring<br/>the precision.<br/><em>We bring<br/>the flair.</em></>,
    sub: "Performance crafted for the fairway.\nPersonality made for every hole.",
    cta1: { label: "Shop Golf", href: "/products" },
    cta2: { label: "Tailor Your Play", href: "/products/1/customize" },
  },
  {
    img: IMG(5),
    eyebrow: "THE KA.SHA PLAYER · 2025",
    title: <>56. 42. 36.<br/><em>One brand.<br/>Every game.</em></>,
    sub: "Wear your personality.\nFor players who play hard.",
    cta1: { label: "Shop Men", href: "/products?gender=men" },
    cta2: { label: "Shop Women", href: "/products?gender=women" },
  },
];

// Customise panel preview swap
const CUST_SWATCHES = [
  { color: "#a52020", img: IMG(14) },
  { color: "#2a5a2a", img: IMG(15) },
  { color: "#2a4a8a", img: IMG(16) },
  { color: "#d4a0bc", img: IMG(17) },
  { color: "#e8e0d8", img: IMG(18), border: true },
];

// Top seller seed cards (used as fallback if no products from API yet)
const TOP_SELLERS_FALLBACK = [
  { img: IMG(9),  name: "KS1000B",          price: "₹2,000.00", swatches: ["#c0302a","#3a6aaa","#2a5a2a","#f0f0ee"] },
  { img: IMG(10), name: "The QClub Polo",   price: "₹4,500.00", swatches: ["#c0302a","#3a6aaa","#2a5a2a"] },
  { img: IMG(11), name: "The Marble Polo",  price: "₹4,200.00", swatches: ["#3a6aaa","#c0302a","#2a5a2a"] },
  { img: IMG(12), name: "The Scroll Polo",  price: "₹4,500.00", swatches: ["#c8a0b0","#d4b890"] },
];

const PRINTS = [
  { img: IMG(19), name: "The Garden polo", sub: "Print on print" },
  { img: IMG(20), name: "Marble wave",      sub: "Fluid signature" },
  { img: IMG(21), name: "Collar detail",    sub: "White contrast trim" },
  { img: IMG(22), name: "Trouser pocket",   sub: "Tailored finish" },
];

const EVENT_TILES = [
  { img: IMG(23), cat: "Corporate & teams", title: <>Tournament kits,<br/>team activations.</>, cta: "Enquire Now ›" },
  { img: IMG(24) },
  { img: IMG(25) },
  { img: IMG(26), cat: "Women's golf",      title: <>Authority in fit.<br/>Personality in detail.</>, cta: "Shop Women »»" },
];

const EVENT_THUMBS = [
  { img: IMG(27), label: "On the Fairway" },
  { img: IMG(28), label: "Print Edition" },
  { img: IMG(29), label: "Women's Golf" },
  { img: IMG(30), label: "Tournament Day" },
];

const MARQUEE = [
  "Golf T-Shirts", "Performance Trousers", "Caps & Accessories",
  "Tailor Your Play", "Every Piece Customisable", "Men · Women · Kids",
];

export default function Home() {
  const [tab, setTab] = useState<"Men" | "Women" | "Kids">("Men");
  const [slide, setSlide] = useState(0);
  const [custSw, setCustSw] = useState(0);
  const slideRef = useRef(0);

  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );

  useEffect(() => {
    const id = setInterval(() => {
      slideRef.current = (slideRef.current + 1) % HERO_SLIDES.length;
      setSlide(slideRef.current);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  const fabricTees  = (products || []).filter(p => p.category === "fabric-tshirt");
  const patternTees = (products || []).filter(p => p.category === "pattern");
  const topSellers  = (products || []).slice(0, 4);

  const goSlide = (i: number) => { slideRef.current = i; setSlide(i); };
  const navSlide = (d: number) => goSlide((slide + d + HERO_SLIDES.length) % HERO_SLIDES.length);

  const cleanName = (n?: string) => (n || "").replace(/\s*\[gt:GT\d+\]\s*$/, "");

  return (
    <Layout>
      {/* Embedded fonts to match mockup */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Josefin+Sans:wght@300;400;600&display=swap" />

      {/* ── ANNOUNCE BAR ────────────────────────────────────────── */}
      <div
        className="text-center"
        style={{
          background: "#f7f3ee",
          borderBottom: "1px solid #e8e4df",
          padding: "10px 24px",
          fontSize: "10px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "#9b8b6e",
          fontFamily: "'Josefin Sans', sans-serif",
        }}
      >
        New season arrivals — shop the full collection
        <span className="mx-2.5 opacity-40 not-italic">·</span>
        Free shipping on orders above ₹5,000
      </div>

      {/* ── HERO CAROUSEL ────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden" style={{ background: "#1a2a3a", height: "calc(100vh - 132px)", minHeight: "580px" }}>
        {HERO_SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity"
            style={{ opacity: i === slide ? 1 : 0, transitionDuration: "800ms", pointerEvents: i === slide ? "auto" : "none" }}
            aria-hidden={i !== slide}
          >
            <img src={s.img} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 20%" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,.52) 0%, rgba(0,0,0,.18) 48%, transparent 100%)" }} />
            <div className="absolute" style={{ bottom: "90px", left: "72px", maxWidth: "460px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "3px", color: "rgba(255,255,255,.7)", marginBottom: "20px", fontFamily: "'Josefin Sans', sans-serif" }}>
                {s.eyebrow}
              </p>
              <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "52px", fontWeight: 400, lineHeight: 1.08, color: "#fff", marginBottom: "20px" }}>
                {s.title}
              </h1>
              <style>{` .hero-h1 em { color:#f0d89a; font-style:italic; } `}</style>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,.78)", lineHeight: 1.8, marginBottom: "32px", whiteSpace: "pre-line", fontFamily: "'Josefin Sans', sans-serif" }}>
                {s.sub}
              </p>
              <div className="flex gap-3">
                <Link href={s.cta1.href}>
                  <button className="hero-btn-wh" style={{ background: "#fff", color: "#1c1c1c", border: "none", fontFamily: "'Josefin Sans', sans-serif", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "14px 30px", cursor: "pointer", transition: "all .2s" }}>
                    {s.cta1.label}
                  </button>
                </Link>
                <Link href={s.cta2.href}>
                  <button style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,.55)", fontFamily: "'Josefin Sans', sans-serif", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "14px 30px", cursor: "pointer", transition: "all .2s" }}>
                    {s.cta2.label}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ))}
        <style>{`
          h1 em { color:#f0d89a !important; font-style:italic; }
        `}</style>

        <div className="absolute" style={{ top: "22px", right: "28px", fontSize: "11px", color: "rgba(255,255,255,.6)", letterSpacing: "1px", fontFamily: "'Josefin Sans', sans-serif" }}>
          {slide + 1} / {HERO_SLIDES.length}
        </div>

        <button onClick={() => navSlide(-1)} aria-label="Previous slide"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-white text-2xl opacity-65 hover:opacity-100 transition-opacity p-2 bg-transparent border-0 cursor-pointer">
          ←
        </button>
        <button onClick={() => navSlide(1)} aria-label="Next slide"
          className="absolute top-1/2 right-3 -translate-y-1/2 text-white text-2xl opacity-65 hover:opacity-100 transition-opacity p-2 bg-transparent border-0 cursor-pointer">
          →
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex gap-[7px] items-center" style={{ bottom: "28px" }}>
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                height: "3px",
                width: i === slide ? "42px" : "22px",
                background: i === slide ? "#fff" : "rgba(255,255,255,.32)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width .4s, background .4s",
              }}
            />
          ))}
        </div>
      </section>

      {/* ── MARQUEE STRIP ─────────────────────────────────────── */}
      <div style={{ background: "#1c1c1c", overflow: "hidden", whiteSpace: "nowrap", padding: "13px 0" }}>
        <div className="kasha-mq-inner" style={{ display: "inline-block" }}>
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((s, i) => (
            <span key={i}>
              <span style={{ fontSize: "10px", letterSpacing: "2.5px", textTransform: "uppercase", color: "#fff", margin: "0 32px", fontFamily: "'Josefin Sans', sans-serif" }}>{s}</span>
              <span style={{ color: "#9b8b6e", margin: "0 10px", fontFamily: "'Josefin Sans', sans-serif" }}>·</span>
            </span>
          ))}
        </div>
        <style>{`
          @keyframes kasha-mq { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          .kasha-mq-inner { animation: kasha-mq 24s linear infinite; }
        `}</style>
      </div>

      {/* ── CATEGORY GRID ─────────────────────────────────────── */}
      <section style={{ padding: "72px 80px", background: "#fff", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ maxWidth: "1380px", margin: "0 auto" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e", textAlign: "center", marginBottom: "12px" }}>Shop by category</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 400, textAlign: "center", color: "#1c1c1c", marginBottom: "10px" }}>The Ka.Sha Collections</h2>
          <p style={{ fontSize: "12px", color: "#a09890", textAlign: "center", letterSpacing: ".5px", marginBottom: "36px" }}>Fit. Fabric. Print. Every piece fully Customisable.</p>

          <div className="flex justify-center mb-11" style={{ borderBottom: "1px solid #e8e4df", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
            {(["Men","Women","Kids"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase",
                  color: tab === t ? "#1c1c1c" : "#6b6560",
                  background: "none", border: "none",
                  borderBottom: `2px solid ${tab === t ? "#1c1c1c" : "transparent"}`,
                  cursor: "pointer", padding: "14px 52px",
                  fontFamily: "'Josefin Sans', sans-serif", marginBottom: "-1px",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { img: IMG(6), chip: "T-Shirts",            name: "Golf T-shirts",      desc: "Polos & performance tees · prints & solids", href: "/products?category=fabric-tshirt" },
              { img: IMG(7), chip: "Trousers",            name: "Golf trousers",      desc: "Tailored · technical · stretch",              href: "/products?category=trousers" },
              { img: IMG(8), chip: "Caps & Accessories",  name: "Caps & accessories", desc: "Structured · embroidered · logo",             href: "/products?category=caps" },
            ].map(c => (
              <Link key={c.chip} href={c.href} className="group block cursor-pointer">
                <div className="relative overflow-hidden" style={{ height: "440px", background: "#f5f4f2" }}>
                  <img src={c.img} alt={c.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className="absolute" style={{ top: "16px", left: "16px", background: "#fff", fontSize: "9px", letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 12px", color: "#1c1c1c" }}>
                    {c.chip}
                  </span>
                </div>
                <div style={{ padding: "18px 0 0" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "18px", color: "#1c1c1c", marginBottom: "4px" }}>{c.name}</div>
                  <div style={{ fontSize: "11px", color: "#a09890", marginBottom: "12px" }}>{c.desc}</div>
                  <span style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1c1c1c", display: "inline-flex", alignItems: "center", gap: "10px" }}>
                    Explore
                    <span style={{ display: "block", width: "28px", height: "1px", background: "#1c1c1c" }} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP SELLERS ─────────────────────────────────────── */}
      <section style={{ padding: "60px 0 0", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ maxWidth: "1380px", margin: "0 auto", padding: "0 80px", textAlign: "center", marginBottom: "36px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e", marginBottom: "8px" }}>Top sellers</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 400, color: "#1c1c1c" }}>The fairway favourites</h2>
        </div>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ gap: 0, padding: "0 80px", maxWidth: "1380px", margin: "0 auto", borderTop: "1px solid #e8e4df" }}
        >
          {(topSellers.length >= 4 ? topSellers.slice(0,4).map((p, i) => ({
            href: `/products/${p.id}`,
            img: p.thumbnailUrl || TOP_SELLERS_FALLBACK[i].img,
            name: cleanName(p.name) || TOP_SELLERS_FALLBACK[i].name,
            price: formatPrice(p.priceInPaise),
            swatches: TOP_SELLERS_FALLBACK[i].swatches,
          })) : TOP_SELLERS_FALLBACK.map(t => ({ ...t, href: "/products" }))).map((c, i) => (
            <Link key={i} href={c.href} className="group block cursor-pointer" style={{ borderRight: i < 3 ? "1px solid #e8e4df" : "none" }}>
              <div style={{ height: "480px", overflow: "hidden", background: "#f8f7f5" }}>
                <img src={c.img} alt={c.name} className="transition-transform duration-500 group-hover:scale-[1.04]" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
              </div>
              <div style={{ padding: "18px 20px 24px" }}>
                <div className="flex gap-1.5 mb-2.5">
                  {c.swatches.map((sw, j) => (
                    <span key={j} className={j === 0 ? "kasha-sw on" : "kasha-sw"} style={{ width: "16px", height: "16px", borderRadius: "50%", background: sw, border: j === 0 ? "2px solid #1c1c1c" : "2px solid transparent", display: "inline-block" }} />
                  ))}
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16px", color: "#1c1c1c", marginBottom: "5px" }}>{c.name}</div>
                <div style={{ fontSize: "13px", color: "#a09890" }}>{c.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── MEN ▸ T-SHIRTS — Fabric & Pattern (single horizontal row, like Top Sellers) ─ */}
      <section style={{ padding: "100px 0 0", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ maxWidth: "1380px", margin: "0 auto", padding: "0 80px", textAlign: "center", marginBottom: "36px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e", marginBottom: "8px" }}>Men ▸ T-Shirts</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 400, color: "#1c1c1c", marginBottom: "10px" }}>Fabric &amp; Pattern</h2>
          <p style={{ fontSize: "12px", color: "#a09890", letterSpacing: ".5px" }}>
            Choose a blank canvas to print on, or a pre-patterned silhouette to colour.
          </p>
        </div>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ gap: 0, padding: "0 80px", maxWidth: "1380px", margin: "0 auto", borderTop: "1px solid #e8e4df" }}
        >
          {(() => {
            const fpFallback = [
              { img: "/images/kasha/polos/p1.png", name: "KS1007B Classic Pattern", price: "₹2,000.00", chip: "PATTERN" },
              { img: "/images/kasha/polos/p2.png", name: "The Linen Trouser",       price: "₹8,999.00", chip: "FABRIC"  },
              { img: "/images/kasha/polos/p3.png", name: "The Khadi Jacket",        price: "₹18,999.00", chip: "FABRIC" },
              { img: "/images/kasha/polos/p4.png", name: "The Silk Kurta",          price: "₹12,999.00", chip: "PATTERN" },
            ];
            const merged = [
              ...patternTees.slice(0, 2).map(p => ({ ...p, _chip: "PATTERN" as const })),
              ...fabricTees.slice(0, 2).map(p => ({ ...p, _chip: "FABRIC" as const })),
            ];
            const useReal = merged.length === 4;
            return (useReal ? merged.map((p, i) => ({
              href: `/products/${p.id}`,
              img: p.thumbnailUrl || fpFallback[i].img,
              name: cleanName(p.name) || fpFallback[i].name,
              price: formatPrice(p.priceInPaise),
              chip: p._chip,
            })) : fpFallback.map(f => ({ ...f, href: "/products" }))).map((c, i) => (
              <Link key={i} href={c.href} className="group block cursor-pointer" style={{ borderRight: i < 3 ? "1px solid #e8e4df" : "none" }}>
                <div className="relative" style={{ height: "480px", overflow: "hidden", background: "#f8f7f5" }}>
                  <img src={c.img} alt={c.name} className="transition-transform duration-500 group-hover:scale-[1.04]" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "20px", display: "block" }} />
                  <span className="absolute" style={{ top: "16px", left: "16px", background: "#fff", fontSize: "9px", letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 12px", color: "#1c1c1c", border: "1px solid #ece8e2" }}>
                    {c.chip}
                  </span>
                </div>
                <div style={{ padding: "18px 20px 24px" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16px", color: "#1c1c1c", marginBottom: "5px" }}>{c.name}</div>
                  <div style={{ fontSize: "13px", color: "#a09890" }}>{c.price}</div>
                </div>
              </Link>
            ));
          })()}
        </div>
      </section>

      {/* ── CUSTOMISE PANEL ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: "720px", marginTop: "120px", fontFamily: "'Josefin Sans', sans-serif", maxWidth: "1380px", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ background: "#f0ece6", padding: "88px 100px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e", marginBottom: "20px" }}>Tailor your play</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "52px", fontWeight: 400, color: "#1c1c1c", marginBottom: "44px", lineHeight: 1.1 }}>
            Your game.<br/>Your choices.
          </h2>
          {[
            "Select your style — polo, tee or collar",
            "Choose a print or solid from the palette",
            "Upload your logo and drag to position",
            "Review & get your Ka.Sha",
          ].map((step, i) => (
            <div key={i} className="flex items-baseline mb-7" style={{ gap: "40px" }}>
              <span style={{ fontSize: "13px", color: "#9b8b6e", letterSpacing: "1px", flexShrink: 0, width: "24px" }}>0{i+1}</span>
              <span style={{ fontSize: "14px", color: "#1c1c1c", lineHeight: 1.6 }}>{step}</span>
            </div>
          ))}
          <Link href="/products/1/customize">
            <button className="self-start mt-10" style={{ background: "#1c1c1c", color: "#fff", fontFamily: "'Josefin Sans', sans-serif", fontSize: "11px", letterSpacing: "2.5px", textTransform: "uppercase", padding: "16px 40px", border: "none", cursor: "pointer", transition: "background .2s" }}>
              Start Customising
            </button>
          </Link>
        </div>
        <div style={{ background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 80px" }}>
          <img src={CUST_SWATCHES[custSw].img} alt="Polo preview" style={{ width: "360px", height: "460px", objectFit: "contain", transition: "opacity .3s" }} />
          <div className="flex mt-5 mb-2" style={{ gap: "14px" }}>
            {CUST_SWATCHES.map((s, i) => (
              <button
                key={i}
                onClick={() => setCustSw(i)}
                aria-label={`Swatch ${i + 1}`}
                style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: s.color, cursor: "pointer",
                  border: i === custSw ? "3px solid #1c1c1c" : (s.border ? "1.5px solid #ccc" : "3px solid transparent"),
                  transform: i === custSw ? "scale(1.12)" : "none",
                  transition: "border-color .2s, transform .2s",
                  padding: 0,
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: "9px", letterSpacing: "2.5px", textTransform: "uppercase", color: "#9b8b6e" }}>Choose Colour</p>
        </div>
      </section>

      {/* ── PRINTS SHOWCASE ─────────────────────────────────────── */}
      <section style={{ padding: "140px 80px 0", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ maxWidth: "1380px", margin: "0 auto" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e", textAlign: "center", marginBottom: "14px" }}>Prints showcase</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 400, color: "#1c1c1c", textAlign: "center", lineHeight: 1.3, marginBottom: "12px" }}>
            Structured where it matters.<br/>Expressive where it shows.
          </h2>
          <p style={{ fontSize: "12px", color: "#a09890", textAlign: "center", letterSpacing: ".5px", marginBottom: "52px" }}>Collar · Stitch · Fabric · Logo detail</p>
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 0 }}>
            {PRINTS.map((p, i) => (
              <Link key={i} href="/products" className="group block cursor-pointer overflow-hidden">
                <img src={p.img} alt={p.name} className="transition-transform duration-500 group-hover:scale-[1.04]" style={{ width: "100%", height: "460px", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                <div style={{ padding: "16px 0 0" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "17px", color: "#1c1c1c", marginBottom: "4px" }}>{p.name}</div>
                  <div style={{ fontSize: "10px", color: "#9b8b6e", letterSpacing: ".5px" }}>{p.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENTS GALLERY ─────────────────────────────────────── */}
      <section style={{ padding: "140px 80px 0", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ maxWidth: "1380px", margin: "0 auto" }}>
          <div className="flex items-end justify-between" style={{ marginBottom: "24px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#9b8b6e", marginBottom: "8px" }}>On the course</p>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "36px", fontWeight: 400, color: "#1c1c1c" }}>Your event. Our customised expertise.</h2>
            </div>
            <Link href="/heritage" style={{ fontSize: "13px", letterSpacing: "1px", color: "#1c1c1c", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              View All Events »»
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 0, height: "500px", margin: "0 -0px" }}>
          {EVENT_TILES.map((e, i) => (
            <div key={i} className="relative overflow-hidden cursor-pointer group">
              <img src={e.img} alt="" className="transition-transform duration-500 group-hover:scale-[1.03]" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.1) 45%, transparent 100%)" }} />
              {e.cat && (
                <div className="absolute bottom-0 left-0 right-0 text-white" style={{ padding: "24px 22px" }}>
                  <p style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", opacity: 0.82, marginBottom: "8px" }}>{e.cat}</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "22px", lineHeight: 1.2, marginBottom: "14px" }}>{e.title}</p>
                  <button style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#fff", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,.5)", padding: "0 0 2px", cursor: "pointer", fontFamily: "'Josefin Sans', sans-serif" }}>{e.cta}</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 0, height: "190px" }}>
          {EVENT_THUMBS.map((t, i) => (
            <div key={i} className="relative overflow-hidden cursor-pointer group">
              <img src={t.img} alt={t.label} className="transition-transform duration-500 group-hover:scale-[1.05]" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 55%)" }} />
              <div className="absolute bottom-0 left-0 right-0" style={{ padding: "10px 14px", fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", color: "#fff" }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BRAND STRIP ─────────────────────────────────────── */}
      <section className="relative overflow-hidden text-center" style={{ background: "#f7f3ee", padding: "96px 40px", marginTop: "80px", fontFamily: "'Josefin Sans', sans-serif" }}>
        <div className="absolute pointer-events-none select-none" style={{
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "200px", fontWeight: 500,
          color: "rgba(155,139,110,.04)", whiteSpace: "nowrap"
        }}>KA.SHA</div>
        <div className="relative" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "44px", fontWeight: 400, color: "#1c1c1c", marginBottom: "4px" }}>
          Premium meets edgy.
        </div>
        <div className="relative" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "44px", fontWeight: 400, fontStyle: "italic", color: "#9b8b6e", marginBottom: "18px" }}>
          Performance matches flair.
        </div>
        <p className="relative" style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#9b8b6e" }}>Ka.Sha — For Players</p>
      </section>
    </Layout>
  );
}
