import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { SHOW_KIDS, SHOW_CUSTOMIZATION } from "@/lib/features";

// ─── Design tokens ────────────────────────────────────────────────────────────
const GOLD       = "#B8925A";
const GOLD_LIGHT = "#D4A96A";

// Cool-toned premium palette — replaces flat bright whites with depth + hierarchy
const BG_PAGE    = "#F2F3F7";   // cool slate-white page base
const BG_SECTION = "#ECEEF4";   // slightly deeper for alternating sections
const BG_CARD    = "#F7F8FB";   // card surface
const BG_DARK    = "#0F1622";   // dark navy — bespoke card + studio bar

// ─── Image paths ──────────────────────────────────────────────────────────────
// Copy the supplied image files into your project at /public/images/
//
// /public/images/slides/hero1_mens.png            ← "KaSha Hero banner 1 Mens"
// /public/images/slides/hero2_mens_tshirts.png    ← "KaSha Hero banner 2 Mens t shirts"
// /public/images/slides/hero3_womens.png          ← "KaSha Hero banner 3 Womens"
// /public/images/slides/hero4_all_products.png    ← "KaSha Hero banner 4 All products"
//
// /public/images/shop/men_kasha.png               ← "Home_men_Ka SHa Signature"
// /public/images/shop/men_flair.png               ← "Home_Men_Flair"
// /public/images/shop/men_bottoms.png             ← "Home_Men_Bottoms"
// /public/images/shop/women_kasha.png             ← "Home Women_s Ka SHa Signature"
// /public/images/shop/women_flair.png             ← "Home women Flair"
// /public/images/shop/women_skorts.png            ← "HoME WOMEn Bottom Skorts"
//
// /public/images/bulk/tournament.png              ← "Home_Tournament"
// /public/images/bulk/academy.png                 ← "Home Academy"
// /public/images/bulk/clubs.png                   ← "Home_Clubs and Coporate"

// ─── Hero slides ─────────────────────────────────────────────────────────────
// Primary button routes derived from banner filenames:
//   banner 1 "Mens"          → /products?gender=men
//   banner 2 "Mens t shirts" → /products?gender=men&type=tshirts
//   banner 3 "Womens"        → /products?gender=women
//   banner 4 "All products"  → /products
const SLIDES = [
  {
    img:     "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Slide_images/KaSha%20Hero%20banner%201%20Mens.png",
    eyebrow: "Full Collection · 2026",
    title:   (<>Flair on the fairway<br />Ka.Sha Golfwear.</>),
    sub:     SHOW_KIDS ? "Men · Women · Kids · Bespoke" : "Men · Women",
    primary: { label: "All Products", href: "/products" },
    outline: SHOW_CUSTOMIZATION ? { label: "Custom Studio", href: "/products/1/customize" } : undefined,
  },
  {
    img:     "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Slide_images/KaSha%20Hero%20banner%202%20Mens%20t%20shirts.png",
    eyebrow: "Ka·Sha Signature · Men's T-Shirts",
    title:   (<>Gentlemen golfers.<br />When precision meets panache.</>),
    sub:     "GT001–GT0032 · Signature Collection",
    primary: { label: "Men's Store", href: "/products?gender=men&type=tshirts" },
    outline: { label: "View Collection", href: "/products?gender=men" },
  },
  {
    img:     "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Slide_images/KaSha%20Hero%20banner%203%20Womens.png",
    eyebrow: "Women's Collection · 2026",
    title:   (<>Wear your game.<br />Style</>),
    sub:     "Women · Signature · Flair · Bottoms",
    primary: { label: "Women's Store", href: "/products?gender=women&type=tshirts" },
    outline: { label: "View Collection", href: "/products?gender=women&type=tshirts" },
  },
  {
    img:     "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Slide_images/KaSha%20Hero%20banner%204%20All%20products.png",
    eyebrow: "New Season · Golf Collection 2026",
    title:   (<>Crafted for players<br />Bespoke prints.Try our custom studio.</>),
    sub:     SHOW_KIDS ? "Men · Women · Kids · Custom" : "Men · Women",
    primary: { label: "CUSTOM STUDIO",    href: "/products?gender=men" },
    outline: SHOW_CUSTOMIZATION ? { label: "Custom Studio", href: "/products/1/customize" } : undefined,
  },
] as const;

const SLIDE_DURATION = 6000;

// ─── Category card type ───────────────────────────────────────────────────────
type Card = {
  href: string;
  img?: string;
  badge?: string;
  cat: string;
  title: string;
  desc: string;
  tags: string[];
  bespoke?: true;
  bespokeSub?: string;
};

