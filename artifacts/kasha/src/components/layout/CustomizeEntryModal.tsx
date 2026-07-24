/**
 * CustomizeEntryModal — Bespoke Studio entry point.
 * 3-step wizard: Gender → Category → Style → opens 3D studio.
 * All steps share the same premium horizontal-scroll tile layout.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { parseSku } from "@/components/3d/sku-config";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GOLD = "#c9a84c";

type Step   = "gender" | "category" | "style";
type Gender = "men" | "women";

// ── Gender tiles ──────────────────────────────────────────────────────────────
const GENDER_CONFIG: Array<{ key: Gender; label: string; sub: string; desc: string; accent: string; icon: string }> = [
  { key: "men",   label: "Men",   sub: "Golf & Sportswear", desc: "Polos, trousers & shorts crafted for the course", accent: "#4a7fa5", icon: "◈" },
  { key: "women", label: "Women", sub: "Golf & Sportswear", desc: "Dresses, skorts & tees tailored for her game",     accent: "#9a5e7a", icon: "◆" },
];

// ── Category tiles per gender ─────────────────────────────────────────────────
type CatDef = { key: string; label: string; desc: string; accent: string; icon: string };

const GENDER_CATEGORIES: Record<Gender, CatDef[]> = {
  men: [
    { key: "tshirts", label: "T-Shirts", desc: "Polos & signature golf tees",      accent: "#6b8fa3", icon: "◼" },
    { key: "pants",   label: "Pants",    desc: "Tailored golf trousers",            accent: "#7a8a5e", icon: "▣" },
    { key: "shorts",  label: "Shorts",   desc: "Athletic & tailored golf shorts",   accent: "#a08a6b", icon: "◫" },
  ],
  women: [
    { key: "tshirts", label: "T-Shirts", desc: "Signature & printed golf tees",     accent: "#6b8fa3", icon: "◼" },
    { key: "pants",   label: "Pants",    desc: "Tailored golf trousers",             accent: "#7a8a5e", icon: "▣" },
    { key: "shorts",  label: "Shorts",   desc: "Athletic & tailored golf shorts",   accent: "#a08a6b", icon: "◫" },
    { key: "skorts",  label: "Skorts",   desc: "Skirt-shorts for the fairway",      accent: "#8a6ba3", icon: "◇" },
    { key: "dresses", label: "Dresses",  desc: "Golf dresses, fitted & free",       accent: "#a36b7a", icon: "◊" },
  ],
};

// ── Style definitions per category ───────────────────────────────────────────

/**
 * dbCategory: the exact value stored in the `category` column (compared
 * case-insensitively so "Dresses" and "dresses" both match).
 */
type StyleResolver =
  | { kind: "firstByType"; skuType: "solid" | "print"; dbCategory: string }
  | { kind: "patternsAll"; dbCategory: string }
  | { kind: "comingSoon" };

type StyleDef = {
  key:      string;
  label:    string;
  desc:     string;
  accent:   string;
  icon:     string;
  resolver: StyleResolver;
};

