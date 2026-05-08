import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { setLastGender, type Gender } from "@/lib/genderPreference";

// ── Hero slides ──────────────────────────────────────────────────────────────
type Slide = {
  eye: string;
  title: React.ReactNode;
  sub: string;
  photo: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

const SLIDES: Slide[] = [
  {
    eye: "New Season · Golf Collection",
    title: <>Dressed for the clubhouse.<br />Built for every birdie.</>,
    sub: "Men · Women · Kids · Custom",
    photo: "/images/hero/slide-1.jpg",
    primary: { label: "Shop the Collection", href: "/products" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    eye: "Ready to Wear · 8 Patterns",
    title: <>Solids. Stripes.<br />Argyle. Your style.</>,
    sub: "Off-the-shelf · Ships in 5 days",
    photo: "/images/hero/slide-2.jpg",
    primary: { label: "Shop the Collection", href: "/products?type=tshirts" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    eye: "Bespoke Studio",
    title: <>Your colour. Your<br />logo. Your shirt.</>,
    sub: "Colour · Print · Fit · Logo · Text · Trim",
    photo: "/images/hero/slide-3.jpg",
    primary: { label: "Shop the Collection", href: "/products" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    eye: "Tournaments · Academies · Clubs",
    title: <>One shirt. Five<br />hundred. Delivered.</>,
    sub: "Bulk from 12 pieces · Pantone-matched",
    photo: "/images/hero/slide-4.jpg",
    primary: { label: "Shop the Collection", href: "/products" },
    secondary: { label: "Custom Studio", href: "/products/1/customize" },
  },
];

// ── Tab category cards ───────────────────────────────────────────────────────
type Card = {
  eye: string;
  title: string;
  sub: string;
  tags: string[];
  href: string;
  image: string;
  badge?: string;
  bespoke?: boolean;
};

const MEN_CARDS: Card[] = [
  { eye: "T-Shirts", title: "Ka·Sha Signature", sub: "Solids · 8 colours · 8 patterns · prints",
    tags: ["Solid", "8 Patterns", "Prints"], href: "/products?gender=men&type=tshirts&style=patterns",
    image: "/images/collection/look-3.jpeg", badge: "Core Range" },
  { eye: "T-Shirts", title: "Flair", sub: "Statement prints & limited-run designs",
    tags: ["Limited prints", "Seasonal"], href: "/products?gender=men&type=tshirts&style=prints",
    image: "/images/collection/look-19.jpeg", badge: "Seasonal" },
  { eye: "Bottoms", title: "Pro Tour Trouser", sub: "Glove dock · Tee holder · 4-way stretch",
    tags: ["4 colours"], href: "/products?gender=men&type=trousers",
    image: "/images/collection/look-8.jpeg" },
  { eye: "Bespoke", title: "Custom Studio", sub: "Your colour, logo & fit — 1 piece or 500",
    tags: ["Design yours"], href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg", bespoke: true },
];

const WOMEN_CARDS: Card[] = [
  { eye: "T-Shirts", title: "Ka·Sha Signature", sub: "Tailored fit · 8 colours · 8 patterns · prints",
    tags: ["Solid", "8 Patterns", "Prints"], href: "/products?gender=women&type=tshirts&style=patterns",
    image: "/images/collection/look-1.jpeg", badge: "Core Range" },
  { eye: "T-Shirts", title: "Flair", sub: "Statement prints & limited-run designs",
    tags: ["Limited prints", "Seasonal"], href: "/products?gender=women&type=tshirts&style=prints",
    image: "/images/collection/look-15.jpeg", badge: "Seasonal" },
  { eye: "Bottoms", title: "Pro Tour Skort", sub: "Technical stretch · Tailored fit",
    tags: ["3 colours"], href: "/products?gender=women&type=skirts",
    image: "/images/collection/look-25.jpeg" },
  { eye: "Bespoke", title: "Custom Studio", sub: "Your colour, logo & fit — 1 piece or 500",
    tags: ["Design yours"], href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg", bespoke: true },
];

const KIDS_CARDS: Card[] = [
  { eye: "T-Shirts", title: "Boys' T-Shirts", sub: "Solids · Patterns · XS–XL Junior",
    tags: ["Solid", "Patterns"], href: "/products?gender=kids&type=tshirts&style=patterns",
    image: "/images/hero/slide-kids.png", badge: "Boys" },
  { eye: "T-Shirts", title: "Girls' T-Shirts", sub: "Solids · Patterns · XS–XL Junior",
    tags: ["Solid", "Patterns"], href: "/products?gender=kids&type=tshirts&style=prints",
    image: "/images/hero/slide-kids.png", badge: "Girls" },
  { eye: "Bottoms", title: "All Bottoms", sub: "Trousers & skorts · All sizes",
    tags: ["Trousers", "Skorts"], href: "/products?gender=kids&type=bottoms",
    image: "/images/hero/slide-kids.png" },
  { eye: "Bespoke", title: "Custom Studio", sub: "Academy crest · Names · All sizes",
    tags: ["Design yours"], href: "/products/1/customize",
    image: "/images/hero/slide-3.jpg", bespoke: true },
];

const TABS: { key: Gender; label: string; cards: Card[] }[] = [
  { key: "men", label: "Men's", cards: MEN_CARDS },
  { key: "women", label: "Women's", cards: WOMEN_CARDS },
  { key: "kids", label: "Kids'", cards: KIDS_CARDS },
];

// ── Bulk event tiles ─────────────────────────────────────────────────────────
const BULK = [
  {
    n: "01", title: "Tournaments", from: "From 12 pieces",
    body: "Full field kit — player names, sponsor logo, Pantone-matched to brief.",
    tags: ["Player names", "Sponsor logo"], image: "/images/collection/look-13.jpeg",
  },
  {
    n: "02", title: "Golf Academies", from: "All ages & sizes",
    body: "Academy crest, student names, cohort year. On the range and at the club.",
    tags: ["Academy crest", "All sizes"], image: "/images/collection/look-26.jpeg",
  },
  {
    n: "03", title: "Clubs & Corporate", from: "Social clubs",
    body: "Shared identity for your group. Mixed sizes, one print. From 12 pieces.",
    tags: ["Mixed sizes", "From 12"], image: "/images/collection/look-9.jpeg",
  },
];

const GOLD = "#B8925A";
const INK = "#0f1622";
const SLIDE_MS = 6500;

export default function Home() {
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState<Gender>("men");
  const [progressKey, setProgressKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCur((c) => (c + 1) % SLIDES.length);
      setProgressKey((k) => k + 1);
    }, SLIDE_MS);
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
      }, SLIDE_MS);
    }
  };

  const setActiveTab = (g: Gender) => {
    setTab(g);
    setLastGender(g);
  };

  const cards = TABS.find((t) => t.key === tab)!.cards;

  return (
    <Layout>
      <style>{`
        @keyframes ks-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes ks-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ─── HERO CAROUSEL ─── */}
      <section className="relative w-full overflow-hidden bg-[#0f1622]" style={{ height: "min(86vh, 760px)" }}>
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === cur ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <img src={s.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/85" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />

            <div className="relative z-10 h-full max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col justify-end pb-24">
              <div className="text-[11px] tracking-[0.32em] uppercase mb-5"
                style={{ color: GOLD, animation: i === cur ? "ks-fade-up 700ms ease both" : "none" }}>
                {s.eye}
              </div>
              <h1 className="text-white font-light leading-[1.05] mb-6"
                style={{
                  fontSize: "clamp(36px, 6vw, 76px)",
                  fontFamily: "'Playfair Display', Georgia, serif",
                  animation: i === cur ? "ks-fade-up 800ms ease both 60ms" : "none",
                }}>
                {s.title}
              </h1>
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/60 mb-8"
                style={{ animation: i === cur ? "ks-fade-up 700ms ease both 120ms" : "none" }}>
                {s.sub}
              </div>
              <div className="flex flex-wrap gap-3"
                style={{ animation: i === cur ? "ks-fade-up 700ms ease both 180ms" : "none" }}>
                <Link href={s.primary.href}
                  className="inline-block text-[11px] tracking-[0.24em] uppercase text-white px-7 py-3.5 hover:brightness-110 transition"
                  style={{ background: GOLD }}>
                  {s.primary.label}
                </Link>
                <Link href={s.secondary.href}
                  className="inline-block text-[11px] tracking-[0.24em] uppercase text-white/85 px-7 py-3.5 border border-white/30 hover:bg-white/10 transition">
                  {s.secondary.label}
                </Link>
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
              style={i === cur
                ? { width: 26, height: 4, borderRadius: 2, background: GOLD }
                : { width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.35)" }} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="absolute z-20 bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div key={progressKey} className="h-full origin-left"
            style={{ background: GOLD, animation: `ks-progress ${SLIDE_MS}ms linear forwards` }} />
        </div>
      </section>

      {/* ─── TAB-BASED CATEGORY GRID ─── */}
      <section className="bg-[#f5f3ef] py-16 md:py-20 px-4 md:px-6">
        <div className="max-w-[1400px] mx-auto">
          {/* Tab row */}
          <div className="flex border border-gray-300 bg-white mb-6">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                aria-pressed={tab === t.key}
                className={`flex-1 px-7 py-4 text-[11px] tracking-[0.22em] uppercase font-medium transition-colors ${
                  tab === t.key ? "bg-white text-black" : "bg-[#f5f3ef] text-gray-500 hover:text-black"
                } ${i < TABS.length - 1 ? "border-r border-gray-300" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c, i) => <CategoryCard key={`${tab}-${i}`} c={c} />)}
          </div>
        </div>
      </section>

      {/* ─── CUSTOM STUDIO BAR ─── */}
      <section className="bg-[#f5f3ef] px-4 md:px-6 pb-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] overflow-hidden border-l-[3px]"
            style={{ background: INK, borderLeftColor: GOLD }}>
            {/* Banner image */}
            <div className="relative min-h-[260px] lg:min-h-[340px] order-2 lg:order-2">
              <img src="/images/hero/slide-3.jpg" alt="Custom Studio"
                className="absolute inset-0 w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0f1622]/30 to-[#0f1622]" />
              <div className="absolute bottom-5 right-5 text-right text-white/90">
                <div className="text-[10px] tracking-[0.28em] uppercase" style={{ color: GOLD }}>3D Studio</div>
                <div className="text-[12px] tracking-[0.18em] uppercase text-white/60">Live preview · Real fabric</div>
              </div>
            </div>

            {/* Copy + CTAs */}
            <div className="p-8 md:p-10 lg:p-12 order-1 lg:order-1 text-white">
              <div className="text-[10px] tracking-[0.32em] uppercase mb-4" style={{ color: GOLD }}>
                Custom Studio
              </div>
              <h2 className="text-[22px] md:text-[26px] font-medium leading-tight mb-2"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Choose your colour, print, pattern, size<br />or upload your logo.
              </h2>
              <div className="text-[11px] tracking-[0.18em] uppercase text-white/45 mb-6">
                Your game, your t-shirt.
              </div>
              <div className="flex flex-wrap gap-1.5 mb-8">
                {["Colour", "Print", "Pattern", "Size", "Upload logo", "Add text", "Trim & collar"].map((c) => (
                  <span key={c}
                    className="text-[9px] tracking-[0.14em] uppercase px-2.5 py-1 border text-white/65"
                    style={{ borderColor: "rgba(184,146,90,.4)" }}>
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <Link href="/products/1/customize"
                  className="inline-block text-[10px] tracking-[0.26em] uppercase text-white px-7 py-3.5 hover:brightness-110 transition"
                  style={{ background: GOLD }}>
                  Start designing →
                </Link>
                <Link href="/products/1/customize"
                  className="text-[10px] tracking-[0.18em] uppercase text-white/40 hover:text-white/70 transition border-b border-white/20 pb-0.5">
                  Bulk &amp; corporate pricing →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BULK EVENT TILES ─── */}
      <section className="bg-[#f5f3ef] px-4 md:px-6 pb-20">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
          {BULK.map((b) => (
            <Link key={b.n} href="/products/1/customize"
              className="group block bg-white border border-gray-200 overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition">
              <div className="relative aspect-[16/9] overflow-hidden">
                <img src={b.image} alt={b.title} loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1622]/55 to-transparent" />
                <div className="absolute top-3 left-3 text-[9px] tracking-[0.22em] uppercase" style={{ color: GOLD }}>
                  {b.from}
                </div>
              </div>
              <div className="p-5">
                <div className="text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: GOLD }}>{b.n}</div>
                <h3 className="text-[15px] font-medium text-black mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {b.title}
                </h3>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{b.body}</p>
                <div className="flex flex-wrap gap-1.5">
                  {b.tags.map((t) => (
                    <span key={t} className="text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 bg-gray-100 text-gray-600">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}

function CategoryCard({ c }: { c: Card }) {
  if (c.bespoke) {
    return (
      <Link href={c.href}
        className="group block overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl"
        style={{ background: INK, borderColor: "rgba(184,146,90,.4)" }}>
        <div className="relative aspect-[5/4] overflow-hidden flex items-center justify-center">
          <img src={c.image} alt={c.title} loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-30 transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0" style={{ background: `${INK}cc` }} />
          <div className="relative z-10 text-center opacity-50">
            <div className="text-3xl font-light tracking-[0.3em] text-white">KS</div>
            <div className="text-[9px] tracking-[0.3em] uppercase mt-1" style={{ color: GOLD }}>Bespoke</div>
          </div>
        </div>
        <div className="p-5 border-t" style={{ borderColor: "rgba(184,146,90,.25)" }}>
          <div className="text-[10px] tracking-[0.26em] uppercase mb-1.5" style={{ color: GOLD }}>{c.eye}</div>
          <div className="text-[16px] mb-1.5 font-medium text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {c.title}
          </div>
          <div className="text-[11px] mb-4 text-white/45">{c.sub}</div>
          <div className="inline-block text-[10px] tracking-[0.22em] uppercase border-b pb-0.5"
            style={{ color: GOLD, borderColor: "rgba(184,146,90,.5)" }}>
            Design yours →
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link href={c.href}
      className="group block overflow-hidden border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[5/4] overflow-hidden">
        <img src={c.image} alt={c.title} loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        {c.badge && (
          <div className="absolute top-3 left-3 text-[9px] tracking-[0.18em] uppercase text-white px-2.5 py-1"
            style={{ background: GOLD }}>
            {c.badge}
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="text-[10px] tracking-[0.26em] uppercase mb-1.5" style={{ color: GOLD }}>{c.eye}</div>
        <div className="text-[16px] mb-1.5 font-medium text-black" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {c.title}
        </div>
        <div className="text-[11px] text-gray-500 mb-3">{c.sub}</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {c.tags.map((t) => (
            <span key={t} className="text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 bg-gray-100 text-gray-700">
              {t}
            </span>
          ))}
        </div>
        <div className="inline-block text-[10px] tracking-[0.22em] uppercase text-black border-b border-gray-300 pb-0.5 group-hover:border-black transition">
          Shop →
        </div>
      </div>
    </Link>
  );
}
