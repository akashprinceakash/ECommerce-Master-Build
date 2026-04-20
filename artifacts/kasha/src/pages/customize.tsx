import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import * as fabric from "fabric";

// ── Types ──────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  priceInPaise: number;
  modelUrl: string;
  thumbnailUrl?: string | null;
  defaultColor?: string;
  sizes?: string[];
}
interface MatEntry { idx: number; name: string; mat: any; color: string; }

// ── Constants ──────────────────────────────────────────────────────────────
const PAL = [
  "#C5D3DE","#F8F4E9","#ACB1A1","#F0CED2","#E9DAC3",
  "#FFFFFF","#585858","#576043","#DA1F26","#273878",
  "#243C2F","#362223","#000000",
];

const SIZES = ["XS","S","M","L","XL","XXL"];

const FONTS = [
  { label: "DM Sans", value: "'DM Sans'" },
  { label: "Arial", value: "Arial" },
  { label: "Serif", value: "'Times New Roman'" },
  { label: "Impact", value: "Impact" },
  { label: "Mono", value: "'Courier New'" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── CSS vars (dark studio theme) ──────────────────────────────────────────
const V = {
  bg: "#0e0c0a",
  sf: "rgba(255,255,255,0.04)",
  sf2: "rgba(255,255,255,0.08)",
  bd: "rgba(255,255,255,0.09)",
  bd2: "rgba(255,255,255,0.15)",
  tx: "#f0ece4",
  mu: "#7a7470",
  ac: "#c9a87c",
};

const S = {
  hdr: { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:"48px",borderBottom:`1px solid ${V.bd}`,background:"rgba(8,6,4,0.9)",backdropFilter:"blur(12px)",flexShrink:0,zIndex:50,position:"sticky",top:0 } as React.CSSProperties,
  lp: { width:"260px",minWidth:"260px",borderRight:`1px solid ${V.bd}`,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:"0",scrollbarWidth:"thin",background:V.bg } as React.CSSProperties,
  vw: { flex:1,position:"relative",background:"radial-gradient(ellipse at center,#1a1612 0%,#080604 100%)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" } as React.CSSProperties,
  rp: { width:"300px",minWidth:"300px",borderLeft:`1px solid ${V.bd}`,overflowY:"auto",display:"flex",flexDirection:"column",scrollbarWidth:"thin",background:V.bg } as React.CSSProperties,
  sb: { padding:"12px 0",borderBottom:`1px solid ${V.bd}` } as React.CSSProperties,
  sl: { fontSize:"10px",letterSpacing:".1em",textTransform:"uppercase",color:V.mu,fontWeight:600,marginBottom:"7px" } as React.CSSProperties,
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebGL check — model-viewer needs WebGL; fall back to thumbnail if unavailable
  const [webglAvailable] = useState<boolean>(() => {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch { return false; }
  });

  // 3D model-viewer ref
  const mvRef = useRef<any>(null);
  const [mvReady, setMvReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Fabric canvas
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);
  const logoObjRef = useRef<fabric.FabricImage | null>(null);

  // Materials
  const [mats, setMats] = useState<MatEntry[]>([]);
  const [activePart, setActivePart] = useState(0);

  // Design state
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [designName, setDesignName] = useState("");
  const [rightTab, setRightTab] = useState<"text"|"logo"|"shapes"|"canvas">("text");

  // Text controls
  const [txtVal, setTxtVal] = useState("");
  const [txtColor, setTxtColor] = useState("#FFFFFF");
  const [txtFont, setTxtFont] = useState("'DM Sans'");
  const [txtSize, setTxtSize] = useState(80);

  // Logo controls
  const [logoScale, setLogoScale] = useState(1);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Shape controls
  const [shapeColor, setShapeColor] = useState("#FFFFFF");
  const [strokeW, setStrokeW] = useState(12);

  // Canvas controls
  const [canvasBg, setCanvasBg] = useState("#FFFFFF");
  const [elScale, setElScale] = useState(1);
  const [elX, setElX] = useState(512);
  const [elY, setElY] = useState(512);

  // Product
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => apiFetch(`/api/products/${id}`),
    enabled: !!id,
  });

  // Load existing customization
  const { data: existing } = useQuery<any>({
    queryKey: ["customization", id],
    queryFn: () => apiFetch(`/api/customizations/product/${id}/latest`),
    enabled: !!id && !!user,
  });

  // ── Load model-viewer script (only when WebGL is available) ─────────────
  useEffect(() => {
    if (!webglAvailable) { setMvReady(false); return; }
    if (document.querySelector('script[data-mv-loader]')) { setMvReady(true); return; }
    const s = document.createElement("script");
    s.type = "module"; s.setAttribute("data-mv-loader","1");
    s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    s.onload = () => setMvReady(true);
    document.head.appendChild(s);
  }, [webglAvailable]);

  // ── Init Fabric ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el || fcRef.current) return;

    // Chrome textBaseline patch
    try {
      const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"textBaseline");
      if (d?.set) Object.defineProperty(CanvasRenderingContext2D.prototype,"textBaseline",{configurable:true,set(v){d.set!.call(this,v==="alphabetical"?"alphabetic":v);},get(){return d.get!.call(this);}});
    } catch {}

    const fc = new fabric.Canvas(el, { width:1024, height:1024, preserveObjectStacking:true, backgroundColor:"#FFFFFF" });
    fcRef.current = fc;

    const scaleCanvas = () => {
      const wrapper = document.getElementById("fc-wrapper");
      if (!wrapper || !wrapper.clientWidth) return;
      const w = wrapper.clientWidth;
      fc.setZoom(w / 1024);
      fc.setWidth(w);
      fc.setHeight(w);
    };
    window.addEventListener("resize", scaleCanvas);
    setTimeout(scaleCanvas, 100);

    fc.on("object:modified", () => syncTexture());
    fc.on("object:added", () => syncTexture());
    fc.on("object:removed", () => syncTexture());
    fc.on("selection:created", (e: any) => {
      const o = e.selected?.[0];
      if (!o) return;
      setElScale(o.scaleX ?? 1);
      setElX(Math.round(o.left ?? 512));
      setElY(Math.round(o.top ?? 512));
    });

    return () => { window.removeEventListener("resize", scaleCanvas); fc.dispose().catch(()=>{}); fcRef.current = null; };
  }, []);

  // ── Texture sync ────────────────────────────────────────────────────────
  const syncTexture = useCallback(async () => {
    const mv = mvRef.current;
    const fc = fcRef.current;
    if (!mv || !fc || !mats.length) return;
    try {
      const url = fc.toDataURL({ format:"png", quality:0.95, multiplier:1 });
      const tex = await mv.createTexture(url);
      mats[0].mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
    } catch {}
  }, [mats]);

  // Re-sync when mats array changes
  useEffect(() => {
    if (mats.length) syncTexture();
  }, [mats, syncTexture]);

  // ── model-viewer load event ─────────────────────────────────────────────
  useEffect(() => {
    if (!mvReady || !product?.modelUrl) return;
    const mv = mvRef.current;
    if (!mv) return;

    const onLoad = () => {
      const overlay = document.getElementById("mv-overlay");
      if (overlay) { overlay.style.opacity = "0"; setTimeout(() => { if(overlay) overlay.style.display="none"; }, 500); }

      const model = mv.model;
      if (!model?.materials?.length) { setModelLoaded(true); return; }

      const entries: MatEntry[] = model.materials.map((m: any, i: number) => ({
        idx: i, name: m.name || `Part ${i+1}`, mat: m, color: "#ffffff",
      }));
      setMats(entries);
      setModelLoaded(true);
    };

    mv.addEventListener("load", onLoad);
    return () => mv.removeEventListener("load", onLoad);
  }, [mvReady, product?.modelUrl]);

  // ── Restore existing design ─────────────────────────────────────────────
  useEffect(() => {
    if (!existing || !modelLoaded || !fcRef.current) return;
    setSize(existing.size || "M");
    setDesignName(existing.name || "");

    // Restore canvas
    if (existing.canvasData) {
      try {
        const parsed = JSON.parse(existing.canvasData);
        const canvasJSON = parsed.canvasJSON || parsed;
        const bg = parsed.canvasBg || "#FFFFFF";
        setCanvasBg(bg);
        fcRef.current.loadFromJSON(canvasJSON).then(() => {
          fcRef.current!.renderAll();
          syncTexture();
        }).catch(()=>{});

        // Restore material colors
        if (parsed.matColors && Array.isArray(parsed.matColors) && mats.length) {
          const updated = [...mats];
          parsed.matColors.forEach((hex: string, i: number) => {
            if (updated[i]) {
              updated[i] = { ...updated[i], color: hex };
              if (i === 0) {
                const fc = fcRef.current;
                if (fc) fc.setBackgroundColor(hex, () => { fc.renderAll(); });
              } else {
                updated[i].mat.pbrMetallicRoughness.setBaseColorFactor(hex);
              }
            }
          });
          setMats(updated);
        }
      } catch {}
    }
  }, [existing, modelLoaded]);

  // ── Material color change ───────────────────────────────────────────────
  const applyPartColor = (idx: number, hex: string) => {
    setMats(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], color: hex };
      if (idx === 0) {
        const fc = fcRef.current;
        if (fc) { fc.setBackgroundColor(hex, () => { fc.renderAll(); syncTexture(); }); }
        next[0].mat.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
      } else {
        next[idx].mat.pbrMetallicRoughness.setBaseColorFactor(hex);
      }
      return next;
    });
  };

  // Apply palette to active part
  const applyPalette = (hex: string) => {
    applyPartColor(activePart, hex);
    (document.getElementById("cp-custom") as HTMLInputElement | null)!.value = hex;
  };

  // ── Canvas background ───────────────────────────────────────────────────
  const setFcBg = (hex: string) => {
    setCanvasBg(hex);
    const fc = fcRef.current;
    if (!fc) return;
    fc.setBackgroundColor(hex, () => { fc.renderAll(); syncTexture(); });
    // Also update primary material color
    if (mats[0]) applyPartColor(0, hex);
  };

  // ── Text ────────────────────────────────────────────────────────────────
  const addText = async () => {
    const fc = fcRef.current; if (!fc) return;
    await document.fonts.ready;
    const t = new fabric.FabricText(txtVal || "Your Text", {
      left:512, top:512, originX:"center", originY:"center",
      fontFamily:txtFont, fontSize:txtSize, fill:txtColor, fontWeight:700,
    });
    fc.add(t); fc.setActiveObject(t); fc.renderAll(); syncTexture();
    toast({ title: "Text added", description: "Go to Canvas tab to reposition." });
  };

  // ── Logo ────────────────────────────────────────────────────────────────
  const addLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      setLogoPreview(src);
      const img = await fabric.FabricImage.fromURL(src);
      if (img.width && img.width > 400) img.scaleToWidth(400);
      img.set({ left:512, top:512, originX:"center", originY:"center" });
      const fc = fcRef.current; if (!fc) return;
      fc.add(img); fc.setActiveObject(img); logoObjRef.current = img;
      fc.renderAll(); syncTexture();
      toast({ title: "Logo added", description: "Drag on canvas to reposition." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scaleLogo = (v: number) => {
    const o = logoObjRef.current || fcRef.current?.getActiveObject();
    if (o) { o.scale(v); fcRef.current?.renderAll(); syncTexture(); }
    setLogoScale(v);
  };

  // ── Shapes ──────────────────────────────────────────────────────────────
  const addLine = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = new fabric.Line([0,0,500,0],{stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"});
    fc.add(o); fc.setActiveObject(o); fc.renderAll(); syncTexture();
  };
  const addCurve = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = new fabric.Path("M 0 80 Q 250 -80 500 80",{fill:"",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"});
    fc.add(o); fc.setActiveObject(o); fc.renderAll(); syncTexture();
  };
  const addRect = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = new fabric.Rect({width:300,height:180,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"});
    fc.add(o); fc.setActiveObject(o); fc.renderAll(); syncTexture();
  };
  const addCircle = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = new fabric.Circle({radius:140,fill:"transparent",stroke:shapeColor,strokeWidth:strokeW,left:512,top:512,originX:"center",originY:"center"});
    fc.add(o); fc.setActiveObject(o); fc.renderAll(); syncTexture();
  };
  const addStripes = () => {
    const fc = fcRef.current; if (!fc) return;
    const lines = Array.from({length:14}, (_,i) => new fabric.Line([-600,i*80-520,600,i*80-520],{stroke:shapeColor,strokeWidth:strokeW}));
    const g = new fabric.Group(lines,{left:512,top:512,originX:"center",originY:"center"});
    fc.add(g); fc.setActiveObject(g); fc.renderAll(); syncTexture();
  };
  const removeSel = () => {
    const fc = fcRef.current; if (!fc) return;
    const o = fc.getActiveObject();
    if (o) { fc.remove(o); fc.renderAll(); syncTexture(); }
  };
  const clearCanvas = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.getObjects().forEach(o => fc.remove(o)); fc.renderAll(); syncTexture();
  };

  // Element tweaks
  const setElS = (v: number) => {
    const o = fcRef.current?.getActiveObject();
    if (o) { o.scale(v); fcRef.current?.renderAll(); syncTexture(); }
    setElScale(v);
  };
  const setElPos = (k: "left"|"top", v: number) => {
    const o = fcRef.current?.getActiveObject();
    if (!o) return;
    o.set(k, v); fcRef.current?.renderAll(); syncTexture();
    if (k === "left") setElX(v); else setElY(v);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const fc = fcRef.current;
      if (!fc) throw new Error("Canvas not ready");
      if (!designName.trim()) throw new Error("Enter a design name");

      const matColors = mats.map(m => m.color);
      const canvasJSON = JSON.stringify(fc.toJSON());
      const snap = fc.toDataURL({ format:"png", quality:0.92, multiplier:1 });

      const body = {
        productId: id,
        name: designName || `${product?.name} Custom`,
        color: mats[0]?.color || "#ffffff",
        size,
        partsEnabled: { qty, matColors, canvasBg },
        canvasData: JSON.stringify({ canvasJSON, matColors, canvasBg }),
        previewImageUrl: snap,
      };
      return apiFetch("/api/customizations", { method:"POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: "Design Saved ✓", description: "Your bespoke design has been saved." });
      queryClient.invalidateQueries({ queryKey: ["customization", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant:"destructive" }),
  });

  const cartMut = useMutation({
    mutationFn: async () => {
      const fc = fcRef.current;
      if (!fc) throw new Error("Canvas not ready");
      const matColors = mats.map(m => m.color);
      const snap = fc.toDataURL({ format:"png", quality:0.92, multiplier:1 });
      const cust = await apiFetch("/api/customizations", { method:"POST", body: JSON.stringify({
        productId: id,
        name: designName || `${product?.name} Custom`,
        color: mats[0]?.color || "#ffffff",
        size,
        partsEnabled: { qty, matColors, canvasBg },
        canvasData: JSON.stringify({ canvasJSON: JSON.stringify(fc.toJSON()), matColors, canvasBg }),
        previewImageUrl: snap,
      })});
      return apiFetch("/api/cart", { method:"POST", body: JSON.stringify({
        productId: id, customizationId: cust.id, quantity: qty, size,
      })});
    },
    onSuccess: () => {
      toast({ title: "Added to Cart", description: "Your customized item is in your bag." });
      setLocation("/cart");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant:"destructive" }),
  });

  const exportCanvas = () => {
    const fc = fcRef.current; if (!fc) return;
    const a = document.createElement("a");
    a.href = fc.toDataURL({ format:"png", quality:0.95, multiplier:1 });
    a.download = `kasha-design-${Date.now()}.png`;
    a.click();
  };

  // ── Shared sub-styles ───────────────────────────────────────────────────
  const btn = (variant: "primary"|"secondary"|"danger"|"ghost" = "ghost") => {
    const base: React.CSSProperties = { width:"100%",padding:"8px",borderRadius:"8px",border:"none",fontFamily:"inherit",fontSize:"12px",fontWeight:600,cursor:"pointer",transition:"all .15s",letterSpacing:".02em" };
    if (variant === "primary") return { ...base, background:V.ac, color:V.bg };
    if (variant === "secondary") return { ...base, background:V.sf2, color:V.tx, border:`1px solid ${V.bd}` };
    if (variant === "danger") return { ...base, background:"rgba(196,92,92,.15)", color:"#c45c5c", border:"1px solid rgba(196,92,92,.2)" };
    return { ...base, background:V.sf2, color:V.tx, border:`1px solid ${V.bd}` };
  };

  const inp: React.CSSProperties = { width:"100%",padding:"8px 10px",background:"rgba(0,0,0,.4)",border:`1px solid ${V.bd}`,borderRadius:"8px",color:V.tx,fontFamily:"inherit",fontSize:"12px",outline:"none" };
  const slr: React.CSSProperties = { display:"flex",alignItems:"center",gap:"8px",marginTop:"4px" };
  const lbl: React.CSSProperties = { fontSize:"10px",color:V.mu,width:"44px",flexShrink:0 };

  if (isLoading) {
    return (
      <div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:V.bg }}>
        <div style={{ width:36,height:36,border:`2px solid ${V.bd2}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite" }} />
      </div>
    );
  }
  if (!product) return null;

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100vh",background:V.bg,color:V.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden" }}>

      {/* HEADER */}
      <header style={S.hdr}>
        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
          <Link href={`/products/${id}`} style={{ color:V.mu,fontSize:"13px",textDecoration:"none",display:"flex",alignItems:"center",gap:"6px" }}>
            ← Back
          </Link>
          <div style={{ width:"1px",height:"16px",background:V.bd }} />
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:"15px",color:V.ac,letterSpacing:".04em" }}>
            Golf Studio ✦ 3D Customizer
          </span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <input
            value={designName}
            onChange={e => setDesignName(e.target.value)}
            placeholder="Name your design..."
            style={{ ...inp, width:"160px", fontSize:"12px" }}
          />
          <Show when="signed-in">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:V.ac,color:V.bg,fontSize:"12px",fontWeight:600,cursor:"pointer",opacity:saveMut.isPending?0.6:1 }}
            >
              {saveMut.isPending ? "Saving…" : "💾 Save Design"}
            </button>
          </Show>
          <Show when="signed-out">
            <Link href="/sign-in" style={{ padding:"6px 14px",borderRadius:"8px",border:`1px solid ${V.bd}`,color:V.mu,fontSize:"12px",textDecoration:"none" }}>
              Sign in to save
            </Link>
          </Show>
          <button
            onClick={() => cartMut.mutate()}
            disabled={cartMut.isPending || saveMut.isPending}
            style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:"#2d6a4f",color:"white",fontSize:"12px",fontWeight:600,cursor:"pointer",opacity:cartMut.isPending?0.6:1 }}
          >
            {cartMut.isPending ? "Adding…" : "🛒 Add to Cart"}
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>

        {/* ── LEFT PANEL ── */}
        <div style={S.lp}>

          {/* Garment Parts */}
          <div style={S.sb}>
            <div style={S.sl}>Garment Parts</div>
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {!modelLoaded ? (
                <p style={{ fontSize:"11px",color:V.mu }}>Loading model parts…</p>
              ) : mats.length > 0 ? (
                mats.map((m,i) => (
                  <div
                    key={i}
                    onClick={() => setActivePart(i)}
                    style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",
                      background: activePart===i ? `rgba(201,168,124,.12)` : "rgba(0,0,0,.25)",
                      padding:"9px 11px",borderRadius:"9px",
                      border:`1px solid ${activePart===i ? V.ac : V.bd}`,
                      cursor:"pointer",transition:"border-color .15s",
                    }}
                  >
                    <div>
                      <div style={{ fontSize:"11px",fontWeight:500 }}>{m.name}</div>
                      <div style={{ fontSize:"10px",color:V.ac,marginTop:"1px" }}>
                        {i===0 ? "Main body" : i===1 ? "Trim / collar" : i===2 ? "Sleeve panel" : `Part ${i+1}`}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={m.color}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { setActivePart(i); applyPartColor(i, e.target.value); }}
                      style={{ width:"30px",height:"24px",border:"none",cursor:"pointer",background:"none",borderRadius:"5px",padding:0 }}
                    />
                  </div>
                ))
              ) : (
                <p style={{ fontSize:"11px",color:V.mu }}>No parts found in model.</p>
              )}
            </div>
          </div>

          {/* Color Palette */}
          <div style={S.sb}>
            <div style={S.sl}>Color Palette</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center" }}>
              {PAL.map(hex => (
                <div
                  key={hex}
                  title={hex}
                  onClick={() => applyPalette(hex)}
                  style={{
                    width:"26px",height:"26px",borderRadius:"50%",cursor:"pointer",flexShrink:0,
                    background:hex, border:`2px solid ${hex==="#FFFFFF"?V.bd2:"transparent"}`,
                    transition:"transform .12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform="scale(1.18)")}
                  onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
                />
              ))}
            </div>
            <div style={{ marginTop:"9px",display:"flex",gap:"7px",alignItems:"center" }}>
              <input
                id="cp-custom"
                type="color"
                defaultValue="#C5D3DE"
                onChange={e => applyPartColor(activePart, e.target.value)}
                style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }}
              />
              <span style={{ fontSize:"11px",color:V.mu }}>Apply to selected part</span>
            </div>
          </div>

          {/* Options */}
          <div style={S.sb}>
            <div style={S.sl}>Options</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0" }}>
              <div>
                <div style={{ fontSize:"12px",fontWeight:500 }}>Auto Rotate</div>
                <div style={{ fontSize:"10px",color:V.mu }}>Spin 3D preview</div>
              </div>
              <button
                onClick={() => {
                  const next = !autoRotate;
                  setAutoRotate(next);
                  const mv = mvRef.current;
                  if (mv) { if (next) mv.setAttribute("auto-rotate",""); else mv.removeAttribute("auto-rotate"); }
                }}
                style={{ width:"34px",height:"18px",background:autoRotate?V.ac:V.bd2,borderRadius:"9px",cursor:"pointer",border:"none",position:"relative",transition:"background .2s",flexShrink:0 }}
              >
                <div style={{ position:"absolute",top:"2px",left:autoRotate?"18px":"2px",width:"14px",height:"14px",background:"#fff",borderRadius:"50%",transition:"left .2s",boxShadow:"0 1px 2px rgba(0,0,0,.3)" }} />
              </button>
            </div>
          </div>

          {/* Size */}
          <div style={S.sb}>
            <div style={S.sl}>Size</div>
            <div style={{ display:"flex",gap:"5px" }}>
              {SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  style={{
                    flex:1,padding:"7px 0",background:size===s?V.ac:"rgba(0,0,0,.3)",
                    border:`1px solid ${size===s?V.ac:V.bd}`,borderRadius:"8px",
                    color:size===s?V.bg:V.mu,fontFamily:"inherit",fontSize:"12px",fontWeight:600,cursor:"pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div style={S.sb}>
            <div style={S.sl}>Quantity</div>
            <div style={{ display:"flex",alignItems:"center",gap:"9px" }}>
              <button onClick={() => setQty(q => Math.max(1,q-1))} style={{ width:"28px",height:"28px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:"6px",color:V.tx,fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>−</button>
              <span style={{ fontSize:"15px",fontWeight:600,minWidth:"26px",textAlign:"center" }}>{qty}</span>
              <button onClick={() => setQty(q => q+1)} style={{ width:"28px",height:"28px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:"6px",color:V.tx,fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>+</button>
            </div>
          </div>

          {/* Save / Export */}
          <div style={{ padding:"12px 0" }}>
            <Show when="signed-in">
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} style={{ ...btn("primary"),marginBottom:"7px" }}>
                {saveMut.isPending ? "Saving…" : "💾 Save This Design"}
              </button>
            </Show>
            <button onClick={exportCanvas} style={btn("secondary")}>📷 Export Design Canvas</button>
          </div>
        </div>

        {/* ── CENTER: model-viewer ── */}
        <div style={S.vw}>
          {/* Loading overlay — hidden if WebGL unavailable */}
          <div id="mv-overlay" style={{ position:"absolute",inset:0,background:V.bg,display:webglAvailable?"flex":"none",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px",zIndex:10,transition:"opacity .5s" }}>
            <div style={{ width:"36px",height:"36px",border:`2px solid ${V.bd2}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite" }} />
            <p style={{ fontSize:"12px",color:V.mu }}>Loading 3D T-Shirt…</p>
          </div>

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

          {(!product.modelUrl || !webglAvailable) && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"16px",color:V.mu,padding:"24px",maxWidth:"320px",textAlign:"center" }}>
              {product.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={product.name} style={{ maxHeight:"360px",objectFit:"contain",borderRadius:"12px",opacity:0.85 }} />
              ) : (
                <div style={{ fontSize:"64px",opacity:.2 }}>👕</div>
              )}
              <p style={{ fontSize:"11px",lineHeight:1.6 }}>
                {!webglAvailable
                  ? "3D preview requires WebGL. All design tools (canvas, text, shapes) still work — your design will be applied to the 3D model."
                  : "No 3D model uploaded for this product."}
              </p>
            </div>
          )}

          <div style={{ position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",fontSize:"10px",color:V.mu,background:"rgba(0,0,0,.55)",padding:"4px 12px",borderRadius:"20px",pointerEvents:"none",letterSpacing:".04em" }}>
            Drag to rotate · Scroll to zoom
          </div>

          {/* Product badge */}
          <div style={{ position:"absolute",top:"14px",left:"14px",background:"rgba(8,6,4,.85)",border:`1px solid ${V.bd}`,borderRadius:"9px",padding:"8px 12px",backdropFilter:"blur(8px)" }}>
            <div style={{ fontSize:"11px",fontWeight:600,color:V.ac }}>{product.name}</div>
            <div style={{ fontSize:"10px",color:V.mu }}>{formatPrice(product.priceInPaise)}</div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Design ── */}
        <div style={S.rp}>
          {/* Design tabs */}
          <div style={{ display:"flex",borderBottom:`1px solid ${V.bd}`,flexShrink:0 }}>
            {(["text","logo","shapes","canvas"] as const).map(t => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                style={{
                  flex:1,padding:"10px 0",background:"none",border:"none",
                  color:rightTab===t?V.ac:V.mu,fontFamily:"inherit",fontSize:"11px",fontWeight:600,
                  letterSpacing:".08em",textTransform:"uppercase",cursor:"pointer",
                  borderBottom:`2px solid ${rightTab===t?V.ac:"transparent"}`,transition:"all .15s",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* TEXT */}
          {rightTab==="text" && (
            <div style={{ padding:"16px 14px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={S.sl}>Text Content</div>
                <input type="text" value={txtVal} onChange={e=>setTxtVal(e.target.value)} placeholder="e.g. GOLF CLUB 2024" maxLength={40} style={inp} />
              </div>
              <div style={{ display:"flex",gap:"7px",alignItems:"center" }}>
                <input type="color" value={txtColor} onChange={e=>setTxtColor(e.target.value)} style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                <span style={{ fontSize:"11px",color:V.mu }}>Color</span>
                <select value={txtFont} onChange={e=>setTxtFont(e.target.value)} style={{ ...inp,flex:1,padding:"5px 7px" }}>
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div style={S.sl}>Font Size</div>
                <div style={slr}>
                  <label style={lbl}>Size</label>
                  <input type="range" min={30} max={200} value={txtSize} onChange={e=>setTxtSize(+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{txtSize}</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:"5px" }}>
                <button onClick={addText} style={{ ...btn("primary"),flex:1,padding:"6px 0",fontSize:"11px" }}>+ Add Text</button>
                <button onClick={removeSel} style={{ ...btn("danger"),flex:1,padding:"6px 0",fontSize:"11px" }}>✕ Remove</button>
              </div>
              <div style={{ background:"rgba(201,168,124,.07)",border:`1px solid rgba(201,168,124,.18)`,borderRadius:"7px",padding:"9px" }}>
                <p style={{ fontSize:"10px",color:V.ac,lineHeight:1.5 }}>💡 Add text then drag it on the Canvas tab to reposition. Updates the 3D model live.</p>
              </div>
            </div>
          )}

          {/* LOGO */}
          {rightTab==="logo" && (
            <div style={{ padding:"16px 14px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={S.sl}>Upload Logo / Graphic</div>
                <label style={{ display:"block",border:`1.5px dashed ${V.bd2}`,borderRadius:"9px",padding:"16px",textAlign:"center",cursor:"pointer",transition:"all .15s" }}>
                  <div style={{ fontSize:"20px" }}>⬆</div>
                  <p style={{ fontSize:"11px",color:V.mu,marginTop:"3px" }}><strong style={{ color:V.ac }}>Click to upload</strong></p>
                  <p style={{ fontSize:"10px",color:V.mu }}>PNG with transparency recommended</p>
                  <input type="file" accept="image/*" onChange={addLogo} style={{ display:"none" }} />
                </label>
              </div>
              {logoPreview && (
                <div>
                  <div style={S.sl}>Preview</div>
                  <img src={logoPreview} alt="Logo" style={{ maxWidth:"100%",borderRadius:"7px",border:`1px solid ${V.bd}` }} />
                </div>
              )}
              <div>
                <div style={S.sl}>Logo Scale</div>
                <div style={slr}>
                  <label style={lbl}>Scale</label>
                  <input type="range" min={0.1} max={3} step={0.05} value={logoScale} onChange={e=>scaleLogo(+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{logoScale.toFixed(1)}×</span>
                </div>
              </div>
              <button onClick={removeSel} style={{ ...btn("danger"),padding:"6px 0",fontSize:"11px" }}>Remove Logo</button>
            </div>
          )}

          {/* SHAPES */}
          {rightTab==="shapes" && (
            <div style={{ padding:"16px 14px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={S.sl}>Shape Color</div>
                <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                  <input type="color" value={shapeColor} onChange={e=>setShapeColor(e.target.value)} style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                  <span style={{ fontSize:"11px",color:V.mu }}>Shape color</span>
                </div>
              </div>
              <div>
                <div style={S.sl}>Stroke Width</div>
                <div style={slr}>
                  <label style={lbl}>Width</label>
                  <input type="range" min={2} max={60} value={strokeW} onChange={e=>setStrokeW(+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{strokeW}</span>
                </div>
              </div>
              <div>
                <div style={S.sl}>Add Shape</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px" }}>
                  <button onClick={addLine} style={{ ...btn("secondary"),padding:"6px 0",fontSize:"11px" }}>— Line</button>
                  <button onClick={addCurve} style={{ ...btn("secondary"),padding:"6px 0",fontSize:"11px" }}>⌒ Curve</button>
                  <button onClick={addRect} style={{ ...btn("secondary"),padding:"6px 0",fontSize:"11px" }}>▭ Rectangle</button>
                  <button onClick={addCircle} style={{ ...btn("secondary"),padding:"6px 0",fontSize:"11px" }}>○ Circle</button>
                  <button onClick={addStripes} style={{ ...btn("secondary"),padding:"6px 0",fontSize:"11px",gridColumn:"span 2" }}>≡ Stripe Pattern</button>
                </div>
              </div>
              <button onClick={removeSel} style={{ ...btn("danger"),padding:"6px 0",fontSize:"11px" }}>Remove Selected</button>
            </div>
          )}

          {/* CANVAS */}
          {rightTab==="canvas" && (
            <div style={{ padding:"16px 14px",display:"flex",flexDirection:"column",gap:"14px" }}>
              <div>
                <div style={S.sl}>Texture Background Color</div>
                <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                  <input type="color" value={canvasBg} onChange={e=>setFcBg(e.target.value)} style={{ width:"34px",height:"28px",borderRadius:"7px",cursor:"pointer",background:"none",padding:0,border:"none" }} />
                  <span style={{ fontSize:"11px",color:V.mu }}>Canvas background</span>
                </div>
              </div>
              <div>
                <div style={S.sl}>Adjust Selected Element</div>
                <div style={slr}>
                  <label style={lbl}>Scale</label>
                  <input type="range" min={0.1} max={5} step={0.05} value={elScale} onChange={e=>setElS(+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                  <span style={{ fontSize:"10px",color:V.mu,minWidth:"26px",textAlign:"right" }}>{elScale.toFixed(1)}×</span>
                </div>
                <div style={slr}>
                  <label style={lbl}>Pos X</label>
                  <input type="range" min={0} max={1024} step={5} value={elX} onChange={e=>setElPos("left",+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                </div>
                <div style={slr}>
                  <label style={lbl}>Pos Y</label>
                  <input type="range" min={0} max={1024} step={5} value={elY} onChange={e=>setElPos("top",+e.target.value)} style={{ flex:1,height:"3px",background:V.bd2,borderRadius:"2px",outline:"none",WebkitAppearance:"none",appearance:"none" }} />
                </div>
              </div>
              <div style={{ display:"flex",gap:"5px" }}>
                <button onClick={clearCanvas} style={{ ...btn("secondary"),flex:1,padding:"6px 0",fontSize:"11px" }}>Clear All</button>
                <button onClick={removeSel} style={{ ...btn("danger"),flex:1,padding:"6px 0",fontSize:"11px" }}>Remove Sel.</button>
              </div>
              <div>
                <div style={{ ...S.sl,marginBottom:"8px" }}>Live Canvas — drag to reposition</div>
                <div id="fc-wrapper" style={{ background:"#fff",borderRadius:"9px",overflow:"hidden",border:`1px solid ${V.bd2}`,width:"100%",aspectRatio:"1/1",position:"relative" }}>
                  <canvas ref={canvasElRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${V.bd2}; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:13px; height:13px; background:${V.ac}; border-radius:50%; cursor:pointer; border:2px solid #fff; }
      `}</style>
    </div>
  );
}
