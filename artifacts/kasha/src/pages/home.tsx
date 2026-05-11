import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";

const GOLD = "#B8925A";
const GOLD_LIGHT = "#D4A96A";
const MUTED = "rgba(0,0,0,0.55)";

type Slide = {
  bg: string;
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  primary: { label: string; href: string };
  outline: { label: string; href: string };
};

const SLIDES: Slide[] = [
  {
    bg: "linear-gradient(160deg, rgba(10,18,40,0.5) 0%, rgba(20,35,60,0.3) 50%, rgba(8,12,20,0.6) 100%), url('https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=1800&q=80') center/cover",
    eyebrow: "New Season · Golf Collection 2026",
    title: (<>Dressed for the<br />clubhouse. Built<br />for every birdie.</>),
    subtitle: "Men · Women · Kids · Custom",
    primary: { label: "Shop the Collection", href: "/products" },
    outline: { label: "Custom Studio", href: "/products/1/customize" },
  },
  {
    bg: "linear-gradient(160deg, rgba(20,12,8,0.5) 0%, rgba(40,25,10,0.3) 50%, rgba(10,8,5,0.6) 100%), url('https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=1800&q=80') center/cover",
    eyebrow: "Ka·Sha Signature · Patterns & Prints",
    title: (<>Where elegance<br />meets the<br />fairway.</>),
    subtitle: "GT001–GT0032 · Signature Collection",
    primary: { label: "Explore Patterns", href: "/products?type=tshirts&style=patterns" },
    outline: { label: "View Lookbook", href: "/products" },
  },
  {
    bg: "linear-gradient(160deg, rgba(8,18,12,0.5) 0%, rgba(15,35,20,0.3) 50%, rgba(5,10,8,0.6) 100%), url('https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=1800&q=80') center/cover",
    eyebrow: "Flair · Limited Run Prints",
    title: (<>Statement pieces<br />for the course<br />and beyond.</>),
    subtitle: "Seasonal · Limited Edition · Exclusive",
    primary: { label: "Shop Flair", href: "/products?type=tshirts&style=prints" },
    outline: { label: "Custom Studio", href: "/products/1/customize" },
  },
];

const SLIDE_DURATION = 6000;

type Card = {
  href: string;
  img: string;
  badge?: string;
  cat: string;
  title: string;
  desc: string;
  tags: string[];
  bespoke?: boolean;
  bespokeSub?: string;
};

const PANELS: Record<"men" | "women" | "kids", Card[]> = {
  men: [
    {
      href: "/products?gender=men&type=tshirts&style=patterns",
      img: "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&q=80",
      badge: "Core Range",
      cat: "T-Shirts",
      title: "Ka·Sha Signature",
      desc: "Solids · 8 colours · 8 patterns · prints",
      tags: ["Solid", "8 Patterns", "Prints"],
    },
    {
      href: "/products?gender=men&type=tshirts&style=prints",
      img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&q=80",
      badge: "Seasonal",
      cat: "T-Shirts",
      title: "Flair",
      desc: "Statement prints & limited-run designs",
      tags: ["Limited Prints", "Seasonal"],
    },
    {
      href: "/products?gender=men&type=trousers",
      img: "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=600&q=80",
      cat: "Bottoms",
      title: "Pro Tour Trouser",
      desc: "Glove dock · Tee holder · 4-way stretch",
      tags: ["4 Colours", "Technical"],
    },
    {
      href: "/products/1/customize",
      img: "",
      cat: "Bespoke",
      title: "Custom Studio",
      desc: "Your colour, logo & fit — 1 piece or 500",
      tags: [],
      bespoke: true,
      bespokeSub: "Bespoke",
    },
  ],
  women: [
    {
      href: "/products?gender=women&type=tshirts&style=patterns",
      img: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=600&q=80",
      badge: "Core Range",
      cat: "T-Shirts",
      title: "Ka·Sha Signature",
      desc: "Solids · 8 colours · 8 patterns · prints",
      tags: ["Solid", "8 Patterns", "Prints"],
    },
    {
      href: "/products?gender=women&type=tshirts&style=prints",
      img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
      badge: "Seasonal",
      cat: "T-Shirts",
      title: "Flair",
      desc: "Statement prints & limited-run designs",
      tags: ["Limited Prints", "Seasonal"],
    },
    {
      href: "/products?gender=women&type=skirts",
      img: "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=600&q=80",
      cat: "Bottoms",
      title: "Pro Tour Skort",
      desc: "Technical stretch · Tailored fit · Active skirt",
      tags: ["3 Colours", "Skirt", "Skort"],
    },
    {
      href: "/products/1/customize",
      img: "",
      cat: "Bespoke",
      title: "Custom Studio",
      desc: "Your colour, logo & fit — 1 piece or 500",
      tags: [],
      bespoke: true,
      bespokeSub: "Bespoke",
    },
  ],
  kids: [
    {
      href: "/products?gender=kids&type=tshirts&style=patterns",
      img: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&q=80",
      badge: "Boys",
      cat: "T-Shirts",
      title: "Boys' T-Shirts",
      desc: "Solids · Patterns · XS–XL Junior",
      tags: ["Solid", "Patterns"],
    },
    {
      href: "/products?gender=kids&type=tshirts&style=prints",
      img: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=80",
      badge: "Girls",
      cat: "T-Shirts",
      title: "Girls' T-Shirts",
      desc: "Solids · Patterns · XS–XL Junior",
      tags: ["Solid", "Patterns"],
    },
    {
      href: "/products?gender=kids&type=bottoms",
      img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80",
      cat: "Bottoms",
      title: "All Bottoms",
      desc: "Trousers & skorts · All sizes",
      tags: ["Trousers", "Skorts"],
    },
    {
      href: "/products/1/customize",
      img: "",
      cat: "Bespoke",
      title: "Custom Studio",
      desc: "Academy crest · Names · All sizes",
      tags: [],
      bespoke: true,
      bespokeSub: "Academy",
    },
  ],
};

