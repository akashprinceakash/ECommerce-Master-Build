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
}

declare global {
  interface Window {
    ModelViewerElement?: any;
  }
}

const PRESET_COLORS = [
  { name: "Ivory", hex: "#F5F0EB" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "Navy", hex: "#1D2B45" },
  { name: "Burgundy", hex: "#5C2028" },
  { name: "Olive", hex: "#4A5240" },
  { name: "Beige", hex: "#D4C5B9" },
  { name: "Slate", hex: "#708090" },
  { name: "Forest", hex: "#228B22" },
];

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
}: ModelViewerCustomizerProps) {
  const [webglAvailable] = useState<boolean>(() => {
    try { return isWebGLAvailable(); } catch { return false; }
  });
  const [mvScriptLoaded, setMvScriptLoaded] = useState(false);

  useEffect(() => {
    if (!webglAvailable) return;
    if (document.querySelector('script[data-mv-loader]')) {
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
  const [objects, setObjects] = useState<fabric.FabricObject[]>([]);
  const [selectedObjIndex, setSelectedObjIndex] = useState<number>(-1);
  const [scaleVal, setScaleVal] = useState(1);
  const [posX, setPosX] = useState(512);
  const [posY, setPosY] = useState(512);

  const SIZE_SCALES: Record<string, string> = {
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

  useEffect(() => {
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

    mv.addEventListener("load", handleLoad);
    mv.addEventListener("error", handleError);
    return () => {
      mv.removeEventListener("load", handleLoad);
      mv.removeEventListener("error", handleError);
    };
  }, [syncTexture]);

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
      fontFamily, fontSize: 100, fill: textColor, fontWeight: "800",
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

  const handleAddLine = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const line = new fabric.Line([0, 512, 1024, 512], {
      stroke: textColor, strokeWidth: 20, selectable: true, left: 512, top: 512, originX: "center", originY: "center",
    });
    fc.add(line); fc.setActiveObject(line); fc.renderAll();
    currentObjRef.current = line;
    updateObjectsList(); syncTexture();
  };

  const handleAddCurve = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const path = new fabric.Path("M 200 512 Q 512 200 800 512", {
      fill: "", stroke: textColor, strokeWidth: 20, selectable: true, left: 512, top: 512, originX: "center", originY: "center",
    });
    fc.add(path); fc.setActiveObject(path); fc.renderAll();
    currentObjRef.current = path;
    updateObjectsList(); syncTexture();
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
    updateObjectsList(); syncTexture();
  };

  const handleDeleteSelected = () => {
    const fc = fabricCanvasRef.current;
    const obj = currentObjRef.current;
    if (!fc || !obj) return;
    fc.remove(obj);
    currentObjRef.current = null;
    setSelectedObjIndex(-1);
    fc.renderAll();
    updateObjectsList(); syncTexture();
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

  const effectiveModelUrl = uploadedModelUrl || modelUrl;
  const noModel = !effectiveModelUrl || modelError;

  const handleModelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedBlobRef.current) URL.revokeObjectURL(uploadedBlobRef.current);
    const blobUrl = URL.createObjectURL(file);
    uploadedBlobRef.current = blobUrl;
    setUploadedModelUrl(blobUrl);
    setModelLoaded(false);
    setModelError(false);
    setMaterials([]);
    e.target.value = "";
  };

  const handleGarmentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImageUrl(ev.target?.result as string);
      setUploadedModelUrl(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full" style={{ minHeight: "600px" }}>
      {/* 3D Viewer */}
      <div className="flex-1 relative bg-[#100d0b] flex items-center justify-center rounded-none overflow-hidden" style={{ minHeight: "400px" }}>
        {!modelLoaded && effectiveModelUrl && webglAvailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#100d0b] z-10">
            <div className="w-10 h-10 border-2 border-white/10 border-t-emerald-300 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-white/40 tracking-wider">Loading Model...</p>
          </div>
        )}

        {(noModel || !webglAvailable || !mvScriptLoaded) ? (
          <div className="flex flex-col items-center justify-center w-full h-full gap-4 p-8">
            {uploadedImageUrl ? (
              <img src={uploadedImageUrl} alt="Uploaded garment" className="max-h-[500px] object-contain rounded-lg" />
            ) : thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Product" className="max-h-[400px] object-contain rounded-lg" />
            ) : (
              <div className="text-center text-white/30">
                <div className="w-24 h-32 mx-auto mb-4 rounded-sm bg-white/10" />
                <p className="text-xs tracking-widest uppercase">{noModel ? "Upload a Model or Image" : "3D Preview"}</p>
                <p className="text-xs mt-1 opacity-60">
                  {noModel ? "Use the upload button below to load your design" : "Use your browser for the 3D preview"}
                </p>
              </div>
            )}
          </div>
        ) : (
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
            exposure="1"
            style={{ width: "100%", height: "100%", minHeight: "400px", "--poster-color": "transparent" } as any}
          />
        )}

        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-white/30 flex gap-3">
          <span>DRAG to rotate</span>
          <span>SCROLL to zoom</span>
        </div>
      </div>

      {/* Controls Panel */}
      <div
        className="w-full lg:w-[400px] flex flex-col overflow-y-auto"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Tabs */}
        <div
          className="flex border-b sticky top-0 z-10"
          style={{ background: "rgba(16,13,11,0.9)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {(["parts", "design"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-4 text-sm font-semibold tracking-widest uppercase transition-colors relative"
              style={{
                color: activeTab === tab ? "#f8f9fa" : "#8b949e",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab === "parts" ? "Parts & Colors" : "Design"}
              {activeTab === tab && (
                <div
                  className="absolute bottom-0 left-0 w-full h-0.5"
                  style={{ background: "#6ee7b7", boxShadow: "0 0 10px rgba(110,231,183,0.4)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab: Parts & Colors */}
        {activeTab === "parts" && (
          <div className="flex flex-col gap-6 p-6">

            {/* Upload 3D Model or Image */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Upload Your Own Model / Image</p>
              <div className="flex flex-col gap-2">
                <label
                  className="flex flex-col items-center justify-center w-full py-4 rounded-xl cursor-pointer text-sm transition-all gap-1"
                  style={{ background: "rgba(110,231,183,0.08)", border: "2px dashed rgba(110,231,183,0.3)", color: "#6ee7b7" }}
                >
                  <span className="font-bold tracking-wider text-xs">↑ Upload 3D Model</span>
                  <span className="text-[10px] text-white/30">.glb or .gltf files supported</span>
                  <input type="file" accept=".glb,.gltf" onChange={handleModelFileUpload} className="hidden" />
                </label>
                <label
                  className="flex flex-col items-center justify-center w-full py-4 rounded-xl cursor-pointer text-sm transition-all gap-1"
                  style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.12)", color: "#8b949e" }}
                >
                  <span className="font-bold tracking-wider text-xs">↑ Upload 2D Image / Design</span>
                  <span className="text-[10px] text-white/30">PNG, JPG, WebP, SVG</span>
                  <input type="file" accept="image/*" onChange={handleGarmentImageUpload} className="hidden" />
                </label>
                {(uploadedModelUrl || uploadedImageUrl) && (
                  <button
                    onClick={() => { setUploadedModelUrl(null); setUploadedImageUrl(null); setModelLoaded(false); setModelError(false); setMaterials([]); }}
                    className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors text-center"
                  >
                    × Clear uploaded file
                  </button>
                )}
              </div>
            </div>

            {/* Materials */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Garment Parts</p>
              {modelLoaded && materials.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {materials.map((mat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleMaterialToggle(idx)}
                          title={mat.visible ? "Hide part" : "Show part"}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                          style={{
                            background: mat.visible ? "rgba(110,231,183,0.15)" : "rgba(255,255,255,0.05)",
                            border: mat.visible ? "1px solid rgba(110,231,183,0.4)" : "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>{mat.visible ? "●" : "○"}</span>
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-white/90">{mat.name}</p>
                          {mat.isPrintArea && (
                            <p className="text-[10px] text-emerald-400/70 tracking-wider">Print Area</p>
                          )}
                        </div>
                      </div>
                      <input
                        type="color"
                        value={mat.color}
                        onChange={(e) => handleMaterialColorChange(idx, e.target.value)}
                        style={{
                          width: "40px", height: "40px", border: "none", cursor: "pointer",
                          background: "none", borderRadius: "8px", padding: 0,
                        }}
                        title={`Color for ${mat.name}`}
                      />
                    </div>
                  ))}
                </div>
              ) : modelLoaded && !noModel ? (
                <div className="flex flex-col gap-3">
                  <p className="text-white/30 text-sm">No materials detected in model.</p>
                  <p className="text-white/20 text-xs">Use the Design tab to add graphics.</p>
                </div>
              ) : noModel ? (
                <p className="text-white/30 text-sm">No 3D model assigned to this product.</p>
              ) : !webglAvailable ? (
                <p className="text-white/30 text-sm">3D features require WebGL — open in a supported browser to customize parts.</p>
              ) : (
                <p className="text-white/30 text-sm animate-pulse">Loading parts...</p>
              )}
            </div>

            {/* Preset Colors (applies to first material) */}
            {materials.length > 0 && (
              <div>
                <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Quick Colors</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleMaterialColorChange(0, c.hex)}
                      title={c.name}
                      className="w-9 h-9 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c.hex,
                        border: materials[0]?.color === c.hex ? "2px solid #fff" : "2px solid transparent",
                        boxShadow: materials[0]?.color === c.hex ? "0 0 12px rgba(255,255,255,0.2)" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Size */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Size</p>
              <div className="flex gap-2">
                {["S", "M", "L", "XL"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSizeChange(s)}
                    className="flex-1 py-3 font-bold text-base rounded-xl transition-all"
                    style={{
                      background: selectedSize === s ? "#6ee7b7" : "rgba(0,0,0,0.3)",
                      color: selectedSize === s ? "#0b0c10" : "#f8f9fa",
                      border: selectedSize === s ? "1px solid #6ee7b7" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: selectedSize === s ? "0 5px 15px rgba(110,231,183,0.3)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Design */}
        {activeTab === "design" && (
          <div className="flex flex-col gap-5 p-6">
            {/* Add Text */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Add Text</p>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="w-full rounded-lg px-4 py-3 text-sm mb-3"
                style={{
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f8f9fa", outline: "none", boxSizing: "border-box",
                }}
              />
              <div className="flex gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Color</span>
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                    style={{ width: "36px", height: "36px", border: "none", background: "none", cursor: "pointer", borderRadius: "6px", padding: 0 }} />
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f9fa" }}
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                </select>
              </div>
              <button onClick={handleAddText}
                className="w-full py-3 font-bold text-sm rounded-lg transition-all hover:opacity-90"
                style={{ background: "#f8f9fa", color: "#0b0c10", border: "none", cursor: "pointer" }}>
                Place Text on Garment
              </button>
            </div>

            {/* Upload Image */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Upload Graphic / Logo</p>
              <label
                className="flex items-center justify-center w-full py-3 rounded-lg cursor-pointer text-sm transition-all"
                style={{ background: "rgba(0,0,0,0.3)", border: "2px dashed rgba(255,255,255,0.15)", color: "#8b949e" }}
              >
                <span>Click to upload image</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* Shapes */}
            <div>
              <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold mb-3">Add Shapes</p>
              <div className="flex gap-2">
                {[
                  { label: "Line", fn: handleAddLine },
                  { label: "Curve", fn: handleAddCurve },
                  { label: "Stripes", fn: handleAddStripes },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
                    style={{ background: "#f8f9fa", color: "#0b0c10", border: "none", cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layer controls */}
            {objects.length > 0 && (
              <div
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-[11px] tracking-[3px] uppercase text-white/40 font-semibold">Adjust Elements</p>
                <select
                  value={selectedObjIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    const fc = fabricCanvasRef.current;
                    if (!fc) return;
                    const obj = fc.getObjects()[idx];
                    if (obj) {
                      fc.setActiveObject(obj);
                      currentObjRef.current = obj;
                      setSelectedObjIndex(idx);
                      setScaleVal(obj.scaleX ?? 1);
                      setPosX(Math.round(obj.left ?? 512));
                      setPosY(Math.round(obj.top ?? 512));
                    }
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f9fa" }}
                >
                  {objects.map((obj, i) => {
                    let label = (obj as any).type ?? "object";
                    if ((obj as any).text) label = `Text: "${((obj as any).text as string).substring(0, 8)}"`;
                    return <option key={i} value={i}>[{i + 1}] {label}</option>;
                  })}
                </select>

                {[
                  { label: "Scale", min: 0.1, max: 3, step: 0.05, val: scaleVal, fn: handleScaleChange },
                  { label: "Pos X", min: 0, max: 1024, step: 10, val: posX, fn: handlePosXChange },
                  { label: "Pos Y", min: 0, max: 1024, step: 10, val: posY, fn: handlePosYChange },
                ].map(({ label, min, max, step, val, fn }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-white/40 w-12">{label}</span>
                    <input
                      type="range" min={min} max={max} step={step} value={val}
                      onChange={(e) => fn(parseFloat(e.target.value))}
                      className="flex-1 accent-emerald-400"
                    />
                    <span className="text-xs text-white/50 w-10 text-right">{typeof val === "number" && val < 10 ? val.toFixed(2) : Math.round(val)}</span>
                  </div>
                ))}

                <button onClick={handleDeleteSelected}
                  className="w-full py-2 text-sm font-bold rounded-lg mt-1"
                  style={{ background: "#d1495b", color: "#fff", border: "none", cursor: "pointer" }}>
                  Remove Selected
                </button>
              </div>
            )}

            {/* Canvas */}
            <div>
              <div
                className="rounded-lg overflow-hidden mt-2"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: bgColor, aspectRatio: "1/1", width: "100%", position: "relative" }}
                id="fabric-canvas-wrapper"
              >
                <canvas ref={canvasElRef} id="design-canvas" />
              </div>
              <p className="text-[11px] text-white/30 mt-2 text-center">
                Drag elements on the canvas — changes map live to the 3D garment
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
