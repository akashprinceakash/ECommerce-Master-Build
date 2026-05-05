import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import * as fabric from "fabric";
import { PATTERNS, ZONE_PRESETS, ZONE_LABEL, ALL_OVER_TILE_PX, patternUrl, type PatternZone, type PatternDef } from "@/components/3d/patterns";
import { GT_STYLES, applyGtStyle, clearGtStyle, type GtStyleDef, type GtColors } from "@/components/3d/gt-styles";

const GT_GROUPS = [
  { id: "classic",    label: "Classic"     },
  { id: "sport-side", label: "Sport Side"  },
  { id: "triple",     label: "Triple Tone" },
  { id: "wave",       label: "Wave Panel"  },
  { id: "hourglass",  label: "Hourglass"   },
  { id: "pinstripe",  label: "Pinstripe"   },
  { id: "raglan",     label: "Raglan"      },
] as const;

const GT_PALETTE = ["#C5D3DE","#F8F4E9","#ACB1A1","#F0CED2","#E9DAC3","#FFFFFF","#585858","#576043","#DA1F26","#273878","#243C2F","#362223","#000000"];

function GtSwatch({ style, isActive, accent }: { style: GtStyleDef; isActive: boolean; accent: string }) {
  const cRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = cRef.current; if (!el) return;
    const ctx = el.getContext("2d"); if (!ctx) return;
    const W = 60, H = 60;
    ctx.clearRect(0, 0, W, H);
    const { primary, accent: ac, tertiary } = style.defaultColors;
    switch (style.group) {
      case "classic":
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = ac;
        ctx.fillRect(0,0,W,12); ctx.fillRect(0,H-8,W,8); ctx.fillRect(0,H-22,W,6);
        break;
      case "sport-side": case "wave": case "triple":
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = ac;
        ctx.fillRect(0,0,14,H); ctx.fillRect(W-14,0,14,H);
        if (tertiary) { ctx.fillStyle = tertiary; ctx.fillRect(0,0,W,10); }
        break;
      case "hourglass":
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.moveTo(W*0.22,0); ctx.lineTo(W*0.78,0);
        ctx.lineTo(W*0.62,H*0.55); ctx.lineTo(W*0.78,H);
        ctx.lineTo(W*0.22,H); ctx.lineTo(W*0.38,H*0.55);
        ctx.closePath(); ctx.fill();
        break;
      case "pinstripe":
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
        ctx.strokeStyle = ac; ctx.lineWidth = 1.5;
        for (let x = 8; x < W; x += 10) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        break;
      case "raglan":
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(W*0.45,0); ctx.lineTo(W*0.18,H*0.35); ctx.lineTo(0,H*0.2);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W,0); ctx.lineTo(W*0.55,0); ctx.lineTo(W*0.82,H*0.35); ctx.lineTo(W,H*0.2);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(0,0,W,8); ctx.fillRect(0,H-10,W,10);
        break;
      default:
        ctx.fillStyle = primary; ctx.fillRect(0,0,W,H);
    }
    if (isActive) { ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(1.5,1.5,W-3,H-3); }
  }, [style, isActive, accent]);
  return <canvas ref={cRef} width={60} height={60} style={{ display: "block", width: "100%", height: "auto" }} />;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number; name: string; description: string; category: string;
  priceInPaise: number; modelUrl: string; thumbnailUrl?: string | null; defaultColor?: string;
  sku?: string | null;
  productType?: "fabric" | "pattern";
  fabric?: string | null;
  fixedPattern?: string | null;
  patternCategory?: string | null;
}
interface MatEntry { idx: number; name: string; mat: any; color: string; }

// ── Color palette (from PDF specs) ──────────────────────────────────────────
const PAL = [
  "#C5D3DE","#F8F4E9","#ACB1A1","#F0CED2","#E9DAC3",
  "#FFFFFF","#585858","#576043","#DA1F26","#273878",
  "#243C2F","#362223","#000000",
];

// ── Design presets (GT001–GT012 from reference) ──────────────────────────────
const PRESETS = [
  { name:"GT001", primary:"#C5D3DE", secondary:"#362223" },
  { name:"GT002", primary:"#F0CED2", secondary:"#362223" },
  { name:"GT003", primary:"#ACB1A1", secondary:"#362223" },
  { name:"GT004", primary:"#E9DAC3", secondary:"#362223" },
  { name:"GT005", primary:"#FFFFFF", secondary:"#273878" },
  { name:"GT006", primary:"#576043", secondary:"#000000" },
  { name:"GT007", primary:"#DA1F26", secondary:"#000000" },
  { name:"GT008", primary:"#273878", secondary:"#000000" },
  { name:"GT009", primary:"#F0CED2", secondary:"#585858" },
  { name:"GT010", primary:"#F0CED2", secondary:"#000000" },
  { name:"GT011", primary:"#000000", secondary:"#585858" },
  { name:"GT012", primary:"#ACB1A1", secondary:"#576043" },
];

const SIZES = ["XS","S","M","L","XL","XXL"];

const FONTS = [
  { label:"DM Sans", value:"'DM Sans'" },
  { label:"Arial (Clean)", value:"Arial" },
  { label:"Serif Classic", value:"'Times New Roman'" },
  { label:"Monospace", value:"'Courier New'" },
  { label:"Impact Bold", value:"Impact" },
  { label:"Casual", value:"'Comic Sans MS'" },
];

// Placement → canvas coordinate map (1024×1024 UV space).
// Derived from ZONE_PRESETS so text / logos / shapes land on the same UV
// islands the Patterns library uses (single source of truth = patterns.ts).
// Each entry is the CENTER point of that placement (originX/Y:"center"
// elsewhere expects centers). "Front Chest" sits in the upper-third of the
// front island; "Front Center" sits at the geometric centre, etc.
const _zCenter = (z: keyof typeof ZONE_PRESETS, dy = 0) => ({
  left: ZONE_PRESETS[z].left + ZONE_PRESETS[z].w / 2,
  top:  ZONE_PRESETS[z].top  + ZONE_PRESETS[z].h * dy,
});
const PLACEMENTS: Record<string, {left:number;top:number}> = {
  "front-chest":  _zCenter("front",        0.22),
  "front-center": _zCenter("front",        0.50),
  "back-top":     _zCenter("back",         0.18),
  "back-center":  _zCenter("back",         0.50),
  "sleeve-left":  _zCenter("leftSleeve",   0.50),
  "sleeve-right": _zCenter("rightSleeve",  0.50),
};

