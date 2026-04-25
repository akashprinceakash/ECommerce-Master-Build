import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import * as fabric from "fabric";
import { PATTERNS, ZONE_PRESETS, ZONE_LABEL, ALL_OVER_TILE_PX, patternUrl, type PatternZone, type PatternDef } from "@/components/3d/patterns";

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number; name: string; description: string; category: string;
  priceInPaise: number; modelUrl: string; thumbnailUrl?: string | null; defaultColor?: string;
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

// Placement → canvas coordinate map (1024×1024 UV space)
const PLACEMENTS: Record<string, {left:number;top:number}> = {
  "front-chest":  { left:320, top:280 },
  "front-center": { left:512, top:512 },
  "back-top":     { left:512, top:180 },
  "back-center":  { left:512, top:420 },
  "sleeve-left":  { left:170, top:480 },
  "sleeve-right": { left:854, top:480 },
};

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
  const [rightTab, setRightTab]     = useState<"colors"|"design"|"text"|"logo"|"shapes"|"canvas">("colors");

  // Print Library state
  const [activePrintId, setActivePrintId]   = useState<string | null>(null);
  const [allOverPrintId, setAllOverPrintId] = useState<string | null>(null);
  const baseBgRef = useRef<string>("#C5D3DE");

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
  }, [mats, syncTexture, toast]);

  const clearAllOverPrint = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    setFabricBg(fc, baseBgRef.current || "#ffffff");
    fc.renderAll();
    setAllOverPrintId(null);
    syncTexture();
  }, [syncTexture]);

  const placePrintOnZone = useCallback(async (p: PatternDef, zone: Exclude<PatternZone, "all">) => {
    const fc = fcRef.current;
    if (!fc) return;
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
      img.set({ left:pos.left, top:pos.top, originX:"center", originY:"center" });
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
  const addLine = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.add(new fabric.Line([0,0,500,0],{stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addCurve = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.add(new fabric.Path("M 0 80 Q 250 -80 500 80",{fill:"",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addRect = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.add(new fabric.Rect({width:300,height:180,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addCircle = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.add(new fabric.Circle({radius:140,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"}));
    fc.renderAll(); syncTexture();
  };
  const addStripes = () => {
    const fc = fcRef.current; if (!fc) return;
    const lines = Array.from({length:14},(_,i) => new fabric.Line([-600,i*80-520,600,i*80-520],{stroke:shapeColor,strokeWidth:strokeW}));
    fc.add(new fabric.Group(lines,{left:512,top:512,originX:"center",originY:"center"}));
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
  const TABS = ["colors","design","text","logo","shapes","canvas"] as const;

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

          {/* Garment Parts */}
          <div style={sb}>
            <div style={sl}>Garment Parts</div>
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {!modelLoaded ? (
                <p style={{ fontSize:"11px",color:V.mu }}>Loading model parts…</p>
              ) : mats.length > 0 ? mats.map((m,i) => (
                <div key={i} onClick={()=>setActivePart(i)} style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  background:activePart===i?`rgba(201,168,124,.12)`:"rgba(0,0,0,.25)",
                  padding:"9px 11px",borderRadius:"9px",
                  border:`1px solid ${activePart===i?V.ac:V.bd}`,
                  cursor:"pointer",transition:"border-color .15s",
                }}>
                  <div>
                    <div style={{ fontSize:"11px",fontWeight:500 }}>{m.name}</div>
                    <div style={{ fontSize:"10px",color:V.ac,marginTop:"1px" }}>
                      {i===0?"Main body":i===1?"Trim / collar":i===2?"Sleeve panel":i===3?"Buttons":`Part ${i+1}`}
                    </div>
                  </div>
                  <input type="color" value={m.color}
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>{ setActivePart(i); applyPartColor(i,e.target.value); }}
                    style={{ width:"30px",height:"24px",border:"none",cursor:"pointer",background:"none",borderRadius:"5px",padding:0 }}
                  />
                </div>
              )) : (
                <p style={{ fontSize:"11px",color:V.mu }}>No 3D model parts found.</p>
              )}
            </div>
          </div>

          {/* Color Palette */}
          <div style={sb}>
            <div style={sl}>Color Palette</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center" }}>
              {PAL.map(hex => (
                <div key={hex} title={hex} onClick={()=>applyPalette(hex)} style={{
                  width:"26px",height:"26px",borderRadius:"50%",cursor:"pointer",flexShrink:0,
                  background:hex,border:`2px solid ${hex==="#FFFFFF"?V.bd2:"transparent"}`,transition:"transform .12s",
                }}
                  onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.18)")}
                  onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
                />
              ))}
            </div>
            <div style={{ marginTop:"9px",display:"flex",gap:"7px",alignItems:"center" }}>
              <input id="cp-custom" type="color" defaultValue="#C5D3DE"
                onChange={e=>{ applyPartColor(activePart,e.target.value); }}
                style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }}
              />
              <span style={{ fontSize:"11px",color:V.mu }}>Apply to selected part</span>
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

          {/* ── COLORS TAB ── */}
          {rightTab==="colors" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"16px" }}>

              {/* Design Presets */}
              <div>
                <div style={sl}>Design Presets (GT001–GT012)</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px" }}>
                  {PRESETS.map(p => (
                    <button key={p.name} onClick={()=>applyPreset(p)} title={`${p.name}: ${p.primary} / ${p.secondary}`}
                      style={{
                        borderRadius:"7px",border:`2px solid ${presetName===p.name?V.ac:V.bd}`,
                        padding:"4px",cursor:"pointer",background:"rgba(0,0,0,.3)",overflow:"hidden",transition:"border-color .15s",
                      }}>
                      <div style={{ display:"flex",flexDirection:"column",gap:"2px" }}>
                        <div style={{ height:"16px",borderRadius:"3px 3px 0 0",background:p.primary }} />
                        <div style={{ height:"8px",borderRadius:"0 0 3px 3px",background:p.secondary }} />
                      </div>
                      <div style={{ fontSize:"8px",color:presetName===p.name?V.ac:V.mu,marginTop:"3px",fontWeight:600 }}>{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <div style={sl}>Primary Color (Body / Canvas)</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"7px" }}>
                  {PAL.map(hex => (
                    <div key={hex} onClick={()=>applyPrimary(hex)} title={hex} style={{
                      width:"24px",height:"24px",borderRadius:"50%",cursor:"pointer",flexShrink:0,
                      background:hex,border:`2px solid ${primaryColor===hex?V.ac:hex==="#FFFFFF"?V.bd2:"transparent"}`,
                      transition:"transform .12s",
                    }}
                      onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.2)")}
                      onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
                    />
                  ))}
                </div>
                <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
                  <input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)}
                    style={{ width:"40px",height:"32px",border:`1px solid ${V.bd}`,borderRadius:"7px",cursor:"pointer",padding:"2px",background:"none" }} />
                  <div style={{ fontSize:"11px",color:V.mu }}>Custom primary</div>
                  <div style={{ fontSize:"11px",color:V.ac,fontWeight:600,fontFamily:"monospace" }}>{primaryColor}</div>
                </div>
              </div>

              {/* Secondary / Trim Color */}
              <div>
                <div style={sl}>Secondary / Trim Color</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"7px" }}>
                  {PAL.map(hex => (
                    <div key={hex} onClick={()=>applySecondary(hex)} title={hex} style={{
                      width:"24px",height:"24px",borderRadius:"50%",cursor:"pointer",flexShrink:0,
                      background:hex,border:`2px solid ${secondaryColor===hex?V.ac:hex==="#FFFFFF"?V.bd2:"transparent"}`,
                      transition:"transform .12s",
                    }}
                      onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.2)")}
                      onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
                    />
                  ))}
                </div>
                <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
                  <input type="color" value={secondaryColor} onChange={e=>applySecondary(e.target.value)}
                    style={{ width:"40px",height:"32px",border:`1px solid ${V.bd}`,borderRadius:"7px",cursor:"pointer",padding:"2px",background:"none" }} />
                  <div style={{ fontSize:"11px",color:V.mu }}>Custom trim</div>
                  <div style={{ fontSize:"11px",color:V.ac,fontWeight:600,fontFamily:"monospace" }}>{secondaryColor}</div>
                </div>
              </div>

              {/* Design Summary */}
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

          {/* ── DESIGN TAB ── */}
          {rightTab==="design" && (
            <div style={{ padding:"14px 12px",display:"flex",flexDirection:"column",gap:"16px" }}>

              {/* Garment Options */}
              <div>
                <div style={sl}>Garment Options</div>

                {([
                  { key:"sleeves", label:"Sleeves", desc:"Short sleeve design",   val:gSleeves, set:(v:boolean)=>{ setGSleeves(v); toggleGarment("sleeve",v,secondaryColor); } },
                  { key:"collar",  label:"Collar",  desc:"Polo collar style",      val:gCollar,  set:(v:boolean)=>{ setGCollar(v);  toggleGarment("collar",v,secondaryColor); } },
                  { key:"placket", label:"Button Placket", desc:"Front 3-button placket", val:gPlacket, set:(v:boolean)=>{ setGPlacket(v); toggleGarment("placket",v,secondaryColor); } },
                  { key:"panel",   label:"Side Panel", desc:"Contrast color panels", val:gPanel, set:(v:boolean)=>{ setGPanel(v); toggleGarment("panel",v,secondaryColor); } },
                  { key:"stripe",  label:"Chest Stripe", desc:"Diagonal accent stripe", val:gStripe, set:(v:boolean)=>{ setGStripe(v); toggleGarment("stripe",v,secondaryColor); } },
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

              {/* Pattern Overlay */}
              <div>
                <div style={sl}>Pattern Overlay</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px" }}>
                  {(["none","stripes","grid","dots"] as const).map(pat => (
                    <button key={pat} onClick={()=>{ setPattern(pat); drawPattern(pat, secondaryColor); }} style={{
                      padding:"8px 0",fontSize:"10px",fontWeight:600,fontFamily:"inherit",cursor:"pointer",
                      borderRadius:"7px",border:`1.5px solid ${pattern===pat?V.ac:V.bd}`,
                      background:pattern===pat?"rgba(201,168,124,.12)":V.sf,
                      color:pattern===pat?V.ac:V.mu,transition:"all .15s",
                    }}>
                      {pat==="none"?"None":pat==="stripes"?"///":pat==="grid"?"#":"•••"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Print Library */}
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

              {/* Quick tip */}
              <div style={{ background:"rgba(201,168,124,.07)",border:`1px solid rgba(201,168,124,.18)`,borderRadius:"7px",padding:"9px" }}>
                <p style={{ fontSize:"10px",color:V.ac,lineHeight:1.6 }}>
                  💡 Garment features are drawn onto the design canvas as overlay shapes in the Trim color. They update live on the 3D model.
                </p>
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
