/**
 * Custom Studio Landing Page
 * Gender + Category selector before entering the 3D customisation studio.
 * Matches the reference design at attached_assets/kasha_custom_studio_category_select_(3)_…html
 */
import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { getAssetUrl } from "@/lib/api";
import { parseSku } from "@/components/3d/sku-config";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const SAND      = "#f5f3ef";
const NAVY      = "#0f1622";
const GOLD      = "#B8925A";
const WARM_GREY = "#c8c4bc";
const MID       = "#888";
const TEXT      = "#3a3a3a";
const CREAM     = "#eceae4";
const WHITE     = "#ffffff";

// ─── Category definitions ─────────────────────────────────────────────────────
type CatType = "tshirt" | "model" | "model-fit";

interface CategoryDef {
  id: string;
  name: string;
  type: CatType;
  icon: React.ReactNode;
  subtitle: string;
  stepTitle: string;
  stepSub: string;
  /** Only for model/model-fit */
  modelItems?: Array<{ name: string; features: string }>;
  fits?: string[];
}

const TShirtIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 46, height: 46 }}>
    <path d="M35 12 L15 28 L8 42 L22 48 L22 90 L78 90 L78 48 L92 42 L85 28 L65 12 L58 20 Q50 26 42 20 Z" />
  </svg>
);
const PantsIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 46, height: 46 }}>
    <path d="M28 10 H72 L75 42 L82 90 L64 90 L54 46 L46 90 L28 90 L35 42 Z" />
    <path d="M28 10 H72" />
  </svg>
);
const ShortsIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 46, height: 46 }}>
    <path d="M28 10 H72 L76 55 L88 90 H68 L58 58 L50 58 L40 90 H20 L32 55 Z" />
  </svg>
);
const SkortIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 46, height: 46 }}>
    <path d="M22 10 H78 L88 62 H12 Z" />
    <path d="M35 62 L28 90 M65 62 L72 90 M50 62 L50 90" />
  </svg>
);
const DressIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 46, height: 46 }}>
    <path d="M38 10 L28 26 L18 92 H82 L72 26 L62 10 L54 18 Q50 22 46 18 Z" />
  </svg>
);

const MEN_CATEGORIES: CategoryDef[] = [
  {
    id: "mt", name: "T-Shirts", type: "tshirt",
    icon: <TShirtIcon />,
    subtitle: "Patterns, solids & prints",
    stepTitle: "Choose your style",
    stepSub: "Every style can be recoloured, printed with your own artwork, or Pantone-matched in the next step.",
  },
  {
    id: "mp", name: "Pants", type: "model-fit",
    icon: <PantsIcon />,
    subtitle: "3 models",
    stepTitle: "Choose your pant model",
    stepSub: "Pick a model, then select the fit or fits you want us to prepare for review.",
    modelItems: [
      { name: "Pro Tour Trouser",    features: "Zip-off legs · Gripper waist · 3-slot tee holder" },
      { name: "Classic Chino Trouser", features: "Fixed leg · Gripper waist · Flat front" },
      { name: "Tapered Jogger",      features: "Elastic cuff · Gripper waist · Zip pocket" },
    ],
    fits: ["Athletic", "Classic", "Relaxed"],
  },
  {
    id: "ms", name: "Shorts", type: "model",
    icon: <ShortsIcon />,
    subtitle: "3 models",
    stepTitle: "Choose your shorts model",
    stepSub: "Pick a silhouette. Fit and length details follow in the next step.",
    modelItems: [
      { name: "Tour Short",          features: "9\" inseam · Ball pocket · 4-way stretch" },
      { name: "Classic Short",       features: "7\" inseam · Flat front · Moisture-wicking" },
      { name: "Performance Short",   features: "8\" inseam · Zip pocket · UV 40+" },
    ],
  },
];