const CHIPS = ["Colour", "Print", "Pattern", "Size", "Upload Logo", "Add Text", "Trim & Collar"];

const BULK = [
  {
    img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&q=80",
    from: "From 12 Pieces",
    num: "01",
    title: "Tournaments",
    desc: "Full field kit — player names, sponsor logo, Pantone-matched to brief.",
    tags: ["Player Names", "Sponsor Logo"],
  },
  {
    img: "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600&q=80",
    from: "All Ages & Sizes",
    num: "02",
    title: "Golf Academies",
    desc: "Academy crest, student names, cohort year. On the range and at the club.",
    tags: ["Academy Crest", "All Sizes"],
  },
  {
    img: "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=600&q=80",
    from: "Social Clubs",
    num: "03",
    title: "Clubs & Corporate",
    desc: "Shared identity for your group. Mixed sizes, one print. From 12 pieces.",
    tags: ["Mixed Sizes", "From 12"],
  },
];

function ProductCard({ c }: { c: Card }) {
  if (c.bespoke) {
    return (
      <Link
        href={c.href}
        className="block group transition-all duration-500"
        style={{
          background: "#FAFAF7",
          border: "1px solid rgba(184,146,90,0.3)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          className="h-[220px] flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(184,146,90,0.08) 0%, transparent 70%)" }}
        >
          <div className="text-center" style={{ opacity: 0.3 }}>
            <div
              className="text-neutral-900"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 52,
                fontWeight: 200,
                letterSpacing: "0.3em",
                lineHeight: 1,
              }}
            >
              KS
            </div>
            <div
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 8,
                letterSpacing: "0.5em",
                color: GOLD,
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              {c.bespokeSub}
            </div>
          </div>
        </div>
        <CardBody c={c} bespoke />
      </Link>
    );
  }
  return (
    <Link
      href={c.href}
      className="block group transition-all duration-500 hover:-translate-y-1.5"
      style={{
        background: "#F5F2EC",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 8,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,146,90,0.3)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.10)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div className="h-[220px] relative overflow-hidden">
        <img
          src={c.img}
          alt={c.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {c.badge && (
          <span
            className="absolute top-3 left-3 z-[1] text-neutral-900"
            style={{
              background: GOLD,
              fontFamily: "'Josefin Sans', sans-serif",
              fontSize: 7,
              letterSpacing: "0.2em",
              padding: "3px 10px",
              textTransform: "uppercase",
            }}
          >
            {c.badge}
          </span>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(8,10,18,0.6) 0%, transparent 60%)" }}
        />
      </div>
      <CardBody c={c} />
    </Link>
  );
}

function CardBody({ c, bespoke }: { c: Card; bespoke?: boolean }) {
  return (
    <div className="p-5">
      <div
        style={{
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 7.5,
          letterSpacing: "0.35em",
          color: GOLD,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {c.cat}
      </div>
      <div
        className="text-neutral-900"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18,
          fontWeight: 500,
          marginBottom: 6,
          lineHeight: 1.2,
        }}
      >
        {c.title}
      </div>
      <div
        style={{
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 9.5,
          color: bespoke ? "rgba(0,0,0,0.35)" : MUTED,
          letterSpacing: "0.08em",
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        {c.desc}
      </div>
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3.5">
          {c.tags.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 7,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.50)",
                background: "rgba(0,0,0,0.08)",
                padding: "3px 8px",
                borderRadius: 2,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <span
        className="inline-flex items-center gap-1.5 transition-colors"
        style={{
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 8,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: bespoke ? GOLD : "rgba(0,0,0,0.65)",
          paddingBottom: 2,
          borderBottom: bespoke ? "1px solid rgba(184,146,90,0.3)" : "1px solid rgba(0,0,0,0.10)",
        }}
      >
        {bespoke ? "Design Yours →" : "Shop →"}
      </span>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<"men" | "women" | "kids">("men");

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = ((Date.now() - start) / SLIDE_DURATION) * 100;
      if (p >= 100) {
        setActive((cur) => (cur + 1) % SLIDES.length);
      } else {
        setProgress(p);
      }
    }, 100);
    return () => clearInterval(id);
  }, [active]);

  return (
    <Layout>
      {/* HERO */}
      <section className="relative h-[100vh] min-h-[600px] overflow-hidden -mt-16">
        <div
          className="absolute inset-0 flex transition-transform duration-[900ms]"
          style={{
            transform: `translateX(-${active * 100}%)`,
            transitionTimingFunction: "cubic-bezier(0.77,0,0.175,1)",
          }}
        >
          {SLIDES.map((s, i) => (
            <div key={i} className="min-w-full h-full relative overflow-hidden">
              <div
                className="absolute inset-0 transition-transform duration-[8000ms] ease-out"
                style={{
                  background: s.bg,
                  transform: i === active ? "scale(1)" : "scale(1.08)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(8,10,18,0.2) 0%, rgba(8,10,18,0.1) 30%, rgba(8,10,18,0.5) 70%, rgba(8,10,18,0.92) 100%)",
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 z-[2] px-6 md:px-20 pb-20 max-w-[700px]">
                <div
                  className="transition-all duration-700"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "translateY(0)" : "translateY(20px)",
                    transitionDelay: i === active ? "200ms" : "0ms",
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.4em",
                    color: GOLD,
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  {s.eyebrow}
                </div>
                <h1
                  className="text-white transition-all duration-[800ms]"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "translateY(0)" : "translateY(30px)",
                    transitionDelay: i === active ? "350ms" : "0ms",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "clamp(42px, 5.5vw, 72px)",
                    fontWeight: 400,
                    lineHeight: 1.05,
                    letterSpacing: "0.02em",
                    marginBottom: 16,
                  }}
                >
                  {s.title}
                </h1>
                <p
                  className="transition-opacity duration-700"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transitionDelay: i === active ? "500ms" : "0ms",
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.25em",
                    color: "rgba(255,255,255,0.75)",
                    textTransform: "uppercase",
                    marginBottom: 32,
                  }}
                >
                  {s.subtitle}
                </p>
                <div
                  className="flex gap-3 transition-all duration-700"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "translateY(0)" : "translateY(20px)",
                    transitionDelay: i === active ? "600ms" : "0ms",
                  }}
                >
                  <Link
                    href={s.primary.href}
                    className="text-neutral-900 transition-all hover:-translate-y-0.5"
                    style={{
                      background: GOLD,
                      fontFamily: "'Josefin Sans', sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      padding: "14px 28px",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.background = GOLD_LIGHT)}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.background = GOLD)}
                  >
                    {s.primary.label}
                  </Link>
                  <Link
                    href={s.outline.href}
                    className="transition-all"
                    style={{
                      background: "transparent",
                      color: "rgba(0,0,0,0.65)",
                      fontFamily: "'Josefin Sans', sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      padding: "13px 28px",
                      border: "1px solid rgba(0,0,0,0.30)",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = "rgba(184,146,90,0.4)";
                      (e.target as HTMLElement).style.color = GOLD;
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "rgba(0,0,0,0.30)";
                      (e.target as HTMLElement).style.color = "rgba(0,0,0,0.65)";
                    }}
                  >
                    {s.outline.label}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className="absolute bottom-[84px] right-6 md:right-20 z-[3] flex gap-2 items-center">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="transition-all duration-300"
              style={{
                width: i === active ? 24 : 6,
                height: i === active ? 4 : 6,
                borderRadius: i === active ? 2 : 9999,
                background: i === active ? GOLD : "rgba(0,0,0,0.25)",
              }}
            />
          ))}
        </div>

        {/* Vertical counter */}
        <div
          className="hidden md:block absolute top-1/2 right-20 -translate-y-1/2 z-[3]"
          style={{
            writingMode: "vertical-rl",
            fontFamily: "'Josefin Sans', sans-serif",
            fontSize: 9,
            letterSpacing: "0.3em",
            color: "rgba(0,0,0,0.25)",
          }}
        >
          {String(active + 1).padStart(2, "0")} / 0{SLIDES.length}
        </div>

        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 z-[3]"
          style={{ background: GOLD, width: `${progress}%`, transition: "width 0.1s linear" }}
        />
      </section>

      {/* PRODUCT TABS */}
      <section className="px-6 md:px-20 py-16 md:py-20 max-w-[1400px] mx-auto">
        <div
          className="mb-10"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.10)" }}
        >
          <div className="pb-6">
            <div
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 8,
                letterSpacing: "0.4em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Collections
            </div>
            <h2
              className="text-neutral-900"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(28px, 3vw, 42px)",
                fontWeight: 400,
                letterSpacing: "0.02em",
              }}
            >
              Shop by Category
            </h2>
          </div>
          <div className="flex">
            {(["men", "women", "kids"] as const).map((t) => {
              const on = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="transition-all relative -mb-px"
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: on ? GOLD : "rgba(0,0,0,0.50)",
                    border: "none",
                    background: "none",
                    borderBottom: on ? `2px solid ${GOLD}` : "2px solid transparent",
                    padding: "14px 24px 14px 0",
                    marginRight: 32,
                  }}
                >
                  {t === "men" ? "Men's" : t === "women" ? "Women's" : "Kids'"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PANELS[tab].map((c) => (
            <ProductCard key={c.title + c.href} c={c} />
          ))}
        </div>
      </section>

      {/* Divider */}
      <div
        className="mx-6 md:mx-20"
        style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,146,90,0.3), transparent)" }}
      />

      {/* CUSTOM STUDIO BAR */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "#F5F2EC",
          borderTop: "1px solid rgba(184,146,90,0.3)",
          borderBottom: "1px solid rgba(184,146,90,0.3)",
        }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: GOLD }} />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            background:
              "url('https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=1200&q=60') center/cover",
          }}
        />
        <div className="relative z-[1] max-w-[1400px] mx-auto px-6 md:px-20 py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-16">
          <div>
            <div
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 8,
                letterSpacing: "0.4em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Custom Studio
            </div>
            <h2
              className="text-neutral-900"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(28px, 2.5vw, 40px)",
                fontWeight: 400,
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              Choose your colour, print, pattern,<br />size or upload your logo.
            </h2>
            <p
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: MUTED,
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              Your game, your t-shirt.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <span
                  key={c}
                  className="transition-colors"
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 7.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(0,0,0,0.50)",
                    border: "1px solid rgba(184,146,90,0.3)",
                    padding: "5px 12px",
                    borderRadius: 2,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0 items-start min-w-[200px]">
            <Link
              href="/products/1/customize"
              className="text-neutral-900 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              style={{
                background: GOLD,
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 9,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                padding: "14px 28px",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = GOLD_LIGHT)}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = GOLD)}
            >
              Start Designing →
            </Link>
            <Link
              href="/products/1/customize"
              className="hover:!text-[#B8925A] transition-colors"
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 8,
                letterSpacing: "0.2em",
                color: MUTED,
                textTransform: "uppercase",
                borderBottom: "1px solid rgba(0,0,0,0.16)",
                paddingBottom: 2,
              }}
            >
              Bulk & Corporate Pricing →
            </Link>
          </div>
        </div>
      </section>

      <div
        className="mx-6 md:mx-20"
        style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,146,90,0.3), transparent)" }}
      />

      {/* BULK SECTION */}
      <section className="px-6 md:px-20 py-16 md:py-20 max-w-[1400px] mx-auto">
        <div className="mb-10">
          <div
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              fontSize: 8,
              letterSpacing: "0.4em",
              color: GOLD,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Bulk & Corporate
          </div>
          <h2
            className="text-neutral-900"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(28px, 3vw, 42px)",
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            Outfit Your Event,<br />Academy or Club
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BULK.map((b) => (
            <div
              key={b.title}
              className="group transition-all hover:-translate-y-1"
              style={{
                background: "#F5F2EC",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(184,146,90,0.3)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.10)")}
            >
              <div className="h-[140px] relative overflow-hidden flex items-center justify-center">
                <img
                  src={b.img}
                  alt={b.title}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  style={{ opacity: 0.55 }}
                />
                <span
                  className="absolute top-3 left-3.5 z-[1]"
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 7,
                    letterSpacing: "0.25em",
                    color: GOLD,
                    textTransform: "uppercase",
                  }}
                >
                  {b.from}
                </span>
              </div>
              <div className="px-5 pt-5 pb-5">
                <div
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 8,
                    letterSpacing: "0.3em",
                    color: GOLD,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  {b.num}
                </div>
                <div
                  className="text-neutral-900"
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 20,
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  {b.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 10,
                    color: MUTED,
                    letterSpacing: "0.06em",
                    lineHeight: 1.7,
                    marginBottom: 14,
                  }}
                >
                  {b.desc}
                </div>
                <div className="flex flex-wrap gap-1">
                  {b.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: "'Josefin Sans', sans-serif",
                        fontSize: 7,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,0.50)",
                        background: "rgba(0,0,0,0.08)",
                        padding: "3px 8px",
                        borderRadius: 2,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
