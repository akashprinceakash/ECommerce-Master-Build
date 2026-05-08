import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { setLastGender, type Gender } from "@/lib/genderPreference";

type SlideDef = {
  eye: string;
  title: React.ReactNode;
  sub: string;
  photo: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

const SLIDES: SlideDef[] = [
  {
    eye: "New Season · Golf Collection",
    title: (
      <>
        Dressed for the<br />clubhouse. Built<br />for every birdie.
      </>
    ),
    sub: "Men · Women · Kids · Custom",
    photo: "/images/hero/slide-1.jpg",
    primary: { label: "Shop the Collection", href: "/products" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    eye: "Ready to Wear · 8 Patterns",
    title: (
      <>
        Solids. Stripes.<br />Argyle. Checks.<br />Your course, your style.
      </>
    ),
    sub: "Off-the-shelf · Ships in 5 days",
    photo: "/images/hero/slide-2.jpg",
    primary: { label: "Shop T-Shirts", href: "/products?type=tshirts" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    eye: "Bespoke Studio",
    title: (
      <>
        Your colour.<br />Your logo.<br />Your shirt.
      </>
    ),
    sub: "Colour · Print · Fit · Logo · Text · Trim",
    photo: "/images/hero/slide-3.jpg",
    primary: { label: "Open the Custom Studio", href: "/products/1/customize" },
    secondary: { label: "View collection", href: "/products" },
  },
  {
    eye: "Tournaments · Academies · Clubs",
    title: (
      <>
        One shirt.<br />Five hundred.<br />Delivered on brief.
      </>
    ),
    sub: "Bulk from 12 pieces · Pantone-matched",
    photo: "/images/hero/slide-4.jpg",
    primary: { label: "Get a Quote", href: "/products/1/customize" },
    secondary: { label: "View collection", href: "/products" },
  },
];

type CardDef = {
  eye: string;
  title: string;
  sub: string;
  tags: string[];
  href: string;
  image: string;
  tone?: "light" | "dark";
  badge?: string;
  cta?: string;
};

const MEN_CARDS: CardDef[] = [
  {
    eye: "T-Shirts",
    title: "Ka·Sha Signature",
    sub: "Solids · 8 colours · 8 patterns · prints",
    tags: ["Solid", "8 Patterns", "Prints"],
    href: "/products?gender=men&type=tshirts&style=patterns",
    image: "/images/collection/look-3.jpeg",
    badge: "Core Range",
  },
  {
    eye: "T-Shirts",
    title: "Flair",
    sub: "Statement prints & limited-run designs",
    tags: ["Limited prints", "Seasonal"],
    href: "/products?gender=men&type=tshirts&style=prints",
    image: "/images/collection/look-19.jpeg",
    badge: "Seasonal",
  },
  {
    eye: "Bottoms",
    title: "Pro Tour Trouser",
    sub: "Glove dock · Tee holder · 4-way stretch",
    tags: ["4 colours", "Athletic fit"],
    href: "/products?gender=men&type=trousers",
    image: "/images/collection/look-8.jpeg",
  },
  {
    eye: "Bespoke",
    title: "Custom Studio",
    sub: "Your colour, logo & fit — 1 piece or 500",
    tags: ["Design yours"],
    href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg",
    tone: "dark",
    cta: "Design yours →",
  },
];

const WOMEN_CARDS: CardDef[] = [
  {
    eye: "T-Shirts",
    title: "Ka·Sha Signature",
    sub: "Tailored fit · 8 colours · 8 patterns",
    tags: ["Tailored", "8 Patterns", "Prints"],
    href: "/products?gender=women&type=tshirts&style=patterns",
    image: "/images/collection/look-1.jpeg",
    badge: "Core Range",
  },
  {
    eye: "T-Shirts",
    title: "Flair",
    sub: "Statement prints & limited-run designs",
    tags: ["Limited prints", "Seasonal"],
    href: "/products?gender=women&type=tshirts&style=prints",
    image: "/images/collection/look-15.jpeg",
    badge: "Seasonal",
  },
  {
    eye: "Bottoms",
    title: "Pro Tour Skort",
    sub: "Tailored skirt · Inner shorts · 4-way stretch",
    tags: ["Skirt", "Skort"],
    href: "/products?gender=women&type=skirts",
    image: "/images/collection/look-25.jpeg",
  },
  {
    eye: "Bespoke",
    title: "Custom Studio",
    sub: "Tailored to you — 1 piece or 500",
    tags: ["Design yours"],
    href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg",
    tone: "dark",
    cta: "Design yours →",
  },
];

const KIDS_CARDS: CardDef[] = [
  {
    eye: "T-Shirts",
    title: "Boys' Range",
    sub: "Junior fit · Patterns & prints",
    tags: ["Patterns", "Prints"],
    href: "/products?gender=kids&type=tshirts&style=patterns",
    image: "/images/hero/slide-kids.png",
    badge: "Junior",
  },
  {
    eye: "T-Shirts",
    title: "Girls' Range",
    sub: "Tailored junior fit · Soft prints",
    tags: ["Patterns", "Prints"],
    href: "/products?gender=kids&type=tshirts&style=prints",
    image: "/images/hero/slide-kids.png",
    badge: "Junior",
  },
  {
    eye: "Bottoms",
    title: "Kids' Bottoms",
    sub: "Trousers, skorts & all-day comfort",
    tags: ["Trousers", "Skorts"],
    href: "/products?gender=kids&type=bottoms",
    image: "/images/hero/slide-kids.png",
  },
  {
    eye: "Bespoke",
    title: "Custom Studio",
    sub: "Names, crests, academy colours",
    tags: ["Design yours"],
    href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg",
    tone: "dark",
    cta: "Design yours →",
  },
];

const TAB_CONFIG: { key: Gender; label: string; cards: CardDef[] }[] = [
  { key: "men", label: "Men's", cards: MEN_CARDS },
  { key: "women", label: "Women's", cards: WOMEN_CARDS },
  { key: "kids", label: "Kids'", cards: KIDS_CARDS },
];

export default function Home() {
  const [, navigate] = useLocation();
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState<Gender>("men");
  const [progressKey, setProgressKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carousel auto-advance
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCur((c) => (c + 1) % SLIDES.length);
      setProgressKey((k) => k + 1);
    }, 6500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const goTo = (i: number) => {
    setCur(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
    setProgressKey((k) => k + 1);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setCur((c) => (c + 1) % SLIDES.length);
        setProgressKey((k) => k + 1);
      }, 6500);
    }
  };

  const handleTabChange = (g: Gender) => {
    setTab(g);
    setLastGender(g);
  };

  return (
    <Layout>
      <style>{`
        @keyframes ks-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes ks-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* HERO CAROUSEL */}
      <section
        className="relative w-full overflow-hidden bg-[#0f1622]"
        style={{ height: "min(86vh, 760px)" }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === cur ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <img
              src={s.photo}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />

            <div className="relative z-10 h-full max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col justify-end pb-24">
              <div
                className="text-[11px] tracking-[0.32em] uppercase mb-5"
                style={{ color: "#B8925A", animation: i === cur ? "ks-fade-up 700ms ease both" : "none" }}
              >
                {s.eye}
              </div>
              <h1
                className="text-white font-light leading-[1.05] mb-6"
                style={{
                  fontSize: "clamp(36px, 6vw, 76px)",
                  fontFamily: "'Playfair Display', Georgia, serif",
                  animation: i === cur ? "ks-fade-up 800ms ease both 60ms" : "none",
                }}
              >
                {s.title}
              </h1>
              <div
                className="text-[11px] tracking-[0.22em] uppercase text-white/60 mb-8"
                style={{ animation: i === cur ? "ks-fade-up 700ms ease both 120ms" : "none" }}
              >
                {s.sub}
              </div>
              <div
                className="flex flex-wrap gap-3"
                style={{ animation: i === cur ? "ks-fade-up 700ms ease both 180ms" : "none" }}
              >
                <Link
                  href={s.primary.href}
                  className="inline-block text-[11px] tracking-[0.24em] uppercase text-black px-7 py-3.5 transition-colors hover:brightness-110"
                  style={{ background: "#B8925A" }}
                >
                  {s.primary.label}
                </Link>
                {s.secondary && (
                  <Link
                    href={s.secondary.href}
                    className="inline-block text-[11px] tracking-[0.24em] uppercase text-white/85 px-7 py-3.5 border border-white/30 hover:bg-white/10 transition-colors"
                  >
                    {s.secondary.label}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Slide indicators */}
        <div className="absolute z-20 bottom-7 right-8 flex items-center gap-2.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="block transition-all"
              style={
                i === cur
                  ? { width: 26, height: 4, borderRadius: 2, background: "#B8925A" }
                  : { width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.35)" }
              }
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="absolute z-20 bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            key={progressKey}
            className="h-full origin-left"
            style={{
              background: "#B8925A",
              animation: "ks-progress 6500ms linear forwards",
            }}
          />
        </div>
      </section>

      {/* TAB-BASED CATEGORY GRID */}
      <section className="bg-[#f5f3ef] py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] tracking-[0.32em] uppercase text-[#B8925A] mb-3">
              The Collection
            </div>
            <h2
              className="text-black font-light"
              style={{ fontSize: "clamp(28px, 3.6vw, 44px)", fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Find your range
            </h2>
          </div>

          {/* Tab row */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex border border-gray-300 bg-white">
              {TAB_CONFIG.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`px-7 md:px-10 py-3 text-[11px] tracking-[0.22em] uppercase font-medium transition-colors ${
                    tab === t.key
                      ? "bg-[#0f1622] text-white"
                      : "text-gray-500 hover:text-black"
                  }`}
                  aria-pressed={tab === t.key}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TAB_CONFIG.find((t) => t.key === tab)!.cards.map((c, i) => (
              <CategoryCard key={`${tab}-${i}`} card={c} />
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOM STUDIO BANNER */}
      <section className="bg-[#0f1622] text-white px-4 md:px-6 py-16 md:py-20">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <div className="text-[10px] tracking-[0.34em] uppercase text-[#B8925A] mb-4">
              Bespoke &amp; Custom
            </div>
            <h2
              className="font-light mb-6 leading-[1.08]"
              style={{ fontSize: "clamp(30px, 4vw, 52px)", fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Every detail — yours to design.<br />
              <span className="text-white/60">One shirt or five hundred.</span>
            </h2>
            <p className="text-white/65 text-[14px] leading-relaxed max-w-lg mb-8">
              Choose your colour, pick a print, drop in your logo, set the fit — our 3D Custom Studio
              shows it all in real time before you commit.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 max-w-xl">
              {[
                "Colour",
                "Pattern",
                "Print",
                "Upload Logo",
                "Add Text",
                "Collar / Trim",
              ].map((f, i) => (
                <div
                  key={f}
                  className="flex items-center gap-3 text-[12px] tracking-[0.08em] text-white/80"
                >
                  <span className="text-[#B8925A] text-[10px] tracking-[0.2em]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/products/1/customize")}
              className="inline-flex items-center gap-3 text-[11px] tracking-[0.26em] uppercase text-black px-9 py-4 transition-colors hover:brightness-110"
              style={{ background: "#B8925A" }}
            >
              Start Designing →
            </button>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden border border-white/10">
            <img
              src="/images/hero/slide-3.jpg"
              alt="Bespoke studio preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-white/85">
              <div className="text-[10px] tracking-[0.26em] uppercase">3D Studio · Live Preview</div>
              <div className="text-[10px] tracking-[0.26em] uppercase text-[#B8925A]">Step 1 / 6</div>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES STRIP */}
      <section className="bg-white py-16 md:py-20 px-4 md:px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] tracking-[0.32em] uppercase text-[#B8925A] mb-3">
              Built For
            </div>
            <h2
              className="text-black font-light"
              style={{ fontSize: "clamp(26px, 3.2vw, 38px)", fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Tournaments, academies &amp; clubs.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: "01", t: "Tournaments", d: "Player names, sponsor logos. From 12 pieces, mixed sizes.", img: "/images/collection/look-13.jpeg" },
              { n: "02", t: "Academies", d: "Academy crest, student names. All sizes accommodated.", img: "/images/collection/look-26.jpeg" },
              { n: "03", t: "Corporate", d: "Brand logo across five placements, colour-matched.", img: "/images/collection/look-9.jpeg" },
              { n: "04", t: "Personal", d: "Single-piece orders. Your fit, your initials, your print.", img: "/images/collection/look-21.jpeg" },
            ].map((u) => (
              <div key={u.n} className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-gray-100 mb-4">
                  <img
                    src={u.img}
                    alt={u.t}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 text-[9px] tracking-[0.24em] uppercase text-white/85 bg-black/45 px-2 py-1">
                    {u.n}
                  </div>
                </div>
                <h3 className="text-[15px] font-medium text-black mb-1.5">{u.t}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{u.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="bg-[#0f1622] text-white px-4 md:px-6 py-12">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/85 text-center md:text-left">
            Start your order — one shirt or five hundred
          </div>
          <Link
            href="/products/1/customize"
            className="inline-block text-[11px] tracking-[0.26em] uppercase text-black px-8 py-3.5 transition-colors hover:brightness-110"
            style={{ background: "#B8925A" }}
          >
            Open the Custom Studio
          </Link>
        </div>
      </section>
    </Layout>
  );
}

function CategoryCard({ card }: { card: CardDef }) {
  const dark = card.tone === "dark";
  return (
    <Link
      href={card.href}
      className={`group block overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        dark
          ? "bg-[#0f1622] border-[#B8925A]/40 text-white"
          : "bg-white border-gray-200 text-black"
      }`}
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <img
          src={card.image}
          alt={card.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {dark && <div className="absolute inset-0 bg-[#0f1622]/55" />}
        {card.badge && (
          <div
            className="absolute top-3 left-3 text-[9px] tracking-[0.18em] uppercase text-white px-2.5 py-1"
            style={{ background: "#B8925A" }}
          >
            {card.badge}
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{ color: "#B8925A" }}>
          {card.eye}
        </div>
        <div
          className={`text-[18px] mb-1.5 font-medium ${dark ? "text-white" : "text-black"}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {card.title}
        </div>
        <div className={`text-[12px] mb-3 ${dark ? "text-white/55" : "text-gray-500"}`}>{card.sub}</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {card.tags.map((t) => (
            <span
              key={t}
              className={`text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 ${
                dark ? "bg-white/10 text-white/75" : "bg-gray-100 text-gray-700"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        <div
          className={`inline-block text-[10px] tracking-[0.22em] uppercase border-b pb-0.5 transition-colors ${
            dark
              ? "text-[#B8925A] border-[#B8925A]/40 group-hover:border-[#B8925A]"
              : "text-black border-gray-300 group-hover:border-black"
          }`}
        >
          {card.cta || "Shop →"}
        </div>
      </div>
    </Link>
  );
}
