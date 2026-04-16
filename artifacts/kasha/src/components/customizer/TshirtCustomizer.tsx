import { useRef, useState, useEffect, useCallback } from "react";
import * as fabric from "fabric";

export type SleeveType = "half" | "full" | "none";
export type CollarType = "round" | "polo" | "vneck";

export interface TshirtConfig {
  color: string;
  sleeves: SleeveType;
  collar: CollarType;
  size: string;
}

interface TshirtCustomizerProps {
  productId: number;
  productName: string;
  onSaveAndAddToCart: (config: TshirtConfig, previewUrl: string, designName: string) => void;
  isSaving?: boolean;
}

const PRESET_COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "Navy", hex: "#1D2B45" },
  { name: "Sky Blue", hex: "#7EC8E3" },
  { name: "Red", hex: "#C0392B" },
  { name: "Forest", hex: "#2D6A4F" },
  { name: "Burgundy", hex: "#6B2737" },
  { name: "Olive", hex: "#4A5240" },
  { name: "Beige", hex: "#D4C5B9" },
  { name: "Lavender", hex: "#9B89C4" },
  { name: "Coral", hex: "#E8735A" },
  { name: "Mustard", hex: "#C9A84C" },
];

const FONT_OPTIONS = ["Arial", "Georgia", "Impact", "Courier New", "Trebuchet MS", "Times New Roman"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

// --- SVG T-shirt path builder ---
// ViewBox: 0 0 440 540
// Key anchors: collar-left(100,80) collar-right(340,80) armpit-left(100,205) armpit-right(340,205) hem-left(80,510) hem-right(360,510)

function getTshirtPath(sleeves: SleeveType, collar: CollarType): string {
  const necklines: Record<CollarType, string> = {
    round: "Q 220,152 340,80",
    vneck: "L 220,182 L 340,80",
    polo:  "Q 220,148 340,80",
  };

  const rightSleeves: Record<SleeveType, string> = {
    none: "L 340,190",
    half: "L 422,80 L 422,205 L 340,205",
    full: "L 435,108 L 440,420 L 355,420 L 340,205",
  };

  const leftSleeves: Record<SleeveType, string> = {
    none: "",
    half: "L 18,205 L 18,80",
    full: "L 85,420 L 0,420 L 5,108",
  };

  const n = necklines[collar];
  const rs = rightSleeves[sleeves];
  const ls = leftSleeves[sleeves];

  return `M 100,80 ${n} ${rs} L 360,510 L 80,510 L 100,205 ${ls} Z`;
}

function getShirtShadowPath(sleeves: SleeveType): string {
  // Slightly inset version for inner shading
  if (sleeves === "none") return "M 115,195 L 325,195 L 345,500 L 95,500 Z";
  if (sleeves === "half") return "M 100,205 L 340,205 L 360,500 L 80,500 Z";
  return "M 100,205 L 340,205 L 360,500 L 80,500 Z";
}

// Polo collar fold-down rectangle
function PoloCollar({ color }: { color: string }) {
  const shade = shadeColor(color, -15);
  return (
    <g>
      <rect x="155" y="42" width="130" height="52" rx="6" fill={shade} />
      <rect x="155" y="42" width="130" height="28" rx="4" fill={color} />
      <rect x="155" y="65" width="130" height="2" fill={shadeColor(color, -25)} />
      {/* collar fold lines */}
      <line x1="220" y1="44" x2="220" y2="93" stroke={shadeColor(color, -30)} strokeWidth="1.5" opacity="0.5" />
    </g>
  );
}

function shadeColor(hex: string, percent: number): string {
  try {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent * 2.55));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent * 2.55));
    const b = Math.min(255, Math.max(0, (num & 0xff) + percent * 2.55));
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  } catch {
    return hex;
  }
}

// --- Main SVG T-shirt component ---
interface TshirtSVGProps {
  config: TshirtConfig;
  svgRef: React.RefObject<SVGSVGElement | null>;
  fabricContainerRef: React.RefObject<HTMLDivElement | null>;
}