// Five user-editable colour zones for the per-zone Garment Parts panel.
// Each maps 1:1 to a ZONE_PRESETS rectangle on the 1024×1024 texture canvas.
const COLOR_ZONES: { id: Exclude<PatternZone, "all">; label: string }[] = [
  { id: "front",       label: "Front" },
  { id: "back",        label: "Back" },
  { id: "leftSleeve",  label: "Left Sleeve" },
  { id: "rightSleeve", label: "Right Sleeve" },
  { id: "collar",      label: "Collar" },
];

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    return clerk?.session ? await clerk.session.getToken() : null;
  } catch { return null; }
}
async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const headers: Record<string,string> = {};
  if (!(opts?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

// ── Dark studio theme ────────────────────────────────────────────────────────
// Fabric v7 stores backgroundColor as a property — there's no setBackgroundColor()
// helper. Use this to set + render in one call.
function setFabricBg(fc: any, hex: string) {
  if (!fc) {
    console.warn("[customize] setFabricBg: no canvas yet, skipping bg=", hex);
    return;
  }
  fc.backgroundColor = hex;
  fc.renderAll();
  console.debug("[customize] setFabricBg ->", hex, "objects:", fc.getObjects().length);
}

// model-viewer's setBaseColorFactor expects an RGBA float array (0..1), not a hex string.
function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [isNaN(r) ? 1 : r, isNaN(g) ? 1 : g, isNaN(b) ? 1 : b, 1];
}

const V = {
  bg:"#0e0c0a", sf:"rgba(255,255,255,0.04)", sf2:"rgba(255,255,255,0.08)",
  bd:"rgba(255,255,255,0.09)", bd2:"rgba(255,255,255,0.15)",
  tx:"#f0ece4", mu:"#7a7470", ac:"#c9a87c",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function CustomizePage() {
  const params    = useParams();
  const id        = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user }  = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebGL detection
  const [webglAvailable] = useState<boolean>(() => {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch { return false; }
  });

  // 3D model-viewer
  const mvRef        = useRef<any>(null);
  const [mvReady, setMvReady]       = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Fabric canvas
  const fcRef        = useRef<fabric.Canvas | null>(null);
  // Stable holder for the resize listener so we can clean it up on detach.
  const resizeListenerRef = useRef<(() => void) | null>(null);
  // Always points to the latest syncTexture closure — Fabric event handlers
  // are registered once at canvas-init, so without this ref they'd capture
  // a stale syncTexture (with empty mats) forever.
  const syncTextureRef = useRef<(() => void) | null>(null);
  // Indices of materials that actually accept textures (probed on model load).
  // GLBs vary wildly — some only the body, some all parts, some none.
  const texturableMatsRef = useRef<number[]>([]);
  // Latest baked texture data URL (used for save/restore so admin can rebuild
  // the customer's exact look on a fresh model-viewer).
  const lastTextureUrlRef = useRef<string>("");
  const logoObjRef   = useRef<any>(null);

  // Materials from model
  const [mats, setMats]             = useState<MatEntry[]>([]);
  const [activePart, setActivePart] = useState(0);

  // Right panel tabs: colors | design | text | logo | shapes | canvas
  // Initial tab is set per productType in an effect below once product loads.
  const [rightTab, setRightTab]     = useState<"colors"|"design"|"text"|"logo"|"shapes"|"canvas">("design");

  // Print Library state
  const [activePrintId, setActivePrintId]   = useState<string | null>(null);
  const [allOverPrintId, setAllOverPrintId] = useState<string | null>(null);
  const baseBgRef = useRef<string>("#C5D3DE");

  // GT Design Style System state
  const [activeGtStyle, setActiveGtStyle] = useState<GtStyleDef | null>(null);
  const [gtColors, setGtColors] = useState<GtColors>({ primary: "#FFFFFF", accent: "#000000" });
  // Monotonic token to guard against race conditions when the user clicks GT
  // styles or color swatches faster than the texture can load+recolor.
  const gtRequestIdRef = useRef(0);
  const [gtGroupOpen, setGtGroupOpen] = useState<string | null>("classic");

  // Core design state
  const [size, setSize]             = useState("M");
  const [qty, setQty]               = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [designName, setDesignName] = useState("");
  const [presetName, setPresetName] = useState("GT001");

  // Colors
  const [primaryColor, setPrimaryColor]     = useState("#C5D3DE");
  const [secondaryColor, setSecondaryColor] = useState("#362223");
  const [canvasBg, setCanvasBg]             = useState("#C5D3DE");

  // Garment design toggles (from File 2)
  const [gSleeves, setGSleeves]   = useState(true);
  const [gCollar, setGCollar]     = useState(true);
  const [gPlacket, setGPlacket]   = useState(true);
  const [gPanel, setGPanel]       = useState(true);
  const [gStripe, setGStripe]     = useState(false);
  const [pattern, setPattern]     = useState<"none"|"stripes"|"grid"|"dots">("none");

  // Text controls
  const [txtVal, setTxtVal]         = useState("");
  const [txtColor, setTxtColor]     = useState("#FFFFFF");
  const [txtFont, setTxtFont]       = useState("'DM Sans'");
  const [txtSize, setTxtSize]       = useState(80);
  const [txtPlacement, setTxtPlacement] = useState("front-chest");

  // Logo controls
  const [logoScale, setLogoScale]   = useState(1);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoPlacement, setLogoPlacement] = useState("front-chest");

  // Shape controls
  const [shapeColor, setShapeColor] = useState("#FFFFFF");
  const [strokeW, setStrokeW]       = useState(12);
  const [shapePlacement, setShapePlacement] = useState("front-center");

  // Per-zone garment colours — each user-painted colour rect lives on the
  // texture canvas at the matching ZONE_PRESETS rectangle. Empty string =
  // no colour applied (the body / GT base shows through).
  const [activeColorZone, setActiveColorZone] = useState<Exclude<PatternZone, "all">>("front");
  const [zoneColors, setZoneColors] = useState<Record<Exclude<PatternZone, "all">, string>>({
    front: "", back: "", leftSleeve: "", rightSleeve: "", collar: "",
  });

  // Canvas element adjustments
  const [elScale, setElScale] = useState(1);
  const [elX, setElX]         = useState(512);
  const [elY, setElY]         = useState(512);

  // ── Product data ──────────────────────────────────────────────────────────
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn:  () => apiFetch(`/api/products/${id}`),
    enabled:  !!id,
  });

  const { data: existing } = useQuery<any>({
    queryKey: ["customization", id],
    queryFn:  () => apiFetch(`/api/customizations/product/${id}/latest`),
    enabled:  !!id && !!user,
  });

  // ── Load model-viewer script (only when WebGL available) ─────────────────
  useEffect(() => {
    if (!webglAvailable) { setMvReady(false); return; }
    if (document.querySelector('script[data-mv-loader]')) { setMvReady(true); return; }
    const s = document.createElement("script");
    s.type = "module"; s.setAttribute("data-mv-loader","1");
    s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    s.onload = () => setMvReady(true);
    document.head.appendChild(s);
  }, [webglAvailable]);

  // ── Init Fabric canvas (ref callback so it fires whenever the canvas DOM
  //    element is attached — the component returns a spinner first while the
  //    product is loading, so a useEffect([]) runs *before* the canvas exists
  //    and never re-runs.) ────────────────────────────────────────────────────
  const canvasElRef = useCallback((el: HTMLCanvasElement | null) => {
    // Detach: dispose any existing Fabric canvas
    if (!el) {
      if (resizeListenerRef.current) {
        window.removeEventListener("resize", resizeListenerRef.current);
        resizeListenerRef.current = null;
      }
      if (fcRef.current) {
        try {
          // dispose() may be sync OR Promise-returning depending on Fabric build
          const r: any = fcRef.current.dispose();
          if (r && typeof r.catch === "function") r.catch(() => {});
        } catch (e) {
          console.warn("[customize] dispose threw:", e);
        }
        fcRef.current = null;
      }
      return;
    }
    // Already initialised on this element → nothing to do
    if (fcRef.current) return;

    // Chrome textBaseline patch (Fabric occasionally feeds the deprecated value)
    try {
      const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "textBaseline");
      if (d?.set) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, "textBaseline", {
          configurable: true,
          set(v) { d.set!.call(this, v === "alphabetical" ? "alphabetic" : v); },
          get() { return d.get!.call(this); },
        });
      }
    } catch {}

    const fc = new fabric.Canvas(el, {
      width: 1024, height: 1024,
      preserveObjectStacking: true,
      backgroundColor: "#C5D3DE",
    });
    fcRef.current = fc;
    console.debug("[customize] Fabric canvas initialised");

    const scaleCanvas = () => {
      // CSS-only scale: keep the underlying Fabric canvas at 1024×1024 (so the
      // texture sent to the 3D model is always full-resolution) and scale the
      // host element via transform for the visible preview.
      const host = document.getElementById("fc-scale-host");
      const wrapper = document.getElementById("fc-wrapper");
      if (!host || !wrapper) return;
      const w = wrapper.clientWidth || 1024;
      host.style.transform = `scale(${w / 1024})`;
    };
    resizeListenerRef.current = scaleCanvas;
    window.addEventListener("resize", scaleCanvas);
    setTimeout(scaleCanvas, 100);

    fc.on("object:modified",  () => syncTextureRef.current?.());
    fc.on("object:added",     () => syncTextureRef.current?.());
    fc.on("object:removed",   () => syncTextureRef.current?.());
    fc.on("selection:created", (e: any) => {
      const o = e.selected?.[0]; if (!o) return;
      setElScale(o.scaleX ?? 1);
      setElX(Math.round(o.left ?? 512));
      setElY(Math.round(o.top  ?? 512));
    });
    fc.on("selection:updated", (e: any) => {
      const o = e.selected?.[0]; if (!o) return;
      setElScale(o.scaleX ?? 1);
      setElX(Math.round(o.left ?? 512));
      setElY(Math.round(o.top  ?? 512));
    });
  }, []);

  // ── Re-scale canvas when CANVAS tab becomes visible ──────────────────────
  useEffect(() => {
    if (rightTab !== "canvas") return;
    // Give the DOM a frame to render the wrapper at full width, then scale.
    // We re-read fcRef *inside* rAF so HMR / dispose races can't hand us a
    // stale reference whose methods have been stripped.
    requestAnimationFrame(() => {
      const host = document.getElementById("fc-scale-host");
      const wrapper = document.getElementById("fc-wrapper");
      if (!host || !wrapper) return;
      const w = wrapper.clientWidth || 1024;
      host.style.transform = `scale(${w / 1024})`;
      fcRef.current?.renderAll();
    });
  }, [rightTab]);

  // ── Texture sync: Fabric canvas → PNG → model-viewer material ─────────────
  // Strategy borrowed from a tested reference impl that works on arbitrary GLBs:
  //   1. Force TWO render passes + animation frames so fonts/images commit.
  //   2. Read the raw HTMLCanvasElement (Fabric's wrapper sometimes lies).
  //   3. Iterate ALL materials and try setTexture; break on FIRST success
  //      (one shared UV-mapped material covers most t-shirts).
  //   4. Fall back to the undocumented `info.texture = tex` path for stubborn
  //      materials that throw on setTexture.
  // We probe materials at load time (probeTexturability) and store the indices
  // that are confirmed texturable.
  const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));

  const syncTexture = useCallback(async () => {
    const mv: any = mvRef.current;
    const fc: any = fcRef.current;
    if (!mv || !fc || !mats.length) return;
    try {
      // Two render passes + RAFs — required for fonts and images to render
      fc.renderAll(); await raf();
      fc.renderAll(); await raf();

      // Use the underlying HTMLCanvasElement (more reliable than fc.toDataURL)
      const rawEl: HTMLCanvasElement | undefined =
        typeof fc.getElement === "function" ? fc.getElement() : undefined;
      const dataUrl = rawEl
        ? rawEl.toDataURL("image/png", 1.0)
        : fc.toDataURL({ format: "png", quality: 1.0, multiplier: 1 });
      if (!dataUrl || dataUrl.length < 100) {
        console.warn("[customize] syncTexture: empty canvas data");
        return;
      }
      lastTextureUrlRef.current = dataUrl;

      const tex = await mv.createTexture(dataUrl);
      let applied = 0;
      for (const entry of mats) {
        const mat: any = entry?.mat;
        const pbr = mat?.pbrMetallicRoughness;
        if (!pbr) continue;
        const slot = pbr.baseColorTexture;
        // Path 1: documented setTexture
        try {
          slot?.setTexture?.(tex);
          try { pbr.setBaseColorFactor([1, 1, 1, 1]); } catch {}
          applied++;
          break;
        } catch {
          // Path 2: undocumented direct assignment
          try {
            if (slot && typeof slot.texture !== "undefined") {
              slot.texture = tex;
              try { pbr.setBaseColorFactor([1, 1, 1, 1]); } catch {}
              applied++;
              break;
            }
          } catch {}
        }
      }
      if (!applied) {
        console.warn(
          "[customize] syncTexture: this GLB has no UV-mapped texture slot. The design appears in the canvas preview but cannot bake onto the 3D mesh. (Re-export the GLB with a baseColorTexture map.)"
        );
      } else {
        console.debug(`[customize] syncTexture: applied texture (${dataUrl.length}b)`);
      }
    } catch (e) {
      console.error("[customize] syncTexture failed:", e);
    }
  }, [mats]);

  // Probe materials with a 1×1 test texture to learn which ones accept textures.
  // We don't use the result to gate writes (we always try all), but it gives us
  // diagnostic info and a future hook for partial failures.
  const probeTexturability = useCallback(async (model: any) => {
    texturableMatsRef.current = [];
    const mv: any = mvRef.current;
    if (!mv || !model?.materials?.length) return;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      c.getContext("2d")!.fillStyle = "#ffffff";
      c.getContext("2d")!.fillRect(0, 0, 1, 1);
      const testTex = await mv.createTexture(c.toDataURL("image/png"));
      model.materials.forEach((m: any, i: number) => {
        try {
          m.pbrMetallicRoughness.baseColorTexture.setTexture(testTex);
          m.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
          texturableMatsRef.current.push(i);
        } catch {}
      });
      console.debug(
        `[customize] probe: ${texturableMatsRef.current.length}/${model.materials.length} material(s) accept textures →`,
        texturableMatsRef.current.map(i => model.materials[i].name || `Part ${i + 1}`)
      );
    } catch (e) {
      console.warn("[customize] probe failed:", e);
    }
  }, []);

  // Keep the ref pointing at the latest syncTexture so canvas event handlers
  // (registered once at init) always call the current closure.
  useEffect(() => { syncTextureRef.current = syncTexture; }, [syncTexture]);

  useEffect(() => { if (mats.length) syncTexture(); }, [mats, syncTexture]);

  // Flow-init effect declared further down (after handleSelectGtStyle is defined).

  // ── model-viewer load event ───────────────────────────────────────────────
  useEffect(() => {
    if (!mvReady || !product?.modelUrl) return;
    const mv = mvRef.current; if (!mv) return;
    const onLoad = async () => {
      const ov = document.getElementById("mv-overlay");
      if (ov) { ov.style.opacity = "0"; setTimeout(()=>{ if(ov) ov.style.display="none"; }, 500); }
      const model = mv.model;
      console.debug("[customize] model loaded. materials:", model?.materials?.length ?? 0);
      if (!model?.materials?.length) { setModelLoaded(true); return; }
      const entries: MatEntry[] = model.materials.map((m:any, i:number) => ({
        idx:i, name:m.name||`Part ${i+1}`, mat:m, color:"#ffffff",
      }));
      setMats(entries);
      setModelLoaded(true);
      // Discover which materials accept textures, then push the current canvas
      await probeTexturability(model);
      // syncTexture closes over `mats` state which hasn't flushed yet — call
      // it through the ref so we get the next-tick (post-setState) closure.
      requestAnimationFrame(() => syncTextureRef.current?.());
    };
    mv.addEventListener("load", onLoad);
    return () => mv.removeEventListener("load", onLoad);
  }, [mvReady, product?.modelUrl]);

  // ── Restore saved design ──────────────────────────────────────────────────
  useEffect(() => {
    if (!existing || !modelLoaded || !fcRef.current) return;
    setSize(existing.size || "M");
    setDesignName(existing.name || "");
    if (!existing.canvasData) return;
    try {
      const parsed = JSON.parse(existing.canvasData);
      const canvasJSON = parsed.canvasJSON || parsed;
      const bg = parsed.canvasBg || "#C5D3DE";
      setCanvasBg(bg);
      setPrimaryColor(parsed.primaryColor || bg);
      setSecondaryColor(parsed.secondaryColor || "#362223");
      // Initialise the print-library "restore-to" colour to the loaded body colour
      // so Clear All-Over reverts to it instead of the hard-coded default.
      baseBgRef.current = parsed.primaryColor || bg;
      if (parsed.garmentState) {
        const g = parsed.garmentState;
        setGSleeves(g.sleeves ?? true); setGCollar(g.collar ?? true);
        setGPlacket(g.placket ?? true); setGPanel(g.panel ?? true);
        setGStripe(g.stripe ?? false); setPattern(g.pattern ?? "none");
      }
      const fc = fcRef.current;
      setFabricBg(fc, bg);
      fc.loadFromJSON(typeof canvasJSON === "string" ? JSON.parse(canvasJSON) : canvasJSON).then(() => {
        fc.renderAll(); syncTexture();
      }).catch((e: any) => console.error("[customize] loadFromJSON failed:", e));
      if (parsed.matColors?.length && mats.length) {
        const updated = [...mats];
        parsed.matColors.forEach((hex:string, i:number) => {
          if (!updated[i]) return;
          updated[i] = { ...updated[i], color:hex };
          if (i === 0) {
            setFabricBg(fc, hex);
          } else {
            try { updated[i].mat.pbrMetallicRoughness.setBaseColorFactor(hexToRgba(hex)); }
            catch (e) { console.error("[customize] setBaseColorFactor failed:", e); }
          }
        });
        setMats(updated);
      }
    } catch {}
  }, [existing, modelLoaded]);

  // ── Garment overlay helpers ───────────────────────────────────────────────
  // Removes all garment overlay objects of a given type from canvas
  const removeGarmentOverlay = useCallback((type: string) => {
    const fc = fcRef.current; if (!fc) return;
    const toRemove = fc.getObjects().filter((o:any) => o.data?.garmentType === type);
    toRemove.forEach((o:any) => fc.remove(o));
  }, []);

  // Draw collar overlay on canvas
  const drawCollar = useCallback((color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("collar");
    // Two collar flap rectangles
    const left = new fabric.Rect({
      left:320, top:50, width:90, height:140, rx:10, ry:10,
      fill:color, opacity:0.7, selectable:false, evented:false,
      data:{ garmentType:"collar" }, 
    });
    const right = new fabric.Rect({
      left:614, top:50, width:90, height:140, rx:10, ry:10,
      fill:color, opacity:0.7, selectable:false, evented:false,
      data:{ garmentType:"collar" },
    });
    const center = new fabric.Rect({
      left:412, top:30, width:200, height:80, rx:8, ry:8,
      fill:color, opacity:0.6, selectable:false, evented:false,
      data:{ garmentType:"collar" },
    });
    fc.add(left, right, center);
  }, [removeGarmentOverlay]);

  // Draw sleeve cuff overlays
  const drawSleeves = useCallback((color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("sleeve");
    const leftCuff = new fabric.Rect({
      left:30, top:380, width:130, height:60, rx:6, ry:6,
      fill:color, opacity:0.7, selectable:false, evented:false,
      data:{ garmentType:"sleeve" },
    });
    const rightCuff = new fabric.Rect({
      left:864, top:380, width:130, height:60, rx:6, ry:6,
      fill:color, opacity:0.7, selectable:false, evented:false,
      data:{ garmentType:"sleeve" },
    });
    fc.add(leftCuff, rightCuff);
  }, [removeGarmentOverlay]);

  // Draw button placket
  const drawPlacket = useCallback((color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("placket");
    const placket = new fabric.Rect({
      left:472, top:130, width:80, height:450, rx:4, ry:4,
      fill:color, opacity:0.5, selectable:false, evented:false,
      data:{ garmentType:"placket" },
    });
    // Buttons
    [220,330,440,550].forEach(y => {
      const btn = new fabric.Circle({
        left:500, top:y, radius:14,
        fill:"#ffffff", opacity:0.9,
        stroke:color, strokeWidth:2,
        selectable:false, evented:false,
        data:{ garmentType:"placket" },
      });
      fc.add(btn);
    });
    fc.add(placket);
  }, [removeGarmentOverlay]);

  // Draw side panels
  const drawPanel = useCallback((color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("panel");
    const lPanel = new fabric.Rect({
      left:30, top:130, width:120, height:680, rx:0, ry:0,
      fill:color, opacity:0.55, selectable:false, evented:false,
      data:{ garmentType:"panel" },
    });
    const rPanel = new fabric.Rect({
      left:874, top:130, width:120, height:680, rx:0, ry:0,
      fill:color, opacity:0.55, selectable:false, evented:false,
      data:{ garmentType:"panel" },
    });
    fc.add(lPanel, rPanel);
  }, [removeGarmentOverlay]);

  // Draw chest diagonal stripe
  const drawStripe = useCallback((color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("stripe");
    const stripe = new fabric.Path("M 100 130 L 440 130 L 640 520 L 300 520 Z",{
      fill:color, opacity:0.5, selectable:false, evented:false,
      data:{ garmentType:"stripe" },
    });
    fc.add(stripe);
  }, [removeGarmentOverlay]);

  // Draw pattern overlay
  const drawPattern = useCallback((pat: "none"|"stripes"|"grid"|"dots", color: string) => {
    const fc = fcRef.current; if (!fc) return;
    removeGarmentOverlay("pattern");
    if (pat === "none") { fc.renderAll(); syncTexture(); return; }

    const lines: fabric.Line[] = [];
    if (pat === "stripes") {
      for (let i = -10; i < 25; i++) {
        lines.push(new fabric.Line(
          [i*80-200, 0, i*80+800, 1024],
          { stroke:color, strokeWidth:14, opacity:0.2, selectable:false, evented:false, data:{garmentType:"pattern"} }
        ));
      }
    } else if (pat === "grid") {
      for (let i = 0; i <= 12; i++) {
        lines.push(new fabric.Line([i*90,0,i*90,1024],{stroke:color,strokeWidth:6,opacity:0.15,selectable:false,evented:false,data:{garmentType:"pattern"}}));
        lines.push(new fabric.Line([0,i*90,1024,i*90],{stroke:color,strokeWidth:6,opacity:0.15,selectable:false,evented:false,data:{garmentType:"pattern"}}));
      }
    } else if (pat === "dots") {
      for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 12; y++) {
          lines.push(new fabric.Circle({
            left:x*90+30, top:y*90+30, radius:6,
            fill:color, opacity:0.18, selectable:false, evented:false,
            data:{garmentType:"pattern"},
          }) as any);
        }
      }
    }
    if (lines.length) { fc.add(...lines); }
    fc.renderAll(); syncTexture();
  }, [removeGarmentOverlay, syncTexture]);

  // Toggle garment feature
  const toggleGarment = useCallback((feature: string, value: boolean, color: string) => {
    const fc = fcRef.current; if (!fc) return;
    if (!value) {
      removeGarmentOverlay(feature);
      fc.renderAll(); syncTexture();
    } else {
      if (feature === "collar")  drawCollar(color);
      if (feature === "sleeve")  drawSleeves(color);
      if (feature === "placket") drawPlacket(color);
      if (feature === "panel")   drawPanel(color);
      if (feature === "stripe")  drawStripe(color);
      fc.renderAll(); syncTexture();
    }
  }, [removeGarmentOverlay, drawCollar, drawSleeves, drawPlacket, drawPanel, drawStripe, syncTexture]);

  // ── Material color ────────────────────────────────────────────────────────
  const applyPartColor = useCallback((idx: number, hex: string) => {
    const fc = fcRef.current;
    setMats(prev => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], color:hex };
      if (idx === 0) {
        // Body — paint the canvas background so the texture carries the color
        baseBgRef.current = hex;
        // Don't clobber an active all-over pattern; the colour is restored when it's removed.
        if (!allOverPrintId) setFabricBg(fc, hex);
        syncTexture();
        try { next[0].mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1, 1, 1, 1]); }
        catch (e) { console.error("[customize] setBaseColorFactor (body white) failed:", e); }
      } else {
        // Other parts (collar, sleeves, etc) — apply color directly to the material
        try { next[idx].mat?.pbrMetallicRoughness?.setBaseColorFactor?.(hexToRgba(hex)); }
        catch (e) { console.error("[customize] setBaseColorFactor failed:", e); }
      }
      return next;
    });
  }, [syncTexture, allOverPrintId]);

  // Apply palette to active garment part
  const applyPalette = (hex: string) => {
    applyPartColor(activePart, hex);
    const el = document.getElementById("cp-custom") as HTMLInputElement | null;
    if (el) el.value = hex;
  };

  // Primary color → canvas bg + mat[0]
  const applyPrimary = (hex: string) => {
    setPrimaryColor(hex); setCanvasBg(hex);
    const fc = fcRef.current;
    baseBgRef.current = hex;
    if (!allOverPrintId) setFabricBg(fc, hex);
    syncTexture();
    if (mats[0]) { applyPartColor(0, hex); }
  };

  // ── PRINT LIBRARY ────────────────────────────────────────────────────────
  const loadHTMLImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    });

  const applyAllOverPrint = useCallback(async (p: PatternDef) => {
    const fc = fcRef.current;
    if (!fc) return;
    // Invalidate any in-flight GT apply/recolor — otherwise a slow GT load
    // could finish AFTER us and stomp our print background.
    gtRequestIdRef.current++;
    try {
      const img = await loadHTMLImage(patternUrl(p.file));
      // Pre-scale the source onto an offscreen canvas so the pattern repeats
      // at a predictable tile size instead of being "zoomed in" by the
      // source image's natural resolution.
      const off = document.createElement("canvas");
      off.width = ALL_OVER_TILE_PX;
      off.height = ALL_OVER_TILE_PX;
      const ctx = off.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, ALL_OVER_TILE_PX, ALL_OVER_TILE_PX);
      }
      // GT styles cover the whole shirt — clear them so the all-over print
      // is actually visible and the panel state stays consistent.
      if (activeGtStyle) {
        clearGtStyle(fc);
        setActiveGtStyle(null);
      }
      const pattern = new fabric.Pattern({ source: off, repeat: "repeat" });
      // Bypass setFabricBg (which expects a hex string) — assign Pattern directly.
      (fc as any).backgroundColor = pattern;
      fc.renderAll();
      setAllOverPrintId(p.id);
      setActivePrintId(p.id);
      // Body material must be pure white so the texture's true colours show through.
      try { mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1, 1, 1, 1]); } catch {}
      syncTexture();
      toast({ title: "Print applied", description: `${p.label} mapped across the whole garment.` });
    } catch {
      toast({ title: "Could not load print", variant: "destructive" });
    }
  }, [activeGtStyle, mats, syncTexture, toast]);

  const clearAllOverPrint = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    setFabricBg(fc, baseBgRef.current || "#ffffff");
    fc.renderAll();
    setAllOverPrintId(null);
    syncTexture();
  }, [syncTexture]);

  // ── GT DESIGN STYLE SYSTEM ───────────────────────────────────────────────
  const handleSelectGtStyle = useCallback(async (style: GtStyleDef) => {
    const fc = fcRef.current;
    if (!fc) return;
    const myReq = ++gtRequestIdRef.current;
    setActiveGtStyle(style);
    const colors: GtColors = { ...style.defaultColors };
    setGtColors(colors);
    // GT styles paint flat colour zones — clear any all-over print first so
    // the underlying repeating pattern doesn't bleed through transparent areas.
    if (allOverPrintId) {
      setFabricBg(fc, "#ffffff");
      setAllOverPrintId(null);
    }
    // Body material must be pure white so the painted zones render true to colour.
    try { mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1, 1, 1, 1]); } catch {}
    // Await — applyGtStyle loads the 1024×1024 base texture as a FabricImage,
    // so syncTexture() must run AFTER it's added to the canvas.
    await applyGtStyle(fc, style, colors);
    // Race guard: if another GT request started after us, abandon this result.
    if (myReq !== gtRequestIdRef.current) return;
    syncTexture();
    toast({ title: `${style.id} applied`, description: style.label });
  }, [allOverPrintId, mats, syncTexture, toast]);

  const handleGtColorChange = useCallback(async (role: keyof GtColors, hex: string) => {
    const fc = fcRef.current;
    if (!fc || !activeGtStyle) return;
    const myReq = ++gtRequestIdRef.current;
    const updated: GtColors = { ...gtColors, [role]: hex };
    setGtColors(updated);
    // Await — pixel-swap recolor + re-add to canvas is async.
    await applyGtStyle(fc, activeGtStyle, updated);
    // Race guard: only commit if this is still the latest request.
    if (myReq !== gtRequestIdRef.current) return;
    syncTexture();
  }, [activeGtStyle, gtColors, syncTexture]);

  // ── KA.SHA flow init: per productType set initial right-tab and (for
  // pattern products) lock activeGtStyle to product.fixedPattern. Runs once
  // when mats become available so the canvas is ready for applyGtStyle. ──
  const flowInitDoneRef = useRef(false);
  useEffect(() => {
    if (flowInitDoneRef.current) return;
    if (!product || !mats.length || !fcRef.current) return;
    flowInitDoneRef.current = true;
    if (product.productType === "pattern") {
      setRightTab("colors");
      const fixed = product.fixedPattern;
      if (fixed) {
        const style = GT_STYLES.find(s => s.id === fixed);
        if (style) {
          setPresetName(style.id);
          handleSelectGtStyle(style);
        }
      }
    } else {
      setRightTab("design");
    }
  }, [product, mats.length, handleSelectGtStyle]);

  const handleClearGtStyle = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    clearGtStyle(fc);
    fc.renderAll();
    setActiveGtStyle(null);
    setFabricBg(fc, baseBgRef.current || "#ffffff");
    syncTexture();
    toast({ title: "Design style removed" });
  }, [syncTexture, toast]);

  // ── PER-ZONE COLOUR ──────────────────────────────────────────────────────
  // Paints (or removes) a flat colour rectangle on the texture canvas at the
  // exact ZONE_PRESETS rectangle for the chosen zone. Sits ABOVE GT base
  // textures and BELOW prints / text / logos / shapes so the user can recolour
  // a panel without losing their decorative work.
  const applyZoneColor = useCallback((zone: Exclude<PatternZone, "all">, hex: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    // Invalidate any in-flight GT apply — its async completion could otherwise
    // re-stack the texture above our zone colour rect.
    gtRequestIdRef.current++;
    // Remove any prior colour rect for this zone.
    const existing = fc.getObjects().filter((o: any) => o?.data?.kashaZoneColor === zone);
    if (existing.length) fc.remove(...existing);

    if (!hex) {
      setZoneColors(prev => ({ ...prev, [zone]: "" }));
      fc.renderAll();
      syncTexture();
      return;
    }

    const preset = ZONE_PRESETS[zone];
    const rect = new fabric.Rect({
      left: preset.left, top: preset.top,
      width: preset.w,   height: preset.h,
      fill: hex,
      selectable: false, evented: false,
      originX: "left",   originY: "top",
    });
    (rect as any).data = { kashaZoneColor: zone };
    fc.add(rect);
    // Stack: GT base (very back) → zone colour rects → prints → text/logos/shapes.
    // sendObjectToBack puts rect at index 0, then we restore the GT base behind it.
    (fc as any).sendObjectToBack?.(rect);
    const gtBase = fc.getObjects().find((o: any) => o?.data?.tag === "__kashaGtBg__");
    if (gtBase) (fc as any).sendObjectToBack?.(gtBase);
    fc.renderAll();
    setZoneColors(prev => ({ ...prev, [zone]: hex }));
    syncTexture();
  }, [syncTexture]);

  const placePrintOnZone = useCallback(async (p: PatternDef, zone: Exclude<PatternZone, "all">) => {
    const fc = fcRef.current;
    if (!fc) return;
    // Invalidate any in-flight GT apply for the same reason as applyZoneColor.
    gtRequestIdRef.current++;
    try {
      const img = await fabric.FabricImage.fromURL(patternUrl(p.file), { crossOrigin: "anonymous" });
      const preset = ZONE_PRESETS[zone];
      // Remove any prior print already placed in this zone so the new one
      // replaces it cleanly (so repeated clicks on a zone don't stack copies).
      const existing = fc.getObjects().filter(
        (o: any) => o?.data?.kashaZone === zone
      );
      if (existing.length) fc.remove(...existing);

      const naturalW = img.width ?? preset.w;
      const naturalH = img.height ?? preset.h;
      // Stretch the print to fill the entire zone using the UV-mapped width
      // and height — no static scale, so every print covers its zone fully
      // regardless of source-image dimensions.
      img.set({
        left: preset.left,
        top: preset.top,
        originX: "left",
        originY: "top",
        scaleX: preset.w / naturalW,
        scaleY: preset.h / naturalH,
      });
      (img as any).data = { kashaZone: zone, kashaPrintId: p.id };
      fc.add(img);
      fc.setActiveObject(img);
      fc.renderAll();
      setActivePrintId(p.id);
      syncTexture();
      toast({ title: "Print placed", description: `${p.label} fills the ${ZONE_LABEL[zone]} — drag in Canvas tab to reposition.` });
    } catch {
      toast({ title: "Could not load print", variant: "destructive" });
    }
  }, [syncTexture, toast]);

  // Secondary color → mat[1] + redraw garment overlays that use secondary
  const applySecondary = (hex: string) => {
    setSecondaryColor(hex);
    if (mats[1]) { applyPartColor(1, hex); }
    // Redraw active garment overlays with new secondary color
    const fc = fcRef.current; if (!fc) return;
    if (gCollar)  drawCollar(hex);
    if (gSleeves) drawSleeves(hex);
    if (gPlacket) drawPlacket(hex);
    if (gPanel)   drawPanel(hex);
    if (gStripe)  drawStripe(hex);
    fc.renderAll(); syncTexture();
  };

  // Apply preset
  const applyPreset = (p: typeof PRESETS[0]) => {
    setPresetName(p.name);
    applyPrimary(p.primary);
    applySecondary(p.secondary);
    toast({ title: `Preset ${p.name} applied`, description:`${p.primary} · ${p.secondary}` });
  };

  // Canvas bg change (manual)
  const setFcBg = (hex: string) => {
    setCanvasBg(hex); setPrimaryColor(hex);
    const fc = fcRef.current;
    setFabricBg(fc, hex);
    syncTexture();
    if (mats[0]) applyPartColor(0, hex);
  };

  // ── Text ─────────────────────────────────────────────────────────────────
  const addText = async () => {
    const fc = fcRef.current;
    if (!fc) {
      console.error("[customize] addText: canvas not initialised");
      toast({ title:"Canvas not ready", description:"Try again in a moment.", variant:"destructive" });
      return;
    }
    // document.fonts.ready can hang in some browsers/environments — guard with timeout
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise(r => setTimeout(r, 300)),
      ]);
    } catch {}
    const pos = PLACEMENTS[txtPlacement] || { left:512, top:512 };
    const TextCtor = (fabric as any).FabricText || (fabric as any).Text;
    const t = new TextCtor(txtVal || "Your Text", {
      left: pos.left, top: pos.top,
      originX: "center", originY: "center",
      fontFamily: txtFont, fontSize: txtSize, fill: txtColor,
      fontWeight: "bold",
      // The body UVs of the GLB are horizontally mirrored when wrapped onto
      // the 3D mesh: typing "Akash" on the canvas would show "hsakA" on the
      // shirt. Pre-flipping on X cancels that mirror so it reads correctly.
      // Patterns/prints are repeating + roughly symmetric so the mirror is
      // not visible on them — only directional content (text, logos) needs it.
      flipX: true,
    });
    fc.add(t);
    fc.setActiveObject(t);
    fc.renderAll();
    syncTexture();
    console.debug("[customize] addText:", { text: txtVal, pos, totalObjects: fc.getObjects().length });
    toast({ title:"Text added", description:"Switch to the Canvas tab to drag it." });
  };
  const removeText = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = fc.getActiveObject();
    if (o) { fc.remove(o); fc.renderAll(); syncTexture(); }
  };

  // ── Logo ──────────────────────────────────────────────────────────────────
  const addLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      setLogoPreview(src);
      const img = await fabric.FabricImage.fromURL(src);
      const pos = PLACEMENTS[logoPlacement] || { left:512, top:512 };
      const maxW = parseInt(document.getElementById("logo-size-input")?.getAttribute("value")||"200");
      if (img.width && img.width > maxW) img.scaleToWidth(maxW);
      // flipX cancels the body-UV horizontal mirror so the logo reads correctly
      // on the 3D shirt — same fix as text. Symmetric logos won't notice.
      img.set({ left:pos.left, top:pos.top, originX:"center", originY:"center", flipX:true });
      const fc = fcRef.current; if (!fc) return;
      fc.add(img); fc.setActiveObject(img);
      logoObjRef.current = img;
      fc.renderAll(); syncTexture();
      toast({ title:"Logo added", description:"Drag on Canvas tab to reposition." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const applyLogo = () => {
    const o = logoObjRef.current || fcRef.current?.getActiveObject();
    if (!o) { toast({ title:"No logo", description:"Upload a logo first.", variant:"destructive" }); return; }
    const pos = PLACEMENTS[logoPlacement] || { left:512, top:512 };
    o.set({ left:pos.left, top:pos.top, originX:"center", originY:"center" });
    o.scale(logoScale);
    fcRef.current?.renderAll(); syncTexture();
    toast({ title:"Logo repositioned" });
  };
  const updateLogoSize = (v: number) => {
    setLogoScale(v / 100);
    const o = logoObjRef.current || fcRef.current?.getActiveObject();
    if (o) { o.scaleToWidth(v); fcRef.current?.renderAll(); syncTexture(); }
  };
  const removeLogo = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = logoObjRef.current || fc.getActiveObject();
    if (o) { fc.remove(o); logoObjRef.current = null; setLogoPreview(null); fc.renderAll(); syncTexture(); }
  };

  // ── Shapes ────────────────────────────────────────────────────────────────
  // All shapes drop at the user's currently-selected Placement so they land
  // on the same UV island the Patterns library uses (single source of truth).
  // Stroke colours are direction-agnostic so no flipX is needed here.
  const _shapePos = () => PLACEMENTS[shapePlacement] || { left: 512, top: 512 };
  const addLine = () => {
    const fc = fcRef.current; if (!fc) return;
    const p = _shapePos();
    fc.add(new fabric.Line([0,0,500,0],{stroke:shapeColor,strokeWidth:strokeW,left:p.left,top:p.top,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addCurve = () => {
    const fc = fcRef.current; if (!fc) return;
    const p = _shapePos();
    fc.add(new fabric.Path("M 0 80 Q 250 -80 500 80",{fill:"",stroke:shapeColor,strokeWidth:strokeW,left:p.left,top:p.top,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addRect = () => {
    const fc = fcRef.current; if (!fc) return;
    const p = _shapePos();
    fc.add(new fabric.Rect({width:300,height:180,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:p.left,top:p.top,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addCircle = () => {
    const fc = fcRef.current; if (!fc) return;
    const p = _shapePos();
    fc.add(new fabric.Circle({radius:140,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:p.left,top:p.top,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addStripes = () => {
    const fc = fcRef.current; if (!fc) return;
    const p = _shapePos();
    const lines = Array.from({length:14},(_,i) => new fabric.Line([-600,i*80-520,600,i*80-520],{stroke:shapeColor,strokeWidth:strokeW}));
    fc.add(new fabric.Group(lines,{left:p.left,top:p.top,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const removeSel = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = fc.getActiveObject();
    if (o) { fc.remove(o); fc.renderAll(); syncTexture(); }
  };
  const clearCanvas = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.getObjects().forEach(o => fc.remove(o)); fc.renderAll(); syncTexture();
    toast({ title:"Canvas cleared" });
  };

  // ── Selected element adjustments ──────────────────────────────────────────
  const setElS = (v: number) => {
    const o = fcRef.current?.getActiveObject();
    if (o) { o.scale(v); fcRef.current?.renderAll(); syncTexture(); }
    setElScale(v);
  };
  const setElPos = (k:"left"|"top", v: number) => {
    const o = fcRef.current?.getActiveObject(); if (!o) return;
    o.set(k, v); fcRef.current?.renderAll(); syncTexture();
    if (k==="left") setElX(v); else setElY(v);
  };

  // ── Snapshot the 3D model (the customer-facing view, with the design
  //     baked onto the t-shirt) — falls back to the flat canvas if model-
  //     viewer isn't ready yet.
  const snapshotModel = useCallback(async (): Promise<string> => {
    const mv: any = mvRef.current;
    const fc = fcRef.current;
    // Make sure the latest design is on the model before we snapshot
    try { await syncTexture(); } catch {}
    // Give the renderer one frame to commit the texture update
    await new Promise(r => requestAnimationFrame(() => r(null)));
    if (mv && typeof mv.toDataURL === "function") {
      try {
        return mv.toDataURL("image/png", 1.0);
      } catch (e) {
        console.warn("[customize] mv.toDataURL failed, falling back to canvas snapshot", e);
      }
    }
    if (fc) return fc.toDataURL({ format: "png", quality: 0.95, multiplier: 1 });
    throw new Error("Nothing to snapshot");
  }, [syncTexture]);

  // ── Export the customized 3D t-shirt as a PNG ────────────────────────────
  const exportCanvas = async () => {
    try {
      const dataUrl = await snapshotModel();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `kasha-design-${Date.now()}.png`;
      a.click();
      toast({ title: "Design exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const fc = fcRef.current;
      if (!fc) throw new Error("Canvas not ready");
      if (!designName.trim()) throw new Error("Enter a design name first");
      const matColors = mats.map(m => m.color);
      const garmentState = { sleeves:gSleeves, collar:gCollar, placket:gPlacket, panel:gPanel, stripe:gStripe, pattern };
      const canvasJSON = JSON.stringify((fc as any).toJSON(["data"]));
      // Preview thumbnail = snapshot of the 3D model (with the design baked
      // onto the t-shirt). textureUrl = full 1024px PNG, used by the admin
      // viewer to re-apply the exact design on a fresh model-viewer.
      const snap = await snapshotModel();
      const textureUrl = lastTextureUrlRef.current;
      return apiFetch("/api/customizations", { method:"POST", body: JSON.stringify({
        productId: id,
        name: designName,
        color: primaryColor,
        size,
        partsEnabled: { qty, matColors, canvasBg, presetName },
        canvasData: JSON.stringify({ canvasJSON, textureUrl, matColors, canvasBg, primaryColor, secondaryColor, garmentState, presetName }),
        previewImageUrl: snap,
      })});
    },
    onSuccess: () => {
      toast({ title:"Design Saved ✓", description:"Your bespoke design has been saved." });
      queryClient.invalidateQueries({ queryKey:["customization", id] });
    },
    onError: (err:any) => toast({ title:"Error", description:err.message, variant:"destructive" }),
  });

  // ── Add to Cart ────────────────────────────────────────────────────────────
  const cartMut = useMutation({
    mutationFn: async () => {
      const fc = fcRef.current; if (!fc) throw new Error("Canvas not ready");
      const matColors = mats.map(m => m.color);
      const garmentState = { sleeves:gSleeves, collar:gCollar, placket:gPlacket, panel:gPanel, stripe:gStripe, pattern };
      // Cart preview = snapshot of the 3D model with design baked on.
      const snap = await snapshotModel();
      const textureUrl = lastTextureUrlRef.current;
      const cust = await apiFetch("/api/customizations", { method:"POST", body: JSON.stringify({
        productId: id,
        name: designName || `${product?.name} Custom`,
        color: primaryColor, size,
        partsEnabled: { qty, matColors, canvasBg, presetName },
        canvasData: JSON.stringify({ canvasJSON:JSON.stringify((fc as any).toJSON(["data"])), textureUrl, matColors, canvasBg, primaryColor, secondaryColor, garmentState, presetName }),
        previewImageUrl: snap,
      })});
      return apiFetch("/api/cart/items", { method:"POST", body: JSON.stringify({
        productId:id, customizationId:cust.id, quantity:qty, size,
      })});
    },
    onSuccess: () => { toast({ title:"Added to Cart" }); setLocation("/cart"); },
    onError: (err:any) => toast({ title:"Error", description:err.message, variant:"destructive" }),
  });

  // ── Design summary (live) ─────────────────────────────────────────────────
  const summary = [
    { label:"Style",    val: presetName },
    { label:"Primary",  val: <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:12,height:12,borderRadius:"50%",background:primaryColor,display:"inline-block",border:"1px solid rgba(255,255,255,.2)" }}/>{primaryColor}</span> },
    { label:"Trim",     val: <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:12,height:12,borderRadius:"50%",background:secondaryColor,display:"inline-block",border:"1px solid rgba(255,255,255,.2)" }}/>{secondaryColor}</span> },
    { label:"Sleeves",  val: gSleeves?"Yes":"No" },
    { label:"Collar",   val: gCollar?"Yes":"No" },
    { label:"Placket",  val: gPlacket?"Yes":"No" },
    { label:"Panel",    val: gPanel?"Yes":"No" },
    { label:"Stripe",   val: gStripe?"Yes":"No" },
    { label:"Pattern",  val: pattern },
    { label:"Size/Qty", val: `${size} × ${qty}` },
  ];

  // ── Shared style helpers ──────────────────────────────────────────────────
  const btnStyle = (v:"primary"|"secondary"|"danger"|"ghost"="ghost"): React.CSSProperties => {
    const base: React.CSSProperties = { width:"100%",padding:"8px",borderRadius:"8px",border:"none",fontFamily:"inherit",fontSize:"12px",fontWeight:600,cursor:"pointer",transition:"all .15s",letterSpacing:".02em" };
    if (v==="primary")   return { ...base, background:V.ac, color:V.bg };
    if (v==="secondary") return { ...base, background:V.sf2, color:V.tx, border:`1px solid ${V.bd}` };
    if (v==="danger")    return { ...base, background:"rgba(196,92,92,.15)", color:"#c45c5c", border:"1px solid rgba(196,92,92,.2)" };
    return { ...base, background:V.sf2, color:V.tx, border:`1px solid ${V.bd}` };
  };
  const inp: React.CSSProperties = { width:"100%",padding:"8px 10px",background:"rgba(0,0,0,.4)",border:`1px solid ${V.bd}`,borderRadius:"8px",color:V.tx,fontFamily:"inherit",fontSize:"12px",outline:"none" };
  const slr: React.CSSProperties = { display:"flex",alignItems:"center",gap:"8px",marginTop:"4px" };
  const lbl: React.CSSProperties = { fontSize:"10px",color:V.mu,width:"44px",flexShrink:0 };
  const sl: React.CSSProperties  = { fontSize:"10px",letterSpacing:".1em",textTransform:"uppercase",color:V.mu,fontWeight:600,marginBottom:"7px" };
  const sb: React.CSSProperties  = { padding:"12px 0",borderBottom:`1px solid ${V.bd}` };

  const togBtn = (on:boolean, toggle:()=>void) => (
    <button onClick={toggle} style={{ width:"34px",height:"18px",background:on?V.ac:V.bd2,borderRadius:"9px",cursor:"pointer",border:"none",position:"relative",transition:"background .2s",flexShrink:0 }}>
      <div style={{ position:"absolute",top:"2px",left:on?"18px":"2px",width:"14px",height:"14px",background:"#fff",borderRadius:"50%",transition:"left .2s",boxShadow:"0 1px 2px rgba(0,0,0,.3)" }} />
    </button>
  );

  const placeBtns = (options: string[], active: string, setActive: (s:string)=>void) => (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginTop:"6px" }}>
      {options.map(opt => (
        <button key={opt} onClick={()=>setActive(opt)} style={{
          padding:"6px 0",fontSize:"10px",fontWeight:500,fontFamily:"inherit",cursor:"pointer",textAlign:"center",
          borderRadius:"7px",border:`1.5px solid ${active===opt?V.ac:V.bd}`,
          background:active===opt?"rgba(201,168,124,.15)":V.sf,
          color:active===opt?V.ac:V.mu,transition:"all .15s",
        }}>
          {opt.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
        </button>
      ))}
    </div>
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:V.bg }}>
      <div style={{ width:36,height:36,border:`2px solid ${V.bd2}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite" }} />
    </div>
  );
  if (!product) return null;

  const PLACEMENT_OPTS = ["front-chest","front-center","back-top","back-center","sleeve-left","sleeve-right"];
  // ── Customizer flow split (KA.SHA spec) ──
  // Fabric flow: print/design library + text/logo/canvas. NO GT styles, NO shapes.
  // Pattern flow: GT colors (locked to product.fixedPattern) + text/logo/canvas. NO designs/prints, NO shapes.
  const isPatternFlow = product.productType === "pattern";
  const TABS = (isPatternFlow
    ? (["colors","text","logo","canvas"] as const)
    : (["design","text","logo","canvas"] as const)) as readonly ("colors"|"design"|"text"|"logo"|"shapes"|"canvas")[];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100vh",background:V.bg,color:V.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:"48px",borderBottom:`1px solid ${V.bd}`,background:"rgba(8,6,4,0.9)",backdropFilter:"blur(12px)",flexShrink:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
          <Link href={`/products/${id}`} style={{ color:V.mu,fontSize:"13px",textDecoration:"none" }}>← Back</Link>
          <div style={{ width:"1px",height:"16px",background:V.bd }} />
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:"15px",color:V.ac,letterSpacing:".04em" }}>Golf Studio ✦ 3D Customizer</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <input value={designName} onChange={e=>setDesignName(e.target.value)} placeholder="Name your design…" style={{ ...inp,width:"160px",fontSize:"12px" }} />
          <Show when="signed-in">
            <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
              style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:V.ac,color:V.bg,fontSize:"12px",fontWeight:600,cursor:"pointer",opacity:saveMut.isPending?0.6:1 }}>
              {saveMut.isPending?"Saving…":"💾 Save"}
            </button>
          </Show>
          <Show when="signed-out">
            <Link href="/sign-in" style={{ padding:"6px 14px",borderRadius:"8px",border:`1px solid ${V.bd}`,color:V.mu,fontSize:"12px",textDecoration:"none" }}>Sign in to save</Link>
          </Show>
          <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending||saveMut.isPending}
            style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:"#2d6a4f",color:"white",fontSize:"12px",fontWeight:600,cursor:"pointer",opacity:cartMut.isPending?0.6:1 }}>
            {cartMut.isPending?"Adding…":"🛒 Add to Cart"}
          </button>
        </div>
      </header>

      {/* ── WORKSPACE ── */}
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>

        {/* ════ LEFT PANEL ════ */}
        <div style={{ width:"260px",minWidth:"260px",borderRight:`1px solid ${V.bd}`,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:0,scrollbarWidth:"thin",background:V.bg }}>

          {/* Garment Parts — fixed 5 zones (Front, Back, L-Sleeve, R-Sleeve, Collar) */}
          <div style={sb}>
            <div style={sl}>Garment Parts</div>
            <p style={{ margin:"0 0 8px",fontSize:"10px",color:V.mu,lineHeight:1.5 }}>
              Pick a part, then choose a colour from the palette below. Click ✕ to clear.
            </p>
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {COLOR_ZONES.map(z => {
                const active = activeColorZone === z.id;
                const col    = zoneColors[z.id];
                return (
                  <div key={z.id} onClick={()=>setActiveColorZone(z.id)} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:active?`rgba(201,168,124,.12)`:"rgba(0,0,0,.25)",
                    padding:"9px 11px",borderRadius:"9px",
                    border:`1px solid ${active?V.ac:V.bd}`,
                    cursor:"pointer",transition:"border-color .15s",
                  }}>
                    <div>
                      <div style={{ fontSize:"11px",fontWeight:500 }}>{z.label}</div>
                      <div style={{ fontSize:"10px",color:V.ac,marginTop:"1px" }}>
                        {col ? col.toUpperCase() : "No colour"}
                      </div>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                      <input type="color" value={col || "#ffffff"}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>{ setActiveColorZone(z.id); applyZoneColor(z.id,e.target.value); }}
                        style={{ width:"30px",height:"24px",border:"none",cursor:"pointer",background:"none",borderRadius:"5px",padding:0 }}
                      />
                      {col && (
                        <button
                          onClick={e=>{ e.stopPropagation(); applyZoneColor(z.id, ""); }}
                          title="Clear this zone"
                          style={{ background:"none",border:`1px solid ${V.bd}`,color:V.mu,
                                   cursor:"pointer",fontSize:"11px",borderRadius:"5px",
                                   width:"22px",height:"24px",lineHeight:"1",padding:0 }}
                        >×</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div style={sb}>
            <div style={sl}>Options</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0" }}>
              <div>
                <div style={{ fontSize:"12px",fontWeight:500 }}>Auto Rotate</div>
                <div style={{ fontSize:"10px",color:V.mu }}>Spin 3D preview</div>
              </div>
              {togBtn(autoRotate, () => {
                const next = !autoRotate; setAutoRotate(next);
                const mv = mvRef.current;
                if (mv) { if (next) mv.setAttribute("auto-rotate",""); else mv.removeAttribute("auto-rotate"); }
              })}
            </div>
          </div>

          {/* Size */}
          <div style={sb}>
            <div style={sl}>Size</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"5px" }}>
              {SIZES.map(s => (
                <button key={s} onClick={()=>setSize(s)} style={{
                  flex:1,minWidth:"34px",padding:"7px 0",
                  background:size===s?V.ac:"rgba(0,0,0,.3)",
                  border:`1px solid ${size===s?V.ac:V.bd}`,
                  borderRadius:"8px",color:size===s?V.bg:V.mu,
                  fontFamily:"inherit",fontSize:"12px",fontWeight:600,cursor:"pointer",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div style={sb}>
            <div style={sl}>Quantity</div>
            <div style={{ display:"flex",alignItems:"center",gap:"9px" }}>
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:"28px",height:"28px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:"6px",color:V.tx,fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>−</button>
              <span style={{ fontSize:"15px",fontWeight:600,minWidth:"26px",textAlign:"center" }}>{qty}</span>
              <button onClick={()=>setQty(q=>q+1)} style={{ width:"28px",height:"28px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:"6px",color:V.tx,fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>+</button>
            </div>
          </div>

          {/* Save / Export */}
          <div style={{ padding:"12px 0" }}>
            <Show when="signed-in">
              <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
                style={{ ...btnStyle("primary"),marginBottom:"7px" }}>
                {saveMut.isPending?"Saving…":"💾 Save This Design"}
              </button>
            </Show>
            <button onClick={exportCanvas} style={btnStyle("secondary")}>📷 Export Design Canvas</button>
          </div>
        </div>

        {/* ════ CENTER: 3D VIEWER ════ */}
        <div style={{ flex:1,position:"relative",background:"radial-gradient(ellipse at center,#1a1612 0%,#080604 100%)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>

          {/* Loading overlay */}
          <div id="mv-overlay" style={{ position:"absolute",inset:0,background:V.bg,display:webglAvailable?"flex":"none",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px",zIndex:10,transition:"opacity .5s" }}>
            <div style={{ width:"36px",height:"36px",border:`2px solid ${V.bd2}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite" }} />
            <p style={{ fontSize:"12px",color:V.mu }}>Loading 3D T-Shirt…</p>
          </div>

          {/* model-viewer (WebGL) */}
          {mvReady && product.modelUrl && webglAvailable && (
            <model-viewer
              ref={mvRef}
              src={product.modelUrl}
              camera-controls
              auto-rotate
              rotation-per-second="8deg"
              shadow-intensity="1.5"
              environment-image="neutral"
              exposure="1.1"
              camera-orbit="0deg 75deg 2.5m"
              min-camera-orbit="auto auto 1.5m"
              max-camera-orbit="auto auto 5m"
              interaction-prompt="none"
              style={{ width:"100%",height:"100%","--poster-color":"transparent" } as any}
            />
          )}

          {/* Fallback when no WebGL or no model */}
          {(!product.modelUrl || !webglAvailable) && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"16px",color:V.mu,padding:"24px",maxWidth:"320px",textAlign:"center" }}>
              {product.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={product.name} style={{ maxHeight:"360px",objectFit:"contain",borderRadius:"12px",opacity:0.85 }} />
              ) : (
                <div style={{ fontSize:"64px",opacity:.2 }}>👕</div>
              )}
              <p style={{ fontSize:"11px",lineHeight:1.6 }}>
                {!webglAvailable
                  ? "3D preview requires WebGL. All design tools are fully functional — your design will be applied to the 3D model."
                  : "No 3D model uploaded for this product."}
              </p>
            </div>
          )}

          {/* Hint pill */}
          <div style={{ position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",fontSize:"10px",color:V.mu,background:"rgba(0,0,0,.55)",padding:"4px 12px",borderRadius:"20px",pointerEvents:"none",letterSpacing:".04em" }}>
            Drag to rotate · Scroll to zoom
          </div>

          {/* Product badge */}
          <div style={{ position:"absolute",top:"14px",left:"14px",background:"rgba(8,6,4,.85)",border:`1px solid ${V.bd}`,borderRadius:"9px",padding:"8px 12px",backdropFilter:"blur(8px)" }}>
            <div style={{ fontSize:"11px",fontWeight:600,color:V.ac }}>{product.name}</div>
            <div style={{ fontSize:"10px",color:V.mu }}>{formatPrice(product.priceInPaise)}</div>
          </div>

          {/* Style badge */}
          <div style={{ position:"absolute",top:"14px",right:"14px",background:"rgba(8,6,4,.85)",border:`1px solid ${V.bd}`,borderRadius:"9px",padding:"6px 10px",backdropFilter:"blur(8px)" }}>
            <div style={{ fontSize:"9px",color:V.mu,letterSpacing:".08em",textTransform:"uppercase" }}>Style</div>
            <div style={{ fontSize:"12px",fontWeight:600,color:V.ac }}>{presetName}</div>
          </div>
        </div>

        {/* ════ RIGHT PANEL: Design Tools ════ */}
        <div style={{ width:"300px",minWidth:"300px",borderLeft:`1px solid ${V.bd}`,overflowY:"auto",display:"flex",flexDirection:"column",scrollbarWidth:"thin",background:V.bg }}>

          {/* Tab bar */}
          <div style={{ display:"flex",borderBottom:`1px solid ${V.bd}`,flexShrink:0,flexWrap:"wrap" }}>
            {TABS.map(t => (
              <button key={t} onClick={()=>setRightTab(t)} style={{
                flex:"1 1 auto",padding:"8px 4px",background:"none",border:"none",
                color:rightTab===t?V.ac:V.mu,fontFamily:"inherit",fontSize:"10px",fontWeight:600,
                letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",
                borderBottom:`2px solid ${rightTab===t?V.ac:"transparent"}`,transition:"all .15s",
                minWidth:"40px",
              }}>{t}</button>
            ))}
          </div>

          {/* ── COLORS TAB ── Design Styles (GT001–GT032) + Design Summary */}
          {rightTab==="colors" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"16px" }}>

              {/* GT Design Style System (moved from Design tab) */}
              <div>
                <div style={sl}>
                  {isPatternFlow ? `Locked Style — ${product.fixedPattern ?? ""}` : "Design Styles (GT001–GT032)"}
                </div>
                <p style={{ margin:"0 0 8px",fontSize:"10px",color:V.mu,lineHeight:1.5 }}>
                  {isPatternFlow
                    ? "This product comes with a fixed pattern. Recolour the zones below — the cut and panel layout stay the same."
                    : "Pick a predefined style — it applies to the right shirt zones automatically. Then recolour to taste."}
                </p>

                {!isPatternFlow && (
                <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
                  {GT_GROUPS.map((group) => {
                    const groupStyles = GT_STYLES.filter((s) => s.group === group.id);
                    const isOpen = gtGroupOpen === group.id;
                    return (
                      <div key={group.id} style={{ border:`1px solid ${V.bd}`,borderRadius:"8px",overflow:"hidden" }}>
                        <button
                          onClick={() => setGtGroupOpen(isOpen ? null : group.id)}
                          style={{
                            width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                            padding:"7px 10px",
                            background: isOpen ? "rgba(201,168,124,.10)" : V.sf,
                            border:"none",cursor:"pointer",fontFamily:"inherit",
                            color: isOpen ? V.ac : V.mu,
                            fontWeight:600,fontSize:"11px",letterSpacing:"0.5px",
                          }}
                        >
                          <span>{group.label}  <span style={{ opacity:0.55,fontWeight:400 }}>({groupStyles.length})</span></span>
                          <span style={{ fontSize:"9px" }}>{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen && (
                          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px",padding:"6px",background:V.sf }}>
                            {groupStyles.map((style) => {
                              const isActive = activeGtStyle?.id === style.id;
                              return (
                                <button
                                  key={style.id}
                                  onClick={() => handleSelectGtStyle(style)}
                                  title={`${style.id} — ${style.label}`}
                                  style={{
                                    padding:0,borderRadius:"6px",overflow:"hidden",cursor:"pointer",
                                    border: isActive ? `2px solid ${V.ac}` : `1px solid ${V.bd}`,
                                    boxShadow: isActive ? `0 0 0 2px rgba(201,168,124,.25)` : "none",
                                    background:"none",
                                  }}
                                >
                                  <GtSwatch style={style} isActive={isActive} accent={V.ac} />
                                  <div style={{
                                    background:"rgba(0,0,0,0.55)",
                                    color: isActive ? V.ac : "#f8f4e9",
                                    fontSize:"9px",fontWeight:700,padding:"2px 0",textAlign:"center",letterSpacing:"0.5px",
                                  }}>{style.id}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}

                {activeGtStyle && (
                  <div style={{
                    marginTop:"10px",
                    background:V.sf,border:`1px solid ${V.bd}`,borderRadius:"8px",padding:"10px",
                    display:"flex",flexDirection:"column",gap:"9px",
                  }}>
                    <div style={{ fontSize:"12px",fontWeight:600,color:V.tx }}>
                      {activeGtStyle.id} — {activeGtStyle.label}
                    </div>

                    <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                      <input
                        type="color"
                        value={gtColors.primary}
                        onChange={(e) => handleGtColorChange("primary", e.target.value)}
                        style={{ width:34,height:34,border:"none",cursor:"pointer",borderRadius:"6px",padding:0,background:"none" }}
                      />
                      <div>
                        <div style={{ fontSize:"11px",fontWeight:600,color:V.tx }}>Primary</div>
                        <div style={{ fontSize:"10px",color:V.mu }}>Body / main panels</div>
                      </div>
                    </div>

                    <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                      <input
                        type="color"
                        value={gtColors.accent}
                        onChange={(e) => handleGtColorChange("accent", e.target.value)}
                        style={{ width:34,height:34,border:"none",cursor:"pointer",borderRadius:"6px",padding:0,background:"none" }}
                      />
                      <div>
                        <div style={{ fontSize:"11px",fontWeight:600,color:V.tx }}>Accent</div>
                        <div style={{ fontSize:"10px",color:V.mu }}>Collar / cuffs / panels</div>
                      </div>
                    </div>

                    {activeGtStyle.defaultColors.tertiary !== undefined && (
                      <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                        <input
                          type="color"
                          value={gtColors.tertiary ?? activeGtStyle.defaultColors.tertiary}
                          onChange={(e) => handleGtColorChange("tertiary", e.target.value)}
                          style={{ width:34,height:34,border:"none",cursor:"pointer",borderRadius:"6px",padding:0,background:"none" }}
                        />
                        <div>
                          <div style={{ fontSize:"11px",fontWeight:600,color:V.tx }}>Third Colour</div>
                          <div style={{ fontSize:"10px",color:V.mu }}>Collar highlight</div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize:"10px",color:V.mu,marginBottom:"5px",letterSpacing:"0.5px",textTransform:"uppercase" }}>
                        Quick palette → primary
                      </div>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:"4px" }}>
                        {GT_PALETTE.map((hex) => (
                          <button
                            key={hex}
                            onClick={() => handleGtColorChange("primary", hex)}
                            title={hex}
                            style={{
                              width:20,height:20,borderRadius:"50%",background:hex,
                              border: gtColors.primary.toLowerCase() === hex.toLowerCase()
                                ? `2px solid ${V.ac}` : `1px solid ${V.bd}`,
                              cursor:"pointer",padding:0,flexShrink:0,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {!isPatternFlow && (
                      <button
                        onClick={handleClearGtStyle}
                        style={{
                          padding:"7px",background:"transparent",
                          color:"#c4727a",border:"1px solid rgba(196,114,122,.45)",borderRadius:"6px",
                          fontFamily:"inherit",fontWeight:600,fontSize:"11px",cursor:"pointer",
                        }}
                      >
                        ✕ Remove design style
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Design Summary (kept) */}
              <div style={{ background:V.sf,border:`1px solid ${V.bd}`,borderRadius:"9px",padding:"12px" }}>
                <div style={sl}>Design Summary</div>
                {summary.map(r => (
                  <div key={r.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${V.bd}` }}>
                    <span style={{ fontSize:"11px",color:V.mu }}>{r.label}</span>
                    <span style={{ fontSize:"11px",color:V.tx,fontWeight:500 }}>{r.val as any}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DESIGN TAB ── two sections: Print Library + Garment Options */}
          {rightTab==="design" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"16px" }}>

              {/* SECTION 1: Print Library */}
              <div>
                <div style={sl}>Print Library</div>
                <p style={{ margin:"0 0 8px",fontSize:"10px",color:V.mu,lineHeight:1.5 }}>
                  Pick a print, then apply it across the whole garment or place it on a single zone. You can stack multiple prints — drag them on the Canvas tab.
                </p>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px" }}>
                  {PATTERNS.map((p) => {
                    const sel = activePrintId === p.id;
                    const all = allOverPrintId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActivePrintId(p.id)}
                        title={p.label}
                        style={{
                          position:"relative",padding:0,aspectRatio:"1/1",borderRadius:"7px",overflow:"hidden",cursor:"pointer",
                          background:`url(${patternUrl(p.file)}) center/cover`,
                          border:sel?`2px solid ${V.ac}`:`1px solid ${V.bd}`,
                          boxShadow:sel?`0 0 0 2px rgba(201,168,124,.25)`:"none",
                        }}
                      >
                        {all && (
                          <span style={{
                            position:"absolute",top:3,right:3,fontSize:"8px",fontWeight:800,
                            background:V.ac,color:"#fff",padding:"1px 4px",borderRadius:"3px",letterSpacing:"0.5px",
                          }}>ALL</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {activePrintId && (() => {
                  const p = PATTERNS.find(x => x.id === activePrintId);
                  if (!p) return null;
                  return (
                    <div style={{ marginTop:"10px",background:V.sf,border:`1px solid ${V.bd}`,borderRadius:"7px",padding:"10px",display:"flex",flexDirection:"column",gap:"8px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                        <div style={{ width:32,height:32,borderRadius:5,background:`url(${patternUrl(p.file)}) center/cover`,flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:"11px",fontWeight:600 }}>{p.label}</div>
                          <div style={{ display:"flex",gap:3,marginTop:3 }}>
                            {p.swatchColors.map(c => (
                              <span key={c} style={{ width:10,height:10,borderRadius:"50%",background:c,border:`1px solid ${V.bd}` }} />
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => applyAllOverPrint(p)}
                        style={{ ...btnStyle("primary"),padding:"7px 0",fontSize:"11px",fontWeight:700 }}
                      >
                        {allOverPrintId === p.id ? "✓ Applied All-Over" : "Apply to whole T-shirt"}
                      </button>

                      <div style={{ fontSize:"9px",color:V.mu,textTransform:"uppercase",letterSpacing:"1px",marginTop:2 }}>
                        Or place on a zone
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px" }}>
                        {(["front","back","leftSleeve","rightSleeve","collar"] as const).map(zone => (
                          <button
                            key={zone}
                            onClick={() => placePrintOnZone(p, zone)}
                            style={{ ...btnStyle("secondary"),padding:"6px 0",fontSize:"10px",fontWeight:600 }}
                          >
                            + {ZONE_LABEL[zone]}
                          </button>
                        ))}
                      </div>

                      {allOverPrintId && (
                        <button
                          onClick={clearAllOverPrint}
                          style={{ ...btnStyle("danger"),padding:"6px 0",fontSize:"10px",fontWeight:600 }}
                        >
                          ✕ Remove all-over print
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* SECTION 2: Garment Options */}
              <div>
                <div style={sl}>Garment Options</div>
                {([
                  { key:"sleeves", label:"Sleeves",        desc:"Short sleeve design",      val:gSleeves, set:(v:boolean)=>{ setGSleeves(v); toggleGarment("sleeve",v,secondaryColor); } },
                  { key:"collar",  label:"Collar",         desc:"Polo collar style",        val:gCollar,  set:(v:boolean)=>{ setGCollar(v);  toggleGarment("collar",v,secondaryColor); } },
                  { key:"placket", label:"Button Placket", desc:"Front 3-button placket",   val:gPlacket, set:(v:boolean)=>{ setGPlacket(v); toggleGarment("placket",v,secondaryColor); } },
                  { key:"panel",   label:"Side Panel",     desc:"Contrast color panels",    val:gPanel,   set:(v:boolean)=>{ setGPanel(v);   toggleGarment("panel",v,secondaryColor); } },
                  { key:"stripe",  label:"Chest Stripe",   desc:"Diagonal accent stripe",   val:gStripe,  set:(v:boolean)=>{ setGStripe(v);  toggleGarment("stripe",v,secondaryColor); } },
                ] as const).map(item => (
                  <div key={item.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${V.bd}` }}>
                    <div>
                      <div style={{ fontSize:"12px",fontWeight:500 }}>{item.label}</div>
                      <div style={{ fontSize:"10px",color:V.mu }}>{item.desc}</div>
                    </div>
                    {togBtn(item.val, ()=>item.set(!item.val))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TEXT TAB ── */}
          {rightTab==="text" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={sl}>Text Content</div>
                <input type="text" value={txtVal} onChange={e=>setTxtVal(e.target.value)}
                  placeholder="e.g. GOLF CLUB 2024" maxLength={40} style={inp} />
              </div>
              <div style={{ display:"flex",gap:"7px",alignItems:"center" }}>
                <input type="color" value={txtColor} onChange={e=>setTxtColor(e.target.value)}
                  style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                <span style={{ fontSize:"11px",color:V.mu }}>Color</span>
                <select value={txtFont} onChange={e=>setTxtFont(e.target.value)} style={{ ...inp,flex:1,padding:"5px 7px" }}>
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div style={sl}>Font Size</div>
                <div style={slr}>
                  <label style={lbl}>Size</label>
                  <input type="range" min={20} max={200} value={txtSize} onChange={e=>setTxtSize(+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{txtSize}</span>
                </div>
              </div>
              <div>
                <div style={sl}>Placement</div>
                {placeBtns(PLACEMENT_OPTS, txtPlacement, setTxtPlacement)}
              </div>
              <div style={{ display:"flex",gap:"5px" }}>
                <button onClick={addText} style={{ ...btnStyle("primary"),flex:1,padding:"8px 0",fontSize:"11px" }}>Apply Text to Shirt</button>
                <button onClick={removeText} style={{ ...btnStyle("danger"),flex:1,padding:"8px 0",fontSize:"11px" }}>Remove</button>
              </div>
              <div style={{ background:"rgba(201,168,124,.07)",border:`1px solid rgba(201,168,124,.18)`,borderRadius:"7px",padding:"9px" }}>
                <p style={{ fontSize:"10px",color:V.ac,lineHeight:1.5 }}>💡 Add text then drag it on the Canvas tab to fine-tune position. Updates the 3D model live.</p>
              </div>
            </div>
          )}

          {/* ── LOGO TAB ── */}
          {rightTab==="logo" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={sl}>Upload Logo / Graphic</div>
                <label style={{ display:"block",border:`1.5px dashed ${V.bd2}`,borderRadius:"9px",padding:"16px",textAlign:"center",cursor:"pointer",transition:"all .15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=V.ac)}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor=V.bd2)}>
                  <div style={{ fontSize:"20px" }}>⬆</div>
                  <p style={{ fontSize:"11px",color:V.mu,marginTop:"3px" }}><strong style={{ color:V.ac }}>Click to upload</strong></p>
                  <p style={{ fontSize:"10px",color:V.mu }}>PNG, SVG, JPG (max 2MB) — PNG with transparency recommended</p>
                  <input type="file" accept="image/*" onChange={addLogo} style={{ display:"none" }} />
                </label>
              </div>
              {logoPreview && (
                <div>
                  <div style={sl}>Preview</div>
                  <img src={logoPreview} alt="Logo" style={{ maxWidth:"100%",borderRadius:"7px",border:`1px solid ${V.bd}` }} />
                </div>
              )}
              <div>
                <div style={sl}>Logo Placement</div>
                {placeBtns(PLACEMENT_OPTS, logoPlacement, setLogoPlacement)}
              </div>
              <div>
                <div style={sl}>Logo Size</div>
                <div style={slr}>
                  <label style={lbl}>Size</label>
                  <input id="logo-size-input" type="range" min={40} max={400} step={10} defaultValue={200}
                    onChange={e=>updateLogoSize(+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"34px",textAlign:"right" }}>{Math.round(logoScale*200)}px</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:"5px" }}>
                <button onClick={applyLogo} style={{ ...btnStyle("primary"),flex:1,padding:"8px 0",fontSize:"11px" }}>Apply Logo</button>
                <button onClick={removeLogo} style={{ ...btnStyle("danger"),flex:1,padding:"8px 0",fontSize:"11px" }}>Remove Logo</button>
              </div>
            </div>
          )}

          {/* ── SHAPES TAB ── */}
          {rightTab==="shapes" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={sl}>Shape / Stroke Color</div>
                <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                  <input type="color" value={shapeColor} onChange={e=>setShapeColor(e.target.value)}
                    style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                  <span style={{ fontSize:"11px",color:V.mu }}>Shape color</span>
                </div>
              </div>
              <div>
                <div style={sl}>Stroke Width</div>
                <div style={slr}>
                  <label style={lbl}>Width</label>
                  <input type="range" min={2} max={60} value={strokeW} onChange={e=>setStrokeW(+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{strokeW}</span>
                </div>
              </div>
              <div>
                <div style={sl}>Placement</div>
                {placeBtns(PLACEMENT_OPTS, shapePlacement, setShapePlacement)}
              </div>
              <div>
                <div style={sl}>Add Shape</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px" }}>
                  <button onClick={addLine} style={{ ...btnStyle("secondary"),padding:"7px 0",fontSize:"11px" }}>— Line</button>
                  <button onClick={addCurve} style={{ ...btnStyle("secondary"),padding:"7px 0",fontSize:"11px" }}>⌒ Curve</button>
                  <button onClick={addRect} style={{ ...btnStyle("secondary"),padding:"7px 0",fontSize:"11px" }}>▭ Rectangle</button>
                  <button onClick={addCircle} style={{ ...btnStyle("secondary"),padding:"7px 0",fontSize:"11px" }}>○ Circle</button>
                  <button onClick={addStripes} style={{ ...btnStyle("secondary"),padding:"7px 0",fontSize:"11px",gridColumn:"span 2" }}>≡ Stripe Pattern</button>
                </div>
              </div>
              <button onClick={removeSel} style={{ ...btnStyle("danger"),padding:"7px 0",fontSize:"11px" }}>Remove Selected</button>
            </div>
          )}

          {/* ── CANVAS TAB ── */}
          {rightTab==="canvas" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={sl}>Texture Background Color</div>
                <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                  <input type="color" value={canvasBg} onChange={e=>setFcBg(e.target.value)}
                    style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                  <span style={{ fontSize:"11px",color:V.mu }}>Canvas background (= primary color)</span>
                </div>
              </div>
              <div>
                <div style={sl}>Adjust Selected Element</div>
                <div style={slr}>
                  <label style={lbl}>Scale</label>
                  <input type="range" min={0.1} max={5} step={0.05} value={elScale} onChange={e=>setElS(+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"32px",textAlign:"right" }}>{elScale.toFixed(1)}×</span>
                </div>
                <div style={slr}>
                  <label style={lbl}>Pos X</label>
                  <input type="range" min={0} max={1024} step={5} value={elX} onChange={e=>setElPos("left",+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"32px",textAlign:"right" }}>{elX}</span>
                </div>
                <div style={slr}>
                  <label style={lbl}>Pos Y</label>
                  <input type="range" min={0} max={1024} step={5} value={elY} onChange={e=>setElPos("top",+e.target.value)}
                    style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"32px",textAlign:"right" }}>{elY}</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:"5px" }}>
                <button onClick={clearCanvas} style={{ ...btnStyle("secondary"),flex:1,padding:"6px 0",fontSize:"11px" }}>Clear All</button>
                <button onClick={removeSel} style={{ ...btnStyle("danger"),flex:1,padding:"6px 0",fontSize:"11px" }}>Remove Sel.</button>
              </div>
              {/* Live Fabric canvas preview — always-mounted canvas is shown here */}
              <div>
                <div style={{ ...sl,marginBottom:"8px" }}>Live Canvas — drag elements to reposition</div>
              </div>
            </div>
          )}

          {/*
           * ALWAYS-MOUNTED FABRIC CANVAS
           * This div must NEVER be conditionally rendered.
           * When off the canvas tab it sits off-screen so the DOM element
           * (and therefore fcRef.current) is always valid, making save /
           * export / color-sync work from every tab.
           */}
          {/*
           * The Fabric canvas MUST stay 1024×1024 internally and the wrapper
           * MUST remain visible to the browser (opacity 0.01, NOT hidden) —
           * otherwise toDataURL() returns a blank PNG and the texture sent
           * to the 3D model is empty. We display the visible preview via a
           * CSS transform-scale on a child wrapper so the underlying pixel
           * buffer is never resized.
           */}
          <div
            id="fc-wrapper"
            style={rightTab === "canvas"
              ? { background:"#fff",borderRadius:"9px",overflow:"hidden",border:`1px solid ${V.bd2}`,width:"100%",aspectRatio:"1/1",position:"relative",margin:"0 0 14px 0" }
              : { position:"fixed",left:"-9999px",top:0,width:"1024px",height:"1024px",pointerEvents:"none",opacity:0.01,zIndex:-1 }
            }
          >
            <div id="fc-scale-host" style={{ position:"absolute", left:0, top:0, width:"1024px", height:"1024px", transformOrigin:"top left" }}>
              <canvas ref={canvasElRef} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:${V.bd2}; border-radius:2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:13px; height:13px; background:${V.ac}; border-radius:50%; cursor:pointer; border:2px solid #fff; }
        input[type=range] { -webkit-appearance:none; appearance:none; }
      `}</style>
    </div>
  );
}