const WOMEN_CATEGORIES: CategoryDef[] = [
  {
    id: "wt", name: "T-Shirts", type: "tshirt",
    icon: <TShirtIcon />,
    subtitle: "Patterns, solids & prints",
    stepTitle: "Choose your style",
    stepSub: "Every style can be recoloured, printed with your own artwork, or Pantone-matched in the next step.",
  },
  {
    id: "ws", name: "Shorts", type: "model",
    icon: <ShortsIcon />,
    subtitle: "2 models",
    stepTitle: "Choose your shorts model",
    stepSub: "Pick a silhouette. Fit and length details follow in the next step.",
    modelItems: [
      { name: "Tour Short",    features: "7\" inseam · Ball pocket · 4-way stretch" },
      { name: "Classic Short", features: "6\" inseam · Flat front · Moisture-wicking" },
    ],
  },
  {
    id: "wk", name: "Skorts", type: "model",
    icon: <SkortIcon />,
    subtitle: "2 models",
    stepTitle: "Choose your skort model",
    stepSub: "Pick a silhouette. Fit and length details follow in the next step.",
    modelItems: [
      { name: "Pro Tour Skort", features: "Inner shorts panel · Gripper waist · Full swing range" },
      { name: "Pleated Skort",  features: "Inner shorts panel · Box pleat · Clubhouse finish" },
    ],
  },
  {
    id: "wd", name: "Dress", type: "model",
    icon: <DressIcon />,
    subtitle: "2 models",
    stepTitle: "Choose your dress model",
    stepSub: "Pick a silhouette. Fit and length details follow in the next step.",
    modelItems: [
      { name: "Classic Golf Dress", features: "Inner shorts panel · Sleeveless · UV 40+" },
      { name: "Wrap Golf Dress",    features: "Inner shorts panel · Wrap front · 4-way stretch" },
    ],
  },
  {
    id: "wp", name: "Pants", type: "model-fit",
    icon: <PantsIcon />,
    subtitle: "2 models",
    stepTitle: "Choose your pant model",
    stepSub: "Pick a model, then select the fit or fits you want us to prepare for review.",
    modelItems: [
      { name: "Pro Tour Trouser", features: "Zip-off legs · Gripper waist · 3-slot tee holder" },
      { name: "Cropped Trouser",  features: "Ankle length · Gripper waist · Flat front" },
    ],
    fits: ["Athletic", "Classic", "Relaxed"],
  },
];

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Category" },
    { n: 2, label: "Style" },
    { n: 3, label: "Customise" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 24px 0", maxWidth: 640, margin: "0 auto" }}>
      {steps.map((s, i) => {
        const done   = s.n < step;
        const active = s.n === step;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: i > 0 ? 0 : undefined }}>
            {i > 0 && <div style={{ width: 36, height: 1, background: WARM_GREY, margin: "0 8px" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: done ? GOLD : active ? NAVY : MID, opacity: done || active ? 1 : 0.5 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: `1px solid ${done ? GOLD : active ? NAVY : WARM_GREY}`,
                background: done ? GOLD : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: done ? WHITE : active ? NAVY : MID,
              }}>
                {done ? "✓" : s.n}
              </div>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────
function CategoryCard({ cat, onClick }: { cat: CategoryDef; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: WHITE, border: `1px solid ${hovered ? GOLD : WARM_GREY}`,
        padding: "30px 20px 24px", textAlign: "center", cursor: "pointer",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 10px 24px rgba(15,22,34,0.08)" : "none",
        position: "relative",
      }}
    >
      <div style={{ color: hovered ? GOLD : NAVY, transition: "color 0.25s", margin: "0 auto 16px", display: "flex", justifyContent: "center" }}>
        {cat.icon}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: NAVY, marginBottom: 6 }}>{cat.name}</div>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: MID }}>{cat.subtitle}</div>
    </div>
  );
}

// ─── Product tile (T-Shirts step 2) ──────────────────────────────────────────
interface ProductTile {
  id: number;
  sku: string;
  name: string;
  thumbnail: string;
  label: string;
}

