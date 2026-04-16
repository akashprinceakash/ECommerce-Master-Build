import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";

interface MaterialEntry {
  name: string;
  material: any;
  color: string;
  visible: boolean;
  isPrintArea: boolean;
}

interface ModelViewerCustomizerProps {
  modelUrl?: string | null;
  thumbnailUrl?: string | null;
  initialColor?: string;
  onPartsChange?: (parts: Record<string, boolean>) => void;
  onColorChange?: (color: string) => void;
  onSaveDesign?: (previewUrl: string, selectedSize: string, primaryColor: string) => Promise<void>;
  isSaving?: boolean;
}

declare global {
  interface Window {
    ModelViewerElement?: any;
  }
}

const PRESET_COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Ivory", hex: "#F5F0EB" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "Navy", hex: "#1D2B45" },
  { name: "Burgundy", hex: "#5C2028" },
  { name: "Olive", hex: "#4A5240" },
  { name: "Beige", hex: "#D4C5B9" },
  { name: "Slate", hex: "#708090" },
  { name: "Forest", hex: "#228B22" },
  { name: "Sky", hex: "#87CEEB" },
  { name: "Coral", hex: "#FF6B6B" },
  { name: "Gold", hex: "#C9A86C" },
];

const FONT_OPTIONS = ["Inter", "Georgia", "Arial", "Impact", "Courier New", "Trebuchet MS"];

