import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as fabric from "fabric";
import { ZONE_PRESETS, ZONE_LABEL, patternUrl, type PatternZone, type PatternDef } from "./patterns";
import { GT_STYLES, type GtStyleDef, type GtColors } from "./gt-styles";
import { getApiUrl } from "@/lib/api";
const GT_BASE_TEXTURES: Record<string, string> = {};

export interface CustomizerHandle {
  getCanvasData: () => { canvasJson: string; previewDataUrl: string } | null;
  loadCanvasData: (json: string) => void;
}

interface MaterialEntry {
  name: string;
  material: any;
  color: string;
  isPrintArea: boolean;
}

interface ModelViewerCustomizerProps {
  modelUrl?: string | null;
  thumbnailUrl?: string | null;
  initialColor?: string;
  onPartsChange?: (parts: Record<string, boolean>) => void;
  onColorChange?: (color: string) => void;
}

declare global {
  interface Window { ModelViewerElement?: any; }
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch { return false; }
}

const FONTS = ["Outfit", "Arial", "Times New Roman", "Courier New", "Impact", "Comic Sans MS"];

// ── GT helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgbDist(r1:number,g1:number,b1:number,r2:number,g2:number,b2:number) {
  return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2);
}
const GT_TOL = 60;

const T_COLLECTIONS = [
  { id:"T1", label:"T-1", desc:"Classic",   groups:["classic"] },
  { id:"T2", label:"T-2", desc:"Sport",     groups:["sport-side"] },
  { id:"T3", label:"T-3", desc:"Wave",      groups:["triple","wave"] },
  { id:"T4", label:"T-4", desc:"Hourglass", groups:["hourglass","pinstripe"] },
  { id:"T5", label:"T-5", desc:"Raglan",    groups:["raglan"] },
] as const;