function TileCard({ tile, selected, onSelect }: { tile: ProductTile; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
        border: `1.5px solid ${selected ? GOLD : hovered ? GOLD : WARM_GREY}`,
        background: selected ? CREAM : WHITE,
        transition: "all 0.25s",
        transform: hovered && !selected ? "translateY(-3px)" : "none",
        boxShadow: selected ? `0 0 0 1px ${GOLD}` : hovered ? "0 10px 24px rgba(15,22,34,0.08)" : "none",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Thumbnail */}
      <div style={{ background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "4/3", position: "relative", overflow: "hidden" }}>
        {tile.thumbnail ? (
          <img src={tile.thumbnail} alt={tile.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
        ) : (
          <TShirtIcon />
        )}
        {selected && (
          <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", background: GOLD, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>{tile.label}</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: NAVY, lineHeight: 1.3 }}>
          {tile.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "").replace(/\s*–\s*(men|women|kids)s?\s*$/i, "")}
        </div>
      </div>
    </button>
  );
}

// ─── Model card (non-tshirt step 2) ──────────────────────────────────────────
function ModelCard({ item, icon, selected, onSelect }: { item: { name: string; features: string }; icon: React.ReactNode; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: WHITE, border: `1.5px solid ${selected ? GOLD : hovered ? GOLD : WARM_GREY}`,
        cursor: "pointer", overflow: "hidden", transition: "all 0.25s",
        boxShadow: selected ? `0 0 0 1px ${GOLD}` : "none",
      }}
    >
      <div style={{ height: 150, background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", color: selected ? GOLD : NAVY }}>
        {icon}
        <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", border: `1px solid ${selected ? GOLD : WARM_GREY}`, background: selected ? GOLD : WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: selected ? WHITE : "transparent" }}>✓</div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 4 }}>{item.name}</div>
        <div style={{ fontSize: 10.5, color: MID, lineHeight: 1.5 }}>{item.features}</div>
        <div style={{ marginTop: 10, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Coming Soon</div>
      </div>
    </div>
  );
}

// ─── T-Shirt loading skeleton ─────────────────────────────────────────────────
function TilesSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ border: `1px solid ${WARM_GREY}`, overflow: "hidden", animation: `csLandPulse 1.4s ease-in-out ${i * 0.15}s infinite` }}>
          <div style={{ aspectRatio: "4/3", background: CREAM }} />
          <div style={{ padding: "14px 16px 16px" }}>
            <div style={{ width: "40%", height: 10, borderRadius: 4, background: CREAM, marginBottom: 8 }} />
            <div style={{ width: "75%", height: 13, borderRadius: 4, background: CREAM }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CustomStudioLanding() {
  const [, navigate]      = useLocation();
  const [gender, setGender]   = useState<"men" | "women">("men");
  const [step, setStep]       = useState<1 | 2>(1);
  const [activeCat, setActiveCat] = useState<CategoryDef | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductTile | null>(null);
  const [selectedModelIdx, setSelectedModelIdx] = useState<number | null>(null);
  const [selectedFits, setSelectedFits]         = useState<Set<string>>(new Set());

  const categories = gender === "men" ? MEN_CATEGORIES : WOMEN_CATEGORIES;

  // Fetch products for T-Shirt tile grid
  const { data: allProducts, isLoading } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );

  // Derive T-Shirt tiles from live products
  const tshirtTiles: ProductTile[] = (allProducts ?? [])
    .filter(p => p.available)
    .map(p => {
      const parsed = parseSku(p.sku ?? "");
      let label = "Pattern";
      if (parsed.type === "solid")   label = "Solid";
      else if (parsed.type === "print")   label = "Print";
      else if (parsed.type === "pattern") label = "Pattern";
      return { id: p.id, sku: p.sku ?? "", name: p.name, thumbnail: getAssetUrl(p.thumbnailUrl) ?? "", label };
    });

  const openCategory = useCallback((cat: CategoryDef) => {
    setActiveCat(cat);
    setSelectedProduct(null);
    setSelectedModelIdx(null);
    setSelectedFits(new Set());
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const backToCategories = useCallback(() => {
    setStep(1);
    setActiveCat(null);
    setSelectedProduct(null);
    setSelectedModelIdx(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleGenderChange = (g: "men" | "women") => {
    setGender(g);
    if (step === 2) {
      setStep(1);
      setActiveCat(null);
      setSelectedProduct(null);
      setSelectedModelIdx(null);
    }
  };

  // Build the customize URL from a selected product
  function buildCustomizeUrl(tile: ProductTile): string {
    const parsed = parseSku(tile.sku);
    const base = `/products/${tile.id}/customize?entry=1&from=landing`;
    if (parsed.type === "pattern") return `${base}&style=pattern&design=${encodeURIComponent(tile.sku)}`;
    if (parsed.type === "print")   return `${base}&style=print&design=${encodeURIComponent(tile.sku)}`;
    return `${base}&style=solid&design=${encodeURIComponent(tile.sku)}`;
  }

  const canContinue = activeCat?.type === "tshirt"
    ? selectedProduct !== null
    : selectedModelIdx !== null && (activeCat?.type !== "model-fit" || selectedFits.size > 0);

  const footerText = activeCat?.type === "tshirt" && selectedProduct
    ? `${gender === "men" ? "Men" : "Women"} · T-Shirts · ${selectedProduct.label} — ${selectedProduct.name.replace(/\s*\[gt:GT\d+\]\s*$/i, "")}`
    : selectedModelIdx !== null && activeCat
      ? `${gender === "men" ? "Men" : "Women"} · ${activeCat.name} · ${activeCat.modelItems![selectedModelIdx].name}`
      : "—";

  function handleContinue() {
    if (activeCat?.type === "tshirt" && selectedProduct) {
      navigate(buildCustomizeUrl(selectedProduct));
    }
    // For non-tshirt "coming soon" categories nothing happens (button is disabled)
  }

  // Toggle fit checkbox
  function toggleFit(f: string) {
    setSelectedFits(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  const eyebrow = activeCat ? `${gender === "men" ? "Men" : "Women"} · ${activeCat.name}` : "";

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", background: SAND, color: NAVY, minHeight: "100vh" }}>

      {/* ── Top bar ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(245,243,239,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `0.5px solid ${WARM_GREY}`, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, letterSpacing: "0.28em", color: NAVY, textDecoration: "none" }}>
          KA<span style={{ color: GOLD }}>·</span>SHA
        </Link>
        <Link href="/products" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: NAVY, opacity: 0.65, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = "0.65"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Exit Custom Studio
        </Link>
      </div>

      {/* ── Progress ── */}
      <ProgressBar step={step === 1 ? 1 : 2} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <>
          {/* Header */}
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "38px 24px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>Custom Studio</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 34, lineHeight: 1.15, color: NAVY }}>What are we<br />building today?</div>
            <div style={{ fontSize: 13, color: MID, marginTop: 10, lineHeight: 1.5 }}>Choose a gender and a category. Every piece is yours to configure — from one to five hundred.</div>
          </div>

          {/* Gender tabs */}
          <div style={{ maxWidth: 360, margin: "28px auto 0", display: "flex", border: `1px solid ${NAVY}`, borderRadius: 2, overflow: "hidden" }}>
            {(["men", "women"] as const).map(g => (
              <button key={g} onClick={() => handleGenderChange(g)}
                style={{ flex: 1, textAlign: "center", padding: "13px 0", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", background: gender === g ? NAVY : "transparent", color: gender === g ? WHITE : NAVY, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.25s" }}
              >
                {g === "men" ? "Men" : "Women"}
              </button>
            ))}
          </div>

          {/* Category grid */}
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 120px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 18 }}>
              {categories.map(cat => (
                <CategoryCard key={cat.id} cat={cat} onClick={() => openCategory(cat)} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && activeCat && (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "34px 24px 120px" }}>

          {/* Back link */}
          <button onClick={backToCategories}
            style={{ all: "unset", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: MID, cursor: "pointer", marginBottom: 22, fontFamily: "inherit" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = NAVY}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = MID}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Back to categories
          </button>

          {/* Sub-header */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>{eyebrow}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 28, lineHeight: 1.15, color: NAVY, marginBottom: 8 }}>{activeCat.stepTitle}</div>
            <div style={{ fontSize: 13, color: MID, lineHeight: 1.5 }}>{activeCat.stepSub}</div>
          </div>

          {/* T-Shirts: real product tiles */}
          {activeCat.type === "tshirt" && (
            isLoading ? <TilesSkeleton /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                {tshirtTiles.map(tile => (
                  <TileCard key={tile.id} tile={tile} selected={selectedProduct?.id === tile.id}
                    onSelect={() => setSelectedProduct(tile)} />
                ))}
                {tshirtTiles.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: MID, fontSize: 13 }}>
                    No styles available at the moment.
                  </div>
                )}
              </div>
            )
          )}

          {/* Model / Model-fit categories */}
          {(activeCat.type === "model" || activeCat.type === "model-fit") && activeCat.modelItems && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 8 }}>
                {activeCat.modelItems.map((m, i) => (
                  <ModelCard key={i} item={m} icon={activeCat.icon} selected={selectedModelIdx === i}
                    onSelect={() => setSelectedModelIdx(i)} />
                ))}
              </div>

              {/* Fit selector for model-fit categories */}
              {activeCat.type === "model-fit" && activeCat.fits && (
                <div style={{ marginTop: 32, paddingTop: 26, borderTop: `1px solid ${WARM_GREY}` }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: NAVY, marginBottom: 4 }}>Fit</div>
                  <div style={{ fontSize: 11, color: MID, marginBottom: 16 }}>Select one or more fits — Athletic, Classic and Relaxed are each a distinct cut, not a size adjustment.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {activeCat.fits.map(f => {
                      const checked = selectedFits.has(f);
                      return (
                        <div key={f} onClick={() => toggleFit(f)}
                          style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${checked ? GOLD : WARM_GREY}`, padding: "11px 18px", cursor: "pointer", fontSize: 12, color: TEXT, background: checked ? CREAM : WHITE, transition: "all 0.2s" }}
                        >
                          <div style={{ width: 15, height: 15, border: `1px solid ${checked ? GOLD : MID}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: checked ? GOLD : WHITE, color: checked ? WHITE : "transparent" }}>✓</div>
                          {f} Fit
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Sticky footer CTA ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
        background: NAVY, color: WHITE,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        transform: canContinue ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.3s ease",
      }}>
        <div style={{ fontSize: 11.5, letterSpacing: "0.03em", opacity: 0.85 }}>
          Selected: <b style={{ color: GOLD, fontWeight: 500 }}>{footerText}</b>
        </div>
        <button
          onClick={handleContinue}
          disabled={!canContinue || (activeCat?.type !== "tshirt")}
          style={{
            background: activeCat?.type === "tshirt" ? GOLD : MID,
            color: WHITE, border: "none",
            padding: "13px 28px", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase",
            cursor: activeCat?.type === "tshirt" ? "pointer" : "default",
            fontFamily: "inherit", transition: "opacity 0.2s",
            opacity: !canContinue ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (activeCat?.type === "tshirt") (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = !canContinue ? "0.7" : "1"; }}
        >
          {activeCat?.type === "tshirt" ? "Continue to Customisation →" : "Coming Soon"}
        </button>
      </div>

      <style>{`
        @keyframes csLandPulse { 0%,100%{opacity:.5} 50%{opacity:.85} }
      `}</style>
    </div>
  );
}