const CATEGORY_STYLES: Record<string, StyleDef[]> = {
  tshirts: [
    { key: "solid",   label: "Solid",   desc: "Clean base colours, ready to personalise", accent: "#6b8fa3", icon: "◼", resolver: { kind: "firstByType", skuType: "solid",   dbCategory: "t-shirt" } },
    { key: "printed", label: "Printed", desc: "All-over prints from the KA.SHA library",  accent: "#a36b6b", icon: "✦", resolver: { kind: "firstByType", skuType: "print",   dbCategory: "t-shirt" } },
    { key: "pattern", label: "Pattern", desc: "Bespoke geometric & signature pattern",     accent: "#6ba37a", icon: "◈", resolver: { kind: "patternsAll",                     dbCategory: "t-shirt" } },
  ],
  pants: [
    { key: "solid",   label: "Solid Pant",   desc: "Tailored base colour, ready to personalise", accent: "#6b8fa3", icon: "◼", resolver: { kind: "firstByType", skuType: "solid", dbCategory: "trousers" } },
    { key: "printed", label: "Printed Pant", desc: "All-over prints from the KA.SHA library",    accent: "#a36b6b", icon: "✦", resolver: { kind: "firstByType", skuType: "print", dbCategory: "trousers" } },
  ],
  shorts: [
    { key: "solid",   label: "Solid Short",   desc: "Clean base colour, ready to personalise", accent: "#6b8fa3", icon: "◼", resolver: { kind: "firstByType", skuType: "solid", dbCategory: "shorts" } },
    { key: "printed", label: "Printed Short", desc: "All-over prints from the KA.SHA library", accent: "#a36b6b", icon: "✦", resolver: { kind: "firstByType", skuType: "print", dbCategory: "shorts" } },
  ],
  skorts: [
    { key: "solid",     label: "Solid Skort",   desc: "Clean base colour, ready to personalise",              accent: "#6b8fa3", icon: "◼", resolver: { kind: "firstByType", skuType: "solid", dbCategory: "skorts" } },
    { key: "printed",   label: "Printed Skort", desc: "All-over prints from the KA.SHA library",              accent: "#a36b6b", icon: "✦", resolver: { kind: "firstByType", skuType: "print", dbCategory: "skorts" } },
    { key: "customise", label: "Customise",     desc: "Contrast waistband or bespoke body — design your own", accent: "#a38b6b", icon: "▣", resolver: { kind: "comingSoon" }                                        },
  ],
  dresses: [
    { key: "solid",     label: "Solid Dress",   desc: "Clean base colour, ready to personalise",               accent: "#6b8fa3", icon: "◼", resolver: { kind: "firstByType", skuType: "solid", dbCategory: "dresses" } },
    { key: "printed",   label: "Printed Dress", desc: "All-over prints from the KA.SHA library",               accent: "#a36b6b", icon: "✦", resolver: { kind: "firstByType", skuType: "print", dbCategory: "dresses" } },
    { key: "customise", label: "Customise",     desc: "Contrast collar or bespoke body — design your own",     accent: "#a38b6b", icon: "▣", resolver: { kind: "comingSoon" }                                         },
  ],
};

// ── URL builder (unchanged) ───────────────────────────────────────────────────
function buildHref(productId: number, sku: string): string {
  const result = parseSku(sku);
  if (result.type === "pattern") return `/products/${productId}/customize?entry=1&style=pattern&design=${encodeURIComponent(sku)}`;
  if (result.type === "print")   return `/products/${productId}/customize?entry=1&style=print&design=${encodeURIComponent(sku)}`;
  const designParam = sku ? `&design=${encodeURIComponent(sku)}` : "";
  return `/products/${productId}/customize?entry=1&style=solid${designParam}`;
}

// ── Product type ──────────────────────────────────────────────────────────────
type AnyProduct = {
  id: number;
  sku?: string | null;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  available: boolean;
  gender?: string | null;
  category?: string | null;
};

// ── Resolver helpers ──────────────────────────────────────────────────────────

/** Case-insensitive match against the product's DB category column. */
function matchesCategory(p: AnyProduct, dbCategory: string): boolean {
  return (p.category ?? "").toLowerCase() === dbCategory.toLowerCase();
}

/**
 * Find the first product that matches gender + garment category + SKU type.
 * Priority:
 *   1. gender + category + skuType  (ideal)
 *   2. gender + category            (right garment, any style — still shows as the tile)
 *   3. category + skuType           (right garment + style, ungendered)
 *   4. null                         (tile renders as disabled / Coming Soon)
 */