function TshirtSVG({ config, svgRef, fabricContainerRef }: TshirtSVGProps) {
  const { color, sleeves, collar } = config;
  const mainPath = getTshirtPath(sleeves, collar);
  const dark = shadeColor(color, -18);
  const light = shadeColor(color, 12);
  const shadow = shadeColor(color, -30);

  return (
    <div className="relative w-full flex items-center justify-center select-none" style={{ userSelect: "none" }}>
      <svg
        ref={svgRef as React.RefObject<SVGSVGElement>}
        viewBox="0 0 440 540"
        className="w-full max-w-[400px]"
        style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.35))" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Gradient defs */}
        <defs>
          <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={light} />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
          <linearGradient id="shirtHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.05)" />
          </linearGradient>
          <filter id="clothFabric">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
            <feComposite in="blend" in2="SourceGraphic" operator="in" />
          </filter>
          <clipPath id="shirtClip">
            <path d={mainPath} />
          </clipPath>
        </defs>

        {/* Main shirt body */}
        <path d={mainPath} fill="url(#shirtGrad)" />

        {/* Fabric texture overlay */}
        <path d={mainPath} fill="url(#shirtHighlight)" opacity="0.6" />

        {/* Seam lines */}
        {sleeves !== "none" && (
          <>
            {/* Left sleeve seam */}
            <line x1="100" y1="80" x2="100" y2="205" stroke={shadow} strokeWidth="1" opacity="0.25" />
            {/* Right sleeve seam */}
            <line x1="340" y1="80" x2="340" y2="205" stroke={shadow} strokeWidth="1" opacity="0.25" />
          </>
        )}

        {/* Side seams */}
        <line x1="90" y1="210" x2="82" y2="505" stroke={shadow} strokeWidth="1.2" opacity="0.2" />
        <line x1="350" y1="210" x2="358" y2="505" stroke={shadow} strokeWidth="1.2" opacity="0.2" />

        {/* Hem stitch */}
        <path
          d={`M 80,505 Q 220,515 360,505`}
          fill="none"
          stroke={shadow}
          strokeWidth="2"
          opacity="0.3"
          strokeDasharray="4,4"
        />

        {/* Neckline stitch */}
        {collar === "round" && (
          <path d="M 108,84 Q 220,158 332,84" fill="none" stroke={shadow} strokeWidth="1.5" opacity="0.3" strokeDasharray="3,4" />
        )}
        {collar === "vneck" && (
          <path d="M 108,84 L 220,186 L 332,84" fill="none" stroke={shadow} strokeWidth="1.5" opacity="0.3" strokeDasharray="3,4" />
        )}

        {/* Polo collar piece */}
        {collar === "polo" && <PoloCollar color={color} />}

        {/* Shoulder highlight */}
        <path
          d={sleeves === "none"
            ? "M 115,90 Q 220,70 325,90"
            : "M 105,90 Q 220,68 335,90"}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Chest center fold / shadow */}
        <line x1="220" y1="160" x2="220" y2="505" stroke={shadow} strokeWidth="1.5" opacity="0.08" />
      </svg>

      {/* Fabric.js canvas overlay (chest print area) */}
      <div
        ref={fabricContainerRef as React.RefObject<HTMLDivElement>}
        className="absolute"
        style={{
          top: "32%",
          left: "50%",
          transform: "translate(-50%, 0)",
          width: "45%",
          aspectRatio: "1/1",
          pointerEvents: "auto",
          cursor: "crosshair",
        }}
      />
    </div>
  );
}

