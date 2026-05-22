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
  KASHA_DESIGNS, applyKashaDesign, clearKashaDesign,
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

// Logo 9-point position grid → fabric canvas coordinates
const LOGO_POSITIONS: Record<string, { left:number; top:number }> = {
  "top-left":    { left: 160, top: 360 }, "top-center":    { left: 512, top: 360 }, "top-right":   { left: 864, top: 360 },
  "mid-left":    { left: 160, top: 620 }, "center":        { left: 512, top: 620 }, "mid-right":   { left: 864, top: 620 },
  "bottom-left": { left: 160, top: 880 }, "bottom-center": { left: 512, top: 880 }, "bottom-right":{ left: 864, top: 880 },
};
const POS_GRID = [
  ["top-left","top-center","top-right"],
  ["mid-left","center","mid-right"],
  ["bottom-left","bottom-center","bottom-right"],
];

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
  category: string;    // maps to ProductType
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
  const productType: ProductType = (product?.category as ProductType) ?? "fabric";

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
  const [logoPosition, setLogoPosition] = useState("top-center");
  const [logoSize, setLogoSize] = useState(50);
  const [logoPreview, setLogoPreview] = useState<string|null>(null);

  // ── Size step state ──────────────────────────────────────────────────────
  const [size, setSize] = useState("M");
  const [customMeasurements, setCustomMeasurements] = useState({ chest:"", shoulder:"", length:"", sleeve:"" });
  const [designName, setDesignName] = useState("");
  const [qty, setQty] = useState(1);

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

  // Auto-apply first KA.SHA design when navigating to a pattern product from PDP
  useEffect(() => {
    if (!canvasReady || productType !== "pattern" || autoAppliedRef.current) return;
    autoAppliedRef.current = true;
    handleSelectKashaDesign(KASHA_DESIGNS[0]);
  }, [canvasReady, productType, handleSelectKashaDesign]);

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

      {/* HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 24px",height:60,flexShrink:0,zIndex:50,
        background:"rgba(250,250,247,0.92)",
        backdropFilter:"blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        borderBottom:`1px solid rgba(201,168,76,0.15)`,
        boxShadow:"0 2px 20px rgba(26,26,24,0.05)",
      }}>
        {/* Left: back + logo */}
        <div style={{display:"flex",alignItems:"center",gap:16,minWidth:160}}>
          <Link href={isTypeMode ? "/" : `/products/${id}`} style={{
            color:V.mu,fontSize:12,textDecoration:"none",
            display:"flex",alignItems:"center",gap:5,
            padding:"5px 12px",borderRadius:40,
            border:`1px solid rgba(201,168,76,0.25)`,
            transition:"all 0.3s",fontWeight:500,letterSpacing:".05em",
            fontFamily:"'Jost',sans-serif",
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.25)";e.currentTarget.style.background="transparent";}}>
            ← Back
          </Link>
          <div style={{width:1,height:20,background:`rgba(26,26,24,0.1)`}}/>
          <span style={{
            fontFamily:"'Cormorant Garamond', serif",
            fontSize:20,fontWeight:600,letterSpacing:".08em",color:V.tx,
          }}>
            KA.<span style={{color:V.ac}}>SHA</span>
          </span>
        </div>

        {/* Center: studio label */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span style={{
            fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:".18em",
            textTransform:"uppercase",color:V.mu,fontWeight:500,
          }}>
            {isTypeMode
              ? (garmentType === "solid" ? "Solid T-Shirt Studio"
                 : garmentType === "pattern" ? "Pattern T-Shirt Studio"
                 : "Printed T-Shirt Studio")
              : isQuickMode ? "Quick Personalisation" : "Bespoke Design Studio"}
          </span>
          {isQuickMode && (
            <span style={{
              fontFamily:"'Jost',sans-serif",fontSize:8,letterSpacing:".12em",
              textTransform:"uppercase",color:V.ac,fontWeight:600,
              background:"rgba(201,168,76,0.1)",padding:"2px 8px",borderRadius:99,
            }}>Logo · Text · Placement</span>
          )}
        </div>

        {/* Right: name input + save + cart */}
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:160,justifyContent:"flex-end"}}>
          <input
            value={designName}
            onChange={e=>setDesignName(e.target.value)}
            placeholder="Name your design…"
            style={{
              padding:"6px 12px",
              background:V.sf2,
              border:`1.5px solid ${V.bd}`,
              borderRadius:40,
              color:V.tx,fontSize:11,
              outline:"none",width:150,
              fontFamily:"'Jost',sans-serif",
              letterSpacing:".02em",
              transition:"border-color 0.2s",
            }}
            onFocus={e=>e.target.style.borderColor=V.ac}
            onBlur={e=>e.target.style.borderColor=V.bd}
          />
          {!isTypeMode && (
            <Show when="signed-in">
              <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
                style={{
                  padding:"7px 18px",borderRadius:40,
                  border:`1px solid rgba(201,168,76,0.35)`,
                  background:"transparent",cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
                  letterSpacing:".06em",textTransform:"uppercase",
                  color:V.tx,transition:"all 0.3s",
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
              padding:"8px 22px",borderRadius:40,
              border:`1px solid ${V.ac}`,background:"transparent",
              fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
              letterSpacing:".06em",textTransform:"uppercase",
              color:V.tx,textDecoration:"none",
              transition:"all 0.3s",display:"flex",alignItems:"center",gap:6,
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
              Browse Products →
            </Link>
          ) : (
            <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending||saveMut.isPending}
              style={{
                padding:"8px 22px",borderRadius:40,
                border:"none",background:V.tx,
                cursor:"pointer",
                fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,
                letterSpacing:".06em",textTransform:"uppercase",
                color:"#fff",
                transition:"all 0.3s",
                display:"flex",alignItems:"center",gap:6,
                opacity:cartMut.isPending?.6:1,
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
              onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
              {cartMut.isPending?"Adding…":"✦ Add to Cart"}
            </button>
          )}
        </div>
      </header>

      {/* WORKSPACE ───────────────────────────────────────────────────────── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT PANEL: Wizard ─────────────────────────────────────────── */}
        <div style={{
          width:380,minWidth:320,
          borderRight:`1px solid rgba(26,26,24,0.07)`,
          overflowY:"auto",padding:"24px 22px",
          display:"flex",flexDirection:"column",
          background:V.bg,
          scrollbarWidth:"thin",
        }}>
          {stepIndicator}

          {/* ── STEP 1 (TYPE MODE): Solid — Colour + Parts ────────────── */}
          {step===1&&isTypeMode&&garmentType==="solid"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={sbT}>Base colour</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))}
                  <label title="Custom colour" style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",flexShrink:0,border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.tx}}>
                    +<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                  </label>
                </div>
              </div>

              <div>
                <div style={sbT}>Customise individual parts</div>
                <p style={{fontSize:12,color:"#3a3a36",marginBottom:12,lineHeight:1.65}}>Select a zone, then pick a colour to override it.</p>
                <button onClick={()=>{if(zoneColors[activePartZone])PART_ZONES.forEach(z=>applyZoneColor(z.id,zoneColors[activePartZone]));}} style={{fontSize:12,padding:"7px 16px",border:`1px solid ${V.bd}`,borderRadius:99,cursor:"pointer",background:"transparent",color:"#4a4a42",marginBottom:12,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color="#4a4a42";}}>Apply colour to all parts</button>
                {PART_ZONES.map(z=>{
                  const active=activePartZone===z.id; const col=zoneColors[z.id];
                  return(<div key={z.id} onClick={()=>setActivePartZone(z.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${active?V.ac:V.bd}`,background:active?V.aclt:"transparent",cursor:"pointer",marginBottom:5,transition:"all 0.2s"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:col||primaryColor,border:`1.5px solid ${active?V.ac:V.bd2}`,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12,fontWeight:active?600:400,fontFamily:"'Jost',sans-serif"}}>{z.label}</span>
                    <span style={{fontSize:9,color:active?V.tx:V.mu,padding:"3px 10px",border:`1px solid ${active?V.ac:V.bd}`,borderRadius:99,letterSpacing:".04em",background:active?V.sf:"transparent"}}>{col?col.toUpperCase():"Base"}</span>
                  </div>);
                })}
                <div style={{marginTop:12,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,boxShadow:"0 2px 12px rgba(26,26,24,0.04)"}}>
                  <div style={{fontSize:12,color:"#4a4a42",marginBottom:10,letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Colour for <strong style={{color:V.tx,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:600,textTransform:"none",letterSpacing:".02em"}}>{PART_ZONES.find(z=>z.id===activePartZone)?.label}</strong></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[activePartZone]===hex,()=>applyZoneColor(activePartZone,hex)))}
                    <label title="Custom" style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.tx,flexShrink:0}}>
                      +<input type="color" value={zoneColors[activePartZone]||primaryColor} onChange={e=>applyZoneColor(activePartZone,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                    </label>
                  </div>
                  {zoneColors[activePartZone]&&(<button onClick={()=>applyZoneColor(activePartZone,"")} style={{fontSize:11,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Clear zone colour</button>)}
                </div>
              </div>

              <div>
                <div style={sbT}>Sleeve length</div>
                <div style={{display:"flex",gap:6}}>
                  {(["half","full"] as const).map(v=>(
                    <button key={v} onClick={()=>setSleeveLength(v)} style={{flex:1,padding:"9px 0",fontSize:12,fontFamily:"'Jost',sans-serif",cursor:"pointer",borderRadius:99,letterSpacing:".07em",textTransform:"uppercase",border:sleeveLength===v?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,background:sleeveLength===v?V.aclt:"transparent",color:sleeveLength===v?V.tx:"#4a4a42",fontWeight:sleeveLength===v?600:400,transition:"all .2s"}}>
                      {v.charAt(0).toUpperCase()+v.slice(1)} sleeve
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={()=>setStep(2)} style={{marginTop:4,padding:"12px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
                Next: Add Prints →
              </button>
            </div>
          )}

          {/* ── STEP 1 (TYPE MODE): Pattern — KA.SHA Design Selection ── */}
          {step===1&&isTypeMode&&garmentType==="pattern"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={{background:`rgba(201,168,76,0.08)`,border:`1px solid rgba(201,168,76,0.2)`,borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:600,color:V.ac,letterSpacing:".02em",marginBottom:2}}>KA.SHA Bespoke Designs</div>
                  <div style={{fontSize:12,color:"#3a3a36",lineHeight:1.65}}>Select a signature pattern — colours customised in the next step</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                  {KASHA_DESIGNS.map(d=>{
                    const isA=activeKashaDesign?.id===d.id; const zones=Object.keys(d.zones).length;
                    return(<button key={d.id} onClick={()=>handleSelectKashaDesign(d)} title={d.label} style={{padding:"10px 8px",borderRadius:10,border:isA?`2px solid ${V.ac}`:`1.5px solid ${V.bd}`,background:isA?V.aclt:V.sf,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontFamily:"'Jost',sans-serif",transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)",position:"relative",boxShadow:isA?`0 4px 20px rgba(201,168,76,0.2)`:"0 1px 6px rgba(26,26,24,0.05)"}} onMouseEnter={e=>{if(!isA){e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";e.currentTarget.style.transform="translateY(-2px)";}}} onMouseLeave={e=>{if(!isA){e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.transform="none";}}}>
                      {isA&&<div style={{position:"absolute",top:7,right:7,width:16,height:16,borderRadius:"50%",background:V.ac,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:V.tx,fontWeight:800}}>✓</div>}
                      <div style={{width:"100%",height:48,borderRadius:6,overflow:"hidden",background:V.sf2,border:`1px solid ${V.bd}`,flexShrink:0}}>
                        {d.zones.front&&<img src={d.zones.front} alt={d.label} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
                      </div>
                      <span style={{fontSize:10,color:isA?V.tx:V.mu,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>{d.id}</span>
                      <span style={{fontSize:11,color:V.mul,textAlign:"center",lineHeight:1.4,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{zones} zone{zones!==1?"s":""}</span>
                    </button>);
                  })}
                </div>
                {activeKashaDesign&&(
                  <div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,boxShadow:"0 2px 12px rgba(26,26,24,0.05)"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{activeKashaDesign.id}</div>
                      <div style={{fontSize:12,color:V.mu,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{activeKashaDesign.label}</div>
                    </div>
                    <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);}} style={{fontSize:9,color:V.mu,background:"transparent",border:`1px solid ${V.bd}`,borderRadius:99,padding:"4px 10px",cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",flexShrink:0,transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>Clear</button>
                  </div>
                )}
                {!activeKashaDesign&&<p style={{fontSize:12,color:"#3a3a36",marginTop:2,lineHeight:1.65}}>Select a bespoke design above to begin.</p>}
              </div>

              <div>
                <div style={sbT}>Sleeve length</div>
                <div style={{display:"flex",gap:6}}>
                  {(["half","full"] as const).map(v=>(
                    <button key={v} onClick={()=>setSleeveLength(v)} style={{flex:1,padding:"9px 0",fontSize:12,fontFamily:"'Jost',sans-serif",cursor:"pointer",borderRadius:99,letterSpacing:".07em",textTransform:"uppercase",border:sleeveLength===v?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,background:sleeveLength===v?V.aclt:"transparent",color:sleeveLength===v?V.tx:"#4a4a42",fontWeight:sleeveLength===v?600:400,transition:"all .2s"}}>
                      {v.charAt(0).toUpperCase()+v.slice(1)} sleeve
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={()=>setStep(2)} style={{marginTop:4,padding:"12px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
                Next: Customise Colours →
              </button>
            </div>
          )}

          {/* ── STEP 1 (TYPE MODE): Printed — Print Selection ────────── */}
          {step===1&&isTypeMode&&garmentType==="printed"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={sbT}>Choose your print</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:12}}>
                  {PATTERNS.filter(p=>p.id!=="kasha-gt015").map(p=>{
                    const sel=activePrintId===p.id; const allApplied=allOverPrintId===p.id;
                    return(<button key={p.id} onClick={()=>{setActivePrintId(p.id);applyAllOverPrint(p);}} title={p.label} style={{position:"relative",padding:0,aspectRatio:"1/1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:`url(${patternUrl(p.file)}) center/cover`,border:sel?`2px solid ${V.ac}`:`1.5px solid transparent`,outline:sel?`2px solid rgba(201,168,76,0.25)`:undefined,outlineOffset:sel?"1px":undefined,transition:"all 0.2s",boxShadow:sel?`0 0 0 1px ${V.ac},0 2px 8px rgba(201,168,76,0.2)`:"none"}}>
                      {allApplied&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3,letterSpacing:".04em"}}>✓</span>}
                    </button>);
                  })}
                </div>
                {activePrintId&&(()=>{
                  const p=PATTERNS.find(x=>x.id===activePrintId); if(!p) return null;
                  return(<div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,boxShadow:"0 2px 12px rgba(26,26,24,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:36,height:36,borderRadius:7,background:`url(${patternUrl(p.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                      <div style={{fontSize:13,fontWeight:600,color:V.tx,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".02em"}}>{p.label}</div>
                    </div>
                    {allOverPrintId&&<button onClick={clearAllOverPrint} style={{padding:"7px 0",width:"100%",borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,background:"transparent",color:"#c45c5c",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Remove print</button>}
                  </div>);
                })()}
                {!activePrintId&&<p style={{fontSize:12,color:"#3a3a36",lineHeight:1.65}}>Select a print above — it will be applied across the whole garment.</p>}
              </div>

              <div>
                <div style={sbT}>Sleeve length</div>
                <div style={{display:"flex",gap:6}}>
                  {(["half","full"] as const).map(v=>(
                    <button key={v} onClick={()=>setSleeveLength(v)} style={{flex:1,padding:"9px 0",fontSize:12,fontFamily:"'Jost',sans-serif",cursor:"pointer",borderRadius:99,letterSpacing:".07em",textTransform:"uppercase",border:sleeveLength===v?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,background:sleeveLength===v?V.aclt:"transparent",color:sleeveLength===v?V.tx:"#4a4a42",fontWeight:sleeveLength===v?600:400,transition:"all .2s"}}>
                      {v.charAt(0).toUpperCase()+v.slice(1)} sleeve
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={()=>setStep(2)} style={{marginTop:4,padding:"12px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
                Next: Add Patterns →
              </button>
            </div>
          )}

          {/* ── STEP 1: Style (product mode) ───────────────────────────── */}
          {step===1&&!isTypeMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={sb}>Choose base style</div>

                {/* Tab bar */}
                <div style={{
                  display:"flex",gap:3,
                  background:V.sf2,padding:4,
                  borderRadius:10,overflow:"hidden",marginBottom:18,
                }}>
                  {productType!=="pattern"&&(
                    <button onClick={()=>setStyleTab("solid")} style={{
                      flex:1,padding:"7px 4px",borderRadius:7,cursor:"pointer",
                      border:"none",
                      background:styleTab==="solid"?"#fff":"transparent",
                      color:styleTab==="solid"?V.tx:V.mu,
                      fontWeight:styleTab==="solid"?600:400,
                      letterSpacing:".07em",fontFamily:"'Jost',sans-serif",
                      fontSize:10,textTransform:"uppercase",
                      transition:"all 0.25s",
                      boxShadow:styleTab==="solid"?"0 2px 8px rgba(26,26,24,0.08)":"none",
                    }}>Solid</button>
                  )}
                  {productType!=="pattern"&&(
                    <button onClick={()=>setStyleTab("print")} style={{
                      flex:1,padding:"7px 4px",borderRadius:7,cursor:"pointer",
                      border:"none",
                      background:styleTab==="print"?"#fff":"transparent",
                      color:styleTab==="print"?V.tx:V.mu,
                      fontWeight:styleTab==="print"?600:400,
                      letterSpacing:".07em",fontFamily:"'Jost',sans-serif",
                      fontSize:10,textTransform:"uppercase",
                      transition:"all 0.25s",
                      boxShadow:styleTab==="print"?"0 2px 8px rgba(26,26,24,0.08)":"none",
                    }}>Print</button>
                  )}
                  {productType!=="print"&&(
                    <button onClick={()=>setStyleTab("pattern")} style={{
                      flex:1,padding:"7px 4px",borderRadius:7,cursor:"pointer",
                      border:"none",
                      background:styleTab==="pattern"?"#fff":"transparent",
                      color:styleTab==="pattern"?V.tx:V.mu,
                      fontWeight:styleTab==="pattern"?600:400,
                      letterSpacing:".07em",fontFamily:"'Jost',sans-serif",
                      fontSize:10,textTransform:"uppercase",
                      transition:"all 0.25s",
                      boxShadow:styleTab==="pattern"?"0 2px 8px rgba(26,26,24,0.08)":"none",
                    }}>Pattern</button>
                  )}
                </div>

                {/* ── SOLID pane ── */}
                {styleTab==="solid"&&(
                  <div>
                    <div style={{...sb,marginBottom:10}}>Pick a colour</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                      {MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))}
                      <label title="Custom colour" style={{
                        width:30,height:30,borderRadius:"50%",cursor:"pointer",
                        overflow:"hidden",position:"relative",flexShrink:0,
                        border:`1.5px dashed ${V.bd2}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:14,color:V.mu,
                      }}>
                        +<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                      </label>
                    </div>
                    <p style={{fontSize:10,color:V.mul,fontStyle:"italic"}}>Override individual parts in Step 2</p>
                  </div>
                )}

                {/* ── PRINT pane ── */}
                {styleTab==="print"&&(
                  <div>
                    <div style={{...sb,marginBottom:10}}>Print library</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:12}}>
                      {PATTERNS.filter(p=>p.id!=="kasha-gt015").map(p=>{
                        const sel=activePrintId===p.id;
                        const allApplied=allOverPrintId===p.id;
                        const inZone=Object.values(zonePrintIds).includes(p.id);
                        return(
                          <button key={p.id} onClick={()=>setActivePrintId(p.id)} title={p.label}
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
                            {allApplied&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3,letterSpacing:".04em"}}>ALL</span>}
                            {!allApplied&&inZone&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3,letterSpacing:".04em"}}>ZONE</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected print actions */}
                    {activePrintId&&(()=>{
                      const p=PATTERNS.find(x=>x.id===activePrintId); if(!p) return null;
                      return(
                        <div style={{
                          background:V.sf,border:`1px solid ${V.bd}`,
                          borderRadius:10,padding:12,
                          display:"flex",flexDirection:"column",gap:10,
                          boxShadow:"0 2px 12px rgba(26,26,24,0.05)",
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:36,height:36,borderRadius:7,background:`url(${patternUrl(p.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                            <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".02em"}}>{p.label}</div>
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
                                }}>
                                  {m==="fullBody"?"Full Body":"By Part"}
                                </button>
                              ))}
                            </div>
                          )}

                          {(productType==="print"||printMode==="fullBody")&&(
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              <button onClick={()=>applyAllOverPrint(p)} style={{
                                padding:"9px 0",borderRadius:99,border:"none",
                                background:allOverPrintId===p.id?V.tx:V.ac,
                                color:allOverPrintId===p.id?"#fff":V.tx,
                                fontSize:11,fontWeight:600,cursor:"pointer",
                                fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                                transition:"all 0.2s",
                              }}>
                                {allOverPrintId===p.id?(productType==="print"?"✓ Selected":"✓ Applied All-Over"):(productType==="print"?"Select this Print":"Apply to whole T-shirt")}
                              </button>
                              {allOverPrintId&&productType!=="print"&&(
                                <button onClick={clearAllOverPrint} style={{
                                  padding:"7px 0",borderRadius:99,
                                  border:`1px solid rgba(196,92,92,.35)`,
                                  background:"transparent",color:"#c45c5c",
                                  fontSize:10,fontWeight:500,cursor:"pointer",
                                  fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                                }}>
                                  ✕ Remove full-body print
                                </button>
                              )}
                            </div>
                          )}

                          {productType!=="print"&&printMode==="parts"&&(()=>{
                            const zones: {id:Exclude<PatternZone,"all">;label:string}[]=[
                              {id:"front",label:"Front"},{id:"back",label:"Back"},
                              {id:"collar",label:"Collar"},{id:"leftSleeve",label:"L.Sleeve"},{id:"rightSleeve",label:"R.Sleeve"},
                            ];
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                <div style={{fontSize:10,color:V.mu,marginBottom:2,fontStyle:"italic"}}>Click a part to apply / remove:</div>
                                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                  {zones.map(z=>{
                                    const applied=zonePrintIds[z.id]===p.id;
                                    const otherPrint=zonePrintIds[z.id]&&zonePrintIds[z.id]!==p.id;
                                    return(
                                      <button key={z.id}
                                        onClick={()=>applied?clearZonePrint(z.id):applyZonePrint(z.id,p)}
                                        title={otherPrint?`Currently: ${PATTERNS.find(x=>x.id===zonePrintIds[z.id])?.label}`:""}
                                        style={{
                                          padding:"5px 12px",fontSize:10,fontWeight:applied?600:400,cursor:"pointer",
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
                                  <button onClick={clearAllZonePrints} style={{
                                    padding:"7px 0",borderRadius:99,
                                    border:`1px solid rgba(196,92,92,.35)`,background:"transparent",
                                    color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",marginTop:2,
                                    fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                                  }}>
                                    ✕ Clear all zone prints
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                    {productType==="print"&&<p style={{fontSize:10,color:V.mu,marginTop:6,lineHeight:1.6,fontStyle:"italic"}}>Pre-printed garment. Select a print above — colour changes not available.</p>}
                  </div>
                )}

                {/* ── PATTERN pane (KA.SHA Bespoke Designs KD001–KD005) ── */}
                {styleTab==="pattern"&&(
                  <div>
                    <div style={{
                      background:`rgba(201,168,76,0.08)`,
                      border:`1px solid rgba(201,168,76,0.2)`,
                      borderRadius:10,padding:"10px 12px",marginBottom:14,
                    }}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:600,color:V.ac,letterSpacing:".02em",marginBottom:2}}>KA.SHA Bespoke Designs</div>
                      <div style={{fontSize:10,color:V.mu,lineHeight:1.6}}>Premium zone-mapped designs crafted for the course</div>
                    </div>

                    {/* 5-card design grid */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                      {KASHA_DESIGNS.map(d=>{
                        const isA=activeKashaDesign?.id===d.id;
                        const zones=Object.keys(d.zones).length;
                        return(
                          <button key={d.id} onClick={()=>handleSelectKashaDesign(d)} title={d.label}
                            style={{
                              padding:"10px 8px 10px",borderRadius:10,
                              border:isA?`2px solid ${V.ac}`:`1.5px solid ${V.bd}`,
                              background:isA?V.aclt:V.sf,
                              cursor:"pointer",display:"flex",flexDirection:"column",
                              alignItems:"center",gap:6,fontFamily:"'Jost',sans-serif",
                              transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)",
                              position:"relative",
                              boxShadow:isA?`0 4px 20px rgba(201,168,76,0.2)`:"0 1px 6px rgba(26,26,24,0.05)",
                            }}
                            onMouseEnter={e=>{if(!isA){e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 16px rgba(26,26,24,0.08)";}}}
                            onMouseLeave={e=>{if(!isA){e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 6px rgba(26,26,24,0.05)";}}}>
                            {isA&&(
                              <div style={{
                                position:"absolute",top:7,right:7,
                                width:16,height:16,borderRadius:"50%",
                                background:V.ac,display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:8,color:V.tx,fontWeight:800,
                              }}>✓</div>
                            )}
                            <div style={{
                              width:"100%",height:48,borderRadius:6,overflow:"hidden",
                              background:V.sf2,border:`1px solid ${V.bd}`,flexShrink:0,
                            }}>
                              {d.zones.front&&(
                                <img src={d.zones.front} alt={d.label}
                                  style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                              )}
                            </div>
                            <span style={{
                              fontSize:10,color:isA?V.tx:V.mu,fontWeight:700,
                              letterSpacing:".06em",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",
                            }}>{d.id}</span>
                            <span style={{
                              fontSize:11,color:V.mul,textAlign:"center",lineHeight:1.4,
                              fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",
                            }}>{zones} zone{zones!==1?"s":""}</span>
                          </button>
                        );
                      })}
                    </div>

                    {activeKashaDesign&&(
                      <div style={{
                        background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,
                        padding:"10px 12px",display:"flex",alignItems:"center",
                        justifyContent:"space-between",gap:10,
                        boxShadow:"0 2px 12px rgba(26,26,24,0.05)",
                      }}>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{activeKashaDesign.id}</div>
                          <div style={{fontSize:12,color:V.mu,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{activeKashaDesign.label}</div>
                        </div>
                        <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);}}
                          style={{
                            fontSize:9,color:V.mu,background:"transparent",
                            border:`1px solid ${V.bd}`,borderRadius:99,
                            padding:"4px 10px",cursor:"pointer",
                            fontFamily:"'Jost',sans-serif",letterSpacing:".05em",flexShrink:0,
                            transition:"all 0.2s",
                          }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                          Clear
                        </button>
                      </div>
                    )}

                    {!activeKashaDesign&&(
                      <p style={{fontSize:10,color:V.mu,marginTop:2,fontStyle:"italic",lineHeight:1.6}}>Select a bespoke design above to apply it to the garment.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sleeve length toggle */}
              {productType!=="print"&&(
                <div>
                  <div style={sb}>Sleeve length</div>
                  <div style={{display:"flex",gap:6}}>
                    {(["half","full"] as const).map(v=>(
                      <button key={v} onClick={()=>setSleeveLength(v)} style={{
                        flex:1,padding:"9px 0",fontSize:10,fontFamily:"'Jost',sans-serif",cursor:"pointer",
                        borderRadius:99,letterSpacing:".07em",textTransform:"uppercase",
                        border:sleeveLength===v?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,
                        background:sleeveLength===v?V.aclt:"transparent",
                        color:sleeveLength===v?V.tx:V.mu,
                        fontWeight:sleeveLength===v?600:400,transition:"all .2s",
                      }}>
                        {v.charAt(0).toUpperCase()+v.slice(1)} sleeve
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={()=>setStep(2)} style={{
                marginTop:4,padding:"12px 0",borderRadius:99,border:"none",
                background:V.tx,color:"#fff",
                fontSize:11,fontWeight:600,cursor:"pointer",
                letterSpacing:".08em",textTransform:"uppercase",
                fontFamily:"'Jost',sans-serif",
                transition:"all 0.3s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
              onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
                Next: Customise parts →
              </button>
            </div>
          )}

          {/* ── STEP 2 (TYPE MODE): Solid — Prints (optional) ───────────── */}
          {step===2&&isTypeMode&&garmentType==="solid"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sbT}>Add prints <span style={{opacity:.5,fontWeight:400,letterSpacing:0,textTransform:"none",fontStyle:"italic"}}>(optional)</span></div>
                <p style={{fontSize:12,color:"#3a3a36",marginBottom:12,lineHeight:1.65}}>Apply a repeating print to the whole garment or select individual parts.</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:12}}>
                  {PATTERNS.filter(p=>p.id!=="kasha-gt015").map(p=>{
                    const sel=activePrintId===p.id; const allApplied=allOverPrintId===p.id; const inZone=Object.values(zonePrintIds).includes(p.id);
                    return(<button key={p.id} onClick={()=>setActivePrintId(p.id)} title={p.label} style={{position:"relative",padding:0,aspectRatio:"1/1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:`url(${patternUrl(p.file)}) center/cover`,border:sel?`2px solid ${V.ac}`:`1.5px solid transparent`,outline:sel?`2px solid rgba(201,168,76,0.25)`:undefined,outlineOffset:sel?"1px":undefined,transition:"all 0.2s",boxShadow:sel?`0 0 0 1px ${V.ac},0 2px 8px rgba(201,168,76,0.2)`:"none"}}>
                      {allApplied&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3,letterSpacing:".04em"}}>ALL</span>}
                      {!allApplied&&inZone&&<span style={{position:"absolute",top:2,right:2,fontSize:6,fontWeight:800,background:V.ac,color:V.tx,padding:"1px 4px",borderRadius:3,letterSpacing:".04em"}}>ZONE</span>}
                    </button>);
                  })}
                </div>
                {activePrintId&&(()=>{
                  const p=PATTERNS.find(x=>x.id===activePrintId); if(!p) return null;
                  return(<div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:10,boxShadow:"0 2px 12px rgba(26,26,24,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:7,background:`url(${patternUrl(p.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                      <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".02em"}}>{p.label}</div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      {(["fullBody","parts"] as const).map(m=>(<button key={m} onClick={()=>setPrintMode(m)} style={{flex:1,padding:"6px 0",fontSize:10,fontWeight:600,cursor:"pointer",borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",border:printMode===m?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,background:printMode===m?V.aclt:"transparent",color:printMode===m?V.tx:V.mu,transition:"all .2s"}}>{m==="fullBody"?"Full Body":"By Part"}</button>))}
                    </div>
                    {printMode==="fullBody"&&(<div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <button onClick={()=>applyAllOverPrint(p)} style={{padding:"9px 0",borderRadius:99,border:"none",background:allOverPrintId===p.id?V.tx:V.ac,color:allOverPrintId===p.id?"#fff":V.tx,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s"}}>{allOverPrintId===p.id?"✓ Applied All-Over":"Apply to whole T-shirt"}</button>
                      {allOverPrintId&&<button onClick={clearAllOverPrint} style={{padding:"7px 0",borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Remove print</button>}
                    </div>)}
                    {printMode==="parts"&&(<div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{fontSize:10,color:V.mu,marginBottom:2,fontStyle:"italic"}}>Click a part to apply / remove:</div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {PART_ZONES.map(z=>{const applied=zonePrintIds[z.id]===p.id; return(<button key={z.id} onClick={()=>applied?clearZonePrint(z.id):applyZonePrint(z.id,p)} style={{padding:"5px 12px",fontSize:10,fontWeight:applied?600:400,cursor:"pointer",borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",border:applied?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,background:applied?V.aclt:"transparent",color:applied?V.tx:V.mu,transition:"all .2s"}}>{applied?"✓ ":""}{z.label}</button>);})}
                      </div>
                      {Object.values(zonePrintIds).some(Boolean)&&<button onClick={clearAllZonePrints} style={{padding:"7px 0",borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",marginTop:2,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Clear all zone prints</button>}
                    </div>)}
                  </div>);
                })()}
              </div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"10px 0",borderRadius:99,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{flex:2,padding:"10px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>Next: Add Logo →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2 (TYPE MODE): Pattern — Colour Combination ─────────── */}
          {step===2&&isTypeMode&&garmentType==="pattern"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sbT}>Body colour</div>
                <p style={{fontSize:12,color:"#3a3a36",marginBottom:10,lineHeight:1.65}}>Choose a base colour to complement your pattern.</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))}
                  <label title="Custom colour" style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",flexShrink:0,border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.tx}}>
                    +<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                  </label>
                </div>
              </div>
              <div>
                <div style={sbT}>Zone colour overrides</div>
                <p style={{fontSize:12,color:"#3a3a36",marginBottom:12,lineHeight:1.65}}>Override colour for specific parts to complement your pattern.</p>
                <button onClick={()=>{if(zoneColors[activePartZone])PART_ZONES.forEach(z=>applyZoneColor(z.id,zoneColors[activePartZone]));}} style={{fontSize:12,padding:"7px 16px",border:`1px solid ${V.bd}`,borderRadius:99,cursor:"pointer",background:"transparent",color:"#4a4a42",marginBottom:12,fontFamily:"'Jost',sans-serif",letterSpacing:".05em",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color="#4a4a42";}}>Apply colour to all parts</button>
                {PART_ZONES.map(z=>{
                  const active=activePartZone===z.id; const col=zoneColors[z.id];
                  return(<div key={z.id} onClick={()=>setActivePartZone(z.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${active?V.ac:V.bd}`,background:active?V.aclt:"transparent",cursor:"pointer",marginBottom:5,transition:"all 0.2s"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:col||primaryColor,border:`1.5px solid ${active?V.ac:V.bd2}`,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12,fontWeight:active?600:400,fontFamily:"'Jost',sans-serif"}}>{z.label}</span>
                    <span style={{fontSize:9,color:active?V.tx:V.mu,padding:"3px 10px",border:`1px solid ${active?V.ac:V.bd}`,borderRadius:99,letterSpacing:".04em",background:active?V.sf:"transparent"}}>{col?col.toUpperCase():"Base"}</span>
                  </div>);
                })}
                <div style={{marginTop:12,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,boxShadow:"0 2px 12px rgba(26,26,24,0.04)"}}>
                  <div style={{fontSize:12,color:"#4a4a42",marginBottom:10,letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Colour for <strong style={{color:V.tx,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:600,textTransform:"none",letterSpacing:".02em"}}>{PART_ZONES.find(z=>z.id===activePartZone)?.label}</strong></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[activePartZone]===hex,()=>applyZoneColor(activePartZone,hex)))}
                    <label title="Custom" style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.tx,flexShrink:0}}>
                      +<input type="color" value={zoneColors[activePartZone]||primaryColor} onChange={e=>applyZoneColor(activePartZone,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                    </label>
                  </div>
                  {zoneColors[activePartZone]&&<button onClick={()=>applyZoneColor(activePartZone,"")} style={{fontSize:11,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Clear zone colour</button>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"10px 0",borderRadius:99,border:`1px solid ${V.bd}`,background:"transparent",color:"#4a4a42",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color="#4a4a42";}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{flex:2,padding:"10px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>Next: Add Logo →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2 (TYPE MODE): Printed — Optional Pattern Overlay ────── */}
          {step===2&&isTypeMode&&garmentType==="printed"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sbT}>Add a pattern overlay <span style={{opacity:.5,fontWeight:400,letterSpacing:0,textTransform:"none",fontStyle:"italic"}}>(optional)</span></div>
                <p style={{fontSize:12,color:"#3a3a36",marginBottom:12,lineHeight:1.65}}>Layer a KA.SHA bespoke pattern on top of your print.</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                  {KASHA_DESIGNS.map(d=>{
                    const isA=activeKashaDesign?.id===d.id;
                    return(<button key={d.id} onClick={()=>isA?undefined:handleSelectKashaDesign(d)} title={d.label} style={{padding:"10px 8px",borderRadius:10,border:isA?`2px solid ${V.ac}`:`1.5px solid ${V.bd}`,background:isA?V.aclt:V.sf,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontFamily:"'Jost',sans-serif",transition:"all 0.3s",position:"relative",boxShadow:isA?`0 4px 20px rgba(201,168,76,0.2)`:"0 1px 6px rgba(26,26,24,0.05)"}} onMouseEnter={e=>{if(!isA){e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";e.currentTarget.style.transform="translateY(-2px)";}}} onMouseLeave={e=>{if(!isA){e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.transform="none";}}}>
                      {isA&&<div style={{position:"absolute",top:7,right:7,width:16,height:16,borderRadius:"50%",background:V.ac,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:V.tx,fontWeight:800}}>✓</div>}
                      <div style={{width:"100%",height:40,borderRadius:6,overflow:"hidden",background:V.sf2,border:`1px solid ${V.bd}`,flexShrink:0}}>
                        {d.zones.front&&<img src={d.zones.front} alt={d.label} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
                      </div>
                      <span style={{fontSize:10,color:isA?V.tx:V.mu,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>{d.id}</span>
                    </button>);
                  })}
                </div>
                {activeKashaDesign&&(
                  <div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{activeKashaDesign.id} overlay</div>
                      <div style={{fontSize:11,color:V.mu,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{activeKashaDesign.label}</div>
                    </div>
                    <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);}} style={{fontSize:9,color:V.mu,background:"transparent",border:`1px solid ${V.bd}`,borderRadius:99,padding:"4px 10px",cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",flexShrink:0,transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>Remove</button>
                  </div>
                )}
                {!activeKashaDesign&&<p style={{fontSize:10,color:V.mu,marginTop:2,fontStyle:"italic",lineHeight:1.6}}>Skip this step if you prefer your print without an overlay.</p>}
              </div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"10px 0",borderRadius:99,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{flex:2,padding:"10px 0",borderRadius:99,border:"none",background:V.tx,color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",transition:"all 0.3s"}} onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}} onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>Next: Add Logo →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Parts (product mode) ─────────────────────────────── */}
          {step===2&&!isTypeMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sb}>Customise individual parts</div>
                <p style={{fontSize:10,color:V.mu,marginBottom:12,lineHeight:1.6,fontStyle:"italic"}}>Select a zone, then choose a colour. These override the base style per section.</p>

                <button onClick={()=>{if(zoneColors[activePartZone])PART_ZONES.forEach(z=>applyZoneColor(z.id,zoneColors[activePartZone]));}}
                  style={{
                    fontSize:10,padding:"6px 14px",
                    border:`1px solid ${V.bd}`,borderRadius:99,cursor:"pointer",
                    background:"transparent",color:V.mu,marginBottom:12,
                    fontFamily:"'Jost',sans-serif",letterSpacing:".05em",
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                  Apply colour to all parts
                </button>

                {/* Part rows */}
                {PART_ZONES.map(z=>{
                  const active=activePartZone===z.id; const col=zoneColors[z.id];
                  return(
                    <div key={z.id} onClick={()=>setActivePartZone(z.id)} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 12px",borderRadius:10,
                      border:`1.5px solid ${active?V.ac:V.bd}`,
                      background:active?V.aclt:"transparent",
                      cursor:"pointer",marginBottom:5,
                      transition:"all 0.2s",
                    }}>
                      <div style={{
                        width:20,height:20,borderRadius:"50%",
                        background:col||primaryColor,
                        border:`1.5px solid ${active?V.ac:V.bd2}`,
                        flexShrink:0,
                      }}/>
                      <span style={{flex:1,fontSize:12,fontWeight:active?600:400,fontFamily:"'Jost',sans-serif"}}>{z.label}</span>
                      <span style={{
                        fontSize:9,color:active?V.tx:V.mu,
                        padding:"3px 10px",
                        border:`1px solid ${active?V.ac:V.bd}`,
                        borderRadius:99,letterSpacing:".04em",background:active?V.sf:"transparent",
                      }}>{col?col.toUpperCase():"Base"}</span>
                    </div>
                  );
                })}

                {/* Colour picker for active zone */}
                <div style={{marginTop:12,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:10,padding:12,boxShadow:"0 2px 12px rgba(26,26,24,0.04)"}}>
                  <div style={{fontSize:10,color:V.mu,marginBottom:10,letterSpacing:".06em",textTransform:"uppercase",fontWeight:500}}>
                    Colour for <strong style={{color:V.tx,fontFamily:"'Cormorant Garamond',serif",fontSize:13,fontWeight:600,textTransform:"none",letterSpacing:".02em"}}>{PART_ZONES.find(z=>z.id===activePartZone)?.label}</strong>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[activePartZone]===hex,()=>applyZoneColor(activePartZone,hex)))}
                    <label title="Custom" style={{
                      width:30,height:30,borderRadius:"50%",cursor:"pointer",
                      overflow:"hidden",position:"relative",
                      border:`1.5px dashed ${V.bd2}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:14,color:V.mu,flexShrink:0,
                    }}>
                      +<input type="color" value={zoneColors[activePartZone]||primaryColor} onChange={e=>applyZoneColor(activePartZone,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                    </label>
                  </div>
                  {zoneColors[activePartZone]&&(
                    <button onClick={()=>applyZoneColor(activePartZone,"")} style={{
                      fontSize:10,color:"#c45c5c",background:"none",
                      border:"none",cursor:"pointer",padding:0,
                      fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                    }}>✕ Clear zone colour</button>
                  )}
                </div>
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(1)} style={{
                  flex:1,padding:"10px 0",borderRadius:99,
                  border:`1px solid ${V.bd}`,background:"transparent",
                  color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                  transition:"all 0.2s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{
                  flex:2,padding:"10px 0",borderRadius:99,border:"none",
                  background:V.tx,color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                  transition:"all 0.3s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
                onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>Next: Add logo →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Logo ─────────────────────────────────────────────── */}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sb}>
                  Upload your logo <span style={{opacity:.5,fontWeight:400,letterSpacing:0,textTransform:"none",fontStyle:"italic"}}>(optional)</span>
                </div>
                <label style={{
                  display:"block",
                  border:`2px dashed rgba(201,168,76,0.3)`,
                  borderRadius:12,padding:"20px 16px",textAlign:"center",cursor:"pointer",
                  transition:"all 0.3s",marginBottom:12,
                  background:"rgba(201,168,76,0.02)",
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.3)";e.currentTarget.style.background="rgba(201,168,76,0.02)";}}>
                  <div style={{fontSize:24,marginBottom:8}}>⬆</div>
                  <div style={{fontSize:12,color:V.mu}}>
                    <strong style={{color:V.ac,display:"block",fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>Click to upload</strong>
                  </div>
                  <div style={{fontSize:10,color:V.mul,marginTop:4,fontStyle:"italic"}}>PNG, SVG, JPG · transparent bg recommended</div>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{display:"none"}}/>
                </label>
                {logoPreview&&(
                  <div style={{marginBottom:12}}>
                    <div style={{
                      width:"100%",aspectRatio:"2",
                      background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:10,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      overflow:"hidden",position:"relative",marginBottom:6,
                    }}>
                      <img src={logoPreview} alt="Logo" style={{maxWidth:"80%",maxHeight:"80%",objectFit:"contain"}}/>
                    </div>
                    <button onClick={removeLogo} style={{
                      fontSize:10,color:"#c45c5c",background:"none",border:"none",
                      cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                    }}>✕ Remove logo</button>
                  </div>
                )}
              </div>

              {/* 9-point position grid */}
              <div>
                <div style={sb}>Logo position</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,maxWidth:120,marginBottom:10}}>
                  {POS_GRID.flat().map(pos=>(
                    <button key={pos} onClick={()=>setLogoPosition(pos)} style={{
                      aspectRatio:"1",borderRadius:8,
                      border:`1.5px solid ${logoPosition===pos?V.ac:V.bd}`,
                      background:logoPosition===pos?V.aclt:"transparent",
                      cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,color:logoPosition===pos?V.tx:V.mu,transition:"all 0.2s",
                    }}>
                      {pos==="center"?"◉":pos.includes("top-left")?"↖":pos.includes("top-center")?"↑":pos.includes("top-right")?"↗":pos.includes("mid-left")?"←":pos.includes("mid-right")?"→":pos.includes("bottom-left")?"↙":pos.includes("bottom-center")?"↓":"↘"}
                    </button>
                  ))}
                </div>
                {logoPreview&&(
                  <button onClick={repositionLogo} style={{
                    fontSize:10,padding:"6px 14px",
                    border:`1px solid ${V.bd}`,borderRadius:99,cursor:"pointer",
                    background:"transparent",color:V.mu,fontFamily:"'Jost',sans-serif",
                    letterSpacing:".05em",transition:"all 0.2s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>Apply position</button>
                )}
              </div>

              {/* Size slider */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={sb}>Logo size</div>
                  <span style={{fontSize:11,color:V.tx,fontWeight:600,fontFamily:"'Jost',sans-serif"}}>{logoSize}%</span>
                </div>
                <input type="range" min={10} max={100} step={5} value={logoSize}
                  onChange={e=>{setLogoSize(+e.target.value);if(logoObjRef.current){logoObjRef.current.scaleToWidth(Math.round(+e.target.value*(1024/100)));fcRef.current?.renderAll();syncTexture();}}}
                  style={{width:"100%",height:4,background:V.bd2,borderRadius:2,outline:"none",WebkitAppearance:"none",appearance:"none",accentColor:V.ac}}/>
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                {!isQuickMode && (
                  <button onClick={()=>setStep(2)} style={{
                    flex:1,padding:"10px 0",borderRadius:99,
                    border:`1px solid ${V.bd}`,background:"transparent",
                    color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>← Back</button>
                )}
                <button onClick={()=>setStep(4)} style={{
                  flex:2,padding:"10px 0",borderRadius:99,border:"none",
                  background:V.tx,color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                  transition:"all 0.3s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
                onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>Next: Size →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Size ─────────────────────────────────────────────── */}
          {step===4&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sb}>Choose your size</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
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
                    }}>
                      {s}
                    </button>
                  ))}
                </div>

                {/* Custom measurements */}
                <details style={{marginBottom:12}}>
                  <summary style={{
                    fontSize:10,color:V.mu,cursor:"pointer",marginBottom:6,
                    fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",fontWeight:500,
                  }}>Custom measurements (optional)</summary>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                    {(["chest","shoulder","length","sleeve"] as const).map(key=>(
                      <div key={key}>
                        <label style={{
                          fontSize:9,color:V.mu,display:"block",marginBottom:4,
                          textTransform:"capitalize",letterSpacing:".08em",fontWeight:500,
                        }}>{key}</label>
                        <input value={customMeasurements[key]} onChange={e=>setCustomMeasurements(p=>({...p,[key]:e.target.value}))}
                          placeholder={'e.g. 38"'}
                          style={{
                            width:"100%",padding:"7px 10px",
                            background:V.sf2,border:`1.5px solid ${V.bd}`,
                            borderRadius:8,color:V.tx,fontSize:11,
                            fontFamily:"'Jost',sans-serif",outline:"none",boxSizing:"border-box",
                            transition:"border-color 0.2s",
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
                      display:"flex",alignItems:"center",justifyContent:"center",
                      transition:"all 0.2s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;}}>−</button>
                    <span style={{fontSize:16,fontWeight:600,minWidth:28,textAlign:"center",fontFamily:"'Jost',sans-serif"}}>{qty}</span>
                    <button onClick={()=>setQty(q=>q+1)} style={{
                      width:32,height:32,background:"transparent",
                      border:`1.5px solid ${V.bd}`,borderRadius:8,
                      color:V.tx,fontSize:16,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      transition:"all 0.2s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;}}>+</button>
                  </div>
                </div>
              </div>

              {/* Design summary */}
              <div style={{
                background:V.sf,border:`1px solid ${V.bd}`,borderRadius:12,
                padding:"14px 14px 10px",
                boxShadow:"0 2px 16px rgba(26,26,24,0.05)",
              }}>
                <div style={{
                  fontFamily:"'Cormorant Garamond',serif",
                  fontSize:16,fontWeight:500,color:V.tx,
                  letterSpacing:".02em",marginBottom:10,
                }}>Your Design</div>
                {[
                  ["Garment",   isTypeMode ? `${garmentType.charAt(0).toUpperCase()+garmentType.slice(1)} T-Shirt` : product!.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")],
                  ["Style",     activeKashaDesign?`${activeKashaDesign.id} — ${activeKashaDesign.label}`:activePrintId?PATTERNS.find(p=>p.id===activePrintId)?.label||"—":primaryColor],
                  ["Size",      size],
                  ["Qty",       String(qty)],
                  ...(!isTypeMode ? [["Price", formatPrice(product!.priceInPaise)]] : []),
                ].map(([label,val])=>(
                  <div key={label} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 0",borderBottom:`1px solid rgba(26,26,24,0.06)`,
                  }}>
                    <span style={{fontSize:9,color:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".1em",textTransform:"uppercase",fontWeight:500}}>{label}</span>
                    <span style={{fontSize:11,color:V.tx,fontWeight:500,maxWidth:180,textAlign:"right",wordBreak:"break-all",fontFamily:"'Jost',sans-serif"}}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(3)} style={{
                  flex:1,padding:"10px 0",borderRadius:99,
                  border:`1px solid ${V.bd}`,background:"transparent",
                  color:V.mu,fontSize:10,fontWeight:500,cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                  transition:"all 0.2s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>← Back</button>
                {isTypeMode ? (
                  <Link href="/products" style={{
                    flex:2,padding:"10px 0",borderRadius:99,
                    border:`1.5px solid ${V.ac}`,
                    background:V.aclt,color:V.tx,
                    fontSize:10,fontWeight:600,cursor:"pointer",
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
                    flex:2,padding:"10px 0",borderRadius:99,border:"none",
                    background:V.tx,color:"white",
                    fontSize:10,fontWeight:600,cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                    opacity:cartMut.isPending?.6:1,transition:"all 0.3s",
                  }}
                  onMouseEnter={e=>{if(!cartMut.isPending){e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}}
                  onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="white";}}>
                    {cartMut.isPending?"Adding…":"Add to Cart"}
                  </button>
                )}
              </div>
              {!isTypeMode && (
                <Show when="signed-in">
                  <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending} style={{
                    padding:"10px 0",borderRadius:99,
                    border:`1.5px solid rgba(201,168,76,0.4)`,
                    background:"transparent",
                    color:V.tx,fontSize:10,fontWeight:500,cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",
                    opacity:saveMut.isPending?.6:1,transition:"all 0.3s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background=V.aclt;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.4)";e.currentTarget.style.background="transparent";}}>
                    {saveMut.isPending?"Saving…":"✦ Save this design"}
                  </button>
                </Show>
              )}
            </div>
          )}
        </div>

        {/* CENTER: 3D Viewer ──────────────────────────────────────────────── */}
        <div style={{
          flex:1,position:"relative",
          background:"radial-gradient(ellipse at 60% 40%, #f0ede6 0%, #e6e1d8 60%, #dbd5c8 100%)",
          display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
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

          {/* Product / type badge */}
          <div style={{
            position:"absolute",top:16,left:16,
            background:"rgba(250,250,247,0.92)",
            border:`1px solid rgba(201,168,76,0.2)`,
            borderRadius:10,padding:"10px 14px",
            backdropFilter:"blur(12px)",
            boxShadow:"0 2px 16px rgba(26,26,24,0.08)",
          }}>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:14,fontWeight:600,color:V.tx,letterSpacing:".02em",
            }}>
              {isTypeMode
                ? `${garmentType.charAt(0).toUpperCase()+garmentType.slice(1)} T-Shirt`
                : product!.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")}
            </div>
            {!isTypeMode && (
              <div style={{fontSize:11,color:V.ac,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",marginTop:2}}>{formatPrice(product!.priceInPaise)}</div>
            )}
            {isTypeMode && (
              <div style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",marginTop:2,fontStyle:"italic"}}>Design concept</div>
            )}
          </div>

          {/* Active design badge */}
          {(activeKashaDesign||activePrintId)&&(
            <div style={{
              position:"absolute",top:16,right:16,
              background:"rgba(250,250,247,0.92)",
              border:`1px solid rgba(201,168,76,0.25)`,
              borderRadius:10,padding:"8px 12px",
              backdropFilter:"blur(12px)",
              boxShadow:"0 2px 16px rgba(26,26,24,0.08)",
            }}>
              <div style={{fontSize:8,color:V.mu,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",marginBottom:2}}>Active Design</div>
              <div style={{fontSize:12,fontWeight:600,color:V.ac,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>
                {activeKashaDesign?`${activeKashaDesign.id} · ${activeKashaDesign.label}`:PATTERNS.find(p=>p.id===activePrintId)?.label}
              </div>
            </div>
          )}

          {/* Watermark */}
          <div style={{
            position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
            fontFamily:"'Cormorant Garamond', serif",
            fontSize:10,letterSpacing:".2em",
            color:"rgba(26,26,24,0.2)",textTransform:"uppercase",
            pointerEvents:"none",whiteSpace:"nowrap",
          }}>
            Drag to rotate · Scroll to zoom
          </div>
        </div>
      </div>

      {/* Always-mounted invisible Fabric canvas (keeps texture pipeline live on all steps) */}
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