function findFirstByType(
  products:    AnyProduct[],
  gender:      Gender,
  skuType:     "solid" | "print",
  dbCategory:  string,
): AnyProduct | null {
  return (
    products.find(p => p.available && p.gender === gender && matchesCategory(p, dbCategory) && parseSku(p.sku ?? "").type === skuType) ??
    products.find(p => p.available && p.gender === gender && matchesCategory(p, dbCategory)) ??
    products.find(p => p.available && matchesCategory(p, dbCategory) && parseSku(p.sku ?? "").type === skuType) ??
    null
  );
}

/**
 * Find all pattern products for a gender + garment category.
 * Falls back progressively if the preferred filter returns nothing.
 */
function findPatterns(products: AnyProduct[], gender: Gender, dbCategory: string): AnyProduct[] {
  const byBoth = products.filter(p => p.available && p.gender === gender && matchesCategory(p, dbCategory) && parseSku(p.sku ?? "").type === "pattern");
  if (byBoth.length > 0) return byBoth;
  const byCat  = products.filter(p => p.available && matchesCategory(p, dbCategory) && parseSku(p.sku ?? "").type === "pattern");
  if (byCat.length  > 0) return byCat;
  // Final fallback: all gender-matched patterns (legacy — for categories that have none yet)
  return products.filter(p => p.available && p.gender === gender && parseSku(p.sku ?? "").type === "pattern");
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function CustomizeEntryModal({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const scrollRef    = useRef<HTMLDivElement>(null);

  const [step,     setStep]     = useState<Step>("gender");
  const [gender,   setGender]   = useState<Gender | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // Reset wizard whenever the modal re-opens
  useEffect(() => {
    if (isOpen) { setStep("gender"); setGender(null); setCategory(null); }
  }, [isOpen]);

  const { data: allProducts, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), enabled: isOpen } }
  );

  if (!isOpen) return null;

  function handleSelectStyle(productId: number, sku: string) {
    onClose();
    navigate(buildHref(productId, sku) + "&from=modal");
  }

  function selectGender(g: Gender)      { setGender(g);   setStep("category"); }
  function selectCategory(cat: string)  { setCategory(cat); setStep("style"); }

  function goBack() {
    if (step === "style")    { setStep("category"); setCategory(null); }
    if (step === "category") { setStep("gender");   setGender(null);   }
  }

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
  };

  const subtitleMap: Record<Step, string> = {
    gender:   "Select Gender",
    category: `${gender === "men" ? "Men" : "Women"} — Select Category`,
    style:    `${gender === "men" ? "Men" : "Women"} · ${GENDER_CATEGORIES[gender!]?.find(c => c.key === category)?.label ?? ""} — Select a Style`,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26,26,24,0.65)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: "cemFadeIn 0.28s cubic-bezier(0.16,1,0.3,1)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cem-sheet" style={{ background: "#fafaf7", borderRadius: 20, maxWidth: 760, width: "calc(100vw - 32px)", padding: "36px 32px 38px", position: "relative", animation: "cemSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 32px 80px rgba(26,26,24,0.26), 0 8px 24px rgba(26,26,24,0.14)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Close */}
        <button onClick={onClose}
          style={{ position: "absolute", top: 16, right: 18, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(26,26,24,0.12)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#8a8780", transition: "all 0.2s", zIndex: 1 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ede9e1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, marginBottom: 8, fontWeight: 500 }}>KA.SHA Bespoke Studio</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "#1a1a18", letterSpacing: ".02em", margin: "0 0 8px", lineHeight: 1.2 }}>Choose Your Style</h2>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: "#8a8780", letterSpacing: ".04em", fontStyle: "italic", margin: 0 }}>{subtitleMap[step]}</p>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.4, marginBottom: 28 }} />

        {/* Back button — above the tiles */}
        {step !== "gender" && (
          <button onClick={goBack}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 18, background: "transparent", border: "1px solid rgba(201,168,76,0.35)", borderRadius: 8, padding: "5px 13px", cursor: "pointer", fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a8780", transition: "all 0.2s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#f2ede4"; el.style.color = "#1a1a18"; el.style.borderColor = GOLD; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "#8a8780"; el.style.borderColor = "rgba(201,168,76,0.35)"; }}
          >← Back</button>
        )}

        {/* ── Step: Gender ── */}
        {step === "gender" && (
          <TileRow centerSmall>
            {GENDER_CONFIG.map(g => (
              <WizardTile
                key={g.key}
                label={g.label}
                badge={g.sub}
                desc={g.desc}
                accent={g.accent}
                icon={g.icon}
                onSelect={() => selectGender(g.key)}
              />
            ))}
          </TileRow>
        )}

        {/* ── Step: Category ── */}
        {step === "category" && gender && (
          <TileRow scrollRef={scrollRef} scroll={scroll} showArrows={GENDER_CATEGORIES[gender].length > 3}>
            {GENDER_CATEGORIES[gender].map(cat => (
              <WizardTile
                key={cat.key}
                label={cat.label}
                badge={gender === "men" ? "Men" : "Women"}
                desc={cat.desc}
                accent={cat.accent}
                icon={cat.icon}
                onSelect={() => selectCategory(cat.key)}
              />
            ))}
          </TileRow>
        )}

        {/* ── Step: Style ── */}
        {step === "style" && category && gender && (
          isLoading ? <LoadingSkeleton /> : (
            <StyleStep
              category={category}
              gender={gender}
              allProducts={allProducts ?? []}
              onSelect={handleSelectStyle}
              scrollRef={scrollRef}
              scroll={scroll}
            />
          )
        )}

        {step === "style" && (
          <p style={{ textAlign: "center", marginTop: 24, fontFamily: "'Jost', sans-serif", fontSize: 10, color: "#b8b5ae", letterSpacing: ".08em", fontStyle: "italic" }}>
            The 3D model loads with the product's colour or print pre-applied · Customise freely from there
          </p>
        )}
      </div>

      <style>{`
        @keyframes cemFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cemSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cemPulse   { 0%,100% { opacity:.5 } 50% { opacity:.85 } }
        .cem-sheet::-webkit-scrollbar { width: 4px; }
        .cem-sheet::-webkit-scrollbar-track { background: transparent; }
        .cem-sheet::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 99px; }
        .cem-tiles {
          display: flex; flex-direction: row; gap: 16px;
          overflow-x: auto; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 4px 2px 12px; scrollbar-width: none;
        }
        .cem-tiles::-webkit-scrollbar { display: none; }
        .cem-tiles-center { justify-content: center; }
        .cem-tile { flex: 0 0 200px; scroll-snap-align: start; }
        .cem-tile-wide { flex: 0 0 260px; scroll-snap-align: start; }
        .cem-nav-btn {
          position: absolute; top: 50%; transform: translateY(-60%);
          width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid rgba(201,168,76,0.35);
          background: rgba(250,250,247,0.95); color: #1a1a18;
          font-size: 22px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 2; box-shadow: 0 2px 10px rgba(26,26,24,0.1); transition: all 0.2s;
        }
        .cem-nav-btn:hover { background: #c9a84c; color: #fff; border-color: #c9a84c; }
        .cem-nav-left  { left: -14px; }
        .cem-nav-right { right: -14px; }
        @media (max-width: 640px) {
          .cem-sheet { padding: 20px 14px 24px !important; border-radius: 14px !important; width: calc(100vw - 16px) !important; }
          .cem-tile, .cem-tile-wide { flex: 0 0 72vw; }
          .cem-nav-left  { left: -10px; }
          .cem-nav-right { right: -10px; }
        }
      `}</style>
    </div>
  );
}

// ── TileRow — shared scroll container ────────────────────────────────────────
function TileRow({ children, scrollRef, scroll, showArrows = false, centerSmall = false }: {
  children: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  scroll?: (dir: "left" | "right") => void;
  showArrows?: boolean;
  centerSmall?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      {showArrows && scroll && (
        <>
          <button onClick={() => scroll("left")}  className="cem-nav-btn cem-nav-left"  aria-label="Scroll left">‹</button>
          <button onClick={() => scroll("right")} className="cem-nav-btn cem-nav-right" aria-label="Scroll right">›</button>
        </>
      )}
      <div ref={scrollRef} className={`cem-tiles${centerSmall ? " cem-tiles-center" : ""}`}>
        {children}
      </div>
    </div>
  );
}

// ── WizardTile — used for Gender and Category steps ──────────────────────────
// Shares the exact same card shape / hover / shadow as StyleTile.
function WizardTile({ label, badge, desc, accent, icon, wide, onSelect }: {
  label: string; badge: string; desc: string; accent: string;
  icon: string; wide?: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={wide ? "cem-tile-wide" : "cem-tile"}
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 0, border: `1.5px solid ${accent}33`, borderRadius: 14, cursor: "pointer", background: "#fff", overflow: "hidden", textAlign: "left", transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 2px 10px rgba(26,26,24,0.06)", minWidth: 0 }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 36px ${accent}28, 0 4px 14px rgba(26,26,24,0.08)`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${accent}33`; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
    >
      {/* Decorative header — same 4:3 ratio as StyleTile image area */}
      <div style={{ width: "100%", aspectRatio: "4/3", background: `linear-gradient(160deg, ${accent}18, ${accent}06)`, flexShrink: 0, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span style={{ fontSize: 32, color: accent, opacity: 0.55, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#1a1a18", letterSpacing: ".02em", lineHeight: 1 }}>{label}</span>
        {/* Badge — same position as StyleTile */}
        <div style={{ position: "absolute", top: 10, left: 10, background: accent, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 99, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>{badge}</div>
      </div>
      {/* Content — same padding as StyleTile */}
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18", lineHeight: 1.25, marginBottom: 4 }}>{label}</div>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 9.5, color: "#8a8780", letterSpacing: ".04em", lineHeight: 1.6, margin: "0 0 10px" }}>{desc}</p>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 8.5, fontWeight: 600, color: accent, letterSpacing: ".1em", textTransform: "uppercase" }}>Select →</div>
      </div>
    </button>
  );
}

// ── StyleStep — final step with gender-filtered product resolution ────────────
interface StyleStepProps {
  category:    string;
  gender:      Gender;
  allProducts: AnyProduct[];
  onSelect:    (productId: number, sku: string) => void;
  scrollRef:   React.RefObject<HTMLDivElement | null>;
  scroll:      (dir: "left" | "right") => void;
}

type TileData = {
  key: string; label: string; desc: string; accent: string; icon: string;
  productId?: number; sku?: string; disabled: boolean; productName: string; thumbnail: string;
};

function StyleStep({ category, gender, allProducts, onSelect, scrollRef, scroll }: StyleStepProps) {
  const defs  = CATEGORY_STYLES[category] ?? [];
  const tiles: TileData[] = [];

  for (const def of defs) {
    if (def.resolver.kind === "patternsAll") {
      const patterns = findPatterns(allProducts, gender, def.resolver.dbCategory);
      if (patterns.length > 0) {
        for (const p of patterns) {
          tiles.push({
            key: `pattern-${p.id}`, label: "Pattern",
            desc:    p.description ?? "Bespoke geometric & signature pattern",
            accent:  def.accent, icon: def.icon,
            productId: p.id, sku: p.sku ?? "",
            disabled:    false,
            productName: p.name.replace(/\s*\[gt:GT\d+\]\s*$/i, ""),
            thumbnail:   getAssetUrl(p.thumbnailUrl) ?? "",
          });
        }
      } else {
        tiles.push({ key: "pattern-ph", label: "Pattern", desc: def.desc, accent: def.accent, icon: def.icon, disabled: true, productName: "Pattern", thumbnail: "" });
      }
    } else if (def.resolver.kind === "firstByType") {
      const product = findFirstByType(allProducts, gender, def.resolver.skuType, def.resolver.dbCategory);
      tiles.push({
        key:         def.key,
        label:       def.label,
        desc:        def.desc,
        accent:      def.accent,
        icon:        def.icon,
        productId:   product?.id,
        sku:         product?.sku ?? undefined,
        disabled:    !product,
        productName: product?.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "") ?? def.label,
        thumbnail:   product ? (getAssetUrl(product.thumbnailUrl) ?? "") : "",
      });
    } else {
      // comingSoon
      tiles.push({ key: def.key, label: def.label, desc: def.desc, accent: def.accent, icon: def.icon, disabled: true, productName: def.label, thumbnail: "" });
    }
  }

  return (
    <TileRow scrollRef={scrollRef} scroll={scroll} showArrows={tiles.length > 3}>
      {tiles.map(tile => (
        <StyleTile
          key={tile.key}
          label={tile.label} desc={tile.desc} accent={tile.accent} icon={tile.icon}
          thumbnail={tile.thumbnail} productName={tile.productName} disabled={tile.disabled}
          onSelect={() => { if (tile.productId != null && tile.sku != null) onSelect(tile.productId, tile.sku); }}
        />
      ))}
    </TileRow>
  );
}

// ── StyleTile — product tile (unchanged visual) ───────────────────────────────
function StyleTile({ label, desc, accent, icon, thumbnail, productName, disabled, onSelect }: {
  label: string; desc: string; accent: string; icon: string;
  thumbnail: string; productName: string; disabled: boolean; onSelect: () => void;
}) {
  return (
    <button onClick={onSelect} disabled={disabled} className="cem-tile"
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 0, border: `1.5px solid ${accent}33`, borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer", background: "#fff", overflow: "hidden", textAlign: "left", transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 2px 10px rgba(26,26,24,0.06)", opacity: disabled ? 0.45 : 1, minWidth: 0 }}
      onMouseEnter={e => { if (disabled) return; const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 14px 36px ${accent}28, 0 4px 14px rgba(26,26,24,0.08)`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${accent}33`; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 10px rgba(26,26,24,0.06)"; }}
    >
      <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: `linear-gradient(160deg, ${accent}12, ${accent}06)`, flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {thumbnail ? (
          <img src={thumbnail} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block", padding: "8px" }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }} />
        ) : (
          <span style={{ fontSize: 36, opacity: 0.18, color: accent }}>{icon}</span>
        )}
        <div style={{ position: "absolute", top: 10, left: 10, background: accent, color: "#fff", fontFamily: "'Jost', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 99, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>{label}</div>
      </div>
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a1a18", lineHeight: 1.25, marginBottom: 4 }}>{productName || label}</div>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 9.5, color: "#8a8780", letterSpacing: ".04em", lineHeight: 1.6, margin: "0 0 10px" }}>{desc}</p>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 8.5, fontWeight: 600, color: accent, letterSpacing: ".1em", textTransform: "uppercase" }}>{disabled ? "Coming Soon" : "Open in Studio →"}</div>
      </div>
    </button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="cem-tiles">
      {[0, 1, 2].map(i => (
        <div key={i} className="cem-tile" style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(26,26,24,0.07)", animation: "cemPulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}>
          <div style={{ aspectRatio: "4/3", background: "linear-gradient(160deg, #f0ede6, #e8e4db)" }} />
          <div style={{ padding: "14px 14px 16px" }}>
            <div style={{ width: "70%", height: 14, borderRadius: 4, background: "#ede9e1", marginBottom: 8 }} />
            <div style={{ width: "90%", height: 10, borderRadius: 4, background: "#ede9e1", marginBottom: 4 }} />
            <div style={{ width: "50%", height: 10, borderRadius: 4, background: "#ede9e1" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