// --- Main exported component ---
export function TshirtCustomizer({ productId, productName, onSaveAndAddToCart, isSaving }: TshirtCustomizerProps) {
  const [config, setConfig] = useState<TshirtConfig>({
    color: "#FFFFFF",
    sleeves: "half",
    collar: "round",
    size: "M",
  });
  const [designName, setDesignName] = useState(`${productName} — My Design`);
  const [activePanel, setActivePanel] = useState<"style" | "design">("style");
  const [textInput, setTextInput] = useState("YOUR TEXT");
  const [textColor, setTextColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [selectedObj, setSelectedObj] = useState<fabric.FabricObject | null>(null);
  const [objList, setObjList] = useState<fabric.FabricObject[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fabricContainerRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Mount Fabric canvas
  useEffect(() => {
    if (!canvasElRef.current || fabricCanvasRef.current) return;

    const fc = new fabric.Canvas(canvasElRef.current, {
      width: 220,
      height: 220,
      preserveObjectStacking: true,
      backgroundColor: "transparent",
    });
    fabricCanvasRef.current = fc;

    const onChange = () => setObjList([...fc.getObjects()]);
    fc.on("object:added", onChange);
    fc.on("object:removed", onChange);
    fc.on("object:modified", onChange);
    fc.on("selection:created", (e: any) => setSelectedObj(e.selected?.[0] ?? null));
    fc.on("selection:cleared", () => setSelectedObj(null));

    return () => {
      fc.dispose().catch(() => {});
      fabricCanvasRef.current = null;
    };
  }, []);

  // Position the canvas over the shirt chest area
  useEffect(() => {
    const container = fabricContainerRef.current;
    const fc = fabricCanvasRef.current;
    if (!container || !fc) return;

    const place = () => {
      const rect = container.getBoundingClientRect();
      const size = Math.round(rect.width);
      if (size < 10) return;
      fc.setDimensions({ width: size, height: size });
      (fc as any).lowerCanvasEl.style.width = size + "px";
      (fc as any).lowerCanvasEl.style.height = size + "px";
      (fc as any).upperCanvasEl.style.width = size + "px";
      (fc as any).upperCanvasEl.style.height = size + "px";
      (fc as any).wrapperEl.style.width = size + "px";
      (fc as any).wrapperEl.style.height = size + "px";
      fc.calcOffset();
    };

    const ro = new ResizeObserver(place);
    ro.observe(container);
    setTimeout(place, 80);
    return () => ro.disconnect();
  }, []);

  // Move canvas DOM into overlay container
  useEffect(() => {
    const container = fabricContainerRef.current;
    const fc = fabricCanvasRef.current;
    if (!container || !fc) return;
    const wrapper = (fc as any).wrapperEl as HTMLElement;
    if (wrapper && wrapper.parentElement !== container) {
      wrapper.style.position = "absolute";
      wrapper.style.top = "0";
      wrapper.style.left = "0";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      container.appendChild(wrapper);
    }
  });

  const handleAddText = async () => {
    const fc = fabricCanvasRef.current;
    if (!fc || !textInput.trim()) return;
    await document.fonts.ready;
    const t = new fabric.FabricText(textInput, {
      left: fc.width! / 2,
      top: fc.height! / 2,
      originX: "center",
      originY: "center",
      fontFamily,
      fontSize,
      fill: textColor,
      fontWeight: "bold",
    });
    fc.add(t);
    fc.setActiveObject(t);
    fc.renderAll();
    setSelectedObj(t);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const fc = fabricCanvasRef.current;
      if (!fc) return;
      const img = await fabric.FabricImage.fromURL(ev.target?.result as string);
      const size = fc.width! * 0.5;
      img.scaleToWidth(size);
      img.set({ left: fc.width! / 2, top: fc.height! / 2, originX: "center", originY: "center" });
      fc.add(img);
      fc.setActiveObject(img);
      fc.renderAll();
      setSelectedObj(img);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteSelected = () => {
    const fc = fabricCanvasRef.current;
    if (!fc || !selectedObj) return;
    fc.remove(selectedObj);
    fc.renderAll();
    setSelectedObj(null);
  };

  const handleClearDesign = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    fc.clear();
    fc.renderAll();
    setObjList([]);
    setSelectedObj(null);
  };

  // Generate preview PNG from SVG + Fabric canvas
  const generatePreview = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const svgEl = svgRef.current;
      if (!svgEl) { resolve(""); return; }

      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const SCALE = 2;
      const W = 440 * SCALE;
      const H = 540 * SCALE;

      const offscreen = document.createElement("canvas");
      offscreen.width = W;
      offscreen.height = H;
      const ctx = offscreen.getContext("2d")!;

      // Background
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(0, 0, W, H);

      const svgImg = new Image();
      svgImg.onload = () => {
        ctx.drawImage(svgImg, 0, 0, W, H);
        URL.revokeObjectURL(svgUrl);

        // Draw Fabric canvas overlay
        const fc = fabricCanvasRef.current;
        if (fc && fc.getObjects().length > 0) {
          const fcDataUrl = fc.toDataURL({ multiplier: 1, format: "png" });
          const fcImg = new Image();
          fcImg.onload = () => {
            // Chest area in the 440x540 coordinate space: roughly x=130 y=200 w=180 h=180
            const cx = 130 * SCALE;
            const cy = 200 * SCALE;
            const cw = 180 * SCALE;
            const ch = 180 * SCALE;
            ctx.drawImage(fcImg, cx, cy, cw, ch);
            resolve(offscreen.toDataURL("image/png"));
          };
          fcImg.src = fcDataUrl;
        } else {
          resolve(offscreen.toDataURL("image/png"));
        }
      };
      svgImg.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(""); };
      svgImg.src = svgUrl;
    });
  }, []);

  const handleSaveAndAddToCart = async () => {
    const previewUrl = await generatePreview();
    onSaveAndAddToCart(config, previewUrl, designName);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-[#111]" style={{ minHeight: "100vh" }}>
      {/* Hidden canvas element */}
      <canvas ref={canvasElRef} style={{ display: "none" }} />

      {/* Left: T-shirt Preview */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative"
        style={{ background: "radial-gradient(circle at 50% 40%, #2a2a2a 0%, #111 100%)", minHeight: "480px" }}
      >
        <div className="w-full max-w-[380px] px-8 py-8">
          <TshirtSVG config={config} svgRef={svgRef} fabricContainerRef={fabricContainerRef} />
        </div>

        {/* Config chips */}
        <div className="flex gap-2 flex-wrap justify-center pb-4 px-4">
          {[
            `${config.sleeves === "half" ? "Half Sleeve" : config.sleeves === "full" ? "Full Sleeve" : "Sleeveless"}`,
            `${config.collar === "round" ? "Round Neck" : config.collar === "polo" ? "Polo Collar" : "V-Neck"}`,
            `Size ${config.size}`,
          ].map(label => (
            <span key={label} className="text-[10px] font-bold tracking-widest text-white/40 border border-white/10 px-3 py-1 rounded-full">
              {label.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Hint */}
        <p className="text-[10px] text-white/20 tracking-widest pb-4">Click on the chest area to add/move designs</p>
      </div>

      {/* Right: Controls */}
      <div
        className="w-full lg:w-[380px] flex flex-col overflow-y-auto"
        style={{ background: "#0e0e0e", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Panel tabs */}
        <div className="flex border-b sticky top-0 z-10" style={{ background: "#0e0e0e", borderColor: "rgba(255,255,255,0.07)" }}>
          {(["style", "design"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActivePanel(tab)}
              className="flex-1 py-4 text-xs font-bold tracking-[0.18em] uppercase relative transition-colors"
              style={{ color: activePanel === tab ? "#fff" : "#555", background: "none", border: "none", cursor: "pointer" }}
            >
              {tab === "style" ? "Style" : "Print & Design"}
              {activePanel === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white" />}
            </button>
          ))}
        </div>

        {/* ── STYLE TAB ── */}
        {activePanel === "style" && (
          <div className="flex flex-col gap-6 p-5">

            {/* Color */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Shirt Color</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={() => setConfig(prev => ({ ...prev, color: c.hex }))}
                    className="w-9 h-9 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c.hex,
                      borderColor: config.color === c.hex ? "#fff" : "rgba(255,255,255,0.12)",
                      boxShadow: config.color === c.hex ? "0 0 0 3px rgba(255,255,255,0.2)" : "none",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-white/30">Custom</span>
                <input
                  type="color"
                  value={config.color}
                  onChange={e => setConfig(prev => ({ ...prev, color: e.target.value }))}
                  className="w-9 h-9 cursor-pointer rounded-full border-none bg-transparent"
                />
                <span className="text-xs text-white/40 font-mono">{config.color.toUpperCase()}</span>
              </div>
            </div>

            {/* Sleeves */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Sleeves</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "half" as SleeveType, label: "Half" },
                  { key: "full" as SleeveType, label: "Full" },
                  { key: "none" as SleeveType, label: "Sleeveless" },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setConfig(prev => ({ ...prev, sleeves: opt.key }))}
                    className="py-3 text-xs font-bold tracking-wider rounded-lg transition-all"
                    style={{
                      background: config.sleeves === opt.key ? "#fff" : "rgba(255,255,255,0.05)",
                      color: config.sleeves === opt.key ? "#000" : "#888",
                      border: config.sleeves === opt.key ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collar */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Collar / Neck</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "round" as CollarType, label: "Round Neck" },
                  { key: "polo" as CollarType, label: "Polo Collar" },
                  { key: "vneck" as CollarType, label: "V-Neck" },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setConfig(prev => ({ ...prev, collar: opt.key }))}
                    className="py-3 text-xs font-bold tracking-wider rounded-lg transition-all"
                    style={{
                      background: config.collar === opt.key ? "#fff" : "rgba(255,255,255,0.05)",
                      color: config.collar === opt.key ? "#000" : "#888",
                      border: config.collar === opt.key ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Size</p>
              <div className="flex gap-2 flex-wrap">
                {SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setConfig(prev => ({ ...prev, size: s }))}
                    className="w-11 h-11 text-xs font-bold rounded-lg transition-all"
                    style={{
                      background: config.size === s ? "#fff" : "rgba(255,255,255,0.05)",
                      color: config.size === s ? "#000" : "#888",
                      border: config.size === s ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DESIGN TAB ── */}
        {activePanel === "design" && (
          <div className="flex flex-col gap-5 p-5">

            {/* Text tool */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Add Text</p>
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Type your text..."
                maxLength={30}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 mb-3"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-[9px] text-white/25 mb-1.5">Font</p>
                  <select
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[9px] text-white/25 mb-1.5">Size: {fontSize}pt</p>
                  <input
                    type="range" min={12} max={80} step={2}
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="w-full mt-2 accent-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[9px] text-white/25 whitespace-nowrap">Color</p>
                <input
                  type="color"
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded-full border-none bg-transparent flex-shrink-0"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["#000000", "#FFFFFF", "#1A1A1A", "#C0392B", "#1D2B45", "#C9A84C"].map(hex => (
                    <button
                      key={hex}
                      onClick={() => setTextColor(hex)}
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: hex, borderColor: textColor === hex ? "#fff" : "rgba(255,255,255,0.1)" }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleAddText}
                disabled={!textInput.trim()}
                className="w-full py-2.5 text-xs font-bold tracking-widest rounded-lg transition-colors disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                + PLACE TEXT ON SHIRT
              </button>
            </div>

            {/* Logo / Image upload */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold mb-3">Add Logo / Image</p>
              <label
                className="flex flex-col items-center justify-center w-full py-4 rounded-lg cursor-pointer gap-1.5 hover:opacity-80 transition-opacity"
                style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.12)", color: "#777" }}
              >
                <span className="text-lg">↑</span>
                <span className="text-xs font-bold tracking-wider">Upload Logo / Image</span>
                <span className="text-[10px] text-white/20">PNG, JPG, SVG, WebP</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>

            {/* Layer list */}
            {objList.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-bold">
                    Layers ({objList.length})
                  </p>
                  <button
                    onClick={handleClearDesign}
                    className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {objList.map((obj, i) => {
                    const isSelected = selectedObj === obj;
                    const label = obj.type === "text" || obj.type === "i-text"
                      ? `"${(obj as any).text?.slice(0, 18) ?? "Text"}"`
                      : obj.type === "image" ? "🖼 Image" : `Shape ${i + 1}`;
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          const fc = fabricCanvasRef.current;
                          if (!fc) return;
                          fc.setActiveObject(obj);
                          fc.renderAll();
                          setSelectedObj(obj);
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                          border: isSelected ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span className="text-xs text-white/70 truncate">{label}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedObj(obj); handleDeleteSelected(); }}
                          className="text-[10px] text-red-400/40 hover:text-red-400 ml-2 flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
                {selectedObj && (
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full mt-3 py-2 text-xs font-bold tracking-wider rounded-lg transition-colors"
                    style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.2)" }}
                  >
                    DELETE SELECTED LAYER
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Save section (always visible) ── */}
        <div
          className="sticky bottom-0 p-5 flex flex-col gap-3 z-20"
          style={{ background: "#0e0e0e", borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <input
            type="text"
            value={designName}
            onChange={e => setDesignName(e.target.value)}
            placeholder="Name your design..."
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
          />
          <button
            onClick={handleSaveAndAddToCart}
            disabled={isSaving}
            className="w-full py-4 text-sm font-black tracking-[0.12em] rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: isSaving ? "#555" : "#fff", color: "#000" }}
          >
            {isSaving ? (
              <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />SAVING...</>
            ) : (
              "SAVE & ADD TO CART"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
