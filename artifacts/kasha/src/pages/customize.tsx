/**
 * customize.tsx — KA.SHA Bespoke Studio (4-Step Wizard)
 *
 * Implements the customer wireframe with 4 sequential steps:
 *   1. Style   — base colour / print / bespoke design (locked for "pattern" products)
 *   2. Parts   — per-zone colour overrides (collar, front, back, sleeves)
 *   3. Logo    — optional logo upload + 9-point position grid + size slider
 *   4. Size    — XS → XXL + optional custom measurements
 *
 * Product-type behaviour:
 *   "fabric"  — Step 1 shows Solids + Prints tabs. Bespoke Designs picker in Patterns tab.
 *   "pattern" — Step 1 Pattern tab is pre-locked to a bespoke design.
 *   "print"   — Step 1 Prints tab only. No colour controls on step 1.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import * as fabric from "fabric";
import {
  PATTERNS, ZONE_PRESETS, ZONE_LABEL, ALL_OVER_TILE_PX, patternUrl,
  type PatternZone, type PatternDef, type ProductType,
} from "@/components/3d/patterns";
import {
  KASHA_DESIGNS, applyKashaDesign, clearKashaDesign, SKU_KASHA_DESIGN_MAP,
  type KashaDesignDef,
} from "@/components/3d/kasha-designs";

// ── Theme ─────────────────────────────────────────────────────────────────────
const V = {
  bg:    "#fafaf7",
  sf:    "#ffffff",
  sf2:   "#f4f3ef",
  cream3:"#ede9e1",
  bd:    "#e8e5df",
  bd2:   "#ccc9c2",
  tx:    "#1a1a18",
  mu:    "#8a8780",
  mul:   "#b8b5ae",
  ac:    "#c9a84c",
  aclt:  "#f5e9c8",
  charcoal2: "#2d2d2a",
};

// ── Colour palettes ───────────────────────────────────────────────────────────
const MAIN_PALETTE = [
  "#1a1a1a","#FFFFFF","#e8e0d8","#d4c5a9","#c9b89e","#b5cfe8",
  "#378ADD","#185FA5","#4a7c59","#97C459","#E24B4A","#D85A30",
  "#D4537E","#7F77DD","#BA7517","#888780",
];
const SIZES = ["XS","S","M","L","XL","XXL"];

// Garment part zones
const PART_ZONES: { id: Exclude<PatternZone,"all">; label: string }[] = [
  { id:"collar",      label:"Collar"       },
  { id:"front",       label:"Front"        },
  { id:"back",        label:"Back"         },
  { id:"leftSleeve",  label:"Left Sleeve"  },
  { id:"rightSleeve", label:"Right Sleeve" },
];

// Named placement positions → fabric canvas coordinates (1024×1024 UV space)
const LOGO_POSITIONS: Record<string, { left:number; top:number }> = {
  "front-chest": { left: 512, top: 390 },
  "front-left":  { left: 300, top: 390 },
  "front-right": { left: 724, top: 390 },
  "back-center": { left: 512, top: 500 },
  "back-left":   { left: 300, top: 500 },
  "back-right":  { left: 724, top: 500 },
  "left-sleeve": { left: 175, top: 560 },
  "right-sleeve":{ left: 849, top: 560 },
};
const PLACEMENT_GROUPS = [
  { label:"FRONT",  items:[{key:"front-chest",label:"Chest"},{key:"front-left",label:"Left"},{key:"front-right",label:"Right"}] },
  { label:"BACK",   items:[{key:"back-center",label:"Center"},{key:"back-left",label:"Left"},{key:"back-right",label:"Right"}] },
  { label:"SLEEVES",items:[{key:"left-sleeve",label:"Left"},{key:"right-sleeve",label:"Right"}] },
];

// Zones available for colour overrides (sleeves excluded — colour only on body parts)
const COLOUR_ZONES = PART_ZONES.filter(z => z.id !== "leftSleeve" && z.id !== "rightSleeve");

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgba(hex: string): [number,number,number,number] {
  const h = hex.replace("#","");
  const r = parseInt(h.substring(0,2),16)/255;
  const g = parseInt(h.substring(2,4),16)/255;
  const b = parseInt(h.substring(4,6),16)/255;
  return [isNaN(r)?1:r, isNaN(g)?1:g, isNaN(b)?1:b, 1];
}
function setFabricBg(fc: any, hex: string) {
  if (!fc) return;
  fc.backgroundColor = hex;
  fc.renderAll();
}
async function getToken(): Promise<string|null> {
  try { const c=(window as any).Clerk; return c?.session ? await c.session.getToken() : null; }
  catch { return null; }
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
const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/**
 * Rewrite direct R2 CDN URLs through our API proxy so model-viewer can fetch
 * them without hitting the R2 CORS restriction.
 * Local /api/public/... URLs are returned unchanged.
 */
function toProxiedUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.includes(".r2.dev/") || url.includes("r2.cloudflarestorage.com/")) {
    return `/api/r2-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: number; name: string; description: string;
  category: string;
  subType?: string | null;   // "pattern" | "printed" | "solid" | null
  sku?: string | null;
  priceInPaise: number; modelUrl: string;
  thumbnailUrl?: string|null; defaultColor?: string;
}
interface MatEntry { idx: number; name: string; mat: any; color: string; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();


  // ── Quick personalisation mode (mode=quick in URL) ───────────────────────
  const searchStr = useSearch();
  const isQuickMode = new URLSearchParams(searchStr).get("mode") === "quick";
  // garmentType: set when arriving from CustomizeEntryModal (/customize?type=solid|pattern|printed)
  const garmentType = (new URLSearchParams(searchStr).get("type") ?? "") as "solid"|"pattern"|"printed"|"";
  const isTypeMode = !!garmentType && !id; // standalone type-driven studio, no specific product

  // ── Wizard step (1–4) ────────────────────────────────────────────────────
  const [step, setStep] = useState(() => isQuickMode ? 3 : 1);

  // ── 3D model-viewer ──────────────────────────────────────────────────────
  const [webglAvailable] = useState(() => {
    try { const c=document.createElement("canvas"); return !!(window.WebGLRenderingContext&&(c.getContext("webgl")||c.getContext("experimental-webgl"))); }
    catch { return false; }
  });
  const mvRef = useRef<any>(null);
  const [mvReady, setMvReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  // modelDisplayed: true once load/error fires or fallback timeout hits.
  // Drives the overlay via React state (not DOM mutation) so it's reliable in production.
  const [modelDisplayed, setModelDisplayed] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [mats, setMats] = useState<MatEntry[]>([]);
  const syncTextureRef = useRef<(()=>void)|null>(null);
  const lastTextureUrlRef = useRef("");

  // ── Fabric canvas ────────────────────────────────────────────────────────
  const fcRef = useRef<fabric.Canvas|null>(null);
  const resizeListenerRef = useRef<(()=>void)|null>(null);
  const logoObjRef = useRef<any>(null);

  // ── Product type detection ───────────────────────────────────────────────
  // "pattern" → locked bespoke design
  // "print"   → print library only, no colour controls
  // "fabric"  → full editor (prints + colours + bespoke designs)
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn:  () => apiFetch(`/api/products/${id}`),
    enabled:  !!id,
  });
  const productType: ProductType =
    product?.subType === "pattern" ? "pattern" :
    product?.subType === "printed" ? "print"   : "fabric";

  // ── Style step state ─────────────────────────────────────────────────────
  const [styleTab, setStyleTab] = useState<"solid"|"print"|"pattern">(
    garmentType === "pattern" ? "pattern" :
    garmentType === "printed" ? "print"   :
    productType === "pattern" ? "pattern" :
    productType === "print"   ? "print"   : "solid"
  );
  const [primaryColor, setPrimaryColor] = useState("#ffffff");
  const [sleeveLength, setSleeveLength] = useState<"half"|"full">("half");

  // Print library
  const [activePrintId, setActivePrintId] = useState<string|null>(null);
  const [allOverPrintId, setAllOverPrintId] = useState<string|null>(null);
  const baseBgRef = useRef("#ffffff");
  const [zonePrintIds, setZonePrintIds] = useState<Record<Exclude<PatternZone,"all">,string|null>>({
    front:null, back:null, collar:null, leftSleeve:null, rightSleeve:null,
  });
  const [printMode, setPrintMode] = useState<"fullBody"|"parts">("fullBody");

  // KA.SHA Bespoke Design state
  const [activeKashaDesign, setActiveKashaDesign] = useState<KashaDesignDef|null>(null);
  const kdRequestIdRef = useRef(0);
  const autoAppliedRef = useRef(false);

  // ── Parts step state ─────────────────────────────────────────────────────
  const [activePartZone, setActivePartZone] = useState<Exclude<PatternZone,"all">>("collar");
  const [zoneColors, setZoneColors] = useState<Record<Exclude<PatternZone,"all">,string>>({
    collar:"", front:"", back:"", leftSleeve:"", rightSleeve:"",
  });

  // ── Logo step state ──────────────────────────────────────────────────────
  const [logoPosition, setLogoPosition] = useState("front-chest");
  const [logoSize, setLogoSize] = useState(50);
  const [logoPreview, setLogoPreview] = useState<string|null>(null);

  // ── Text step state ───────────────────────────────────────────────────────
  const textObjRef = useRef<any>(null);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState("front-chest");
  const [textFontSize, setTextFontSize] = useState(40);
  const [textColor, setTextColor] = useState("#1a1a18");
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<"left"|"center"|"right"|"justify">("left");
  const [textFont, setTextFont] = useState("Tinos");

  // ── Size step state ──────────────────────────────────────────────────────
  const [size, setSize] = useState("M");
  const [customMeasurements, setCustomMeasurements] = useState({ chest:"", shoulder:"", length:"", sleeve:"" });
  const [designName, setDesignName] = useState("");
  const [qty, setQty] = useState(1);

  // ── Studio UI state ───────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<"products"|"colors"|"prints"|"patterns"|"text"|"image"|"order"|null>("products");
  const [cameraView, setCameraView] = useState<"front"|"back"|"right"|"left">("front");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [colorTarget, setColorTarget] = useState<"all"|"front"|"back"|"leftSleeve"|"rightSleeve">("all");
  const historyStack = useRef<string[]>([]);
  const historyIdx = useRef(-1);

  // ── Design name ──────────────────────────────────────────────────────────
  const { data: existing } = useQuery<any>({
    queryKey: ["customization", id],
    queryFn:  () => apiFetch(`/api/customizations/product/${id}/latest`),
    enabled:  !!id && !!user,
  });

  // ── Load model-viewer script ─────────────────────────────────────────────
  useEffect(() => {
    if (!webglAvailable) { setModelDisplayed(true); return; }
    if (document.querySelector('script[data-mv-loader]')) { setMvReady(true); return; }
    const s = document.createElement("script");
    s.type = "module"; s.setAttribute("data-mv-loader","1");
    s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    s.onload  = () => setMvReady(true);
    // If CDN is unreachable, surface the fallback immediately instead of hanging
    s.onerror = () => { setMvReady(false); setModelDisplayed(true); };
    document.head.appendChild(s);
  }, [webglAvailable]);

  // ── Fabric canvas init ───────────────────────────────────────────────────
  const canvasElRef = useCallback((el: HTMLCanvasElement|null) => {
    if (!el) {
      if (resizeListenerRef.current) { window.removeEventListener("resize", resizeListenerRef.current); resizeListenerRef.current=null; }
      if (fcRef.current) { try { const r: any=fcRef.current.dispose(); if(r?.catch) r.catch(()=>{}); } catch {} fcRef.current=null; }
      return;
    }
    if (fcRef.current) return;
    // Chrome textBaseline patch
    try {
      const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"textBaseline");
      if (d?.set) Object.defineProperty(CanvasRenderingContext2D.prototype,"textBaseline",{
        configurable:true, set(v) { d.set!.call(this,v==="alphabetical"?"alphabetic":v); }, get() { return d.get!.call(this); },
      });
    } catch {}
    const fc = new fabric.Canvas(el, { width:1024, height:1024, preserveObjectStacking:true, backgroundColor:"#ffffff" });
    fcRef.current = fc;
    setCanvasReady(true);
    const scaleCanvas = () => {
      const host=document.getElementById("fc-scale-host");
      const wrapper=document.getElementById("fc-wrapper");
      if (!host||!wrapper) return;
      host.style.transform=`scale(${(wrapper.clientWidth||1024)/1024})`;
    };
    resizeListenerRef.current = scaleCanvas;
    window.addEventListener("resize", scaleCanvas);
    setTimeout(scaleCanvas, 100);
    fc.on("object:modified", () => syncTextureRef.current?.());
    fc.on("object:added",    () => syncTextureRef.current?.());
    fc.on("object:removed",  () => syncTextureRef.current?.());
  }, []);

  // ── Texture sync ─────────────────────────────────────────────────────────
  const syncTexture = useCallback(async () => {
    const mv: any=mvRef.current; const fc: any=fcRef.current;
    if (!mv||!fc||!mats.length) return;
    try {
      fc.renderAll(); await raf(); fc.renderAll(); await raf();
      const rawEl: HTMLCanvasElement|undefined = typeof fc.getElement==="function" ? fc.getElement() : undefined;
      const dataUrl = rawEl ? rawEl.toDataURL("image/png",1.0) : fc.toDataURL({format:"png",quality:1.0,multiplier:1});
      if (!dataUrl||dataUrl.length<100) return;
      lastTextureUrlRef.current = dataUrl;
      const tex = await mv.createTexture(dataUrl);
      for (const entry of mats) {
        const pbr=entry?.mat?.pbrMetallicRoughness; if(!pbr) continue;
        const slot=pbr.baseColorTexture;
        try { slot?.setTexture?.(tex); try{pbr.setBaseColorFactor([1,1,1,1]);}catch{}; break; }
        catch { try { if(slot&&typeof slot.texture!=="undefined"){slot.texture=tex;try{pbr.setBaseColorFactor([1,1,1,1]);}catch{};break;} }catch{} }
      }
    } catch (e) { console.error("[customize] syncTexture failed:",e); }
  }, [mats]);

  useEffect(() => { syncTextureRef.current = syncTexture; }, [syncTexture]);
  useEffect(() => { if (mats.length) syncTexture(); }, [mats, syncTexture]);

  // ── model-viewer load ────────────────────────────────────────────────────
  useEffect(() => {
    // No model URL or WebGL unavailable → nothing to load, show fallback immediately
    if (!product?.modelUrl || !webglAvailable) { setModelDisplayed(true); return; }
    if (!mvReady) return;

    const mv = mvRef.current;
    if (!mv) {
      // model-viewer element not yet in DOM; wait for next render
      const t = setTimeout(() => setModelDisplayed(true), 15000);
      return () => clearTimeout(t);
    }

    const reveal = () => { setModelDisplayed(true); };

    const onLoad = async () => {
      const model = mv.model;
      if (model?.materials?.length) {
        const entries: MatEntry[] = model.materials.map((m:any,i:number)=>({idx:i,name:m.name||`Part ${i+1}`,mat:m,color:"#ffffff"}));
        setMats(entries);
        requestAnimationFrame(()=>syncTextureRef.current?.());
      }
      setModelLoaded(true);
      reveal();
    };

    const onError = () => { setModelLoaded(true); reveal(); };

    // Guard: model-viewer fires load synchronously on cached models
    if ((mv as any).loaded) { onLoad(); return; }

    // Safety net: hide spinner after 15 s regardless
    const fallback = setTimeout(() => { reveal(); setModelLoaded(true); }, 15000);

    mv.addEventListener("load", onLoad);
    mv.addEventListener("error", onError);
    return () => {
      mv.removeEventListener("load", onLoad);
      mv.removeEventListener("error", onError);
      clearTimeout(fallback);
    };
  }, [mvReady, product?.modelUrl, webglAvailable]);

  // Update styleTab when productType resolves (after data fetch)
  useEffect(() => {
    if (productType==="pattern") setStyleTab("pattern");
    else if (productType==="print") setStyleTab("print");
  }, [productType]);

  // ── KA.SHA Bespoke Design handler ────────────────────────────────────────
  const handleSelectKashaDesign = useCallback(async (design: KashaDesignDef) => {
    const fc=fcRef.current; if(!fc) return;
    const myReq=++kdRequestIdRef.current;
    setActiveKashaDesign(design);
    if (allOverPrintId){setFabricBg(fc,"#ffffff");setAllOverPrintId(null);}
    try{mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1,1,1,1]);}catch{}
    await applyKashaDesign(fc, design);
    if (myReq!==kdRequestIdRef.current) return;
    syncTexture();
    toast({title:`${design.id} applied`, description:design.label});
  }, [allOverPrintId, mats, syncTexture, toast]);

  // ── Primary colour (fabric/solid) ────────────────────────────────────────
  const applyPrimary = (hex: string) => {
    setPrimaryColor(hex);
    const fc=fcRef.current;
    baseBgRef.current=hex;
    if (!allOverPrintId) setFabricBg(fc,hex);
    syncTexture();
    if (mats[0]) {
      setMats(prev=>{const n=[...prev];if(!n[0])return prev;n[0]={...n[0],color:hex};try{n[0].mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1,1,1,1]);}catch{};return n;});
    }
  };

  // ── Per-zone colour ──────────────────────────────────────────────────────
  const applyZoneColor = useCallback((zone: Exclude<PatternZone,"all">, hex: string) => {
    const fc=fcRef.current; if(!fc) return;
    kdRequestIdRef.current++;
    const existing=fc.getObjects().filter((o:any)=>o?.data?.kashaZoneColor===zone);
    if (existing.length) fc.remove(...existing);
    if (!hex) { setZoneColors(prev=>({...prev,[zone]:""})); fc.renderAll(); syncTexture(); return; }
    const preset=ZONE_PRESETS[zone];
    const rect=new fabric.Rect({left:preset.left,top:preset.top,width:preset.w,height:preset.h,fill:hex,selectable:false,evented:false,originX:"left",originY:"top"});
    (rect as any).data={kashaZoneColor:zone};
    fc.add(rect);
    (fc as any).sendObjectToBack?.(rect);
    const kdBase=fc.getObjects().find((o:any)=>o?.data?.tag==="__kashaKdBg__");
    if (kdBase) (fc as any).sendObjectToBack?.(kdBase);
    fc.renderAll();
    setZoneColors(prev=>({...prev,[zone]:hex}));
    syncTexture();
  }, [syncTexture]);

  // ── Print library ────────────────────────────────────────────────────────
  const loadHTMLImage=(url:string)=>new Promise<HTMLImageElement>((res,rej)=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>res(img);img.onerror=rej;img.src=url;});

  const applyAllOverPrint = useCallback(async (p: PatternDef) => {
    const fc=fcRef.current; if(!fc) return;
    kdRequestIdRef.current++;
    try {
      const img=await loadHTMLImage(patternUrl(p.file));
      const off=document.createElement("canvas");off.width=ALL_OVER_TILE_PX;off.height=ALL_OVER_TILE_PX;
      const ctx=off.getContext("2d"); if(ctx){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(img,0,0,ALL_OVER_TILE_PX,ALL_OVER_TILE_PX);}
      if (activeKashaDesign){clearKashaDesign(fc);setActiveKashaDesign(null);}
      const pattern=new fabric.Pattern({source:off,repeat:"repeat"});
      (fc as any).backgroundColor=pattern;
      fc.renderAll();
      setAllOverPrintId(p.id); setActivePrintId(p.id);
      try{mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1,1,1,1]);}catch{}
      syncTexture();
      toast({title:"Print applied",description:`${p.label} mapped across the whole garment.`});
    } catch { toast({title:"Could not load print",variant:"destructive"}); }
  }, [activeKashaDesign, mats, syncTexture, toast]);

  const clearAllOverPrint = useCallback(()=>{
    const fc=fcRef.current; if(!fc) return;
    setFabricBg(fc,baseBgRef.current||"#1a1a1a");
    fc.renderAll(); setAllOverPrintId(null); syncTexture();
  }, [syncTexture]);

  // ── Zone (part-by-part) print placement ───────────────────────────────────
  const applyZonePrint = useCallback(async (zone: Exclude<PatternZone,"all">, p: PatternDef) => {
    const fc=fcRef.current; if(!fc) return;
    const preset=ZONE_PRESETS[zone];
    // Use a consistent tile size — canvas clips overflow, so edges are never squished
    const tileSize=192;
    try {
      const img=await loadHTMLImage(patternUrl(p.file));
      const off=document.createElement("canvas");
      off.width=preset.w; off.height=preset.h;
      const ctx=off.getContext("2d"); if(!ctx) return;
      ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
      // 9-arg drawImage: always scale source to tileSize×tileSize at each position.
      // The offscreen canvas (preset.w × preset.h) clips any overflow automatically.
      for (let row=0; row*tileSize<preset.h; row++) {
        for (let col=0; col*tileSize<preset.w; col++) {
          ctx.drawImage(img, 0, 0, img.width, img.height, col*tileSize, row*tileSize, tileSize, tileSize);
        }
      }
      // Remove any existing print for this zone
      fc.getObjects().filter((o:any)=>o?.data?.kashaZonePrint===zone).forEach((o:any)=>fc.remove(o));
      const fimg=await fabric.FabricImage.fromURL(off.toDataURL());
      fimg.set({ left:preset.left, top:preset.top, selectable:false, evented:false, originX:"left", originY:"top" });
      (fimg as any).data={kashaZonePrint:zone};
      fc.add(fimg);
      setZonePrintIds(prev=>({...prev,[zone]:p.id}));
      fc.renderAll(); syncTexture();
      toast({title:`Print applied to ${ZONE_LABEL[zone]}`});
    } catch { toast({title:"Could not apply print",variant:"destructive"}); }
  }, [syncTexture, toast]);

  // Auto-apply the correct KA.SHA design for this product's SKU when navigating
  // from the PDP (both quick and full customisation modes).
  useEffect(() => {
    if (!canvasReady || productType !== "pattern" || autoAppliedRef.current) return;
    if (!product) return; // wait until product data is loaded
    autoAppliedRef.current = true;
    const designId = SKU_KASHA_DESIGN_MAP[product.sku ?? ""] ?? "KD001";
    const design = KASHA_DESIGNS.find(d => d.id === designId) ?? KASHA_DESIGNS[0];
    handleSelectKashaDesign(design);
  }, [canvasReady, productType, handleSelectKashaDesign, product]);

  const clearZonePrint = useCallback((zone: Exclude<PatternZone,"all">)=>{
    const fc=fcRef.current; if(!fc) return;
    fc.getObjects().filter((o:any)=>o?.data?.kashaZonePrint===zone).forEach((o:any)=>fc.remove(o));
    setZonePrintIds(prev=>({...prev,[zone]:null}));
    fc.renderAll(); syncTexture();
  }, [syncTexture]);

  const clearAllZonePrints = useCallback(()=>{
    const fc=fcRef.current; if(!fc) return;
    fc.getObjects().filter((o:any)=>o?.data?.kashaZonePrint).forEach((o:any)=>fc.remove(o));
    setZonePrintIds({front:null,back:null,collar:null,leftSleeve:null,rightSleeve:null});
    fc.renderAll(); syncTexture();
  }, [syncTexture]);

  // ── Logo ─────────────────────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const src=ev.target?.result as string;
      setLogoPreview(src);
      const img=await fabric.FabricImage.fromURL(src);
      const pos=LOGO_POSITIONS[logoPosition]||{left:512,top:512};
      const maxW=Math.round(logoSize*(1024/100));
      if (img.width&&img.width>maxW) img.scaleToWidth(maxW);
      img.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:true});
      const fc=fcRef.current; if(!fc) return;
      if (logoObjRef.current) fc.remove(logoObjRef.current);
      fc.add(img); fc.setActiveObject(img); logoObjRef.current=img;
      fc.renderAll(); syncTexture();
    };
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const repositionLogo = () => {
    const o=logoObjRef.current; if(!o) return;
    const pos=LOGO_POSITIONS[logoPosition]||{left:512,top:512};
    const maxW=Math.round(logoSize*(1024/100));
    o.scaleToWidth(maxW);
    o.set({left:pos.left,top:pos.top,originX:"center",originY:"center"});
    fcRef.current?.renderAll(); syncTexture();
  };

  const removeLogo=()=>{
    const fc=fcRef.current; if(!fc) return;
    if(logoObjRef.current){fc.remove(logoObjRef.current);logoObjRef.current=null;setLogoPreview(null);fc.renderAll();syncTexture();}
  };

  // ── Text handlers ─────────────────────────────────────────────────────────
  const applyText = () => {
    const fc=fcRef.current; if(!fc||!textInput.trim()) return;
    const pos=LOGO_POSITIONS[textPosition]||{left:512,top:512};
    if (textObjRef.current) fc.remove(textObjRef.current);
    const txt=new (fabric as any).IText(textInput.trim(),{
      left:pos.left, top:pos.top,
      originX:"center", originY:"center",
      fontSize:textFontSize,
      fill:textColor,
      fontFamily:textFont,
      fontWeight:textBold?"700":"400",
      fontStyle:textItalic?"italic":"normal",
      underline:textUnderline,
      textAlign:textAlign,
      flipX:true,
      selectable:true, evented:true,
      data:{tag:"user-text"},
    });
    fc.add(txt); fc.setActiveObject(txt);
    textObjRef.current=txt;
    fc.renderAll(); syncTexture();
  };

  const repositionText = () => {
    const o=textObjRef.current; if(!o) return;
    const pos=LOGO_POSITIONS[textPosition]||{left:512,top:512};
    o.set({left:pos.left, top:pos.top, originX:"center", originY:"center", fontSize:textFontSize, fill:textColor});
    fcRef.current?.renderAll(); syncTexture();
  };

  const removeText = () => {
    const fc=fcRef.current; if(!fc) return;
    if(textObjRef.current){fc.remove(textObjRef.current);textObjRef.current=null;}
    fc.renderAll(); syncTexture();
  };

  // ── Snapshot ─────────────────────────────────────────────────────────────
  const snapshotModel = useCallback(async (): Promise<string> => {
    const mv: any=mvRef.current; const fc=fcRef.current;
    try{await syncTexture();}catch{}
    await new Promise(r=>requestAnimationFrame(()=>r(null)));
    if (mv&&typeof mv.toDataURL==="function"){try{return mv.toDataURL("image/png",1.0);}catch{}}
    if (fc) return fc.toDataURL({format:"png",quality:0.95,multiplier:1});
    throw new Error("Nothing to snapshot");
  }, [syncTexture]);

  // ── Save / Cart mutations ────────────────────────────────────────────────
  const buildPayload=async()=>{
    const fc=fcRef.current; if(!fc) throw new Error("Canvas not ready");
    const snap=await snapshotModel();
    return {
      productId:id, name:designName||`${product?.name} Custom`,
      color:primaryColor, size,
      partsEnabled:{qty,zoneColors,primaryColor,kdDesignId:activeKashaDesign?.id||"",activePrintId,sleeveLength},
      canvasData:JSON.stringify({canvasJSON:JSON.stringify((fc as any).toJSON(["data"])),textureUrl:lastTextureUrlRef.current,primaryColor,kdDesignId:activeKashaDesign?.id||"",zoneColors,activePrintId,allOverPrintId,sleeveLength}),
      previewImageUrl:snap,
    };
  };
  const saveMut=useMutation({
    mutationFn:async()=>apiFetch("/api/customizations",{method:"POST",body:JSON.stringify(await buildPayload())}),
    onSuccess:()=>{toast({title:"Design Saved ✓"});queryClient.invalidateQueries({queryKey:["customization",id]});},
    onError:(e:any)=>toast({title:"Error",description:e.message,variant:"destructive"}),
  });
  const cartMut=useMutation({
    mutationFn:async()=>{const cust=await apiFetch("/api/customizations",{method:"POST",body:JSON.stringify(await buildPayload())});return apiFetch("/api/cart/items",{method:"POST",body:JSON.stringify({productId:id,customizationId:cust.id,quantity:qty,size})});},
    onSuccess:()=>{toast({title:"Added to Cart"});setLocation("/cart");},
    onError:(e:any)=>toast({title:"Error",description:e.message,variant:"destructive"}),
  });

  // ── Style helpers ────────────────────────────────────────────────────────
  // Section label — small-caps with gold bottom border
  const sb: React.CSSProperties = {
    fontSize:"10px", letterSpacing:".12em", textTransform:"uppercase",
    color:V.mu, fontWeight:600, marginBottom:"8px",
    paddingBottom:"6px", borderBottom:`1px solid rgba(26,26,24,0.07)`,
    fontFamily:"'Jost', sans-serif",
  };
  // Stronger section heading for typeMode blocks
  const sbT: React.CSSProperties = {
    fontSize:"13px", letterSpacing:".07em", textTransform:"uppercase",
    color: V.tx, fontWeight:700, marginBottom:"10px",
    paddingBottom:"7px", borderBottom:`1.5px solid rgba(201,168,76,0.22)`,
    fontFamily:"'Jost', sans-serif",
  };

  const swatch=(hex:string, selected:boolean, onClick:()=>void, title?:string)=>(
    <button key={hex} onClick={onClick} title={title||hex} style={{
      width:30,height:30,borderRadius:"50%",cursor:"pointer",padding:0,flexShrink:0,
      background:hex==="transparent"?"none":hex,
      border:selected?`2.5px solid ${V.ac}`:`1.5px solid rgba(26,26,24,0.12)`,
      outline:selected?`3px solid rgba(201,168,76,0.25)`:undefined,
      outlineOffset:selected?"1px":undefined,
      transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",
      boxShadow:selected?`0 0 0 1px ${V.ac}`:`inset 0 0 0 1px rgba(0,0,0,.08)`,
    }}/>
  );

  // ── Step indicator ───────────────────────────────────────────────────────
  const STEP_1_LABEL = isTypeMode
    ? (garmentType === "solid" ? "Colour" : garmentType === "pattern" ? "Pattern" : "Print")
    : "Style";
  const STEP_2_LABEL = isTypeMode
    ? (garmentType === "solid" ? "Prints" : garmentType === "pattern" ? "Colours" : "Patterns")
    : "Parts";
  const ALL_STEPS = [
    { n:1, label: STEP_1_LABEL },
    { n:2, label: STEP_2_LABEL },
    { n:3, label:"Logo"   },
    { n:4, label:"Size"   },
  ];
  const VISIBLE_STEPS = isQuickMode
    ? ALL_STEPS.filter(s => s.n >= 3)
    : ALL_STEPS;

  const stepIndicator=(
    <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:24,flexShrink:0,paddingBottom:20,borderBottom:`1px solid rgba(26,26,24,0.07)`}}>
      {isQuickMode && (
        <div style={{
          display:"flex",alignItems:"center",gap:6,marginRight:16,
          padding:"4px 10px",borderRadius:99,
          background:"rgba(201,168,76,0.12)",
          border:`1px solid rgba(201,168,76,0.3)`,
        }}>
          <span style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".1em",textTransform:"uppercase",color:V.ac,fontWeight:700}}>✦ Quick</span>
        </div>
      )}
      {VISIBLE_STEPS.map((s,i)=>{
        const active=step===s.n; const done=step>s.n;
        const canNav = isQuickMode ? s.n >= 3 : true;
        return(<React.Fragment key={s.n}>
          {i>0&&<div style={{flex:1,height:"1px",background:done?V.ac:`rgba(26,26,24,0.12)`,minWidth:8,transition:"background 0.3s"}}/>}
          <div onClick={()=>canNav&&setStep(s.n)} style={{
            display:"flex",alignItems:"center",gap:6,fontSize:11,
            color:active?V.tx:done?V.ac:V.mul,
            cursor:canNav?"pointer":"default",padding:"5px 8px",borderRadius:99,
            background:active?V.aclt:"transparent",
            transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)",
            letterSpacing:".03em",
          }}>
            <div style={{
              width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:9,fontWeight:700,
              background:active?V.ac:done?V.ac:V.bd,
              color:active?"#fff":done?"#fff":V.mu,
              border:`1.5px solid ${active||done?V.ac:V.bd}`,
              flexShrink:0,transition:"all 0.3s",
            }}>{done?"✓":s.n}</div>
            <span style={{fontWeight:active?600:400,fontSize:10,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>{s.label}</span>
          </div>
        </React.Fragment>);
      })}
    </div>
  );


  // ── History helpers ───────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const json = JSON.stringify((fc as any).toJSON(["data"]));
    historyStack.current = historyStack.current.slice(0, historyIdx.current + 1);
    historyStack.current.push(json);
    historyIdx.current = historyStack.current.length - 1;
    setCanUndo(historyIdx.current > 0);
    setCanRedo(false);
  }, []);

  const undoCanvas = useCallback(async () => {
    const fc = fcRef.current; if (!fc || historyIdx.current <= 0) return;
    historyIdx.current--;
    const json = historyStack.current[historyIdx.current];
    if (!json) return;
    await (fc as any).loadFromJSON(JSON.parse(json));
    fc.renderAll(); syncTexture();
    setCanUndo(historyIdx.current > 0);
    setCanRedo(true);
  }, [syncTexture]);

  const redoCanvas = useCallback(async () => {
    const fc = fcRef.current;
    if (!fc || historyIdx.current >= historyStack.current.length - 1) return;
    historyIdx.current++;
    const json = historyStack.current[historyIdx.current];
    if (!json) return;
    await (fc as any).loadFromJSON(JSON.parse(json));
    fc.renderAll(); syncTexture();
    setCanUndo(true);
    setCanRedo(historyIdx.current < historyStack.current.length - 1);
  }, [syncTexture]);

  // Camera view effect
  useEffect(() => {
    const mv: any = mvRef.current; if (!mv) return;
    const orbits: Record<string, string> = {
      front: "0deg 75deg 2.5m",
      back:  "180deg 75deg 2.5m",
      right: "90deg 75deg 2.5m",
      left:  "-90deg 75deg 2.5m",
    };
    mv.cameraOrbit = orbits[cameraView] || "0deg 75deg 2.5m";
  }, [cameraView, modelLoaded]);

  // ── Tool definitions ──────────────────────────────────────────────────────
  const TOOLS = [
    { id: "products",  icon: "👕", label: "Products"  },
    { id: "colors",    icon: "🎨", label: "Colors"    },
    { id: "prints",    icon: "◈",  label: "Prints"    },
    { id: "patterns",  icon: "✦",  label: "Patterns"  },
    { id: "text",      icon: "Aa", label: "Text"      },
    { id: "image",     icon: "🖼",  label: "Logo"      },
    { id: "order",     icon: "🛒", label: "Order"     },
  ] as const;

  const CAMERA_VIEWS = [
    { id: "front", label: "Front" },
    { id: "back",  label: "Back"  },
    { id: "right", label: "Right" },
    { id: "left",  label: "Left"  },
  ] as const;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !isTypeMode) return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:V.bg,gap:16}}>
      <div style={{
        width:40,height:40,borderRadius:"50%",
        border:`2px solid ${V.bd}`,
        borderTopColor:V.ac,
        animation:"spin .9s linear infinite",
      }}/>
      <p style={{fontFamily:"'Jost',sans-serif",fontSize:11,color:V.mu,letterSpacing:".1em",textTransform:"uppercase"}}>Loading Studio…</p>
    </div>
  );
  if (!product && !isTypeMode) return null;


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:"flex",flexDirection:"column",height:"100vh",
      background:V.bg,color:V.tx,
      fontFamily:"'Jost', sans-serif",overflow:"hidden",
    }}>

      {/* ── TOP ACTION BAR ─────────────────────────────────────────────── */}
      <header style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 20px",height:56,flexShrink:0,zIndex:50,
        background:"rgba(250,250,247,0.97)",
        backdropFilter:"blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        borderBottom:`1px solid rgba(201,168,76,0.15)`,
        boxShadow:"0 2px 20px rgba(26,26,24,0.05)",
      }}>
        {/* Left: back + logo */}
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:180}}>
          <Link href={isTypeMode ? "/" : `/products/${id}`} style={{
            color:V.mu,fontSize:11,textDecoration:"none",
            display:"flex",alignItems:"center",gap:5,
            padding:"5px 12px",borderRadius:40,
            border:`1px solid rgba(201,168,76,0.25)`,
            transition:"all 0.25s",fontWeight:500,letterSpacing:".05em",
            fontFamily:"'Jost',sans-serif",
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.25)";e.currentTarget.style.background="transparent";}}>
            ← Back
          </Link>
          <div style={{width:1,height:18,background:`rgba(26,26,24,0.1)`}}/>
          <span style={{fontFamily:"'Cormorant Garamond', serif",fontSize:18,fontWeight:600,letterSpacing:".1em",color:V.tx}}>
            KA.<span style={{color:V.ac}}>SHA</span>
          </span>
        </div>

        {/* Center: undo / redo / save / studio name */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={undoCanvas} disabled={!canUndo} title="Undo" style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,
            padding:"5px 10px",borderRadius:10,border:"none",
            background:"transparent",cursor:canUndo?"pointer":"default",
            opacity:canUndo?1:0.35,transition:"all 0.2s",color:V.mu,
          }}
          onMouseEnter={e=>{if(canUndo)e.currentTarget.style.background=V.sf2;}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5.333 7.333 9.6 4.4 16 5a9 9 0 0 1 5.4 14.3"/></svg>
            <span style={{fontSize:9,letterSpacing:".04em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif"}}>Undo</span>
          </button>
          <button onClick={redoCanvas} disabled={!canRedo} title="Redo" style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,
            padding:"5px 10px",borderRadius:10,border:"none",
            background:"transparent",cursor:canRedo?"pointer":"default",
            opacity:canRedo?1:0.35,transition:"all 0.2s",color:V.mu,
          }}
          onMouseEnter={e=>{if(canRedo)e.currentTarget.style.background=V.sf2;}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13c-2.333-5.667-6.6-8.6-13-8a9 9 0 0 0-5.4 14.3"/></svg>
            <span style={{fontSize:9,letterSpacing:".04em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif"}}>Redo</span>
          </button>
          <div style={{width:1,height:28,background:`rgba(26,26,24,0.1)`,margin:"0 4px"}}/>
          <span style={{
            fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:".14em",
            textTransform:"uppercase",color:V.mu,fontWeight:500,
          }}>
            {isTypeMode
              ? (garmentType === "solid" ? "Solid Studio"
                 : garmentType === "pattern" ? "Pattern Studio"
                 : "Print Studio")
              : isQuickMode ? "Quick Personalisation" : "Bespoke Design Studio"}
          </span>
        </div>

        {/* Right: design name + save + order */}
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:180,justifyContent:"flex-end"}}>
          <input
            value={designName}
            onChange={e=>setDesignName(e.target.value)}
            placeholder="Name your design…"
            style={{
              padding:"6px 12px",
              background:V.sf2,border:`1.5px solid ${V.bd}`,
              borderRadius:40,color:V.tx,fontSize:11,
              outline:"none",width:140,
              fontFamily:"'Jost',sans-serif",letterSpacing:".02em",
              transition:"border-color 0.2s",
            }}
            onFocus={e=>e.target.style.borderColor=V.ac}
            onBlur={e=>e.target.style.borderColor=V.bd}
          />
          {!isTypeMode && (
            <Show when="signed-in">
              <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
                style={{
                  padding:"7px 16px",borderRadius:40,
                  border:`1px solid rgba(201,168,76,0.35)`,
                  background:"transparent",cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
                  letterSpacing:".06em",textTransform:"uppercase",
                  color:V.tx,transition:"all 0.25s",
                  opacity:saveMut.isPending?.6:1,
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.35)";e.currentTarget.style.background="transparent";}}>
                {saveMut.isPending?"Saving…":"Save"}
              </button>
            </Show>
          )}
          {isTypeMode ? (
            <Link href="/products" style={{
              padding:"8px 20px",borderRadius:40,
              border:`1px solid ${V.ac}`,background:"transparent",
              fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
              letterSpacing:".06em",textTransform:"uppercase",
              color:V.tx,textDecoration:"none",
              transition:"all 0.25s",display:"flex",alignItems:"center",gap:6,
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
              Browse →
            </Link>
          ) : (
            <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending||saveMut.isPending}
              style={{
                padding:"8px 20px",borderRadius:40,
                border:"none",background:V.tx,
                cursor:"pointer",
                fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
                letterSpacing:".06em",textTransform:"uppercase",
                color:"#fff",transition:"all 0.25s",
                display:"flex",alignItems:"center",gap:6,
                opacity:cartMut.isPending?.6:1,
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
              onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
              {cartMut.isPending?"Adding…":"✦ Order Now"}
            </button>
          )}
        </div>
      </header>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── ICON SIDEBAR ────────────────────────────────────────────────── */}
        <div style={{
          width:70,flexShrink:0,
          display:"flex",flexDirection:"column",alignItems:"center",
          paddingTop:12,paddingBottom:12,gap:2,
          borderRight:`1px solid rgba(26,26,24,0.07)`,
          background:V.bg,
          overflowY:"auto",
          scrollbarWidth:"none",
        }}>
          {TOOLS.filter(t => !isQuickMode || (t.id !== "prints" && t.id !== "patterns")).map(t => {
            const isA = activeTool === t.id;
            return (
              <button key={t.id}
                onClick={() => setActiveTool(isA ? null : (t.id as any))}
                style={{
                  width:54,padding:"10px 0 8px",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                  borderRadius:12,border:"none",cursor:"pointer",
                  background:isA ? V.aclt : "transparent",
                  boxShadow:isA ? `0 2px 14px rgba(201,168,76,0.18), inset 0 0 0 1.5px ${V.ac}` : "none",
                  transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  color:isA?V.tx:V.mu,
                }}
                onMouseEnter={e=>{if(!isA){e.currentTarget.style.background=V.sf2;e.currentTarget.style.color=V.tx;}}}
                onMouseLeave={e=>{if(!isA){e.currentTarget.style.background="transparent";e.currentTarget.style.color=V.mu;}}}>
                <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
                <span style={{
                  fontSize:9,letterSpacing:".06em",textTransform:"uppercase",
                  fontFamily:"'Jost',sans-serif",fontWeight:isA?700:500,
                  lineHeight:1,
                }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TOOL PANEL ──────────────────────────────────────────────────── */}
        {activeTool && (
          <div style={{
            width:300,flexShrink:0,
            borderRight:`1px solid rgba(26,26,24,0.07)`,
            overflowY:"auto",
            background:V.sf,
            display:"flex",flexDirection:"column",
            scrollbarWidth:"thin",
            scrollbarColor:`${V.cream3} transparent`,
            boxShadow:"4px 0 24px rgba(26,26,24,0.06)",
          }}>
            {/* Panel header */}
            <div style={{
              padding:"18px 20px 14px",
              borderBottom:`1px solid rgba(26,26,24,0.07)`,
              flexShrink:0,
              background:V.sf,
              position:"sticky",top:0,zIndex:5,
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",
                    fontSize:18,fontWeight:600,color:V.tx,letterSpacing:".02em",
                  }}>
                    {TOOLS.find(t=>t.id===activeTool)?.label}
                  </div>
                  <div style={{fontSize:9,color:V.mu,letterSpacing:".1em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",marginTop:2}}>
                    {activeTool==="products"  && "Select your garment"}
                    {activeTool==="colors"    && "Base & zone colours"}
                    {activeTool==="prints"    && "Apply prints to garment"}
                    {activeTool==="patterns"  && "KA.SHA signature designs"}
                    {activeTool==="text"      && "Add custom text"}
                    {activeTool==="image"     && "Upload & place logo"}
                    {activeTool==="order"     && "Size, quantity & checkout"}
                  </div>
                </div>
                <button onClick={()=>setActiveTool(null)} style={{
                  width:28,height:28,borderRadius:8,border:`1px solid ${V.bd}`,
                  background:"transparent",cursor:"pointer",color:V.mu,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,transition:"all 0.2s",flexShrink:0,
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                  ×
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div style={{padding:"20px",flex:1,display:"flex",flexDirection:"column",gap:20}}>

              {/* ── PRODUCTS panel ─────────────────────────────────────── */}
              {activeTool==="products"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {product && (
                    <div style={{
                      background:V.sf2,border:`1px solid ${V.bd}`,
                      borderRadius:12,overflow:"hidden",
                    }}>
                      {product.thumbnailUrl && (
                        <img src={product.thumbnailUrl} alt={product.name}
                          style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>
                      )}
                      <div style={{padding:"14px"}}>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:V.tx,letterSpacing:".02em",marginBottom:4}}>
                          {product.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")}
                        </div>
                        <div style={{fontSize:15,color:V.ac,fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:".04em"}}>
                          {formatPrice(product.priceInPaise)}
                        </div>
                        {product.description && (
                          <div style={{fontSize:11,color:V.mu,lineHeight:1.65,marginTop:8,fontFamily:"'Jost',sans-serif"}}>
                            {product.description.slice(0,120)}{product.description.length>120?"…":""}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {isTypeMode && (
                    <div>
                      <div style={{...sb,marginBottom:10}}>Garment type</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {([
                          {id:"solid",   label:"Solid Colour",    desc:"Clean base colour + custom parts"},
                          {id:"pattern", label:"KA.SHA Pattern",  desc:"Signature bespoke designs"},
                          {id:"printed", label:"All-Over Print",  desc:"Full garment print library"},
                        ] as const).map(g=>(
                          <div key={g.id} style={{
                            padding:"12px 14px",borderRadius:10,
                            border:`1.5px solid ${garmentType===g.id?V.ac:V.bd}`,
                            background:garmentType===g.id?V.aclt:"transparent",
                            cursor:"default",transition:"all 0.2s",
                          }}>
                            <div style={{fontSize:12,fontWeight:600,color:garmentType===g.id?V.tx:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{g.label}</div>
                            <div style={{fontSize:10,color:V.mul,marginTop:2,fontFamily:"'Jost',sans-serif"}}>{g.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{borderTop:`1px solid ${V.bd}`,paddingTop:14}}>
                    <div style={{...sb,marginBottom:8}}>Sleeve length</div>
                    <div style={{display:"flex",gap:6}}>
                      {(["half","full"] as const).map(sl=>(
                        <button key={sl} onClick={()=>setSleeveLength(sl)} style={{
                          flex:1,padding:"9px 0",borderRadius:99,fontSize:11,fontWeight:600,
                          cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",
                          textTransform:"uppercase" as const,
                          border:sleeveLength===sl?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,
                          background:sleeveLength===sl?V.aclt:"transparent",
                          color:sleeveLength===sl?V.tx:V.mu,transition:"all .2s",
                        }}>
                          {sl==="half"?"Half":"Full"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── COLORS panel ──────────────────────────────────────── */}
              {activeTool==="colors"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {/* Zone thumbnail selector */}
                  {(()=>{
                    const zones:[string,string,string,string][]=[
                      ["all","All Parts",
                        `<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="__COL__" stroke="#1a1a18" stroke-width="1.5"/></svg>`,
                        primaryColor],
                      ["front","Front",
                        `<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/><rect x="19" y="30" width="22" height="32" rx="1" fill="__COL__" opacity="0.9"/></svg>`,
                        zoneColors["front"]||primaryColor],
                      ["back","Back",
                        `<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/><rect x="19" y="30" width="22" height="32" rx="1" fill="__COL__" opacity="0.9"/><text x="30" y="50" text-anchor="middle" font-size="7" fill="#fff" font-family="sans-serif">BACK</text></svg>`,
                        zoneColors["back"]||primaryColor],
                      ["leftSleeve","L. Sleeve",
                        `<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/><path d="M10 12L4 32L14 34L18 14Z" fill="__COL__" opacity="0.9"/></svg>`,
                        zoneColors["leftSleeve"]||primaryColor],
                      ["rightSleeve","R. Sleeve",
                        `<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/><path d="M50 12L56 32L46 34L42 14Z" fill="__COL__" opacity="0.9"/></svg>`,
                        zoneColors["rightSleeve"]||primaryColor],
                    ];
                    return(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                        {zones.map(([id,label,svgTpl,col])=>{
                          const isA=colorTarget===id;
                          const svg=svgTpl.replace(/__COL__/g,col);
                          return(
                            <div key={id} onClick={()=>setColorTarget(id as any)} style={{
                              display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",
                              padding:"8px 4px",borderRadius:10,transition:"all .2s",
                              border:`1.5px solid ${isA?V.ac:V.bd}`,
                              background:isA?V.aclt:"transparent",
                            }}>
                              <div style={{width:40,height:46}} dangerouslySetInnerHTML={{__html:svg}}/>
                              <span style={{fontSize:8,textTransform:"uppercase",letterSpacing:".06em",fontFamily:"'Jost',sans-serif",color:isA?V.tx:V.mu,fontWeight:isA?700:400,textAlign:"center",lineHeight:1.2}}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {/* Colour picker for selected target */}
                  <div style={{background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:"#4a4a42",marginBottom:10,letterSpacing:".07em",textTransform:"uppercase",fontWeight:600,fontFamily:"'Jost',sans-serif"}}>
                      {colorTarget==="all" ? "Colour — All Parts" : `Colour — ${["front","back","leftSleeve","rightSleeve"].includes(colorTarget)?{front:"Front",back:"Back",leftSleeve:"Left Sleeve",rightSleeve:"Right Sleeve"}[colorTarget]:"Part"}`}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                      {colorTarget==="all"
                        ? MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))
                        : MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]===hex,()=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,hex)))}
                      <label title="Custom" style={{width:30,height:30,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:V.tx,flexShrink:0}}>
                        +{colorTarget==="all"
                          ?<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                          :<input type="color" value={zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]||primaryColor} onChange={e=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>}
                      </label>
                    </div>
                    {colorTarget!=="all"&&zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]&&(
                      <button onClick={()=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,"")} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Reset to base</button>
                    )}
                    {colorTarget==="all"&&(
                      <button onClick={()=>{PART_ZONES.forEach(z=>applyZoneColor(z.id,primaryColor));}} style={{fontSize:10,color:V.mu,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",marginTop:4}}>Apply base colour to all zones</button>
                    )}
                  </div>
                </div>
              )}

              {/* ── PRINTS panel ──────────────────────────────────────── */}
              {activeTool==="prints"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {productType==="print"&&(
                    <div style={{background:"rgba(201,168,76,0.07)",border:`1px solid rgba(201,168,76,0.18)`,borderRadius:10,padding:"10px 12px",fontSize:11,color:V.mu,fontStyle:"italic",fontFamily:"'Jost',sans-serif",lineHeight:1.6}}>
                      Pre-printed garment — select a print to change the design.
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                    {PATTERNS.filter(p=>p.id!=="kasha-gt015").map(p=>{
                      const sel=activePrintId===p.id;
                      const allApplied=allOverPrintId===p.id;
                      const inZone=Object.values(zonePrintIds).includes(p.id);
                      return(
                        <button key={p.id} onClick={()=>{setActivePrintId(p.id);}} title={p.label}
                          style={{
                            position:"relative",padding:0,aspectRatio:"1/1",
                            borderRadius:8,overflow:"hidden",cursor:"pointer",
                            background:`url(${patternUrl(p.file)}) center/cover`,
                            border:sel?`2px solid ${V.ac}`:`1.5px solid transparent`,
                            outline:sel?`2px solid rgba(201,168,76,0.25)`:undefined,
                            outlineOffset:sel?"1px":undefined,
                            transition:"all 0.2s",
                            boxShadow:sel?`0 0 0 1px ${V.ac},0 2px 8px rgba(201,168,76,0.2)`:"none",
                          }}>
                          {allApplied&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3}}>ALL</span>}
                          {!allApplied&&inZone&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3}}>ZONE</span>}
                        </button>
                      );
                    })}
                  </div>
                  {activePrintId&&(()=>{
                    const p=PATTERNS.find(x=>x.id===activePrintId); if(!p) return null;
                    return(
                      <div style={{background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:36,height:36,borderRadius:7,background:`url(${patternUrl(p.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                          <div style={{fontSize:13,fontWeight:600,color:V.tx,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".02em"}}>{p.label}</div>
                        </div>
                        {productType!=="print"&&(
                          <div style={{display:"flex",gap:4}}>
                            {(["fullBody","parts"] as const).map(m=>(
                              <button key={m} onClick={()=>setPrintMode(m)} style={{
                                flex:1,padding:"6px 0",fontSize:10,fontWeight:600,cursor:"pointer",
                                borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                                border:printMode===m?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,
                                background:printMode===m?V.aclt:"transparent",
                                color:printMode===m?V.tx:V.mu,transition:"all .2s",
                              }}>{m==="fullBody"?"Full Body":"By Part"}</button>
                            ))}
                          </div>
                        )}
                        {(productType==="print"||printMode==="fullBody")&&(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            <button onClick={()=>{applyAllOverPrint(p);saveHistory();}} style={{
                              padding:"9px 0",borderRadius:99,border:"none",
                              background:allOverPrintId===p.id?V.tx:V.ac,
                              color:allOverPrintId===p.id?"#fff":V.tx,
                              fontSize:11,fontWeight:600,cursor:"pointer",
                              fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s",
                            }}>
                              {allOverPrintId===p.id?(productType==="print"?"✓ Selected":"✓ Applied"):(productType==="print"?"Select Print":"Apply All-Over")}
                            </button>
                            {allOverPrintId&&productType!=="print"&&(
                              <button onClick={()=>{clearAllOverPrint();saveHistory();}} style={{
                                padding:"7px 0",borderRadius:99,
                                border:`1px solid rgba(196,92,92,.35)`,background:"transparent",
                                color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",
                                fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                              }}>✕ Remove print</button>
                            )}
                          </div>
                        )}
                        {productType!=="print"&&printMode==="parts"&&(()=>{
                          const zones: {id:Exclude<typeof activePartZone,"collar">;label:string}[]=[];
                          const pzones: {id:Exclude<PatternZone,"all">;label:string}[]=[
                            {id:"front",label:"Front"},{id:"back",label:"Back"},
                            {id:"collar",label:"Collar"},{id:"leftSleeve",label:"L.Sleeve"},{id:"rightSleeve",label:"R.Sleeve"},
                          ];
                          return(
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              <div style={{fontSize:10,color:V.mu,marginBottom:2,fontStyle:"italic",fontFamily:"'Jost',sans-serif"}}>Click part to apply / remove:</div>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                {pzones.map(z=>{
                                  const applied=zonePrintIds[z.id]===p.id;
                                  const otherPrint=zonePrintIds[z.id]&&zonePrintIds[z.id]!==p.id;
                                  return(
                                    <button key={z.id}
                                      onClick={()=>{applied?clearZonePrint(z.id):applyZonePrint(z.id,p);saveHistory();}}
                                      style={{
                                        padding:"5px 10px",fontSize:10,fontWeight:applied?600:400,cursor:"pointer",
                                        borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",
                                        border:applied?`1.5px solid ${V.ac}`:otherPrint?`1px solid ${V.ac}`:`1px solid ${V.bd}`,
                                        background:applied?V.aclt:otherPrint?"rgba(201,168,76,0.07)":"transparent",
                                        color:applied?V.tx:otherPrint?V.ac:V.mu,transition:"all .2s",
                                      }}>
                                      {applied?"✓ ":""}{z.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {Object.values(zonePrintIds).some(Boolean)&&(
                                <button onClick={()=>{clearAllZonePrints();saveHistory();}} style={{
                                  padding:"7px 0",borderRadius:99,
                                  border:`1px solid rgba(196,92,92,.35)`,background:"transparent",
                                  color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",
                                  fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                                }}>✕ Clear all zone prints</button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── PATTERNS panel ────────────────────────────────────── */}
              {activeTool==="patterns"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{background:`rgba(201,168,76,0.07)`,border:`1px solid rgba(201,168,76,0.2)`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:600,color:V.ac,letterSpacing:".02em",marginBottom:2}}>KA.SHA Bespoke Designs</div>
                    <div style={{fontSize:11,color:V.mu,lineHeight:1.6,fontFamily:"'Jost',sans-serif"}}>Premium zone-mapped designs crafted for the course</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                    {KASHA_DESIGNS.map(d=>{
                      const isA=activeKashaDesign?.id===d.id;
                      const zones=Object.keys(d.zones).length;
                      return(
                        <button key={d.id} onClick={()=>handleSelectKashaDesign(d)} title={d.label}
                          style={{
                            padding:"10px 8px",borderRadius:10,
                            border:isA?`2px solid ${V.ac}`:`1.5px solid ${V.bd}`,
                            background:isA?V.aclt:V.sf2,
                            cursor:"pointer",display:"flex",flexDirection:"column",
                            alignItems:"center",gap:6,fontFamily:"'Jost',sans-serif",
                            transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)",
                            position:"relative",
                            boxShadow:isA?`0 4px 20px rgba(201,168,76,0.2)`:"0 1px 4px rgba(26,26,24,0.05)",
                          }}
                          onMouseEnter={e=>{if(!isA){e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";e.currentTarget.style.transform="translateY(-2px)";}}}
                          onMouseLeave={e=>{if(!isA){e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.transform="none";}}}>
                          {isA&&<div style={{position:"absolute",top:7,right:7,width:16,height:16,borderRadius:"50%",background:V.ac,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:V.tx,fontWeight:800}}>✓</div>}
                          <div style={{width:"100%",height:48,borderRadius:6,overflow:"hidden",background:V.sf,border:`1px solid ${V.bd}`,flexShrink:0}}>
                            {d.zones.front&&<img src={d.zones.front} alt={d.label} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
                          </div>
                          <span style={{fontSize:10,color:isA?V.tx:V.mu,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>{d.id}</span>
                          <span style={{fontSize:11,color:V.mul,textAlign:"center",lineHeight:1.4,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{zones} zone{zones!==1?"s":""}</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeKashaDesign&&(
                    <div style={{background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{activeKashaDesign.id}</div>
                        <div style={{fontSize:12,color:V.mu,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{activeKashaDesign.label}</div>
                      </div>
                      <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);saveHistory();}}
                        style={{fontSize:9,color:V.mu,background:"transparent",border:`1px solid ${V.bd}`,borderRadius:99,padding:"4px 10px",cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",flexShrink:0,transition:"all 0.2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TEXT panel ────────────────────────────────────────── */}
              {activeTool==="text"&&(
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {/* Title */}
                  <div style={{textAlign:"center",letterSpacing:".18em",fontSize:11,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",textTransform:"uppercase",padding:"4px 0 18px"}}>Add Text</div>

                  {/* TEXT input */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Text</div>
                    <input
                      value={textInput}
                      onChange={e=>{setTextInput(e.target.value);if(textObjRef.current){textObjRef.current.set({text:e.target.value});fcRef.current?.renderAll();syncTexture();}}}
                      placeholder="Your text here"
                      style={{width:"100%",padding:"10px 14px",boxSizing:"border-box",background:"#fff",border:`1.5px solid ${V.bd}`,borderRadius:8,color:V.tx,fontSize:13,fontFamily:"'Jost',sans-serif",outline:"none",transition:"border-color 0.2s"}}
                      onFocus={e=>e.target.style.borderColor=V.ac}
                      onBlur={e=>e.target.style.borderColor=V.bd}
                    />
                  </div>

                  {/* FONT SIZE + COLOR row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Font Size</div>
                      <div style={{position:"relative"}}>
                        <select value={textFontSize} onChange={e=>{const v=+e.target.value;setTextFontSize(v);if(textObjRef.current){textObjRef.current.set({fontSize:v});fcRef.current?.renderAll();syncTexture();}}} style={{width:"100%",padding:"9px 28px 9px 12px",border:`1.5px solid ${V.bd}`,borderRadius:8,background:"#fff",color:V.tx,fontSize:13,fontFamily:"'Jost',sans-serif",appearance:"none",WebkitAppearance:"none",cursor:"pointer",outline:"none"}}>
                          {[16,20,24,28,32,36,40,48,56,64,72,80,96].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:10,color:V.mu}}>▾</span>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Color</div>
                      <label style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:38,borderRadius:8,border:`1.5px solid ${V.bd}`,background:"#fff",cursor:"pointer",overflow:"hidden",position:"relative"}}>
                        <div style={{width:26,height:26,borderRadius:4,background:textColor,border:"1.5px solid rgba(0,0,0,.12)"}}/>
                        <input type="color" value={textColor} onChange={e=>{const v=e.target.value;setTextColor(v);if(textObjRef.current){textObjRef.current.set({fill:v});fcRef.current?.renderAll();syncTexture();}}} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/>
                      </label>
                    </div>
                  </div>

                  {/* FONT STYLE: B U I */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Font Style</div>
                    <div style={{display:"flex",gap:8}}>
                      {([
                        {label:"B",title:"Bold",active:textBold,style:{fontWeight:700},action:()=>{const n=!textBold;setTextBold(n);if(textObjRef.current){textObjRef.current.set({fontWeight:n?"700":"400"});fcRef.current?.renderAll();syncTexture();}}},
                        {label:"U",title:"Underline",active:textUnderline,style:{textDecoration:"underline"},action:()=>{const n=!textUnderline;setTextUnderline(n);if(textObjRef.current){textObjRef.current.set({underline:n});fcRef.current?.renderAll();syncTexture();}}},
                        {label:"I",title:"Italic",active:textItalic,style:{fontStyle:"italic"},action:()=>{const n=!textItalic;setTextItalic(n);if(textObjRef.current){textObjRef.current.set({fontStyle:n?"italic":"normal"});fcRef.current?.renderAll();syncTexture();}}},
                      ] as {label:string;title:string;active:boolean;style:React.CSSProperties;action:()=>void}[]).map(btn=>(
                        <button key={btn.label} title={btn.title} onClick={btn.action} style={{
                          width:44,height:38,borderRadius:8,fontSize:14,cursor:"pointer",fontFamily:"'Jost',sans-serif",
                          border:`1.5px solid ${btn.active?V.ac:V.bd}`,background:btn.active?V.aclt:"#fff",
                          color:btn.active?V.tx:V.mu,transition:"all 0.18s",...btn.style,
                        }}>{btn.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* FONT dropdown */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Font</div>
                    <div style={{position:"relative"}}>
                      <select value={textFont} onChange={e=>{const v=e.target.value;setTextFont(v);if(textObjRef.current){textObjRef.current.set({fontFamily:v});fcRef.current?.renderAll();syncTexture();}}} style={{width:"100%",padding:"9px 28px 9px 12px",border:`1.5px solid ${V.bd}`,borderRadius:8,background:"#fff",color:V.tx,fontSize:13,fontFamily:textFont+",sans-serif",appearance:"none",WebkitAppearance:"none",cursor:"pointer",outline:"none"}}>
                        {["Tinos","DM Sans","Jost","Georgia","Playfair Display","Cormorant Garamond","Montserrat","Raleway","Oswald","Dancing Script"].map(f=><option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
                      </select>
                      <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:10,color:V.mu}}>▾</span>
                    </div>
                  </div>

                  {/* TEXT ALIGNMENT */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Text Alignment</div>
                    <div style={{display:"flex",gap:6}}>
                      {([
                        {id:"left",   svg:"M3 6h14M3 10h10M3 14h12M3 18h8"},
                        {id:"center", svg:"M3 6h14M6 10h8M5 14h10M7 18h6"},
                        {id:"right",  svg:"M7 6h10M11 10h6M9 14h8M13 18h4"},
                        {id:"justify",svg:"M3 6h14M3 10h14M3 14h14M3 18h14"},
                      ] as {id:string;svg:string}[]).map(a=>{
                        const isA=textAlign===a.id;
                        return(
                          <button key={a.id} title={a.id} onClick={()=>{setTextAlign(a.id as any);if(textObjRef.current){textObjRef.current.set({textAlign:a.id});fcRef.current?.renderAll();syncTexture();}}} style={{
                            flex:1,height:38,borderRadius:8,border:`1.5px solid ${isA?V.ac:V.bd}`,background:isA?V.aclt:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",
                          }}>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={isA?V.ac:V.mu} strokeWidth="1.6" strokeLinecap="round">
                              {a.svg.split("M").filter(Boolean).map((d,i)=><path key={i} d={"M"+d}/>)}
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TEXT EFFECT */}
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Text Effect <span style={{color:V.mu,fontWeight:400,letterSpacing:".06em",fontSize:8,textTransform:"none"}}>( Straight )</span></div>
                    <div style={{display:"flex",gap:6}}>
                      {["Straight","Arch","Wave"].map(fx=>(
                        <button key={fx} style={{
                          flex:1,padding:"8px 0",borderRadius:8,fontSize:9,letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Jost',sans-serif",
                          border:`1.5px solid ${fx==="Straight"?V.ac:V.bd}`,background:fx==="Straight"?V.aclt:"#fff",
                          color:fx==="Straight"?V.tx:V.mu,transition:"all 0.18s",
                        }}>{fx}</button>
                      ))}
                    </div>
                  </div>

                  {/* Placement */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:6}}>Placement</div>
                    {PLACEMENT_GROUPS.map(grp=>(
                      <div key={grp.label} style={{marginBottom:8}}>
                        <div style={{fontSize:8,color:V.mul,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",marginBottom:4}}>{grp.label}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                          {grp.items.map(item=>(
                            <button key={item.key} onClick={()=>setTextPosition(item.key)} style={{
                              padding:"5px 10px",borderRadius:99,fontSize:10,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",cursor:"pointer",
                              border:`1.5px solid ${textPosition===item.key?V.ac:V.bd}`,
                              background:textPosition===item.key?V.aclt:"transparent",
                              color:textPosition===item.key?V.tx:V.mu,
                              fontWeight:textPosition===item.key?600:400,transition:"all 0.2s",
                            }}>{item.label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{applyText();saveHistory();}} disabled={!textInput.trim()} style={{
                      flex:2,padding:"10px 0",borderRadius:99,border:"none",
                      background:textInput.trim()?V.tx:"#ccc",color:"#fff",fontSize:11,fontWeight:600,
                      cursor:textInput.trim()?"pointer":"default",fontFamily:"'Jost',sans-serif",letterSpacing:".07em",textTransform:"uppercase",transition:"all 0.2s",
                    }}
                    onMouseEnter={e=>{if(textInput.trim()){e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}}
                    onMouseLeave={e=>{e.currentTarget.style.background=textInput.trim()?V.tx:"#ccc";e.currentTarget.style.color="#fff";}}>
                      {textObjRef.current?"Replace":"Add Text"}
                    </button>
                    {textObjRef.current&&(<button onClick={repositionText} style={{flex:1,padding:"10px 0",borderRadius:99,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>Move</button>)}
                    {textObjRef.current&&(<button onClick={()=>{removeText();saveHistory();}} style={{padding:"10px 12px",borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",transition:"all 0.2s"}}>✕</button>)}
                  </div>
                </div>
              )}

              {/* ── IMAGE / LOGO panel ────────────────────────────────── */}
              {activeTool==="image"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {/* Upload */}
                  <div>
                    <div style={sb}>Upload logo</div>
                    <label style={{
                      display:"flex",flexDirection:"column",alignItems:"center",gap:8,
                      padding:"20px",border:`2px dashed ${V.bd}`,borderRadius:12,
                      cursor:"pointer",transition:"all 0.2s",
                      background:V.sf2,
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.background=V.sf2;}}>
                      <span style={{fontSize:28,lineHeight:1}}>🖼</span>
                      <span style={{fontSize:11,color:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",textAlign:"center"}}>Click to upload<br/><span style={{fontSize:10,opacity:.7}}>PNG, JPG, SVG</span></span>
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{handleLogoUpload(e);saveHistory();}}/>
                    </label>
                    {logoPreview&&(
                      <div style={{marginTop:10}}>
                        <div style={{width:"100%",aspectRatio:"2",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",marginBottom:6}}>
                          <img src={logoPreview} alt="Logo" style={{maxWidth:"80%",maxHeight:"80%",objectFit:"contain"}}/>
                        </div>
                        <button onClick={()=>{removeLogo();saveHistory();}} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Remove logo</button>
                      </div>
                    )}
                  </div>
                  {/* Placement */}
                  <div>
                    <div style={sb}>Placement</div>
                    {PLACEMENT_GROUPS.map(grp=>(
                      <div key={grp.label} style={{marginBottom:10}}>
                        <div style={{fontSize:9,color:V.mu,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",fontWeight:600,marginBottom:5}}>{grp.label}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {grp.items.map(item=>(
                            <button key={item.key} onClick={()=>setLogoPosition(item.key)} style={{
                              padding:"6px 10px",borderRadius:99,fontSize:10,
                              fontFamily:"'Jost',sans-serif",letterSpacing:".05em",cursor:"pointer",
                              border:`1.5px solid ${logoPosition===item.key?V.ac:V.bd}`,
                              background:logoPosition===item.key?V.aclt:"transparent",
                              color:logoPosition===item.key?V.tx:V.mu,
                              fontWeight:logoPosition===item.key?600:400,transition:"all 0.2s",
                            }}>{item.label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {logoPreview&&(
                      <button onClick={repositionLogo} style={{
                        fontSize:10,padding:"6px 14px",marginTop:2,
                        border:`1px solid ${V.bd}`,borderRadius:99,cursor:"pointer",
                        background:"transparent",color:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",transition:"all 0.2s",
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>Apply placement</button>
                    )}
                  </div>
                  {/* Size */}
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={sb}>Logo size</div>
                      <span style={{fontSize:11,color:V.tx,fontWeight:600,fontFamily:"'Jost',sans-serif"}}>{logoSize}%</span>
                    </div>
                    <input type="range" min={10} max={100} step={5} value={logoSize}
                      onChange={e=>{setLogoSize(+e.target.value);if(logoObjRef.current){logoObjRef.current.scaleToWidth(Math.round(+e.target.value*(1024/100)));fcRef.current?.renderAll();syncTexture();}}}
                      style={{width:"100%",height:4,background:V.bd2,borderRadius:2,outline:"none",WebkitAppearance:"none",appearance:"none",accentColor:V.ac}}/>
                  </div>
                </div>
              )}

              {/* ── ORDER panel ───────────────────────────────────────── */}
              {activeTool==="order"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {/* Size */}
                  <div>
                    <div style={sb}>Choose your size</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {SIZES.map(s=>(
                        <button key={s} onClick={()=>setSize(s)} style={{
                          width:46,height:46,
                          border:`1.5px solid ${size===s?V.ac:V.bd}`,
                          borderRadius:10,fontSize:12,cursor:"pointer",
                          background:size===s?V.ac:"transparent",
                          color:size===s?V.tx:V.mu,
                          fontFamily:"'Jost',sans-serif",fontWeight:600,
                          letterSpacing:".04em",transition:"all 0.2s",
                          boxShadow:size===s?`0 2px 10px rgba(201,168,76,0.25)`:"none",
                        }}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {/* Custom measurements */}
                  <details>
                    <summary style={{
                      fontSize:10,color:V.mu,cursor:"pointer",marginBottom:6,
                      fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",fontWeight:500,
                    }}>Custom measurements (optional)</summary>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                      {(["chest","shoulder","length","sleeve"] as const).map(key=>(
                        <div key={key}>
                          <label style={{fontSize:9,color:V.mu,display:"block",marginBottom:4,textTransform:"capitalize",letterSpacing:".08em",fontWeight:500}}>{key}</label>
                          <input value={customMeasurements[key]} onChange={e=>setCustomMeasurements(p=>({...p,[key]:e.target.value}))}
                            placeholder={'e.g. 38"'}
                            style={{
                              width:"100%",padding:"7px 10px",
                              background:V.sf2,border:`1.5px solid ${V.bd}`,borderRadius:8,
                              color:V.tx,fontSize:11,fontFamily:"'Jost',sans-serif",
                              outline:"none",boxSizing:"border-box",transition:"border-color 0.2s",
                            }}
                            onFocus={e=>e.target.style.borderColor=V.ac}
                            onBlur={e=>e.target.style.borderColor=V.bd}/>
                        </div>
                      ))}
                    </div>
                  </details>
                  {/* Quantity */}
                  <div>
                    <div style={sb}>Quantity</div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{
                        width:32,height:32,background:"transparent",
                        border:`1.5px solid ${V.bd}`,borderRadius:8,
                        color:V.tx,fontSize:16,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;}}>−</button>
                      <span style={{fontSize:16,fontWeight:600,minWidth:28,textAlign:"center",fontFamily:"'Jost',sans-serif"}}>{qty}</span>
                      <button onClick={()=>setQty(q=>q+1)} style={{
                        width:32,height:32,background:"transparent",
                        border:`1.5px solid ${V.bd}`,borderRadius:8,
                        color:V.tx,fontSize:16,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;}}>+</button>
                    </div>
                  </div>
                  {/* Design summary */}
                  <div style={{
                    background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:12,
                    padding:"14px 14px 10px",
                  }}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:500,color:V.tx,letterSpacing:".02em",marginBottom:10}}>Your Design</div>
                    {[
                      ["Garment", isTypeMode ? `${garmentType.charAt(0).toUpperCase()+garmentType.slice(1)} T-Shirt` : product!.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")],
                      ["Style",   activeKashaDesign?`${activeKashaDesign.id} — ${activeKashaDesign.label}`:activePrintId?PATTERNS.find(p=>p.id===activePrintId)?.label||"—":primaryColor],
                      ["Size",    size],
                      ["Qty",     String(qty)],
                      ...(!isTypeMode ? [["Price", formatPrice(product!.priceInPaise)]] : []),
                    ].map(([label,val])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid rgba(26,26,24,0.06)`}}>
                        <span style={{fontSize:9,color:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".1em",textTransform:"uppercase",fontWeight:500}}>{label}</span>
                        <span style={{fontSize:11,color:V.tx,fontWeight:500,maxWidth:160,textAlign:"right",wordBreak:"break-all",fontFamily:"'Jost',sans-serif"}}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {/* CTA */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {isTypeMode ? (
                      <Link href="/products" style={{
                        padding:"12px 0",borderRadius:99,
                        border:`1.5px solid ${V.ac}`,background:V.aclt,color:V.tx,
                        fontSize:12,fontWeight:600,cursor:"pointer",
                        fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                        textDecoration:"none",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",
                        transition:"all 0.3s",
                      }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.ac;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}>
                        Browse Products →
                      </Link>
                    ) : (
                      <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending} style={{
                        padding:"12px 0",borderRadius:99,border:"none",
                        background:V.tx,color:"white",
                        fontSize:12,fontWeight:600,cursor:"pointer",
                        fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                        opacity:cartMut.isPending?.6:1,transition:"all 0.3s",
                      }}
                      onMouseEnter={e=>{if(!cartMut.isPending){e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}}
                      onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="white";}}>
                        {cartMut.isPending?"Adding…":"✦ Add to Cart"}
                      </button>
                    )}
                    {!isTypeMode && (
                      <Show when="signed-in">
                        <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending} style={{
                          padding:"10px 0",borderRadius:99,
                          border:`1.5px solid rgba(201,168,76,0.4)`,background:"transparent",
                          color:V.tx,fontSize:11,fontWeight:500,cursor:"pointer",
                          fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                          opacity:saveMut.isPending?.6:1,transition:"all 0.3s",
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.4)";e.currentTarget.style.background="transparent";}}>
                          {saveMut.isPending?"Saving…":"✦ Save Design"}
                        </button>
                      </Show>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── CENTER: 3D CANVAS ─────────────────────────────────────────────── */}
        <div style={{
          flex:1,position:"relative",
          background:"radial-gradient(ellipse at 55% 40%, #f2efe8 0%, #e8e2d9 60%, #ddd7ca 100%)",
          display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
          minWidth:0,
        }}>
          {/* Loading overlay */}
          {!modelDisplayed&&webglAvailable&&product?.modelUrl&&(
            <div style={{
              position:"absolute",inset:0,
              background:"rgba(250,250,247,0.92)",backdropFilter:"blur(8px)",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:10,
            }}>
              <div style={{
                width:40,height:40,
                border:`2px solid ${V.bd}`,borderTopColor:V.ac,
                borderRadius:"50%",animation:"spin .9s linear infinite",
              }}/>
              <p style={{fontSize:11,color:V.mu,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif"}}>Loading preview…</p>
            </div>
          )}

          {mvReady&&product?.modelUrl&&webglAvailable&&(
            <model-viewer ref={mvRef} src={toProxiedUrl(product?.modelUrl)}
              camera-controls auto-rotate rotation-per-second="8deg"
              shadow-intensity="1" environment-image="neutral" exposure="1.0"
              camera-orbit="0deg 75deg 2.5m" min-camera-orbit="auto auto 1.5m" max-camera-orbit="auto auto 5m"
              interaction-prompt="none"
              style={{width:"100%",height:"100%","--poster-color":"transparent",opacity:modelDisplayed?1:0,transition:"opacity .4s"} as any}/>
          )}

          {(!product?.modelUrl||!webglAvailable)&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,color:V.mu,padding:24,maxWidth:320,textAlign:"center"}}>
              {product?.thumbnailUrl
                ? <img src={product.thumbnailUrl} alt={product.name} style={{maxHeight:380,objectFit:"contain",borderRadius:14,boxShadow:"0 12px 48px rgba(26,26,24,0.12)",opacity:.95}}/>
                : <div style={{fontSize:64,opacity:.12}}>👕</div>}
              <p style={{fontSize:14,lineHeight:1.7,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>
                {isTypeMode
                  ? "Design your garment — browse products to select one for your cart."
                  : !webglAvailable?"3D preview requires WebGL. Your design is still applied correctly.":"No 3D model uploaded for this product."}
              </p>
            </div>
          )}

          {/* Product badge */}
          <div style={{
            position:"absolute",bottom:20,left:20,
            background:"rgba(250,250,247,0.94)",
            border:`1px solid rgba(201,168,76,0.2)`,
            borderRadius:10,padding:"8px 14px",
            backdropFilter:"blur(12px)",
            boxShadow:"0 2px 16px rgba(26,26,24,0.08)",
          }}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,fontWeight:600,color:V.tx,letterSpacing:".02em"}}>
              {isTypeMode ? `${garmentType.charAt(0).toUpperCase()+garmentType.slice(1)} T-Shirt` : product!.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")}
            </div>
            {!isTypeMode && <div style={{fontSize:11,color:V.ac,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",marginTop:1}}>{formatPrice(product!.priceInPaise)}</div>}
          </div>

          {/* Active design badge */}
          {(activeKashaDesign||activePrintId)&&(
            <div style={{
              position:"absolute",bottom:20,right:20,
              background:"rgba(250,250,247,0.94)",
              border:`1px solid rgba(201,168,76,0.25)`,
              borderRadius:10,padding:"6px 12px",
              backdropFilter:"blur(12px)",
              boxShadow:"0 2px 16px rgba(26,26,24,0.08)",
            }}>
              <div style={{fontSize:8,color:V.mu,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",marginBottom:1}}>Active Design</div>
              <div style={{fontSize:11,fontWeight:600,color:V.ac,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>
                {activeKashaDesign?`${activeKashaDesign.id} · ${activeKashaDesign.label}`:PATTERNS.find(p=>p.id===activePrintId)?.label}
              </div>
            </div>
          )}

          {/* Drag hint */}
          <div style={{
            position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",
            fontFamily:"'Cormorant Garamond', serif",
            fontSize:11,letterSpacing:".16em",
            color:"rgba(26,26,24,0.22)",textTransform:"uppercase",
            pointerEvents:"none",whiteSpace:"nowrap",
          }}>
            Drag to rotate · Scroll to zoom
          </div>
        </div>

        {/* ── RIGHT: VIEW SELECTOR ─────────────────────────────────────────── */}
        <div style={{
          width:86,flexShrink:0,
          display:"flex",flexDirection:"column",alignItems:"center",
          paddingTop:16,paddingBottom:16,gap:8,
          borderLeft:`1px solid rgba(26,26,24,0.07)`,
          background:V.bg,
          overflowY:"auto",
          scrollbarWidth:"none",
        }}>
          {CAMERA_VIEWS.map(v=>{
            const isA=cameraView===v.id;
            return(
              <button key={v.id}
                onClick={()=>setCameraView(v.id as any)}
                style={{
                  width:62,display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                  padding:"10px 0 8px",borderRadius:12,border:"none",cursor:"pointer",
                  background:isA?V.aclt:"transparent",
                  boxShadow:isA?`0 2px 14px rgba(201,168,76,0.18),inset 0 0 0 1.5px ${V.ac}`:"none",
                  transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={e=>{if(!isA){e.currentTarget.style.background=V.sf2;}}}
                onMouseLeave={e=>{if(!isA){e.currentTarget.style.background="transparent";}}}>
                {/* Mini garment silhouette */}
                <div style={{
                  width:38,height:38,borderRadius:8,
                  background:isA?`rgba(201,168,76,0.15)`:V.sf2,
                  border:`1.5px solid ${isA?V.ac:V.bd}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all 0.25s",
                  boxShadow:isA?`0 2px 8px rgba(201,168,76,0.2)`:"none",
                  overflow:"hidden",
                }}>
                  {product?.thumbnailUrl
                    ? <img src={product.thumbnailUrl} alt={v.label}
                        style={{
                          width:"100%",height:"100%",objectFit:"cover",
                          opacity:isA?1:0.5,transition:"opacity 0.2s",
                          transform:v.id==="back"?"scaleX(-1)":v.id==="right"?"none":v.id==="left"?"none":"none",
                          filter:v.id==="back"?"brightness(0.7)":v.id==="right"||v.id==="left"?"brightness(0.85)":"none",
                        }}/>
                    : <span style={{fontSize:16,opacity:isA?1:0.35}}>👕</span>
                  }
                </div>
                <span style={{
                  fontSize:9,letterSpacing:".08em",textTransform:"uppercase",
                  fontFamily:"'Jost',sans-serif",fontWeight:isA?700:500,
                  color:isA?V.tx:V.mu,lineHeight:1,transition:"color 0.2s",
                }}>{v.label}</span>
              </button>
            );
          })}

          {/* Divider */}
          <div style={{width:40,height:1,background:V.bd,margin:"4px 0"}}/>

          {/* TRY 360° button */}
          <button
            onClick={()=>{
              const mv:any=mvRef.current; if(!mv) return;
              mv.setAttribute("auto-rotate",""); mv.setAttribute("rotation-per-second","20deg");
              setTimeout(()=>{mv.removeAttribute("auto-rotate");mv.setAttribute("rotation-per-second","8deg");},3000);
            }}
            style={{
              width:62,padding:"10px 0",borderRadius:12,
              border:`1.5px solid ${V.ac}`,
              background:`rgba(201,168,76,0.1)`,
              cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              transition:"all 0.25s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.background=V.aclt;e.currentTarget.style.boxShadow=`0 4px 14px rgba(201,168,76,0.25)`;}}
            onMouseLeave={e=>{e.currentTarget.style.background=`rgba(201,168,76,0.1)`;e.currentTarget.style.boxShadow="none";}}>
            <span style={{fontSize:14,lineHeight:1}}>↻</span>
            <span style={{
              fontSize:8,letterSpacing:".06em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",fontWeight:700,
              color:V.ac,lineHeight:1,
            }}>360°</span>
          </button>
        </div>
      </div>

      {/* Hidden Fabric canvas (texture pipeline) */}
      <div id="fc-wrapper" style={{position:"fixed",left:"-9999px",top:0,width:"1024px",height:"1024px",pointerEvents:"none",opacity:0.01,zIndex:-1}}>
        <div id="fc-scale-host" style={{position:"absolute",left:0,top:0,width:"1024px",height:"1024px",transformOrigin:"top left"}}>
          <canvas ref={canvasElRef}/>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@200;300;400;500;600&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${V.cream3};border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;width:14px;height:14px;
          background:${V.ac};border-radius:50%;cursor:pointer;
          border:2px solid #fff;box-shadow:0 1px 4px rgba(201,168,76,0.3);
        }
        input[type=range]{-webkit-appearance:none;appearance:none}
        details summary{list-style:none}
        details summary::-webkit-details-marker{display:none}
      `}</style>
    </div>
  );
}
