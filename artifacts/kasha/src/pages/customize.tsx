import { useState, useMemo, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const GOLD = "#B8925A";
const GOLD_LIGHT = "#D4A96A";
const BG = "#080A12";
const CARD = "#0F1622";
const CARD_2 = "#0D1220";
const BD = "rgba(255,255,255,0.08)";
const BD_GOLD = "rgba(184,146,90,0.3)";
const TX = "#ffffff";
const MUTED = "rgba(255,255,255,0.5)";
const MUTED_2 = "rgba(255,255,255,0.35)";

const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";

// ── Auth + API helpers ──────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    return clerk?.session ? await clerk.session.getToken() : null;
  } catch { return null; }
}
async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (!(opts?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

// ── Catalog ─────────────────────────────────────────────────────────────────
type ColorOpt = { hex: string; name: string };
const COLORS: ColorOpt[] = [
  { hex: "#1a1a1a", name: "Black" },
  { hex: "#FFFFFF", name: "White" },
  { hex: "#e8e0d8", name: "Cream" },
  { hex: "#d4c5a9", name: "Sand" },
  { hex: "#c9b89e", name: "Camel" },
  { hex: "#b5cfe8", name: "Sky" },
  { hex: "#378ADD", name: "Blue" },
  { hex: "#185FA5", name: "Navy" },
  { hex: "#4a7c59", name: "Forest" },
  { hex: "#97C459", name: "Lime" },
  { hex: "#E24B4A", name: "Red" },
  { hex: "#D85A30", name: "Rust" },
  { hex: "#D4537E", name: "Pink" },
  { hex: "#7F77DD", name: "Purple" },
  { hex: "#BA7517", name: "Amber" },
  { hex: "#888780", name: "Slate" },
];

type PrintDef = { id: string; label: string; bg: string };
const PRINTS: PrintDef[] = [
  { id: "floral",   label: "Floral",   bg: "repeating-linear-gradient(45deg,#f5e6d3,#f5e6d3 4px,#e8c9a0 4px,#e8c9a0 8px)" },
  { id: "abstract", label: "Abstract", bg: "repeating-radial-gradient(circle,#d4e8f5,#d4e8f5 3px,#a8d0ee 3px,#a8d0ee 6px)" },
  { id: "geo",      label: "Geo",      bg: "repeating-linear-gradient(90deg,#c8d8e8,#c8d8e8 8px,#8aaec8 8px,#8aaec8 9px)" },
  { id: "tropical", label: "Tropical", bg: "linear-gradient(135deg,#1a3a2e 0%,#2d5a3d 50%,#1a3a2e 100%)" },
  { id: "camo",     label: "Camo",     bg: "repeating-conic-gradient(#7a8c5a 0% 25%,#5c6e40 0% 50%)" },
  { id: "digital",  label: "Digital",  bg: "repeating-linear-gradient(0deg,#1a1a2e,#1a1a2e 5px,#16213e 5px,#16213e 10px)" },
  { id: "tiedye",   label: "Tie-dye",  bg: "linear-gradient(135deg,#D4537E 0%,#7F77DD 50%,#378ADD 100%)" },
];

type PatternDef = { id: string; label: string; bg: string };
const PATTERNS: PatternDef[] = [
  { id: "stripes",     label: "Stripes",     bg: "repeating-linear-gradient(0deg,#1a1a1a,#1a1a1a 4px,#fff 4px,#fff 12px)" },
  { id: "diagonal",    label: "Diagonal",    bg: "repeating-linear-gradient(45deg,#1a1a1a,#1a1a1a 2px,#fff 2px,#fff 10px)" },
  { id: "grid",        label: "Grid",        bg: "repeating-linear-gradient(0deg,transparent,transparent 8px,#999 8px,#999 9px),repeating-linear-gradient(90deg,transparent,transparent 8px,#999 8px,#999 9px)" },
  { id: "houndstooth", label: "Houndstooth", bg: "repeating-linear-gradient(45deg,transparent,transparent 5px,#999 5px,#999 6px),repeating-linear-gradient(-45deg,transparent,transparent 5px,#999 5px,#999 6px)" },
];

type Part = "collar" | "front" | "back" | "sleeves";
const PARTS: { id: Part; label: string }[] = [
  { id: "collar",  label: "Collar" },
  { id: "front",   label: "Front" },
  { id: "back",    label: "Back" },
  { id: "sleeves", label: "Sleeves" },
];

type Pos = "top-left"|"top-center"|"top-right"|"mid-left"|"center"|"mid-right"|"bot-left"|"bot-center"|"bot-right";
const POSITIONS: { id: Pos; label: string }[] = [
  { id: "top-left",   label: "↖" },
  { id: "top-center", label: "↑" },
  { id: "top-right",  label: "↗" },
  { id: "mid-left",   label: "←" },
  { id: "center",     label: "◉" },
  { id: "mid-right",  label: "→" },
  { id: "bot-left",   label: "↙" },
  { id: "bot-center", label: "↓" },
  { id: "bot-right",  label: "↘" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
type Size = typeof SIZES[number];
type StyleType = "solid" | "print" | "pattern";

const SIZE_CHART: { size: string; chest: string; shoulder: string; sleeve: string }[] = [
  { size: "XS", chest: "34–36″", shoulder: "16″",   sleeve: "8″"   },
  { size: "S",  chest: "36–38″", shoulder: "16.5″", sleeve: "8.5″" },
  { size: "M",  chest: "38–40″", shoulder: "17.5″", sleeve: "9″"   },
  { size: "L",  chest: "40–42″", shoulder: "18.5″", sleeve: "9.5″" },
  { size: "XL", chest: "42–44″", shoulder: "19.5″", sleeve: "10″"  },
  { size: "XXL",chest: "44–46″", shoulder: "20.5″", sleeve: "10.5″"},
];

// ── Product type ────────────────────────────────────────────────────────────
interface Product {
  id: number; name: string; description: string; category: string;
  priceInPaise: number; modelUrl: string; thumbnailUrl?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function colorName(hex: string): string {
  return COLORS.find(c => c.hex.toUpperCase() === hex.toUpperCase())?.name || hex.toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // Data
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => apiFetch(`/api/products/${id}`),
    enabled: id > 0,
  });

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1: Style
  const [styleType, setStyleType] = useState<StyleType>("solid");
  const [mainColor, setMainColor] = useState<string>("#1a1a1a");
  const [printId, setPrintId] = useState<string>("floral");
  const [patternId, setPatternId] = useState<string>("stripes");
  const [patternA, setPatternA] = useState<string>("#1a1a1a");
  const [patternB, setPatternB] = useState<string>("#FFFFFF");
  const [sleeveLen, setSleeveLen] = useState<"half" | "full">("half");

  // Step 2: Parts
  const [activePart, setActivePart] = useState<Part>("collar");
  const [partColors, setPartColors] = useState<Record<Part, string>>({
    collar: "#1a1a1a", front: "#1a1a1a", back: "#1a1a1a", sleeves: "#1a1a1a",
  });

  // Step 3: Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<Pos>("top-center");
  const [logoSize, setLogoSize] = useState<number>(50);

  // Step 4: Size
  const [size, setSize] = useState<Size>("S");
  const [showChart, setShowChart] = useState(false);
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customSize, setCustomSize] = useState({ chest: "", shoulder: "", hip: "", sleeve: "" });

  // Quantity
  const [qty, setQty] = useState(1);

  // ─── Apply main color (Step 1 solid) auto-paints all parts on first set ──
  const setSolidMain = (hex: string) => {
    setMainColor(hex);
    setPartColors({ collar: hex, front: hex, back: hex, sleeves: hex });
  };

  // ─── Apply current part color to all parts ─────────────────────────────
  const applyPartToAll = () => {
    const c = partColors[activePart];
    setPartColors({ collar: c, front: c, back: c, sleeves: c });
    toast({ title: "Applied", description: `${colorName(c)} applied to all parts` });
  };

  const setPartColor = (hex: string) => {
    setPartColors(p => ({ ...p, [activePart]: hex }));
  };

  // ─── Logo upload ───────────────────────────────────────────────────────
  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Logo must be under 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ─── Order mutation ────────────────────────────────────────────────────
  const orderMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to place an order");
      const customization = {
        styleType,
        mainColor: styleType === "solid" ? mainColor : undefined,
        printId: styleType === "print" ? printId : undefined,
        pattern: styleType === "pattern" ? { id: patternId, a: patternA, b: patternB } : undefined,
        sleeveLen,
        partColors,
        logo: logoUrl ? { dataUrl: logoUrl, position: logoPos, size: logoSize } : null,
        size: customEnabled ? "Custom" : size,
        customSize: customEnabled ? customSize : undefined,
      };
      const cust = await apiFetch("/api/customizations", {
        method: "POST",
        body: JSON.stringify({
          productId: id,
          name: `${product?.name || "Custom"} ${styleType}`,
          color: mainColor,
          size: customEnabled ? "Custom" : size,
          partsEnabled: { collar: true, front: true, back: true, sleeves: true },
          canvasData: JSON.stringify(customization),
          previewImageUrl: null,
        }),
      });
      return apiFetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId: id,
          customizationId: cust.id,
          quantity: qty,
          size: customEnabled ? "Custom" : size,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Added to cart", description: "Your custom design is in the cart." });
      setLocation("/cart");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ─── Style summary ─────────────────────────────────────────────────────
  const styleSummary = useMemo(() => {
    if (styleType === "solid") return `Solid · ${colorName(mainColor)}`;
    if (styleType === "print") return `Print · ${PRINTS.find(p => p.id === printId)?.label}`;
    return `Pattern · ${PATTERNS.find(p => p.id === patternId)?.label}`;
  }, [styleType, mainColor, printId, patternId]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div
            style={{
              width: 36, height: 36,
              border: `2px solid ${BD}`, borderTopColor: GOLD,
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center text-white/60">Product not found.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ background: BG, color: TX, fontFamily: FONT_UI }} className="min-h-[calc(100vh-64px)]">
        {/* Page header */}
        <div
          style={{
            background: CARD_2,
            borderBottom: `1px solid ${BD_GOLD}`,
            padding: "32px 24px",
          }}
        >
          <div className="max-w-[1200px] mx-auto flex items-end justify-between flex-wrap gap-4">
            <div>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 9,
                  letterSpacing: "0.4em",
                  color: GOLD,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Custom Studio
              </div>
              <h1
                className="text-white"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: "clamp(28px, 3.5vw, 42px)",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                }}
              >
                {product.name}
              </h1>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: GOLD,
                  marginTop: 6,
                }}
              >
                {formatPrice(product.priceInPaise)}
              </div>
            </div>
            <Link
              href={`/products/${id}`}
              style={{
                fontFamily: FONT_UI,
                fontSize: 10,
                letterSpacing: "0.28em",
                color: MUTED,
                textTransform: "uppercase",
                textDecoration: "none",
              }}
              className="hover:!text-white transition-colors"
            >
              ← Back to product
            </Link>
          </div>
        </div>

        {/* Wizard */}
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <Stepper step={step} setStep={setStep} />

          <div
            className="grid gap-6 mt-8"
            style={{ gridTemplateColumns: "minmax(0,1fr) 280px" }}
          >
            <div>
              {step === 1 && (
                <Step1Style
                  styleType={styleType} setStyleType={setStyleType}
                  mainColor={mainColor} setMainColor={setSolidMain}
                  printId={printId} setPrintId={setPrintId}
                  patternId={patternId} setPatternId={setPatternId}
                  patternA={patternA} setPatternA={setPatternA}
                  patternB={patternB} setPatternB={setPatternB}
                  sleeveLen={sleeveLen} setSleeveLen={setSleeveLen}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <Step2Parts
                  partColors={partColors} setPartColor={setPartColor}
                  activePart={activePart} setActivePart={setActivePart}
                  applyAll={applyPartToAll}
                  onBack={() => setStep(1)} onNext={() => setStep(3)}
                />
              )}
              {step === 3 && (
                <Step3Logo
                  logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                  logoPos={logoPos} setLogoPos={setLogoPos}
                  logoSize={logoSize} setLogoSize={setLogoSize}
                  fileRef={fileRef} onFile={onLogoFile}
                  onBack={() => setStep(2)} onNext={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <Step4Size
                  size={size} setSize={setSize}
                  showChart={showChart} setShowChart={setShowChart}
                  customEnabled={customEnabled} setCustomEnabled={setCustomEnabled}
                  customSize={customSize} setCustomSize={setCustomSize}
                  qty={qty} setQty={setQty}
                  onBack={() => setStep(3)}
                  onSubmit={() => orderMut.mutate()}
                  loading={orderMut.isPending}
                />
              )}
            </div>

            <PreviewPanel
              partColors={partColors}
              styleType={styleType}
              styleSummary={styleSummary}
              sleeveLen={sleeveLen}
              logoUrl={logoUrl}
              logoPos={logoPos}
              logoSize={logoSize}
              size={customEnabled ? "Custom" : size}
              printId={printId}
              patternId={patternId}
              patternA={patternA}
              patternB={patternB}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const labels = ["Style", "Parts", "Logo", "Size"];
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} className="flex items-center" style={{ flex: i === labels.length - 1 ? "0 0 auto" : "1 1 auto" }}>
            <button
              onClick={() => setStep(n)}
              className="flex items-center gap-2.5 transition-colors"
              style={{
                fontFamily: FONT_UI,
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: active ? GOLD : done ? "rgba(255,255,255,0.7)" : MUTED_2,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 12px",
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 500,
                  background: active ? GOLD : done ? "rgba(184,146,90,0.15)" : "transparent",
                  color: active ? "#fff" : done ? GOLD : MUTED_2,
                  border: active ? `1px solid ${GOLD}` : `1px solid ${done ? BD_GOLD : BD}`,
                  letterSpacing: 0,
                }}
              >
                {n}
              </span>
              <span>{label}</span>
            </button>
            {i < labels.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? BD_GOLD : BD,
                  minWidth: 24,
                  margin: "0 4px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Panel wrapper ──────────────────────────────────────────────────────────
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BD}`,
        borderRadius: 8,
        padding: "24px 26px",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-white"
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: 500,
        marginBottom: 14,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel, loading }: { onBack?: () => void; onNext: () => void; nextLabel: string; loading?: boolean }) {
  return (
    <div
      className="flex items-center justify-between mt-6 pt-5"
      style={{ borderTop: `1px solid ${BD}` }}
    >
      {onBack ? (
        <button
          onClick={onBack}
          style={{
            fontFamily: FONT_UI,
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: MUTED,
            background: "transparent",
            border: `1px solid ${BD}`,
            padding: "10px 18px",
            cursor: "pointer",
          }}
          className="hover:!text-white"
        >
          ← Back
        </button>
      ) : <span />}
      <button
        onClick={onNext}
        disabled={loading}
        style={{
          fontFamily: FONT_UI,
          fontSize: 10,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#fff",
          background: GOLD,
          border: "none",
          padding: "12px 24px",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
          fontWeight: 500,
        }}
        onMouseEnter={e => !loading && ((e.target as HTMLElement).style.background = GOLD_LIGHT)}
        onMouseLeave={e => !loading && ((e.target as HTMLElement).style.background = GOLD)}
      >
        {loading ? "Working…" : nextLabel}
      </button>
    </div>
  );
}

// ── Swatch ─────────────────────────────────────────────────────────────────
function Swatch({ color, selected, onClick, size = 32 }: { color: string; selected?: boolean; onClick?: () => void; size?: number }) {
  const isLight = ["#FFFFFF", "#e8e0d8", "#d4c5a9"].includes(color);
  return (
    <button
      onClick={onClick}
      title={colorName(color)}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color,
        border: selected ? `2px solid ${GOLD}` : isLight ? "1px solid rgba(255,255,255,0.2)" : "2px solid transparent",
        outline: selected ? `2px solid ${BG}` : "none",
        outlineOffset: -4,
        cursor: "pointer",
        padding: 0,
        transition: "transform .15s",
      }}
      className={selected ? "" : "hover:scale-110"}
    />
  );
}

// ── Step 1: Style ─────────────────────────────────────────────────────────
function Step1Style(p: {
  styleType: StyleType; setStyleType: (s: StyleType) => void;
  mainColor: string; setMainColor: (c: string) => void;
  printId: string; setPrintId: (id: string) => void;
  patternId: string; setPatternId: (id: string) => void;
  patternA: string; setPatternA: (c: string) => void;
  patternB: string; setPatternB: (c: string) => void;
  sleeveLen: "half" | "full"; setSleeveLen: (s: "half" | "full") => void;
  onNext: () => void;
}) {
  return (
    <Panel>
      <SectionTitle>Choose base style</SectionTitle>
      <TabRow
        options={[
          { id: "solid", label: "Solids" },
          { id: "print", label: "Prints" },
          { id: "pattern", label: "Patterns" },
        ]}
        active={p.styleType}
        onChange={(v) => p.setStyleType(v as StyleType)}
      />

      {p.styleType === "solid" && (
        <>
          <SubTitle>Pick a colour</SubTitle>
          <div className="grid grid-cols-8 gap-2 mb-3">
            {COLORS.map(c => (
              <Swatch key={c.hex} color={c.hex} selected={p.mainColor === c.hex} onClick={() => p.setMainColor(c.hex)} />
            ))}
          </div>
          <Note>You can override individual parts in Step 2.</Note>
        </>
      )}

      {p.styleType === "print" && (
        <>
          <SubTitle>Print library</SubTitle>
          <div className="grid grid-cols-4 gap-2.5 mb-3">
            {PRINTS.map(pr => (
              <button
                key={pr.id}
                onClick={() => p.setPrintId(pr.id)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 6,
                  border: p.printId === pr.id ? `2px solid ${GOLD}` : `1px solid ${BD}`,
                  background: pr.bg,
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  padding: "0 0 6px",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: "rgba(0,0,0,0.55)",
                    padding: "2px 6px",
                    borderRadius: 2,
                  }}
                >
                  {pr.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {p.styleType === "pattern" && (
        <>
          <SubTitle>Pattern type</SubTitle>
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {PATTERNS.map(pt => (
              <button
                key={pt.id}
                onClick={() => p.setPatternId(pt.id)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 6,
                  border: p.patternId === pt.id ? `2px solid ${GOLD}` : `1px solid ${BD}`,
                  background: pt.bg,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  padding: "0 0 6px",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: "rgba(0,0,0,0.55)",
                    padding: "2px 6px",
                    borderRadius: 2,
                  }}
                >
                  {pt.label}
                </span>
              </button>
            ))}
          </div>
          <Divider />
          <SubTitle>Pattern colours</SubTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <MicroLabel>Colour A</MicroLabel>
              <div className="grid grid-cols-6 gap-1.5">
                {COLORS.slice(0, 12).map(c => (
                  <Swatch key={c.hex} color={c.hex} selected={p.patternA === c.hex} onClick={() => p.setPatternA(c.hex)} size={26} />
                ))}
              </div>
            </div>
            <div>
              <MicroLabel>Colour B</MicroLabel>
              <div className="grid grid-cols-6 gap-1.5">
                {COLORS.slice(0, 12).map(c => (
                  <Swatch key={c.hex} color={c.hex} selected={p.patternB === c.hex} onClick={() => p.setPatternB(c.hex)} size={26} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <Divider />
      <SubTitle>Sleeve length</SubTitle>
      <div className="flex gap-2 mb-2">
        {(["half", "full"] as const).map(opt => {
          const on = p.sleeveLen === opt;
          return (
            <button
              key={opt}
              onClick={() => p.setSleeveLen(opt)}
              style={{
                flex: 1,
                padding: "11px 0",
                fontFamily: FONT_UI,
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                background: on ? GOLD : "transparent",
                color: on ? "#fff" : MUTED,
                border: on ? `1px solid ${GOLD}` : `1px solid ${BD}`,
                cursor: "pointer",
              }}
            >
              {opt} sleeve
            </button>
          );
        })}
      </div>

      <NavRow onNext={p.onNext} nextLabel="Next: Customise parts →" />
    </Panel>
  );
}

// ── Step 2: Parts ─────────────────────────────────────────────────────────
function Step2Parts(p: {
  partColors: Record<Part, string>; setPartColor: (c: string) => void;
  activePart: Part; setActivePart: (pt: Part) => void;
  applyAll: () => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <Panel>
      <SectionTitle>Customise individual parts</SectionTitle>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontFamily: FONT_UI, fontSize: 11, color: MUTED, letterSpacing: "0.05em" }}>
          Quick apply:
        </span>
        <button
          onClick={p.applyAll}
          style={{
            fontFamily: FONT_UI,
            fontSize: 9,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: GOLD,
            background: "transparent",
            border: `1px solid ${BD_GOLD}`,
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          Apply to all parts
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-5">
        {PARTS.map(part => {
          const selected = p.activePart === part.id;
          const col = p.partColors[part.id];
          return (
            <button
              key={part.id}
              onClick={() => p.setActivePart(part.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: selected ? "rgba(184,146,90,0.08)" : "transparent",
                border: selected ? `1px solid ${BD_GOLD}` : `1px solid ${BD}`,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: col,
                  border: "1px solid rgba(255,255,255,0.15)",
                  flexShrink: 0,
                }}
              />
              <span
                className="text-white flex-1"
                style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500 }}
              >
                {part.label}
              </span>
              <span
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: selected ? GOLD : MUTED,
                  border: `1px solid ${selected ? BD_GOLD : BD}`,
                  padding: "3px 8px",
                  borderRadius: 12,
                }}
              >
                {colorName(col)}
              </span>
              <span style={{ color: MUTED_2, fontSize: 14 }}>›</span>
            </button>
          );
        })}
      </div>

      <SubTitle>
        Colour for{" "}
        <span style={{ color: GOLD, fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
          {PARTS.find(pt => pt.id === p.activePart)?.label}
        </span>
      </SubTitle>
      <div className="grid grid-cols-8 gap-2">
        {COLORS.map(c => (
          <Swatch
            key={c.hex}
            color={c.hex}
            selected={p.partColors[p.activePart] === c.hex}
            onClick={() => p.setPartColor(c.hex)}
          />
        ))}
      </div>

      <NavRow onBack={p.onBack} onNext={p.onNext} nextLabel="Next: Add logo →" />
    </Panel>
  );
}

// ── Step 3: Logo ──────────────────────────────────────────────────────────
function Step3Logo(p: {
  logoUrl: string | null; setLogoUrl: (u: string | null) => void;
  logoPos: Pos; setLogoPos: (pos: Pos) => void;
  logoSize: number; setLogoSize: (n: number) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <Panel>
      <SectionTitle>
        Upload your logo{" "}
        <span style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED_2, fontWeight: 400 }}>
          (optional)
        </span>
      </SectionTitle>
      <input ref={p.fileRef} type="file" accept="image/*" onChange={p.onFile} className="hidden" />
      <button
        onClick={() => p.fileRef.current?.click()}
        style={{
          width: "100%",
          border: `1px dashed ${BD_GOLD}`,
          background: "rgba(184,146,90,0.04)",
          padding: "30px 20px",
          textAlign: "center",
          cursor: "pointer",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 32, color: GOLD, marginBottom: 8 }}>↑</div>
        <div style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: TX, marginBottom: 4 }}>
          Click to upload
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: 10, color: MUTED, letterSpacing: "0.05em" }}>
          PNG, SVG, or JPG · max 5 MB · transparent bg recommended
        </div>
      </button>

      <div
        style={{
          width: "100%",
          aspectRatio: "2",
          background: CARD_2,
          border: `1px solid ${BD}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="Logo preview" style={{ maxHeight: "85%", maxWidth: "85%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontFamily: FONT_UI, fontSize: 10, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Logo preview will appear here
          </span>
        )}
        {p.logoUrl && (
          <button
            onClick={() => p.setLogoUrl(null)}
            style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff", border: `1px solid ${BD}`,
              fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.2em",
              textTransform: "uppercase", padding: "3px 8px", cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
      </div>

      <SubTitle>Logo position</SubTitle>
      <div className="grid grid-cols-3 gap-1.5 mb-5" style={{ maxWidth: 160 }}>
        {POSITIONS.map(po => {
          const on = p.logoPos === po.id;
          return (
            <button
              key={po.id}
              onClick={() => p.setLogoPos(po.id)}
              style={{
                aspectRatio: "1",
                background: on ? "rgba(184,146,90,0.15)" : "transparent",
                border: on ? `1px solid ${GOLD}` : `1px solid ${BD}`,
                color: on ? GOLD : MUTED,
                fontSize: 14,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {po.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="flex justify-between mb-2" style={{ fontFamily: FONT_UI, fontSize: 11, color: MUTED, letterSpacing: "0.05em" }}>
          <span>Logo size</span>
          <span style={{ color: GOLD }}>{p.logoSize}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={p.logoSize}
          onChange={e => p.setLogoSize(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: GOLD }}
        />
      </div>

      <NavRow onBack={p.onBack} onNext={p.onNext} nextLabel="Next: Size →" />
    </Panel>
  );
}

// ── Step 4: Size ──────────────────────────────────────────────────────────
function Step4Size(p: {
  size: Size; setSize: (s: Size) => void;
  showChart: boolean; setShowChart: (b: boolean) => void;
  customEnabled: boolean; setCustomEnabled: (b: boolean) => void;
  customSize: { chest: string; shoulder: string; hip: string; sleeve: string };
  setCustomSize: (cs: any) => void;
  qty: number; setQty: (n: number) => void;
  onBack: () => void; onSubmit: () => void; loading: boolean;
}) {
  return (
    <Panel>
      <SectionTitle>Choose your size</SectionTitle>
      <div className="flex gap-2 flex-wrap mb-3">
        {SIZES.map(s => {
          const on = p.size === s && !p.customEnabled;
          return (
            <button
              key={s}
              disabled={p.customEnabled}
              onClick={() => p.setSize(s)}
              style={{
                width: 48, height: 48,
                background: on ? GOLD : "transparent",
                color: on ? "#fff" : p.customEnabled ? MUTED_2 : MUTED,
                border: on ? `1px solid ${GOLD}` : `1px solid ${BD}`,
                fontFamily: FONT_UI,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                cursor: p.customEnabled ? "not-allowed" : "pointer",
                opacity: p.customEnabled ? 0.4 : 1,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      <Note>
        Standard sizes are based on chest circumference —{" "}
        <button
          onClick={() => p.setShowChart(!p.showChart)}
          style={{ background: "none", border: "none", color: GOLD, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}
        >
          {p.showChart ? "hide chart" : "view size chart"}
        </button>
      </Note>

      {p.showChart && (
        <div style={{ marginTop: 12, border: `1px solid ${BD}`, borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", fontFamily: FONT_UI }}>
            <thead>
              <tr style={{ background: CARD_2 }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9 }}>Size</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: MUTED, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9 }}>Chest</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: MUTED, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9 }}>Shoulder</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: MUTED, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9 }}>Sleeve</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map(row => (
                <tr key={row.size} style={{ borderTop: `1px solid ${BD}`, color: TX }}>
                  <td style={{ padding: "8px 12px", color: GOLD, letterSpacing: "0.1em" }}>{row.size}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.chest}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.shoulder}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Divider />

      <div className="flex items-center justify-between mb-3">
        <SubTitle>Custom measurements</SubTitle>
        <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
          <input
            type="checkbox"
            checked={p.customEnabled}
            onChange={e => p.setCustomEnabled(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: GOLD }}
          />
          Enable
        </label>
      </div>
      <div style={{ opacity: p.customEnabled ? 1 : 0.4, pointerEvents: p.customEnabled ? "auto" : "none" }}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { key: "chest" as const, label: "Chest (in)" },
            { key: "shoulder" as const, label: "Shoulder (in)" },
            { key: "hip" as const, label: "Hip (in)" },
            { key: "sleeve" as const, label: "Sleeve (in)" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: 5 }}>
                {f.label}
              </label>
              <input
                type="number"
                value={p.customSize[f.key]}
                onChange={e => p.setCustomSize({ ...p.customSize, [f.key]: e.target.value })}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: CARD_2,
                  border: `1px solid ${BD}`,
                  borderRadius: 4,
                  color: TX,
                  fontFamily: FONT_UI,
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>
        <Note>Measure over a well-fitting garment. Custom orders may take 2–3 extra days.</Note>
      </div>

      <Divider />

      <SubTitle>Quantity</SubTitle>
      <div className="flex items-center gap-3">
        <button
          onClick={() => p.setQty(Math.max(1, p.qty - 1))}
          style={{ width: 36, height: 36, background: "transparent", border: `1px solid ${BD}`, color: TX, cursor: "pointer", fontSize: 16 }}
        >−</button>
        <span style={{ minWidth: 32, textAlign: "center", fontFamily: FONT_DISPLAY, fontSize: 18 }}>{p.qty}</span>
        <button
          onClick={() => p.setQty(p.qty + 1)}
          style={{ width: 36, height: 36, background: "transparent", border: `1px solid ${BD}`, color: TX, cursor: "pointer", fontSize: 16 }}
        >+</button>
      </div>

      <Show when="signed-out">
        <div
          className="mt-5 p-3"
          style={{
            background: "rgba(184,146,90,0.08)",
            border: `1px solid ${BD_GOLD}`,
            fontFamily: FONT_UI,
            fontSize: 11,
            color: TX,
            letterSpacing: "0.05em",
          }}
        >
          <Link href="/sign-in" style={{ color: GOLD, textDecoration: "underline" }}>Sign in</Link> to place your order.
        </div>
      </Show>

      <NavRow onBack={p.onBack} onNext={p.onSubmit} nextLabel={p.loading ? "Adding…" : "Add to cart →"} loading={p.loading} />
    </Panel>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function TabRow({ options, active, onChange }: { options: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div
      className="flex mb-5"
      style={{ border: `1px solid ${BD}`, borderRadius: 6, overflow: "hidden" }}
    >
      {options.map(o => {
        const on = active === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              fontFamily: FONT_UI,
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: on ? "#fff" : MUTED,
              background: on ? GOLD : "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: on ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_UI,
        fontSize: 9,
        letterSpacing: "0.35em",
        textTransform: "uppercase",
        color: GOLD,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_UI,
        fontSize: 9,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        color: MUTED,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.05em", color: MUTED_2, marginTop: 8, lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function Divider() {
  return <hr style={{ border: "none", borderTop: `1px solid ${BD}`, margin: "20px 0" }} />;
}

// ── Preview Panel (right side) ─────────────────────────────────────────────
function PreviewPanel(p: {
  partColors: Record<Part, string>;
  styleType: StyleType;
  styleSummary: string;
  sleeveLen: "half" | "full";
  logoUrl: string | null;
  logoPos: Pos;
  logoSize: number;
  size: string;
  printId: string;
  patternId: string;
  patternA: string;
  patternB: string;
}) {
  const isPattern = p.styleType === "pattern";
  const isPrint = p.styleType === "print";

  // Logo positions on shirt body (within front rect 58,58 to 142,192)
  const POS_COORDS: Record<Pos, { x: number; y: number }> = {
    "top-left":   { x: 70,  y: 75  },
    "top-center": { x: 100, y: 75  },
    "top-right":  { x: 130, y: 75  },
    "mid-left":   { x: 70,  y: 125 },
    "center":     { x: 100, y: 125 },
    "mid-right":  { x: 130, y: 125 },
    "bot-left":   { x: 70,  y: 175 },
    "bot-center": { x: 100, y: 175 },
    "bot-right":  { x: 130, y: 175 },
  };
  const logoCoord = POS_COORDS[p.logoPos];
  const logoBoxW = 40 * (p.logoSize / 50);
  const logoBoxH = 28 * (p.logoSize / 50);

  const patternFill = isPattern
    ? (p.patternId === "stripes"
        ? `repeating-linear-gradient(0deg,${p.patternA} 0,${p.patternA} 4px,${p.patternB} 4px,${p.patternB} 12px)`
        : p.patternId === "diagonal"
        ? `repeating-linear-gradient(45deg,${p.patternA} 0,${p.patternA} 2px,${p.patternB} 2px,${p.patternB} 10px)`
        : p.patternId === "grid"
        ? `${p.patternB}` : `${p.patternA}`)
    : null;

  const printDef = PRINTS.find(pr => pr.id === p.printId);

  return (
    <div
      style={{
        background: CARD_2,
        border: `1px solid ${BD}`,
        borderRadius: 8,
        padding: "20px 22px",
        position: "sticky",
        top: 80,
        alignSelf: "start",
      }}
    >
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 9,
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          color: GOLD,
          marginBottom: 14,
        }}
      >
        Live Preview
      </div>

      {/* Shirt SVG — 200×230 */}
      <div style={{ position: "relative", width: "100%", maxWidth: 220, margin: "0 auto" }}>
        <svg viewBox="0 0 200 230" style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            {isPrint && printDef && (
              <pattern id="bodyFill" patternUnits="userSpaceOnUse" width="20" height="20">
                <rect width="20" height="20" fill="#1a1a1a" />
              </pattern>
            )}
          </defs>
          {/* Right sleeve */}
          <path
            d={p.sleeveLen === "half"
              ? "M55 40 L25 60 L35 80 L62 68 Z"
              : "M55 40 L20 65 L30 100 L62 86 Z"}
            fill={p.partColors.sleeves}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.6"
          />
          {/* Left sleeve */}
          <path
            d={p.sleeveLen === "half"
              ? "M145 40 L175 60 L165 80 L138 68 Z"
              : "M145 40 L180 65 L170 100 L138 86 Z"}
            fill={p.partColors.sleeves}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.6"
          />
          {/* Back */}
          <rect x="55" y="55" width="90" height="140" rx="3" fill={p.partColors.back} stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
          {/* Front */}
          <rect x="58" y="58" width="84" height="134" rx="3" fill={p.partColors.front} stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
          {/* Collar */}
          <path
            d="M88 38 Q100 50 112 38 L115 55 Q100 70 85 55 Z"
            fill={p.partColors.collar}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.6"
          />
          {/* Logo placement box */}
          {p.logoUrl && (
            <image
              href={p.logoUrl}
              x={logoCoord.x - logoBoxW / 2}
              y={logoCoord.y - logoBoxH / 2}
              width={logoBoxW}
              height={logoBoxH}
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
        {/* Print/pattern overlay on front body */}
        {(isPrint || isPattern) && (
          <div
            style={{
              position: "absolute",
              left: `${(58 / 200) * 100}%`,
              top: `${(58 / 230) * 100}%`,
              width: `${(84 / 200) * 100}%`,
              height: `${(134 / 230) * 100}%`,
              borderRadius: 3,
              background: isPrint ? printDef?.bg : patternFill || undefined,
              opacity: 0.92,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <Divider />
      <div className="flex flex-col gap-2.5">
        {[
          { label: "Style", val: p.styleSummary },
          { label: "Sleeve", val: p.sleeveLen === "half" ? "Half" : "Full" },
          { label: "Logo", val: p.logoUrl ? "Uploaded" : "None" },
          { label: "Size", val: p.size },
        ].map(row => (
          <div key={row.label} className="flex justify-between items-center" style={{ fontFamily: FONT_UI, fontSize: 11 }}>
            <span style={{ color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9 }}>
              {row.label}
            </span>
            <span
              style={{
                color: TX,
                background: "rgba(184,146,90,0.1)",
                border: `1px solid ${BD_GOLD}`,
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              {row.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