// ─── Category panels ──────────────────────────────────────────────────────────
// Wireframe shows: 2-col grid, 4 cards → 2 rows × 2 cols.
// Bespoke card = dark navy (#0F1622), gold border, same cell size as others.
const PANELS: Record<"men" | "women" | "kids", Card[]> = {
  men: [
    {
      href:  "/products?gender=men&type=tshirts&style=patterns",
      img:   "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Shop_by_Category_images/Home_men_Ka%20SHa%20Signature.png",
      cat:   "T-Shirts",
      title: "Ka·Sha Signature",
      desc:  "Solids · 8 colours · 8 patterns · prints",
      tags:  ["Solid", "8 Patterns", "Prints"],
    },
    {
      href:  "/products?gender=men&type=tshirts&style=prints",
      img:   "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Shop_by_Category_images/Home_Men_Flair.png",
      cat:   "T-Shirts",
      title: "Flair",
      desc:  "Statement prints & limited-run designs",
      tags:  ["Limited Prints", "Seasonal"],
    },
    {
      href:  "/products?gender=men&type=bottoms",
      img:   "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Shop_by_Category_images/Home_Men_Bottoms.png",
      cat:   "Bottoms",
      title: "Pro Tour Trouser",
      desc:  "Glove dock · Tee holder · 4-way stretch",
      tags:  ["4 Colours", "Technical"],
    },
    ...(SHOW_CUSTOMIZATION ? [{
      href:       "/products/1/customize",
      cat:        "Bespoke",
      title:      "Custom Studio",
      desc:       "Your colour, logo & fit — 1 piece or 500",
      tags:       [],
      bespoke:    true as const,
      bespokeSub: "Bespoke",
    }] : []),
  ],
  women: [
    {
      href:  "/products?gender=women&type=tshirts&style=patterns",
      img:   "/images/shop/women_kasha.png",
      cat:   "T-Shirts",
      title: "Ka·Sha Signature",
      desc:  "Solids · 8 colours · 8 patterns · prints",
      tags:  ["Solid", "8 Patterns", "Prints"],
    },
    {
      href:  "/products?gender=women&type=tshirts&style=prints",
      img:   "/images/shop/women_flair.png",
      cat:   "T-Shirts",
      title: "Flair",
      desc:  "Statement prints & limited-run designs",
      tags:  ["Limited Prints", "Seasonal"],
    },
    {
      href:  "/products?gender=women&type=skirts",
      img:   "/images/shop/women_skorts.png",
      cat:   "Bottoms",
      title: "Pro Tour Skort",
      desc:  "Technical stretch · Tailored fit · Active skirt",
      tags:  ["3 Colours", "Skirt", "Skort"],
    },
    ...(SHOW_CUSTOMIZATION ? [{
      href:       "/products/1/customize",
      cat:        "Bespoke",
      title:      "Custom Studio",
      desc:       "Your colour, logo & fit — 1 piece or 500",
      tags:       [],
      bespoke:    true as const,
      bespokeSub: "Bespoke",
    }] : []),
  ],
  kids: [
    {
      href:  "/products?gender=kids&type=tshirts&style=patterns",
      img:   "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&q=80",
      badge: "Boys",
      cat:   "T-Shirts",
      title: "Boys' T-Shirts",
      desc:  "Solids · Patterns · XS–XL Junior",
      tags:  ["Solid", "Patterns"],
    },
    {
      href:  "/products?gender=kids&type=tshirts&style=prints",
      img:   "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=80",
      badge: "Girls",
      cat:   "T-Shirts",
      title: "Girls' T-Shirts",
      desc:  "Solids · Patterns · XS–XL Junior",
      tags:  ["Solid", "Patterns"],
    },
    {
      href:  "/products?gender=kids&type=bottoms",
      img:   "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80",
      cat:   "Bottoms",
      title: "All Bottoms",
      desc:  "Trousers & skorts · All sizes",
      tags:  ["Trousers", "Skorts"],
    },
    ...(SHOW_CUSTOMIZATION ? [{
      href:       "/products/1/customize",
      cat:        "Bespoke",
      title:      "Custom Studio",
      desc:       "Academy crest · Names · All sizes",
      tags:       [],
      bespoke:    true as const,
      bespokeSub: "Academy",
    }] : []),
  ],
};