type ActiveTab = "parts" | "design";

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function ModelViewerCustomizer({
  modelUrl,
  thumbnailUrl,
  initialColor = "#ffffff",
  onPartsChange,
  onColorChange,
  onSaveDesign,
  isSaving = false,
}: ModelViewerCustomizerProps) {
  const [webglAvailable] = useState<boolean>(() => {
    try { return isWebGLAvailable(); } catch { return false; }
  });
  const [mvScriptLoaded, setMvScriptLoaded] = useState(false);

  useEffect(() => {
    if (!webglAvailable) return;
    const existing = document.querySelector('script[data-mv-loader]');
    if (existing) {
      setMvScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.setAttribute("data-mv-loader", "1");
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    script.onload = () => setMvScriptLoaded(true);
    script.onerror = () => setMvScriptLoaded(false);
    document.head.appendChild(script);
  }, [webglAvailable]);

  const viewerRef = useRef<HTMLElement & {
    model?: { materials: any[] };
    createTexture: (url: string) => Promise<any>;
    scale: string;
  }>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const printMaterialRef = useRef<any>(null);
  const currentObjRef = useRef<fabric.FabricObject | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("parts");
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const uploadedBlobRef = useRef<string | null>(null);

  const [bgColor, setBgColor] = useState("#ffffff");
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(80);
  const [objects, setObjects] = useState<fabric.FabricObject[]>([]);
  const [selectedObjIndex, setSelectedObjIndex] = useState<number>(-1);
  const [scaleVal, setScaleVal] = useState(1);
  const [posX, setPosX] = useState(512);
  const [posY, setPosY] = useState(512);

  const SIZE_SCALES: Record<string, string> = {
    XS: "0.75 0.75 0.75",
    S: "0.88 0.88 0.88",
    M: "1 1 1",
    L: "1.12 1.12 1.12",
    XL: "1.25 1.25 1.25",
  };

  const syncTexture = useCallback(async () => {
    const mv = viewerRef.current;
    const fc = fabricCanvasRef.current;
    const pm = printMaterialRef.current;
    if (!mv || !fc || !pm) return;
    try {
      const dataUrl = fc.toDataURL({ multiplier: 1, format: "png", quality: 0.9 });
      const texture = await mv.createTexture(dataUrl);
      pm.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
    } catch {
    }
  }, []);

  const updateObjectsList = useCallback(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    setObjects([...fc.getObjects()]);
  }, []);

  const effectiveModelUrl = uploadedModelUrl || modelUrl;
  const showModelViewer = !!(effectiveModelUrl && webglAvailable && mvScriptLoaded && !modelError);

  // Re-attach load/error listeners whenever model URL changes or model-viewer becomes available
  useEffect(() => {
    if (!showModelViewer) return;
    const mv = viewerRef.current;
    if (!mv) return;

    const handleLoad = () => {
      const model = (mv as any).model;
      if (!model || !model.materials || model.materials.length === 0) {
        setModelLoaded(true);
        return;
      }
      const mats: MaterialEntry[] = model.materials.map((mat: any, i: number) => ({
        name: mat.name || `Part ${i + 1}`,
        material: mat,
        color: "#ffffff",
        visible: true,
        isPrintArea: i === (model.materials.length > 1 ? 1 : 0),
      }));
      printMaterialRef.current = mats.find(m => m.isPrintArea)?.material ?? mats[0].material;
      if (printMaterialRef.current) {
        printMaterialRef.current.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
        setTimeout(() => syncTexture(), 200);
      }
      setMaterials(mats);
      setModelLoaded(true);
    };

    const handleError = () => {
      setModelError(true);
      setModelLoaded(true);
    };

    // If already loaded (e.g. listener missed the event), check model synchronously
    if ((mv as any).loaded) {
      handleLoad();
    }

    mv.addEventListener("load", handleLoad);
    mv.addEventListener("error", handleError);
    return () => {
      mv.removeEventListener("load", handleLoad);
      mv.removeEventListener("error", handleError);
    };
  }, [showModelViewer, effectiveModelUrl, syncTexture]);

  // Set up Fabric canvas once
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

    const onModified = () => { syncTexture(); updateObjectsList(); };
    fc.on("object:modified", onModified);
    fc.on("object:added", onModified);
    fc.on("object:removed", onModified);
    fc.on("selection:created", (e: any) => {
      const obj = e.selected?.[0];
      if (obj) {
        currentObjRef.current = obj;
        const idx = fc.getObjects().indexOf(obj);
        setSelectedObjIndex(idx);
        setScaleVal(obj.scaleX ?? 1);
        setPosX(Math.round(obj.left ?? 512));
        setPosY(Math.round(obj.top ?? 512));
      }
    });
    fc.on("selection:cleared", () => {
      currentObjRef.current = null;
      setSelectedObjIndex(-1);
    });

    return () => {
      fc.dispose().catch(() => {});
      fabricCanvasRef.current = null;
    };
  }, [syncTexture, updateObjectsList]);

  // Resize fabric canvas wrapper when switching to design tab
  useEffect(() => {
    if (activeTab === "design") {
      setTimeout(() => {
        const fc = fabricCanvasRef.current;
        const wrapper = document.getElementById("fabric-canvas-wrapper");
        if (!fc || !wrapper) return;
        const w = wrapper.clientWidth || 400;
        (fc as any).wrapperEl.style.width = w + "px";
        (fc as any).wrapperEl.style.height = w + "px";
        (fc as any).lowerCanvasEl.style.width = w + "px";
        (fc as any).lowerCanvasEl.style.height = w + "px";
        (fc as any).upperCanvasEl.style.width = w + "px";
        (fc as any).upperCanvasEl.style.height = w + "px";
        fc.calcOffset();
      }, 80);
    }
  }, [activeTab]);

  const handleMaterialColorChange = (idx: number, hex: string) => {
    const updated = [...materials];
    updated[idx].color = hex;
    setMaterials(updated);
    const mat = updated[idx].material;
    if (!mat) return;
    if (updated[idx].isPrintArea) {
      const fc = fabricCanvasRef.current;
      if (fc) {
        (fc as any).backgroundColor = hex;
        setBgColor(hex);
        fc.renderAll();
        syncTexture();
      }
      mat.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
    } else {
      mat.pbrMetallicRoughness.setBaseColorFactor(hex);
    }
    if (idx === 0) onColorChange?.(hex);
  };

  const handleMaterialToggle = (idx: number) => {
    const updated = [...materials];
    updated[idx].visible = !updated[idx].visible;
    setMaterials(updated);
    const mat = updated[idx].material;
    if (!mat) return;
    if (updated[idx].visible) {
      mat.pbrMetallicRoughness.setBaseColorFactor(updated[idx].color || "#ffffff");
    } else {
      mat.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
    }
    const parts: Record<string, boolean> = {};
    updated.forEach(m => { parts[m.name] = m.visible; });
    onPartsChange?.(parts);
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    const mv = viewerRef.current;
    if (mv) (mv as any).scale = SIZE_SCALES[size] ?? "1 1 1";
  };

  const handleAddText = async () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    await document.fonts.ready;
    const t = new fabric.FabricText(textInput || "Your Text", {
      left: 512, top: 512,
      originX: "center", originY: "center",
      fontFamily, fontSize, fill: textColor, fontWeight: "bold",
    });
    fc.add(t);
    fc.setActiveObject(t);
    fc.renderAll();
    currentObjRef.current = t;
    updateObjectsList();
    syncTexture();
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
      updateObjectsList();
      syncTexture();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddShape = (shape: "rect" | "circle" | "triangle" | "line" | "stripes") => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    let obj: fabric.FabricObject | null = null;
    if (shape === "rect") {
      obj = new fabric.Rect({ left: 512, top: 512, originX: "center", originY: "center", width: 300, height: 200, fill: textColor, rx: 8, ry: 8 });
    } else if (shape === "circle") {
      obj = new fabric.Circle({ left: 512, top: 512, originX: "center", originY: "center", radius: 150, fill: textColor });
    } else if (shape === "triangle") {
      obj = new fabric.Triangle({ left: 512, top: 512, originX: "center", originY: "center", width: 300, height: 300, fill: textColor });
    } else if (shape === "line") {
      obj = new fabric.Line([0, 0, 400, 0], { stroke: textColor, strokeWidth: 20, selectable: true, left: 512, top: 512, originX: "center", originY: "center" });
    } else if (shape === "stripes") {
      const lines = Array.from({ length: 15 }, (_, i) =>
        new fabric.Line([-1024, i * 80 - 400, 1024, i * 80 - 400], { stroke: textColor, strokeWidth: 30 })
      );
      obj = new fabric.Group(lines, { left: 512, top: 512, originX: "center", originY: "center" });
    }
    if (!obj) return;
    fc.add(obj);
    fc.setActiveObject(obj);
    fc.renderAll();
    currentObjRef.current = obj;
    updateObjectsList();
    syncTexture();
  };

  const handleDeleteSelected = () => {
    const fc = fabricCanvasRef.current;
    const obj = currentObjRef.current;
    if (!fc || !obj) return;
    fc.remove(obj);
    currentObjRef.current = null;
    setSelectedObjIndex(-1);
    fc.renderAll();
    updateObjectsList();
    syncTexture();
  };

  const handleClearCanvas = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    fc.clear();
    (fc as any).backgroundColor = "#ffffff";
    setBgColor("#ffffff");
    fc.renderAll();
    currentObjRef.current = null;
    setSelectedObjIndex(-1);
    updateObjectsList();
    syncTexture();
  };

  const handleScaleChange = (val: number) => {
    setScaleVal(val);
    const obj = currentObjRef.current;
    if (!obj) return;
    obj.set({ scaleX: val, scaleY: val });
    fabricCanvasRef.current?.renderAll();
    syncTexture();
  };

  const handlePosXChange = (val: number) => {
    setPosX(val);
    const obj = currentObjRef.current;
    if (!obj) return;
    obj.set({ left: val });
    fabricCanvasRef.current?.renderAll();
    syncTexture();
  };

  const handlePosYChange = (val: number) => {
    setPosY(val);
    const obj = currentObjRef.current;
    if (!obj) return;
    obj.set({ top: val });
    fabricCanvasRef.current?.renderAll();
    syncTexture();
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
    setUploadedImageUrl(null);
    // Set URL after clearing state so model-viewer re-renders with new src
    setUploadedModelUrl(blobUrl);
    e.target.value = "";
  };

  const handleGarmentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImageUrl(ev.target?.result as string);
      setUploadedModelUrl(null);
      setModelLoaded(false);
      setModelError(false);
      setMaterials([]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearUpload = () => {
    if (uploadedBlobRef.current) {
      URL.revokeObjectURL(uploadedBlobRef.current);
      uploadedBlobRef.current = null;
    }
    setUploadedModelUrl(null);
    setUploadedImageUrl(null);
    setModelLoaded(false);
    setModelError(false);
    setMaterials([]);
  };

  const handleSave = async () => {
    if (!onSaveDesign) return;
    const fc = fabricCanvasRef.current;
    let previewUrl = "";

    if (uploadedImageUrl && !uploadedModelUrl) {
      // 2D image mode — composite design canvas over the image
      previewUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const W = 800, H = Math.round(800 * (img.naturalHeight / img.naturalWidth));
          const offscreen = document.createElement("canvas");
          offscreen.width = W;
          offscreen.height = H;
          const ctx = offscreen.getContext("2d")!;
          ctx.fillStyle = "#e8e8e8";
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          if (fc && fc.getObjects().length > 0) {
            const fcDataUrl = fc.toDataURL({ multiplier: 1, format: "png", quality: 0.92 });
            const fcImg = new Image();
            fcImg.onload = () => {
              ctx.drawImage(fcImg, W * 0.25, H * 0.2, W * 0.5, W * 0.5);
              resolve(offscreen.toDataURL("image/png"));
            };
            fcImg.src = fcDataUrl;
          } else {
            resolve(offscreen.toDataURL("image/png"));
          }
        };
        img.onerror = () => resolve("");
        img.src = uploadedImageUrl;
      });
    } else if (fc) {
      previewUrl = fc.toDataURL({ multiplier: 1, format: "png", quality: 0.92 });
    }

    const primaryColor = materials[0]?.color || "#ffffff";
    await onSaveDesign(previewUrl, selectedSize, primaryColor);
  };

  const noModel = !effectiveModelUrl || modelError;
  const showFallback = !showModelViewer;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full" style={{ minHeight: "600px" }}>
      {/* Hidden fabric canvas (always rendered for texture generation) */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px", pointerEvents: "none" }}>
        <canvas ref={canvasElRef} />
      </div>

      {/* 3D Viewer / Preview Area */}
      <div className="flex-1 relative bg-[#100d0b] flex items-center justify-center overflow-hidden" style={{ minHeight: "420px" }}>

        {/* Loading overlay */}
        {!modelLoaded && showModelViewer && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#100d0b] z-20">
            <div className="w-12 h-12 border-2 border-white/10 border-t-emerald-400 rounded-full animate-spin mb-4" />
            <p className="text-sm text-white/40 tracking-widest">Loading 3D Model...</p>
          </div>
        )}

        {showFallback ? (
          /* No WebGL / No model / 2D image mode */
          <div className="flex flex-col items-center justify-center w-full h-full gap-4 p-8">
            {uploadedImageUrl ? (
              <div className="relative max-h-[500px] w-full flex items-center justify-center">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded garment"
                  className="max-h-[500px] max-w-full object-contain rounded-lg shadow-2xl"
                />
                <div
                  className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <button
                    onClick={() => setActiveTab("design")}
                    className="bg-emerald-400/90 text-black text-xs font-bold tracking-widest px-4 py-2 rounded-full"
                  >
                    OPEN DESIGN EDITOR →
                  </button>
                </div>
              </div>
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Product"
                className="max-h-[450px] max-w-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center text-white/30">
                <div className="w-28 h-36 mx-auto mb-4 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-white/20 text-[10px] font-bold tracking-widest">3D</span>
                </div>
                <p className="text-xs tracking-widest uppercase">
                  {noModel ? "Upload a Model or Image" : "WebGL Required"}
                </p>
                <p className="text-xs mt-1 opacity-50">
                  {noModel ? "Use the upload buttons on the right" : "Open in a browser that supports WebGL"}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* model-viewer */
          <model-viewer
            ref={viewerRef as any}
            src={effectiveModelUrl!}
            id="kasha-model-viewer"
            camera-controls
            auto-rotate
            rotation-per-second="8deg"
            interaction-prompt="none"
            shadow-intensity="1.2"
            environment-image="neutral"
            exposure="1.1"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "420px",
              "--poster-color": "transparent",
            } as any}
          />
        )}

        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-white/25 flex gap-4 z-10">
          {showModelViewer && <><span>DRAG to rotate</span><span>SCROLL to zoom</span></>}
        </div>
      </div>

      {/* Controls Panel */}
      <div
        className="w-full lg:w-[380px] flex flex-col overflow-y-auto"
        style={{
          background: "#111",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Tab Bar */}
        <div className="flex border-b sticky top-0 z-10" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
          {(["parts", "design"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-4 text-xs font-bold tracking-[0.15em] uppercase transition-colors relative"
              style={{
                color: activeTab === tab ? "#f8f9fa" : "#555",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab === "parts" ? "Model & Colors" : "Design"}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400" />
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: MODEL & COLORS ── */}
        {activeTab === "parts" && (
          <div className="flex flex-col gap-5 p-5">

            {/* Upload section */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Upload Your Own</p>
              <div className="flex flex-col gap-2">
                <label
                  className="flex flex-col items-center justify-center w-full py-4 rounded-lg cursor-pointer text-sm gap-1 transition-all hover:opacity-90"
                  style={{ background: "rgba(110,231,183,0.07)", border: "2px dashed rgba(110,231,183,0.25)", color: "#6ee7b7" }}
                >
                  <span className="text-sm">↑</span>
                  <span className="font-bold tracking-wider text-xs">Upload 3D Model</span>
                  <span className="text-[10px] text-white/25">.glb or .gltf</span>
                  <input type="file" accept=".glb,.gltf" onChange={handleModelFileUpload} className="hidden" />
                </label>

                <label
                  className="flex flex-col items-center justify-center w-full py-4 rounded-lg cursor-pointer text-sm gap-1 transition-all hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.1)", color: "#888" }}
                >
                  <span className="text-sm">↑</span>
                  <span className="font-bold tracking-wider text-xs">Upload 2D Image</span>
                  <span className="text-[10px] text-white/25">PNG, JPG, SVG, WebP</span>
                  <input type="file" accept="image/*" onChange={handleGarmentImageUpload} className="hidden" />
                </label>

                {(uploadedModelUrl || uploadedImageUrl) && (
                  <button
                    onClick={handleClearUpload}
                    className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors text-center py-1"
                  >
                    ✕ Remove uploaded file
                  </button>
                )}
              </div>
            </div>

            {/* Garment parts */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Garment Parts</p>
              {!modelLoaded && showModelViewer ? (
                <p className="text-white/30 text-sm animate-pulse">Loading parts...</p>
              ) : materials.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {materials.map((mat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleMaterialToggle(idx)}
                          title={mat.visible ? "Hide part" : "Show part"}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
                          style={{
                            background: mat.visible ? "rgba(110,231,183,0.15)" : "rgba(255,255,255,0.04)",
                            border: mat.visible ? "1px solid rgba(110,231,183,0.4)" : "1px solid rgba(255,255,255,0.08)",
                            color: mat.visible ? "#6ee7b7" : "#555",
                          }}
                        >
                          {mat.visible ? "●" : "○"}
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-white/80">{mat.name}</p>
                          {mat.isPrintArea && (
                            <p className="text-[10px] text-emerald-400/60 tracking-wider">Print Area</p>
                          )}
                        </div>
                      </div>
                      <input
                        type="color"
                        value={mat.color}
                        onChange={(e) => handleMaterialColorChange(idx, e.target.value)}
                        className="w-9 h-9 cursor-pointer rounded-md border-none bg-transparent"
                        title={`Change color of ${mat.name}`}
                      />
                    </div>
                  ))}
                </div>
              ) : !showModelViewer && !uploadedImageUrl ? (
                <p className="text-white/25 text-xs leading-relaxed">
                  Upload a 3D model (.glb / .gltf) to customize individual garment parts and colors.
                </p>
              ) : showModelViewer && modelLoaded && materials.length === 0 ? (
                <p className="text-white/25 text-xs">No materials detected — use the Design tab to add graphics.</p>
              ) : !webglAvailable ? (
                <p className="text-white/25 text-xs">WebGL is required for 3D features. Open in a supported browser.</p>
              ) : null}
            </div>

            {/* Quick Colors */}
            {materials.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Quick Colors</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleMaterialColorChange(0, c.hex)}
                      title={c.name}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110 border-2"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: materials[0]?.color === c.hex ? "#6ee7b7" : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Size */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Size</p>
              <div className="flex gap-2 flex-wrap">
                {["XS", "S", "M", "L", "XL"].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    className="px-4 py-2 text-xs font-bold tracking-wider transition-all rounded"
                    style={{
                      background: selectedSize === size ? "#6ee7b7" : "rgba(255,255,255,0.05)",
                      color: selectedSize === size ? "#000" : "#888",
                      border: selectedSize === size ? "1px solid #6ee7b7" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: DESIGN ── */}
        {activeTab === "design" && (
          <div className="flex flex-col gap-5 p-5">

            {/* Design Canvas Preview */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-2">Design Canvas</p>
              <div
                id="fabric-canvas-wrapper"
                className="w-full overflow-hidden rounded-lg border"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: bgColor, aspectRatio: "1/1" }}
              />
            </div>

            {/* Canvas background */}
            <div className="flex items-center gap-3">
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold whitespace-nowrap">Canvas BG</p>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  const hex = e.target.value;
                  setBgColor(hex);
                  const fc = fabricCanvasRef.current;
                  if (fc) { (fc as any).backgroundColor = hex; fc.renderAll(); syncTexture(); }
                }}
                className="w-9 h-9 cursor-pointer rounded border-none bg-transparent"
              />
              <div className="flex flex-wrap gap-1.5 flex-1">
                {["#ffffff", "#1A1A1A", "#F5F0EB", "#1D2B45", "#5C2028", "#4A5240"].map(hex => (
                  <button
                    key={hex}
                    onClick={() => {
                      setBgColor(hex);
                      const fc = fabricCanvasRef.current;
                      if (fc) { (fc as any).backgroundColor = hex; fc.renderAll(); syncTexture(); }
                    }}
                    className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {/* Text Tool */}
            <div className="rounded-lg p-4" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Add Text</p>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your text here..."
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400/50 mb-3"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-[9px] text-white/25 mb-1">Font</p>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[9px] text-white/25 mb-1">Size: {fontSize}px</p>
                  <input
                    type="range" min={20} max={200} step={5}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[9px] text-white/25 whitespace-nowrap">Color</p>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded border-none bg-transparent"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["#ffffff", "#000000", "#dc2626", "#6ee7b7", "#C9A86C", "#1D2B45"].map(hex => (
                    <button key={hex} onClick={() => setTextColor(hex)} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <button
                onClick={handleAddText}
                className="w-full py-2 text-xs font-bold tracking-widest rounded transition-colors"
                style={{ background: "rgba(110,231,183,0.12)", color: "#6ee7b7", border: "1px solid rgba(110,231,183,0.2)" }}
              >
                + ADD TEXT
              </button>
            </div>

            {/* Shapes */}
            <div className="rounded-lg p-4" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-3">Add Shapes</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { key: "rect" as const, label: "Rectangle" },
                  { key: "circle" as const, label: "Circle" },
                  { key: "triangle" as const, label: "Triangle" },
                  { key: "line" as const, label: "Line" },
                  { key: "stripes" as const, label: "Stripes" },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => handleAddShape(s.key)}
                    className="py-2 text-[10px] font-bold tracking-wider rounded transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#888", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Image to Design */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold mb-2">Upload Image / Logo</p>
              <label
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer transition-all hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)", color: "#666" }}
              >
                <span className="text-xs">↑ Upload Image to Canvas</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* Layer list */}
            {objects.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-semibold">Layers ({objects.length})</p>
                  <button onClick={handleClearCanvas} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">
                    Clear All
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {objects.map((obj, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        const fc = fabricCanvasRef.current;
                        if (!fc) return;
                        fc.setActiveObject(obj);
                        fc.renderAll();
                        currentObjRef.current = obj;
                        setSelectedObjIndex(idx);
                        setScaleVal(obj.scaleX ?? 1);
                        setPosX(Math.round(obj.left ?? 512));
                        setPosY(Math.round(obj.top ?? 512));
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors"
                      style={{
                        background: selectedObjIndex === idx ? "rgba(110,231,183,0.1)" : "rgba(255,255,255,0.03)",
                        border: selectedObjIndex === idx ? "1px solid rgba(110,231,183,0.3)" : "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span className="text-xs text-white/60">
                        {obj.type === "i-text" || obj.type === "text"
                          ? `"${(obj as any).text?.slice(0, 16) || "Text"}"`
                          : obj.type === "group"
                          ? "Group"
                          : obj.type || `Object ${idx + 1}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          currentObjRef.current = obj;
                          handleDeleteSelected();
                        }}
                        className="text-[10px] text-red-400/40 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Object Controls */}
            {selectedObjIndex >= 0 && (
              <div className="rounded-lg p-4" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(110,231,183,0.15)" }}>
                <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-400/50 font-semibold mb-3">Selected Object</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-[10px] text-white/25 mb-1">
                      <span>Scale</span><span>{scaleVal.toFixed(2)}×</span>
                    </div>
                    <input
                      type="range" min={0.1} max={5} step={0.05}
                      value={scaleVal}
                      onChange={(e) => handleScaleChange(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-white/25 mb-1">X Position</p>
                      <input
                        type="number" value={posX}
                        onChange={(e) => handlePosXChange(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 mb-1">Y Position</p>
                      <input
                        type="number" value={posY}
                        onChange={(e) => handlePosYChange(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full py-2 text-xs font-bold tracking-wider rounded text-red-400/70 hover:text-red-400 transition-colors"
                    style={{ background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.12)" }}
                  >
                    DELETE SELECTED
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SAVE BUTTON — sticky at the bottom of the panel ── */}
        {onSaveDesign && (
          <div
            className="sticky bottom-0 z-20 p-4 mt-auto"
            style={{ background: "linear-gradient(to top, #111 70%, transparent)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 font-bold tracking-[0.15em] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: isSaving ? "#333" : "#fff", color: isSaving ? "#888" : "#000", borderRadius: "4px" }}
            >
              {isSaving ? "SAVING DESIGN…" : "SAVE & ADD TO CART"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