const ModelViewerCustomizer = forwardRef<CustomizerHandle, ModelViewerCustomizerProps>(
  function ModelViewerCustomizer({ modelUrl, thumbnailUrl, initialColor = "#ffffff", onPartsChange, onColorChange }, ref) {

  const [webglAvailable] = useState<boolean>(() => { try { return isWebGLAvailable(); } catch { return false; } });
  const [mvScriptLoaded, setMvScriptLoaded] = useState(false);

  useEffect(() => {
    if (!webglAvailable) return;
    if (document.querySelector('script[data-mv-loader]')) { setMvScriptLoaded(true); return; }
    const script = document.createElement("script");
    script.type = "module";
    script.setAttribute("data-mv-loader", "1");
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    script.onload = () => setMvScriptLoaded(true);
    script.onerror = () => setMvScriptLoaded(false);
    document.head.appendChild(script);
  }, [webglAvailable]);

  const viewerRef = useRef<any>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const printMaterialRef = useRef<any>(null);
  const currentObjRef = useRef<fabric.FabricObject | null>(null);
  const uploadedBlobRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<"parts" | "design">("parts");
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null);

  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [fontFamily, setFontFamily] = useState("Outfit");
  const [layerOptions, setLayerOptions] = useState<{ idx: number; label: string }[]>([]);
  const [selectedLayerIdx, setSelectedLayerIdx] = useState(-1);
  const [scaleVal, setScaleVal] = useState(1);
  const [posX, setPosX] = useState(512);
  const [posY, setPosY] = useState(512);
  const [showTweaks, setShowTweaks] = useState(false);

  // Pattern panel state
  const [activePatternId, setActivePatternId] = useState<string | null>(null);
  const [allOverPatternId, setAllOverPatternId] = useState<string | null>(null);
  const baseBgColorRef = useRef<string>("#ffffff");

  // GT Design Collection state
  const [activeGtCollection, setActiveGtCollection] = useState("T1");
  const [activeGtStyleId, setActiveGtStyleId] = useState<string | null>(null);
  const [gtColors, setGtColors] = useState<GtColors>({ primary: "#ffffff", accent: "#000000" });

  const SIZE_SCALES: Record<string, string> = { S: "0.88 0.88 0.88", M: "1 1 1", L: "1.12 1.12 1.12", XL: "1.25 1.25 1.25" };

  const syncTexture = useCallback(async () => {
    const mv = viewerRef.current;
    const fc = fabricCanvasRef.current;
    const pm = printMaterialRef.current;
    if (!mv || !fc || !pm) return;
    try {
      const dataUrl = fc.toDataURL({ multiplier: 1, format: "png", quality: 0.9 });
      const texture = await mv.createTexture(dataUrl);
      pm.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
    } catch { }
  }, []);

  const updateLayerSelector = useCallback(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const objs = fc.getObjects();
    const opts = objs.map((obj, idx) => {
      let label = obj.type ?? `Object ${idx + 1}`;
      if ((obj as any).text) label = `Text: "${(obj as any).text.slice(0, 10)}"`;
      return { idx, label: `[${idx + 1}] ${label}` };
    });
    setLayerOptions(opts);
    setShowTweaks(objs.length > 0);
  }, []);

  // Expose canvas data via ref
  useImperativeHandle(ref, () => ({
    getCanvasData: () => {
      const fc = fabricCanvasRef.current;
      if (!fc) return null;
      return {
        canvasJson: JSON.stringify(fc.toJSON()),
        previewDataUrl: fc.toDataURL({ multiplier: 1, format: "png", quality: 0.9 }),
      };
    },
    loadCanvasData: (json: string) => {
      const fc = fabricCanvasRef.current;
      if (!fc || !json) return;
      fc.loadFromJSON(JSON.parse(json)).then(() => {
        fc.renderAll();
        syncTexture();
        updateLayerSelector();
      }).catch(() => {});
    },
  }), [syncTexture, updateLayerSelector]);

  const rawModelUrl = uploadedModelUrl || modelUrl;
  // Proxy R2 URLs through the API server to avoid browser CORS restrictions.
  // Uses an absolute URL (via VITE_API_URL) so this works when the frontend and
  // API are on different origins (e.g. custom domain deployments).
  const effectiveModelUrl = rawModelUrl
    ? (rawModelUrl.includes(".r2.dev/") || rawModelUrl.includes("r2.cloudflarestorage.com/"))
      ? `${getApiUrl()}/api/r2-proxy?url=${encodeURIComponent(rawModelUrl)}`
      : rawModelUrl
    : null;
  const showModelViewer = !!(effectiveModelUrl && webglAvailable && mvScriptLoaded && !modelError);
  const showFallback = !showModelViewer;

  // Attach load/error listeners whenever model-viewer becomes active
  useEffect(() => {
    if (!showModelViewer) return;
    const mv = viewerRef.current;
    if (!mv) return;

    const handleLoad = () => {
      const loadingEl = document.getElementById("mv-loading-overlay");
      if (loadingEl) {
        loadingEl.style.opacity = "0";
        setTimeout(() => { if (loadingEl) loadingEl.style.display = "none"; }, 500);
      }
      const model = mv.model;
      if (!model?.materials?.length) { setModelLoaded(true); return; }

      const mats: MaterialEntry[] = model.materials.map((mat: any, i: number) => ({
        name: mat.name || `Part ${i + 1}`,
        material: mat,
        color: "#ffffff",
        isPrintArea: i === (model.materials.length > 1 ? 1 : 0),
      }));

      printMaterialRef.current = mats.find(m => m.isPrintArea)?.material ?? mats[0].material;
      if (printMaterialRef.current) {
        printMaterialRef.current.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
        setTimeout(() => syncTexture(), 200);
      }
      setMaterials(mats);
      setModelLoaded(true);
      onPartsChange?.(Object.fromEntries(mats.map(m => [m.name, true])));
    };

    const handleError = () => {
      const loadingEl = document.getElementById("mv-loading-overlay");
      if (loadingEl) loadingEl.style.display = "none";
      setModelError(true);
      setModelLoaded(true);
    };

    mv.addEventListener("load", handleLoad);
    mv.addEventListener("error", handleError);
    return () => {
      mv.removeEventListener("load", handleLoad);
      mv.removeEventListener("error", handleError);
    };
  }, [showModelViewer, effectiveModelUrl, syncTexture, onPartsChange]);

  // Init Fabric canvas
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el || fabricCanvasRef.current) return;

    const patch = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "textBaseline");
    if (patch?.set) {
      Object.defineProperty(CanvasRenderingContext2D.prototype, "textBaseline", {
        configurable: true,
        set(val) { if (val === "alphabetical") val = "alphabetic"; patch.set!.call(this, val); },
        get() { return patch.get!.call(this); },
      });
    }

    const fc = new fabric.Canvas(el, { width: 1024, height: 1024, preserveObjectStacking: true, backgroundColor: "#ffffff" });
    fc.renderAll();
    fabricCanvasRef.current = fc;

    fc.on("object:modified", () => { syncTexture(); updateLayerSelector(); });
    fc.on("object:added", () => { syncTexture(); updateLayerSelector(); });
    fc.on("object:removed", () => { syncTexture(); updateLayerSelector(); });
    fc.on("selection:created", (e: any) => {
      const obj = e.selected?.[0];
      if (!obj) return;
      currentObjRef.current = obj;
      const idx = fc.getObjects().indexOf(obj);
      setSelectedLayerIdx(idx);
      setScaleVal(obj.scaleX ?? 1);
      setPosX(Math.round(obj.left ?? 512));
      setPosY(Math.round(obj.top ?? 512));
    });
    fc.on("selection:cleared", () => { currentObjRef.current = null; setSelectedLayerIdx(-1); });

    return () => { fc.dispose().catch(() => {}); fabricCanvasRef.current = null; };
  }, [syncTexture, updateLayerSelector]);

  // Resize canvas to fit wrapper when Design tab is active
  useEffect(() => {
    if (activeTab !== "design") return;
    const resize = () => {
      const fc = fabricCanvasRef.current;
      const wrapper = document.getElementById("fabric-canvas-wrapper");
      if (!fc || !wrapper || wrapper.clientWidth === 0) return;
      const w = wrapper.clientWidth;
      (fc as any).wrapperEl.style.width = w + "px";
      (fc as any).wrapperEl.style.height = w + "px";
      (fc as any).lowerCanvasEl.style.width = w + "px";
      (fc as any).lowerCanvasEl.style.height = w + "px";
      (fc as any).upperCanvasEl.style.width = w + "px";
      (fc as any).upperCanvasEl.style.height = w + "px";
      fc.calcOffset();
    };
    setTimeout(resize, 80);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [activeTab]);

  const handleMaterialColorChange = (idx: number, hex: string) => {
    const updated = [...materials];
    updated[idx] = { ...updated[idx], color: hex };
    setMaterials(updated);
    const mat = updated[idx].material;
    if (!mat) return;
    if (updated[idx].isPrintArea) {
      baseBgColorRef.current = hex;
      const fc = fabricCanvasRef.current;
      // Don't overwrite an active all-over pattern fill — the colour will be
      // restored when the customer clears the pattern.
      if (fc && !allOverPatternId) { (fc as any).backgroundColor = hex; fc.renderAll(); syncTexture(); }
      mat.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
    } else {
      mat.pbrMetallicRoughness.setBaseColorFactor(hex);
    }
    if (idx === 0) onColorChange?.(hex);
  };

  const handleAddText = async () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    await document.fonts.ready;
    const t = new fabric.FabricText(textInput || "Your Text", {
      left: 512, top: 512, originX: "center", originY: "center",
      fontFamily, fontSize: 100, fill: textColor, fontWeight: "800",
    });
    fc.add(t); fc.setActiveObject(t); fc.renderAll();
    currentObjRef.current = t;
    updateLayerSelector(); syncTexture();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      const img = await fabric.FabricImage.fromURL(data);
      if (img.width && img.width > 600) img.scaleToWidth(600);
      img.set({ left: 512, top: 512, originX: "center", originY: "center" });
      fabricCanvasRef.current?.add(img);
      fabricCanvasRef.current?.setActiveObject(img);
      fabricCanvasRef.current?.renderAll();
      currentObjRef.current = img;
      updateLayerSelector(); syncTexture();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddLine = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const line = new fabric.Line([0, 512, 1024, 512], { stroke: textColor, strokeWidth: 20, selectable: true, left: 512, top: 512, originX: "center", originY: "center" });
    fc.add(line); fc.setActiveObject(line); fc.renderAll();
    currentObjRef.current = line;
    updateLayerSelector(); syncTexture();
  };

  const handleAddCurve = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const path = new fabric.Path("M 200 512 Q 512 200 800 512", { fill: "", stroke: textColor, strokeWidth: 20, selectable: true, left: 512, top: 512, originX: "center", originY: "center" });
    fc.add(path); fc.setActiveObject(path); fc.renderAll();
    currentObjRef.current = path;
    updateLayerSelector(); syncTexture();
  };

  const handleAddStripes = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const lines = Array.from({ length: 15 }, (_, i) =>
      new fabric.Line([-2000, i * 80 - 400, 2000, i * 80 - 400], { stroke: textColor, strokeWidth: 30 })
    );
    const group = new fabric.Group(lines, { left: 512, top: 512, originX: "center", originY: "center" });
    fc.add(group); fc.setActiveObject(group); fc.renderAll();
    currentObjRef.current = group;
    updateLayerSelector(); syncTexture();
  };

  // ── PATTERN HANDLERS ────────────────────────────────────────────────
  const loadHTMLImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    });

  const handleApplyAllOver = async (p: PatternDef) => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    try {
      const img = await loadHTMLImage(patternUrl(p.file));
      // Tile the source image so it repeats across the entire UV print area
      const pattern = new fabric.Pattern({ source: img, repeat: "repeat" });
      (fc as any).backgroundColor = pattern;
      fc.renderAll();
      setAllOverPatternId(p.id);
      setActivePatternId(p.id);
      syncTexture();
    } catch {
      // Pattern image failed to load; silently ignore so UI doesn't crash
    }
  };

  const handleClearAllOver = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    (fc as any).backgroundColor = baseBgColorRef.current || "#ffffff";
    fc.renderAll();
    setAllOverPatternId(null);
    syncTexture();
  };

  // ── GT STYLE HANDLERS ────────────────────────────────────────────────────────
  const handleApplyGtStyle = useCallback(async (style: GtStyleDef, colors: GtColors) => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const src = GT_BASE_TEXTURES[style.id];
    if (!src) return;
    const baseImg = await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const offscreen = document.createElement("canvas");
    offscreen.width = baseImg.naturalWidth || 1024;
    offscreen.height = baseImg.naturalHeight || 1024;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(baseImg, 0, 0);
    const defP = hexToRgb(style.defaultColors.primary);
    const defA = hexToRgb(style.defaultColors.accent);
    const defT = style.defaultColors.tertiary ? hexToRgb(style.defaultColors.tertiary) : null;
    const newP = hexToRgb(colors.primary);
    const newA = hexToRgb(colors.accent);
    const newT = colors.tertiary ? hexToRgb(colors.tertiary) : null;
    const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      if (rgbDist(r,g,b,defP.r,defP.g,defP.b) < GT_TOL) {
        d[i]=newP.r; d[i+1]=newP.g; d[i+2]=newP.b;
      } else if (rgbDist(r,g,b,defA.r,defA.g,defA.b) < GT_TOL) {
        d[i]=newA.r; d[i+1]=newA.g; d[i+2]=newA.b;
      } else if (defT && newT && rgbDist(r,g,b,defT.r,defT.g,defT.b) < GT_TOL) {
        d[i]=newT.r; d[i+1]=newT.g; d[i+2]=newT.b;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const finalUrl = offscreen.toDataURL("image/png");
    const fImg = await fabric.FabricImage.fromURL(finalUrl);
    const W = fImg.width || 1024, H = fImg.height || 1024;
    fImg.set({ left:0, top:0, originX:"left", originY:"top", scaleX:1024/W, scaleY:1024/H, selectable:false, evented:false });
    (fImg as any).kashaGtStyle = style.id;
    const existing = fc.getObjects().find((o:any) => (o as any).kashaGtStyle);
    if (existing) fc.remove(existing);
    fc.insertAt(0, fImg);
    fc.renderAll();
    setActiveGtStyleId(style.id);
    setAllOverPatternId(null);
    syncTexture();
    updateLayerSelector();
  }, [syncTexture, updateLayerSelector]);

  const handleClearGtStyle = useCallback(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const existing = fc.getObjects().find((o:any) => (o as any).kashaGtStyle);
    if (existing) { fc.remove(existing); fc.renderAll(); }
    setActiveGtStyleId(null);
    syncTexture();
    updateLayerSelector();
  }, [syncTexture, updateLayerSelector]);

  const handlePlacePatternOnZone = async (p: PatternDef, zone: Exclude<PatternZone, "all">) => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    try {
      const img = await fabric.FabricImage.fromURL(patternUrl(p.file), { crossOrigin: "anonymous" });
      const preset = ZONE_PRESETS[zone];
      const naturalW = img.width ?? preset.w;
      const naturalH = img.height ?? preset.h;
      img.set({
        left: preset.left,
        top: preset.top,
        originX: "left",
        originY: "top",
        scaleX: preset.w / naturalW,
        scaleY: preset.h / naturalH,
      });
      (img as any).kashaZone = zone;
      (img as any).kashaPatternId = p.id;
      fc.add(img);
      fc.setActiveObject(img);
      fc.renderAll();
      currentObjRef.current = img;
      setActivePatternId(p.id);
      setSelectedLayerIdx(fc.getObjects().indexOf(img));
      setScaleVal(preset.w / naturalW);
      setPosX(preset.left);
      setPosY(preset.top);
      updateLayerSelector();
      syncTexture();
    } catch {
      /* ignore image load failure */
    }
  };

  const handleDeleteSelected = () => {
    const fc = fabricCanvasRef.current;
    const obj = currentObjRef.current;
    if (!fc || !obj) return;
    fc.remove(obj);
    const objs = fc.getObjects();
    if (objs.length > 0) {
      const last = objs[objs.length - 1];
      currentObjRef.current = last;
      fc.setActiveObject(last);
      setSelectedLayerIdx(objs.length - 1);
      setScaleVal(last.scaleX ?? 1);
      setPosX(Math.round(last.left ?? 512));
      setPosY(Math.round(last.top ?? 512));
    } else {
      currentObjRef.current = null;
      setSelectedLayerIdx(-1);
    }
    fc.renderAll();
    updateLayerSelector(); syncTexture();
  };

  const handleLayerChange = (idx: number) => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const obj = fc.item(idx);
    if (!obj) return;
    currentObjRef.current = obj;
    fc.setActiveObject(obj);
    setSelectedLayerIdx(idx);
    setScaleVal(obj.scaleX ?? 1);
    setPosX(Math.round(obj.left ?? 512));
    setPosY(Math.round(obj.top ?? 512));
  };

  const handleModelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedBlobRef.current) URL.revokeObjectURL(uploadedBlobRef.current);
    const blobUrl = URL.createObjectURL(file);
    uploadedBlobRef.current = blobUrl;
    setModelLoaded(false);
    setModelError(false);
    setMaterials([]);
    setUploadedModelUrl(blobUrl);
    e.target.value = "";
  };

  return (
    <div
      className="flex w-full h-full overflow-hidden"
      style={{ background: "radial-gradient(circle at center, #1f232e 0%, #100d0b 100%)" }}
    >
      {/* ── LEFT: 3D Viewer ── */}
      <div className="flex-1 relative rounded-none overflow-hidden flex items-center justify-center m-4 mr-0"
        style={{
          borderRadius: "24px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.5) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          minHeight: "400px",
        }}
      >
        {/* Loading overlay */}
        {showModelViewer && (
          <div
            id="mv-loading-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            style={{
              background: "#100d0b",
              transition: "opacity 0.5s ease",
              borderRadius: "24px",
            }}
          >
            <div
              className="w-12 h-12 rounded-full border-[3px] animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "#6ee7b7" }}
            />
            <p className="mt-4 text-sm" style={{ color: "#8b949e" }}>Loading High Fidelity Resource...</p>
          </div>
        )}

        {showFallback ? (
          <div className="flex flex-col items-center justify-center p-8 w-full h-full">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Product" className="max-h-[480px] max-w-full object-contain" style={{ borderRadius: "12px" }} />
            ) : (
              <div className="text-center" style={{ color: "#8b949e" }}>
                <div className="w-24 h-32 mx-auto mb-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
                <p className="text-xs tracking-widest uppercase">
                  {!effectiveModelUrl ? "Upload a .glb model to see 3D preview" : "WebGL required for 3D preview"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <model-viewer
            ref={viewerRef}
            src={effectiveModelUrl!}
            id="kasha-model-viewer"
            camera-controls
            auto-rotate
            rotation-per-second="10deg"
            interaction-prompt="none"
            shadow-intensity="1.2"
            environment-image="neutral"
            exposure="1"
            style={{ width: "100%", height: "100%", "--poster-color": "transparent", borderRadius: "24px" } as any}
          />
        )}
      </div>

      {/* ── RIGHT: Controls Panel ── */}
      <div
        className="flex flex-col overflow-y-auto m-4 p-10"
        style={{
          width: "450px",
          minWidth: "320px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          backdropFilter: "blur(16px)",
          boxShadow: "20px 20px 60px rgba(0,0,0,0.3)",
          gap: "0",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 800,
            letterSpacing: "-1px",
            background: "linear-gradient(45deg, #fff, #6ee7b7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Craft Your Style
          </h1>
          <p style={{ color: "#8b949e", marginTop: "0.5rem", fontWeight: 300, lineHeight: 1.5, fontSize: "0.9rem" }}>
            Interact with the 3D garment. Mix colors on parts, add text, and upload graphics.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          {(["parts", "design"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                color: activeTab === tab ? "#f8f9fa" : "#8b949e",
                fontFamily: "inherit",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.5rem 1rem",
                position: "relative",
                transition: "all 0.2s",
              }}
            >
              {tab === "parts" ? "Parts & Colors" : "Design (Front)"}
              {activeTab === tab && (
                <div style={{
                  position: "absolute",
                  bottom: "-0.6rem",
                  left: 0,
                  width: "100%",
                  height: "2px",
                  background: "#6ee7b7",
                  borderRadius: "2px",
                  boxShadow: "0 0 10px rgba(110,231,183,0.4)",
                }} />
              )}
            </button>
          ))}
        </div>

        {/* ── PARTS TAB ── */}
        <div style={{ display: activeTab === "parts" ? "flex" : "none", flexDirection: "column", gap: "1.5rem" }}>

          {/* Upload 3D Model */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>
              Upload 3D Model (.glb)
            </div>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: "rgba(110,231,183,0.08)",
              border: "2px dashed rgba(110,231,183,0.25)",
              borderRadius: "12px",
              cursor: "pointer",
              color: "#6ee7b7",
              fontSize: "0.85rem",
              fontWeight: 600,
              transition: "all 0.2s",
            }}>
              <span style={{ fontSize: "1.2rem" }}>↑</span>
              {uploadedModelUrl ? "Model Uploaded ✓" : "Upload .glb / .gltf File"}
              <input type="file" accept=".glb,.gltf" onChange={handleModelFileUpload} style={{ display: "none" }} />
            </label>
            {uploadedModelUrl && (
              <button
                onClick={() => { setUploadedModelUrl(null); setModelLoaded(false); setModelError(false); setMaterials([]); if (uploadedBlobRef.current) { URL.revokeObjectURL(uploadedBlobRef.current); uploadedBlobRef.current = null; } }}
                style={{ background: "none", border: "none", color: "rgba(209,73,91,0.7)", fontSize: "0.8rem", cursor: "pointer", textAlign: "left" }}
              >
                ✕ Remove uploaded model
              </button>
            )}
          </div>

          {/* Garment Parts */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>
              Garment Parts
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {!modelLoaded && showModelViewer ? (
                <p style={{ color: "#8b949e", fontSize: "0.9rem" }}>Loading parts...</p>
              ) : materials.length > 0 ? (
                materials.map((mat, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(0,0,0,0.2)",
                      padding: "1rem",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#f8f9fa" }}>
                      {mat.name}{mat.isPrintArea ? " (Print Area)" : ""}
                    </span>
                    <input
                      type="color"
                      value={mat.color}
                      onChange={(e) => handleMaterialColorChange(idx, e.target.value)}
                      style={{ width: "40px", height: "40px", border: "none", cursor: "pointer", background: "none", borderRadius: "8px", padding: 0 }}
                    />
                  </div>
                ))
              ) : (
                <p style={{ color: "#8b949e", fontSize: "0.9rem" }}>
                  {!effectiveModelUrl
                    ? "Upload a .glb model above to customize garment parts."
                    : !webglAvailable
                    ? "WebGL required to customize garment parts."
                    : "No materials detected in model."}
                </p>
              )}
            </div>
          </div>

          {/* Garment Size */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>
              Garment Size
            </div>
            <div style={{ display: "flex", gap: "0.8rem" }}>
              {[
                { label: "S", scale: "0.88" },
                { label: "M", scale: "1.0" },
                { label: "L", scale: "1.12" },
                { label: "XL", scale: "1.25" },
              ].map(({ label, scale }) => (
                <button
                  key={label}
                  onClick={() => {
                    setSelectedSize(label);
                    if (viewerRef.current) viewerRef.current.scale = `${scale} ${scale} ${scale}`;
                  }}
                  style={{
                    flex: 1,
                    padding: "1rem 0",
                    background: selectedSize === label ? "#6ee7b7" : "rgba(0,0,0,0.3)",
                    border: selectedSize === label ? "1px solid #6ee7b7" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: selectedSize === label ? "#0b0c10" : "#f8f9fa",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: selectedSize === label ? "0 5px 15px rgba(110,231,183,0.4)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "0.8rem", color: "#8b949e", margin: 0 }}>
              Volumetric scaling updates the digital twin's physical representation.
            </p>
          </div>
        </div>

        {/* ── DESIGN TAB ── */}
        <div style={{ display: activeTab === "design" ? "flex" : "none", flexDirection: "column", gap: "1.5rem" }}>

          {/* Add Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>Add Text</div>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text here..."
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#f8f9fa",
                fontFamily: "inherit",
                fontSize: "1rem",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6ee7b7")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: "45px", height: "45px", borderRadius: "10px", cursor: "pointer", border: "none", background: "none", padding: 0 }}
              />
              <span style={{ fontSize: "0.9rem", color: "#f8f9fa" }}>Text Color</span>
            </div>
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                if (currentObjRef.current && (currentObjRef.current as any).type === "text") {
                  (currentObjRef.current as any).set("fontFamily", e.target.value);
                  fabricCanvasRef.current?.renderAll();
                  syncTexture();
                }
              }}
              style={{
                width: "100%",
                padding: "0.5rem 1rem",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#f8f9fa",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {FONTS.map(f => <option key={f} value={f} style={{ background: "#1a1a1a" }}>{f}</option>)}
            </select>
            <button
              onClick={handleAddText}
              style={{
                width: "100%",
                padding: "1rem",
                background: "#f8f9fa",
                color: "#0b0c10",
                border: "none",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: "1rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => { (e.target as HTMLButtonElement).style.background = "#6ee7b7"; }}
              onMouseOut={(e) => { (e.target as HTMLButtonElement).style.background = "#f8f9fa"; }}
            >
              Place Text on Shirt
            </button>
          </div>

          {/* Upload Image */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>Add Graphic / Logo</div>
            <label style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 1rem",
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              cursor: "pointer", color: "#8b949e", fontSize: "0.9rem",
            }}>
              <span>📁</span> Choose image file...
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            </label>
          </div>

          {/* ── GT DESIGN COLLECTIONS (T1–T5) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>
              GT Design Collections
            </div>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#8b949e", lineHeight: 1.5 }}>
              Pick a collection (T-1 to T-5), select a style, customise the colour palette, then apply to the garment.
            </p>

            {/* T1–T5 collection selector */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {T_COLLECTIONS.map(t => {
                const active = activeGtCollection === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveGtCollection(t.id); setActiveGtStyleId(null); }}
                    style={{
                      padding: "5px 13px",
                      fontSize: "11px", fontWeight: 700,
                      letterSpacing: "0.06em",
                      border: active ? "1.5px solid #6ee7b7" : "1.5px solid rgba(255,255,255,0.18)",
                      borderRadius: "20px",
                      cursor: "pointer",
                      background: active ? "rgba(110,231,183,0.15)" : "rgba(255,255,255,0.05)",
                      color: active ? "#6ee7b7" : "#888",
                      transition: "all 0.15s",
                      fontFamily: "inherit",
                    }}
                  >
                    {t.label}
                    <span style={{ fontSize: "9px", opacity: 0.65, marginLeft: 4 }}>{t.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Style grid for the selected collection */}
            {(() => {
              const col = T_COLLECTIONS.find(t => t.id === activeGtCollection);
              if (!col) return null;
              const styles = GT_STYLES.filter(s => (col.groups as readonly string[]).includes(s.group));
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.45rem" }}>
                  {styles.map(style => {
                    const sel = activeGtStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => {
                          setActiveGtStyleId(style.id);
                          setGtColors({
                            primary: style.defaultColors.primary,
                            accent: style.defaultColors.accent,
                            ...(style.defaultColors.tertiary ? { tertiary: style.defaultColors.tertiary } : {}),
                          });
                        }}
                        title={style.label}
                        style={{
                          padding: "7px 5px 5px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border: sel ? "2px solid #6ee7b7" : "1px solid rgba(255,255,255,0.12)",
                          background: sel ? "rgba(110,231,183,0.07)" : "rgba(0,0,0,0.3)",
                          boxShadow: sel ? "0 0 0 2px rgba(110,231,183,0.18)" : "none",
                          transition: "all 0.15s",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                          fontFamily: "inherit",
                        }}
                      >
                        {/* Primary + Accent swatch bar */}
                        <div style={{ display: "flex", width: "100%", height: "22px", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ flex: 1, background: style.defaultColors.primary }} />
                          <div style={{ flex: 1, background: style.defaultColors.accent }} />
                          {style.defaultColors.tertiary && (
                            <div style={{ flex: 1, background: style.defaultColors.tertiary }} />
                          )}
                        </div>
                        <div style={{ fontSize: "8.5px", color: sel ? "#6ee7b7" : "#666", textAlign: "center", letterSpacing: "0.02em", lineHeight: 1.3 }}>
                          {style.label}
                        </div>
                        {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6ee7b7" }} />}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Colour customisation + apply panel for selected style */}
            {activeGtStyleId && (() => {
              const style = GT_STYLES.find(s => s.id === activeGtStyleId)!;
              const colorKeys = [
                { key: "primary" as const, label: "Primary" },
                { key: "accent" as const, label: "Accent" },
                ...(style.defaultColors.tertiary ? [{ key: "tertiary" as const, label: "Tertiary" }] : []),
              ];
              return (
                <div style={{
                  background: "rgba(0,0,0,0.25)",
                  padding: "0.85rem",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", flexDirection: "column", gap: "0.65rem",
                }}>
                  <div style={{ color: "#f8f9fa", fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.03em" }}>
                    {style.label} <span style={{ color: "#555", fontWeight: 400, fontSize: "0.8rem" }}>· {style.id}</span>
                  </div>

                  {/* Color pickers */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {colorKeys.map(({ key, label }) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="color"
                          value={gtColors[key] ?? style.defaultColors[key] ?? "#888888"}
                          onChange={e => setGtColors(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ width: "30px", height: "30px", border: "none", cursor: "pointer", background: "none", borderRadius: "6px", padding: 0, flexShrink: 0 }}
                        />
                        <span style={{ fontSize: "0.82rem", color: "#8b949e", width: 60 }}>{label}</span>
                        <span style={{ fontSize: "0.73rem", color: "#555", fontFamily: "monospace" }}>
                          {(gtColors[key] ?? style.defaultColors[key] ?? "").toUpperCase()}
                        </span>
                        <button
                          onClick={() => setGtColors(prev => ({ ...prev, [key]: style.defaultColors[key] ?? "#888" }))}
                          title="Reset to default"
                          style={{ marginLeft: "auto", fontSize: "10px", color: "#444", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                        >↺</button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleApplyGtStyle(style, gtColors)}
                    style={{
                      padding: "0.7rem", background: "#6ee7b7", color: "#0b0c10",
                      border: "none", borderRadius: "8px", fontFamily: "inherit",
                      fontWeight: 800, fontSize: "0.85rem", cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: "1px",
                    }}
                  >
                    ⚡ Apply GT Style
                  </button>

                  <button
                    onClick={handleClearGtStyle}
                    style={{
                      padding: "0.5rem", background: "transparent",
                      color: "rgba(209,73,91,0.8)", border: "1px solid rgba(209,73,91,0.4)",
                      borderRadius: "6px", fontFamily: "inherit",
                      fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                    }}
                  >
                    ✕ Remove GT Style
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Shapes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>Add Shapes & Lines</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { label: "Straight Line", fn: handleAddLine },
                { label: "Curved Line", fn: handleAddCurve },
                { label: "Stripes Pattern", fn: handleAddStripes },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={fn}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    background: "#f8f9fa",
                    color: "#0b0c10",
                    border: "none",
                    borderRadius: "8px",
                    fontFamily: "inherit",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseOver={(e) => { (e.target as HTMLButtonElement).style.background = "#6ee7b7"; }}
                  onMouseOut={(e) => { (e.target as HTMLButtonElement).style.background = "#f8f9fa"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Hint */}
          <div style={{ background: "rgba(110,231,183,0.1)", padding: "1rem", borderRadius: "8px" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#6ee7b7" }}>
              <strong>💡 Interactive Dragging:</strong> Use the canvas below to drag and reposition elements directly. What you see below precisely maps onto the 3D model above!
            </p>
          </div>

          {/* Design Tweaks (shows when object selected) */}
          {showTweaks && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "2px", color: "#8b949e", fontWeight: 600 }}>
                Tweak Elements (3D Workflow)
              </div>
              <select
                value={selectedLayerIdx}
                onChange={(e) => handleLayerChange(Number(e.target.value))}
                style={{
                  width: "100%", padding: "0.5rem",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#f8f9fa", fontFamily: "inherit", cursor: "pointer",
                }}
              >
                {layerOptions.map(opt => (
                  <option key={opt.idx} value={opt.idx} style={{ background: "#1a1a1a" }}>{opt.label}</option>
                ))}
              </select>

              {[
                { label: "Scale", min: 0.1, max: 3, step: 0.1, value: scaleVal, onChange: (v: number) => { setScaleVal(v); currentObjRef.current?.set({ scaleX: v, scaleY: v }); fabricCanvasRef.current?.renderAll(); syncTexture(); } },
                { label: "Pos X", min: 0, max: 1024, step: 10, value: posX, onChange: (v: number) => { setPosX(v); currentObjRef.current?.set({ left: v }); fabricCanvasRef.current?.renderAll(); syncTexture(); } },
                { label: "Pos Y", min: 0, max: 1024, step: 10, value: posY, onChange: (v: number) => { setPosY(v); currentObjRef.current?.set({ top: v }); fabricCanvasRef.current?.renderAll(); syncTexture(); } },
              ].map(({ label, min, max, step, value, onChange }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label style={{ width: "60px", fontSize: "0.85rem", color: "#8b949e" }}>{label}</label>
                  <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "#6ee7b7" }}
                  />
                </div>
              ))}

              <button
                onClick={handleDeleteSelected}
                style={{
                  width: "100%", padding: "1rem",
                  background: "#d1495b", color: "white",
                  border: "none", borderRadius: "8px",
                  fontFamily: "inherit", fontWeight: 800, fontSize: "1rem",
                  cursor: "pointer", marginTop: "0.5rem",
                }}
              >
                Clear Design
              </button>
            </div>
          )}

          {/* Fabric Canvas — visible print area editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>Print area (drag items here to position)</div>
            <div
              id="fabric-canvas-wrapper"
              style={{
                background: "#fff",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                aspectRatio: "1/1",
                width: "100%",
                position: "relative",
              }}
            >
              <canvas ref={canvasElRef} id="design-canvas" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ModelViewerCustomizer;
export { ModelViewerCustomizer };