// Studio customisation chips (interactive toggles)
const CHIPS = ["Colour", "Print", "Pattern", "Size", "Upload logo", "Add text", "Trim & collar"];

// ─── Bulk tiles ───────────────────────────────────────────────────────────────
const BULK = [
  {
    img:   "/images/bulk/tournament.png",
    from:  "From 12 pieces",
    num:   "01",
    title: "Tournaments",
    desc:  "Consistent kit across the full field. Sponsored logo in five placement options, any colour. .",
    tags:  ["Player Names", "Sponsor Logo"],
  },
  {
    img:   "/images/bulk/academy.png",
    from:  "All ages & sizes",
    num:   "02",
    title: "Golf Academies",
    desc:  "Your crest, your colours, your students — looking like they belong to something.",
    tags:  ["Academy Crest", "All Sizes"],
  },
  {
    img:   "/images/bulk/clubs.png",
    from:  "Social clubs",
    num:   "03",
    title: "SOCIAL GOLF CLUBS",
    desc:  "Give the group a shared identity without anyone feeling like they settled.",
    tags:  ["Mixed Sizes", "From 12"],
  },
];

// ─── CategoryCard ─────────────────────────────────────────────────────────────
function CategoryCard({ c }: { c: Card }) {
  if (c.bespoke) {
    // Dark navy card — exactly as wireframe: #0F1622, gold border
    return (
      <Link
        href={c.href}
        className="block"
        style={{ background: BG_DARK, border: `0.5px solid ${GOLD}`, borderRadius: 8, overflow: "hidden", transition: "transform 0.3s, box-shadow 0.3s" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform  = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 28px rgba(184,146,90,0.22)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform  = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Icon area */}
        <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", opacity: 0.25 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 200, letterSpacing: "0.3em", color: "#fff", lineHeight: 1 }}>KS</div>
            <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase", marginTop: 5 }}>{c.bespokeSub}</div>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "13px 16px 16px", borderTop: "0.5px solid rgba(184,146,90,0.25)" }}>
          <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", marginBottom: 4 }}>{c.cat}</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: "#fff", marginBottom: 4 }}>{c.title}</div>
          <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em", lineHeight: 1.7, marginBottom: 10 }}>{c.desc}</div>
          <span style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, borderBottom: "0.5px solid rgba(184,146,90,0.4)", paddingBottom: 1 }}>Design yours →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={c.href}
      className="block"
      style={{ background: BG_CARD, border: "0.5px solid rgba(30,40,80,0.1)", borderRadius: 8, overflow: "hidden", transition: "transform 0.3s, border-color 0.3s, box-shadow 0.3s" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform   = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,146,90,0.35)";
        (e.currentTarget as HTMLElement).style.boxShadow  = "0 12px 28px rgba(30,40,80,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform   = "translateY(0)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(30,40,80,0.1)";
        (e.currentTarget as HTMLElement).style.boxShadow  = "none";
      }}
    >
      {/* Image */}
      <div style={{ height: 300, position: "relative", overflow: "hidden" }}>
        <img src={c.img} alt={c.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" style={{ display: "block" }} />
        {c.badge && (
          <span style={{ position: "absolute", top: 10, left: 10, background: GOLD, color: "#fff", fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", padding: "3px 9px" }}>{c.badge}</span>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,18,35,0.45) 0%, transparent 55%)" }} />
      </div>
      {/* Body */}
      <div style={{ padding: "13px 16px 16px" }}>
        <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", marginBottom: 4 }}>{c.cat}</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: "#1a1f2e", marginBottom: 4, lineHeight: 1.2 }}>{c.title}</div>
        <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 14, color: "rgba(20,28,60,0.72)", letterSpacing: "0.04em", lineHeight: 1.7, marginBottom: 10 }}>{c.desc}</div>
        {c.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {c.tags.map((t) => (
              <span key={t} style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.1em", padding: "3px 8px", background: BG_SECTION, color: "rgba(20,28,60,0.68)", borderRadius: 3, textTransform: "uppercase", border: "0.5px solid rgba(30,40,80,0.12)" }}>{t}</span>
            ))}
          </div>
        )}
        <span style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1a1f2e", borderBottom: "0.5px solid rgba(30,40,80,0.15)", paddingBottom: 1 }}>Shop →</span>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [active,   setActive]   = useState(0);
  const [progress, setProgress] = useState(0);
  const [tab,      setTab]      = useState<"men" | "women" | "kids">("men");
  const [chips,    setChips]    = useState<string[]>(["Colour"]);

  // Hero auto-advance
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = ((Date.now() - start) / SLIDE_DURATION) * 100;
      if (p >= 100) setActive((c) => (c + 1) % SLIDES.length);
      else          setProgress(p);
    }, 100);
    return () => clearInterval(id);
  }, [active]);

  const toggleChip = (chip: string) =>
    setChips((prev) => prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]);

  const PAD = "clamp(24px, 5vw, 80px)";

  return (
    <Layout>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO CAROUSEL
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", height: "100vh", minHeight: 600, overflow: "hidden", marginTop: -64 }}>

        {/* Slides strip */}
        <div style={{
          position:   "absolute",
          inset:      0,
          display:    "flex",
          transform:  `translateX(-${active * 100}%)`,
          transition: "transform 900ms cubic-bezier(0.77,0,0.175,1)",
        }}>
          {SLIDES.map((s, i) => (
            <div key={i} style={{ minWidth: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
              {/* Background photo */}
              <img
                src={s.img}
                alt={s.eyebrow}
                style={{
                  position:   "absolute",
                  inset:      0,
                  width:      "100%",
                  height:     "100%",
                  objectFit:  "cover",
                  objectPosition: "top",
                  transform:  i === active ? "scale(1)" : "scale(1.06)",
                  transition: "transform 8s ease-out",
                }}
              />
              {/* Overlay — blends to BG_PAGE at bottom so next section is seamless */}
              <div style={{
                position:   "absolute",
                inset:      0,
                background: `linear-gradient(to bottom, rgba(8,10,20,0.18) 0%, rgba(8,10,20,0.06) 22%, rgba(8,10,20,0.58) 68%, rgba(10,15,35,0.94) 100%)`,
              }} />
              {/* CTA content */}
              <div style={{
                position: "absolute",
                bottom:   0,
                left:     0,
                right:    0,
                zIndex:   2,
                padding:  `0 ${PAD} 76px`,
                maxWidth: 720,
              }}>
                <div style={{
                  fontFamily:    "'Josefin Sans', sans-serif",
                  fontSize:      12,
                  letterSpacing: "0.4em",
                  color:         GOLD,
                  textTransform: "uppercase",
                  marginBottom:  12,
                  opacity:       i === active ? 1 : 0,
                  transform:     i === active ? "translateY(0)" : "translateY(14px)",
                  transition:    "opacity 0.7s 0.2s ease, transform 0.7s 0.2s ease",
                }}>
                  {s.eyebrow}
                </div>
                <h1 style={{
                  fontFamily:    "'Cormorant Garamond', serif",
                  fontSize:      "clamp(40px, 5.5vw, 70px)",
                  fontWeight:    400,
                  lineHeight:    1.05,
                  letterSpacing: "0.02em",
                  color:         "#fff",
                  marginBottom:  12,
                  opacity:       i === active ? 1 : 0,
                  transform:     i === active ? "translateY(0)" : "translateY(22px)",
                  transition:    "opacity 0.8s 0.35s ease, transform 0.8s 0.35s ease",
                }}>
                  {s.title}
                </h1>
                <p style={{
                  fontFamily:    "'Josefin Sans', sans-serif",
                  fontSize:      13,
                  letterSpacing: "0.25em",
                  color:         "rgba(255,255,255,0.65)",
                  textTransform: "uppercase",
                  marginBottom:  26,
                  opacity:       i === active ? 1 : 0,
                  transition:    "opacity 0.7s 0.5s ease",
                }}>
                  {s.sub}
                </p>
                <div style={{
                  display:   "flex",
                  gap:       8,
                  flexWrap:  "wrap",
                  opacity:   i === active ? 1 : 0,
                  transform: i === active ? "translateY(0)" : "translateY(14px)",
                  transition:"opacity 0.7s 0.6s ease, transform 0.7s 0.6s ease",
                }}>
                  {/* Primary CTA — navigates to the product section matching the banner name */}
                  <Link
                    href={s.primary.href}
                    style={{
                      background:    GOLD,
                      color:         "#fff",
                      fontFamily:    "'Josefin Sans', sans-serif",
                      fontSize:      12,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      padding:       "13px 28px",
                      display:       "inline-block",
                      transition:    "background 0.2s, transform 0.2s",
                      boxShadow:     "0 6px 18px rgba(184,146,90,0.4)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GOLD_LIGHT; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = GOLD;       (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                  >
                    {s.primary.label}
                  </Link>
                  {/* Secondary outline CTA */}
                  {s.outline && (
                    <Link
                      href={s.outline.href}
                      style={{
                        background:    "rgba(255,255,255,0.08)",
                        backdropFilter:"blur(8px)",
                        color:         "rgba(255,255,255,0.72)",
                        fontFamily:    "'Josefin Sans', sans-serif",
                        fontSize:      12,
                        letterSpacing: "0.28em",
                        textTransform: "uppercase",
                        padding:       "12px 28px",
                        border:        "0.5px solid rgba(255,255,255,0.32)",
                        display:       "inline-block",
                        transition:    "border-color 0.2s, color 0.2s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,146,90,0.55)"; (e.currentTarget as HTMLElement).style.color = GOLD; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.32)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.72)"; }}
                    >
                      {s.outline.label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div style={{ position: "absolute", bottom: 80, right: PAD, zIndex: 3, display: "flex", gap: 6, alignItems: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width:        i === active ? 22 : 6,
                height:       i === active ? 4  : 6,
                borderRadius: i === active ? 2  : 9999,
                background:   i === active ? GOLD : "rgba(255,255,255,0.3)",
                border:       "none",
                cursor:       "pointer",
                transition:   "all 0.3s ease",
                padding:      0,
              }}
            />
          ))}
        </div>

        {/* Vertical slide counter */}
        <div className="hidden md:block" style={{
          position:      "absolute",
          top:           "50%",
          right:         80,
          transform:     "translateY(-50%)",
          zIndex:        3,
          writingMode:   "vertical-rl" as const,
          fontFamily:    "'Josefin Sans', sans-serif",
          fontSize:      11,
          letterSpacing: "0.3em",
          color:         "rgba(255,255,255,0.18)",
        }}>
          {String(active + 1).padStart(2, "0")} / 0{SLIDES.length}
        </div>

        {/* Progress bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, height: 1.5, zIndex: 3, background: GOLD, width: `${progress}%`, transition: "width 0.1s linear" }} />
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SHOP BY CATEGORY
          Wireframe layout: tabs header + 2-col grid (1fr 1fr) always,
          4 cards → 2 rows of 2. Bespoke = dark navy card, same cell as others.
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_SECTION }}>
        <div style={{ maxWidth: '100%', margin: "0 auto", padding: `52px ${PAD} 56px` }}>

          {/* Header */}
          <div style={{ borderBottom: "0.5px solid rgba(30,40,80,0.1)", marginBottom: 0 }}>
            <div style={{ paddingBottom: 18 }}>
              <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.4em", color: GOLD, textTransform: "uppercase", marginBottom: 8 }}>
                Collections
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px,3vw,40px)", fontWeight: 400, letterSpacing: "0.02em", color: "#1a1f2e" }}>
                Shop by Category
              </h2>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex" }}>
              {(["men", "women", ...(SHOW_KIDS ? ["kids"] : [])] as const).map((t) => {
                const on = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t as "men" | "women" | "kids")}
                    style={{
                      fontFamily:    "'Josefin Sans', sans-serif",
                      fontSize:      13,
                      fontWeight:    500,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color:         on ? GOLD : "rgba(30,40,80,0.4)",
                      background:    "none",
                      border:        "none",
                      borderBottom:  on ? `2px solid ${GOLD}` : "2px solid transparent",
                      padding:       "12px 18px 12px 0",
                      marginRight:   24,
                      cursor:        "pointer",
                      position:      "relative",
                      bottom:        -0.5,
                      transition:    "color 0.2s",
                    }}
                  >
                    {t === "men" ? "Men's" : t === "women" ? "Women's" : "Kids'"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 2-column card grid ─────────────────────────────────────────
              gridTemplateColumns: "1fr 1fr" = exactly 2 cols on all screen sizes ≥ small.
              On mobile (< 640px) falls to 1 col via Tailwind breakpoint class below.
          ──────────────────────────────────────────────────────────────── */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: 10, marginTop: 14 }}
          >
            {PANELS[tab].map((c) => (
              <CategoryCard key={c.title + c.href} c={c} />
            ))}
          </div>

        </div>
      </section>

      {/* Gold rule divider */}
      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,146,90,0.22), transparent)", margin: `0 ${PAD}` }} />

      {/* ══════════════════════════════════════════════════════════════════════
          CUSTOM STUDIO — hidden when SHOW_CUSTOMIZATION is false
      ══════════════════════════════════════════════════════════════════════ */}
      {SHOW_CUSTOMIZATION && <section style={{ background: BG_PAGE, padding: `20px ${PAD}` }}>
        <div style={{
          maxWidth:      "100%",
          margin:        "0 auto",
          background:    BG_DARK,
          borderLeft:    `3px solid ${GOLD}`,
          borderRadius:  10,
          padding:       "20px 26px",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          gap:           20,
          flexWrap:      "wrap",
        }}>
          {/* Left block */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.28em", color: GOLD, textTransform: "uppercase", marginBottom: 8 }}>
              Custom Studio
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(15px,1.6vw,19px)", fontWeight: 500, color: "#fff", lineHeight: 1.35, marginBottom: 4 }}>
              Choose your colour, print, pattern, size<br />or upload your logo.
            </div>
            <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 13, letterSpacing: "0.1em", color: "rgba(255,255,255,0.38)", textTransform: "uppercase", marginBottom: 14 }}>
              Your game, your t-shirt.
            </div>
            {/* Interactive toggle chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CHIPS.map((chip) => {
                const on = chips.includes(chip);
                return (
                  <button
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    style={{
                      fontFamily:    "'Josefin Sans', sans-serif",
                      fontSize:      11,
                      letterSpacing: "0.1em",
                      padding:       "5px 12px",
                      borderRadius:  3,
                      border:        `0.5px solid ${on ? GOLD : "rgba(184,146,90,0.35)"}`,
                      background:    on ? GOLD : "transparent",
                      color:         on ? "#fff" : "rgba(255,255,255,0.55)",
                      textTransform: "uppercase",
                      cursor:        "pointer",
                      transition:    "all 0.2s ease",
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", flexShrink: 0 }}>
            <Link
              href="/products/1/customize"
              style={{
                background:    GOLD,
                color:         "#fff",
                fontFamily:    "'Josefin Sans', sans-serif",
                fontSize:      12,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                padding:       "13px 24px",
                whiteSpace:    "nowrap",
                display:       "inline-block",
                transition:    "background 0.2s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = GOLD_LIGHT)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = GOLD)}
            >
              Start designing →
            </Link>
            <Link
              href="/products/1/customize"
              style={{
                fontFamily:    "'Josefin Sans', sans-serif",
                fontSize:      12,
                letterSpacing: "0.14em",
                color:         "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                borderBottom:  "0.5px solid rgba(255,255,255,0.14)",
                paddingBottom: 1,
                whiteSpace:    "nowrap",
                transition:    "color 0.2s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)")}
            >
              Bulk & corporate pricing →
            </Link>
          </div>
        </div>
      </section>}

      {/* Gold rule divider */}
      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,146,90,0.18), transparent)", margin: `0 ${PAD}` }} />

      {/* ══════════════════════════════════════════════════════════════════════
          BULK & CORPORATE — 3-column grid (matching wireframe)
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_PAGE }}>
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: `48px ${PAD} 56px` }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.4em", color: GOLD, textTransform: "uppercase", marginBottom: 8 }}>
              Bulk &amp; Corporate
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px,3vw,40px)", fontWeight: 400, color: "#1a1f2e", lineHeight: 1.2 }}>
              Outfit Your Event,<br />Academy or Club
            </h2>
          </div>

          {/* 3-col tile grid */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
            {BULK.map((b) => (
              <div
                key={b.title}
                style={{
                  background:   BG_CARD,
                  border:       "0.5px solid rgba(30,40,80,0.1)",
                  borderRadius: 10,
                  overflow:     "hidden",
                }}
              >
                {/* Image */}
                <div style={{ height: 300, position: "relative", overflow: "hidden" }}>
                  <img src={b.img} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,18,35,0.4) 0%, transparent 55%)" }} />
                  <span style={{ position: "absolute", top: 8, left: 10, fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: "0.18em", color: GOLD, textTransform: "uppercase" }}>
                    {b.from}
                  </span>
                </div>
                {/* Body */}
                <div style={{ padding: "13px 16px 16px" }}>
                  <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: 4 }}>{b.num}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: "#1a1f2e", marginBottom: 6 }}>{b.title}</div>
                  <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 14, color: "rgba(20,28,60,0.72)", letterSpacing: "0.04em", lineHeight: 1.7, marginBottom: 10 }}>{b.desc}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {b.tags.map((t) => (
                      <span key={t} style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, padding: "3px 8px", background: BG_SECTION, color: "rgba(20,28,60,0.68)", borderRadius: 3, letterSpacing: "0.08em", textTransform: "uppercase", border: "0.5px solid rgba(30,40,80,0.12)" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

    </Layout>
  );
}