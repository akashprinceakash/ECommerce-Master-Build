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
import { useParams, Link, useLocation } from "wouter";
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
  bg:   "#fafaf7",
  sf:   "#ffffff",
  sf2:  "#f4f4f0",
  bd:   "#e2e2dc",
  bd2:  "#ccccc6",
  tx:   "#1a1a18",
  mu:   "#8a8a84",
  ac:   "#2d6a4f",
  aclt: "#e8f5ee",
  gold: "#B8925A",
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


  // ── Wizard step (1–4) ────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

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
  const sb: React.CSSProperties = { fontSize:"10px",letterSpacing:".1em",textTransform:"uppercase",color:V.mu,fontWeight:600,marginBottom:"8px" };
  const swatch=(hex:string, selected:boolean, onClick:()=>void, title?:string)=>(
    <button key={hex} onClick={onClick} title={title||hex} style={{
      width:28,height:28,borderRadius:"50%",cursor:"pointer",padding:0,flexShrink:0,
      background:hex==="transparent"?"none":hex,
      border:selected?`2.5px solid ${V.ac}`:`1px solid ${V.bd}`,
      outline:selected?`1px solid ${V.ac}`:undefined,
      outlineOffset:selected?"2px":undefined,
      boxShadow:`inset 0 0 0 1px rgba(0,0,0,.10)`,
    }}/>
  );

  // ── Step indicator ───────────────────────────────────────────────────────
  const STEP_LABELS=["Style","Parts","Logo","Size"];
  const stepIndicator=(
    <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20,flexShrink:0,borderBottom:`1px solid ${V.bd}`,paddingBottom:16}}>
      {STEP_LABELS.map((label,i)=>{
        const n=i+1; const active=step===n; const done=step>n;
        return(<React.Fragment key={n}>
          {i>0&&<div style={{flex:1,height:"1px",background:done?V.ac:V.bd,minWidth:10}}/>}
          <div onClick={()=>setStep(n)} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:active?V.tx:done?V.mu:V.bd2,cursor:"pointer",padding:"5px 7px",borderRadius:8,background:active?V.aclt:"transparent",transition:"all .2s"}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:active?V.ac:done?V.aclt:V.sf,color:active?V.sf:done?V.ac:V.mu,border:`1.5px solid ${active?V.ac:done?V.ac:V.bd}`,flexShrink:0}}>{done?"✓":n}</div>
            <span style={{fontWeight:active?600:400,fontSize:11}}>{label}</span>
          </div>
        </React.Fragment>);
      })}
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:V.bg}}>
      <div style={{width:32,height:32,border:`2px solid ${V.bd2}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite"}}/>
    </div>
  );
  if (!product) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:V.bg,color:V.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>

      {/* HEADER */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:52,borderBottom:`1px solid ${V.bd}`,background:V.sf,flexShrink:0,zIndex:50,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Link href={`/products/${id}`} style={{color:V.mu,fontSize:13,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>← Back</Link>
          <div style={{width:1,height:16,background:V.bd}}/>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:V.ac,letterSpacing:".04em",fontWeight:600}}>Golf Studio · 3D Customizer</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input value={designName} onChange={e=>setDesignName(e.target.value)} placeholder="Name your design…"
            style={{padding:"6px 10px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:8,color:V.tx,fontSize:12,outline:"none",width:160}}/>
          <Show when="signed-in">
            <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
              style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${V.bd}`,background:V.sf,color:V.tx,fontSize:12,fontWeight:500,cursor:"pointer",opacity:saveMut.isPending?.6:1}}>
              {saveMut.isPending?"Saving…":"Save"}
            </button>
          </Show>
          <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending||saveMut.isPending}
            style={{padding:"6px 16px",borderRadius:8,border:"none",background:V.ac,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:cartMut.isPending?.6:1}}>
            {cartMut.isPending?"Adding…":"Add to Cart"}
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT PANEL: Wizard */}
        <div style={{width:520,minWidth:400,borderRight:`1px solid ${V.bd}`,overflowY:"auto",padding:"20px 22px",display:"flex",flexDirection:"column",background:V.bg,scrollbarWidth:"thin"}}>
          {stepIndicator}

          {/* ── STEP 1: Style ─────────────────────────────────────────────── */}
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={sb}>Choose base style</div>
                {/* Tab bar — hide Print for "pattern"; hide Pattern for "print" */}
                <div style={{display:"flex",border:`1px solid ${V.bd}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
                  {productType!=="pattern"&&<button onClick={()=>setStyleTab("solid")} style={{flex:1,padding:"7px 0",fontSize:11,fontFamily:"inherit",cursor:"pointer",border:"none",background:styleTab==="solid"?V.ac:"transparent",color:styleTab==="solid"?V.bg:V.mu,fontWeight:600,letterSpacing:".04em",textTransform:"uppercase"}}>Solid</button>}
                  {productType!=="pattern"&&<button onClick={()=>setStyleTab("print")} style={{flex:1,padding:"7px 0",fontSize:11,fontFamily:"inherit",cursor:"pointer",border:"none",background:styleTab==="print"?V.ac:"transparent",color:styleTab==="print"?V.bg:V.mu,fontWeight:600,letterSpacing:".04em",textTransform:"uppercase"}}>Print</button>}
                  {productType!=="print"&&<button onClick={()=>setStyleTab("pattern")} style={{flex:1,padding:"7px 0",fontSize:11,fontFamily:"inherit",cursor:"pointer",border:"none",background:styleTab==="pattern"?V.ac:"transparent",color:styleTab==="pattern"?V.bg:V.mu,fontWeight:600,letterSpacing:".04em",textTransform:"uppercase"}}>Pattern</button>}
                </div>

                {/* ── SOLID pane ── */}
                {styleTab==="solid"&&(
                  <div>
                    <div style={{...sb,marginBottom:6}}>Pick a colour</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                      {MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))}
                      <label title="Custom colour" style={{width:28,height:28,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",flexShrink:0,border:`1px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:V.mu}}>
                        +<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                      </label>
                    </div>
                    <p style={{fontSize:10,color:V.mu}}>Override individual parts in Step 2</p>
                  </div>
                )}

                {/* ── PRINT pane ── */}
                {styleTab==="print"&&(
                  <div>
                    <div style={{...sb,marginBottom:6}}>Print library</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:10}}>
                      {PATTERNS.filter(p=>p.id!=="kasha-gt015").map(p=>{
                        const sel=activePrintId===p.id;
                        const allApplied=allOverPrintId===p.id;
                        const inZone=Object.values(zonePrintIds).includes(p.id);
                        return(
                          <button key={p.id} onClick={()=>setActivePrintId(p.id)} title={p.label}
                            style={{position:"relative",padding:0,aspectRatio:"1/1",borderRadius:8,overflow:"hidden",cursor:"pointer",
                              background:`url(${patternUrl(p.file)}) center/cover`,
                              border:sel?`2px solid ${V.ac}`:`1px solid ${V.bd}`,
                              boxShadow:sel?`0 0 0 2px rgba(45,106,79,.18)`:"none"}}>
                            {allApplied&&<span style={{position:"absolute",top:2,right:2,fontSize:7,fontWeight:800,background:V.ac,color:"#fff",padding:"1px 3px",borderRadius:3}}>ALL</span>}
                            {!allApplied&&inZone&&<span style={{position:"absolute",top:2,right:2,fontSize:7,fontWeight:800,background:V.ac,color:"#fff",padding:"1px 3px",borderRadius:3}}>ZONE</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected print actions */}
                    {activePrintId&&(()=>{
                      const p=PATTERNS.find(x=>x.id===activePrintId); if(!p) return null;
                      return(
                        <div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:8,padding:10,display:"flex",flexDirection:"column",gap:8}}>
                          {/* Print name + swatch */}
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:32,height:32,borderRadius:5,background:`url(${patternUrl(p.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                            <div style={{fontSize:11,fontWeight:600,color:V.tx}}>{p.label}</div>
                          </div>

                          {/* Mode toggle: Full Body / By Part */}
                          {productType!=="print"&&(
                            <div style={{display:"flex",gap:4}}>
                              {(["fullBody","parts"] as const).map(m=>(
                                <button key={m} onClick={()=>setPrintMode(m)}
                                  style={{flex:1,padding:"6px 0",fontSize:10,fontWeight:700,cursor:"pointer",
                                    borderRadius:7,fontFamily:"inherit",letterSpacing:".03em",
                                    border:printMode===m?`1.5px solid ${V.ac}`:`1px solid ${V.bd}`,
                                    background:printMode===m?V.aclt:V.sf,
                                    color:printMode===m?V.ac:V.mu,transition:"all .15s"}}>
                                  {m==="fullBody"?"Full Body":"By Part"}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Full Body mode */}
                          {(productType==="print"||printMode==="fullBody")&&(
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              <button onClick={()=>applyAllOverPrint(p)}
                                style={{padding:"7px 0",borderRadius:8,border:"none",background:V.ac,color:V.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                {allOverPrintId===p.id?(productType==="print"?"✓ Selected":"✓ Applied All-Over"):(productType==="print"?"Select this Print":"Apply to whole T-shirt")}
                              </button>
                              {allOverPrintId&&productType!=="print"&&(
                                <button onClick={clearAllOverPrint}
                                  style={{padding:"5px 0",borderRadius:7,border:`1px solid rgba(196,92,92,.4)`,background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                                  ✕ Remove full-body print
                                </button>
                              )}
                            </div>
                          )}

                          {/* By Part mode */}
                          {productType!=="print"&&printMode==="parts"&&(()=>{
                            const zones: {id:Exclude<PatternZone,"all">;label:string}[]=[
                              {id:"front",label:"Front"},{id:"back",label:"Back"},
                              {id:"collar",label:"Collar"},{id:"leftSleeve",label:"L.Sleeve"},{id:"rightSleeve",label:"R.Sleeve"},
                            ];
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                <div style={{fontSize:10,color:V.mu,marginBottom:2}}>Click a part to apply / remove:</div>
                                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                  {zones.map(z=>{
                                    const applied=zonePrintIds[z.id]===p.id;
                                    const otherPrint=zonePrintIds[z.id]&&zonePrintIds[z.id]!==p.id;
                                    return(
                                      <button key={z.id}
                                        onClick={()=>applied?clearZonePrint(z.id):applyZonePrint(z.id,p)}
                                        title={otherPrint?`Currently: ${PATTERNS.find(x=>x.id===zonePrintIds[z.id])?.label}`:""}
                                        style={{padding:"5px 10px",fontSize:10,fontWeight:applied?700:500,cursor:"pointer",
                                          borderRadius:16,fontFamily:"inherit",letterSpacing:".03em",
                                          border:applied?`1.5px solid ${V.ac}`:otherPrint?`1px solid ${V.ac}`:`1px solid ${V.bd}`,
                                          background:applied?V.aclt:otherPrint?"rgba(45,106,79,.07)":V.sf,
                                          color:applied?V.ac:otherPrint?V.ac:V.mu,transition:"all .15s"}}>
                                        {applied?"✓ ":""}{z.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {Object.values(zonePrintIds).some(Boolean)&&(
                                  <button onClick={clearAllZonePrints}
                                    style={{padding:"5px 0",borderRadius:7,border:`1px solid rgba(196,92,92,.4)`,background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:600,cursor:"pointer",marginTop:2}}>
                                    ✕ Clear all zone prints
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                    {productType==="print"&&<p style={{fontSize:10,color:V.mu,marginTop:6,lineHeight:1.5}}>This is a pre-printed garment. Select a print above — colour changes are not available for this product.</p>}
                  </div>
                )}

                {/* ── PATTERN pane (KA.SHA Bespoke Designs KD001–KD005) ── */}
                {styleTab==="pattern"&&(
                  <div>
                    <div style={{...sb,marginBottom:8}}>KA.SHA Bespoke Designs</div>

                    {/* 5-card design grid */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:10}}>
                      {KASHA_DESIGNS.map(d=>{
                        const isA=activeKashaDesign?.id===d.id;
                        const zones=Object.keys(d.zones).length;
                        return(
                          <button key={d.id} onClick={()=>handleSelectKashaDesign(d)}
                            title={d.label}
                            style={{padding:"10px 8px 8px",borderRadius:8,
                              border:isA?`2px solid ${V.ac}`:`1px solid ${V.bd}`,
                              background:isA?V.aclt:V.sf,
                              cursor:"pointer",display:"flex",flexDirection:"column",
                              alignItems:"center",gap:5,fontFamily:"inherit",
                              transition:"all .15s",position:"relative"}}>
                            {isA&&(
                              <div style={{position:"absolute",top:5,right:7,width:8,height:8,borderRadius:"50%",background:V.ac}}/>
                            )}
                            {/* Zone texture strip using front zone preview */}
                            <div style={{width:"100%",height:44,borderRadius:5,overflow:"hidden",background:V.sf2,
                              border:`1px solid ${V.bd}`,flexShrink:0}}>
                              {d.zones.front&&(
                                <img src={d.zones.front} alt={d.label}
                                  style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                              )}
                            </div>
                            <span style={{fontSize:9,color:isA?V.ac:V.tx,fontWeight:700,letterSpacing:".04em"}}>{d.id}</span>
                            <span style={{fontSize:8,color:V.mu,opacity:.85,textAlign:"center",lineHeight:1.3}}>{zones} zone{zones!==1?"s":""}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active design info + clear */}
                    {activeKashaDesign&&(
                      <div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:8,padding:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:V.tx}}>{activeKashaDesign.id}</div>
                          <div style={{fontSize:9,color:V.mu}}>{activeKashaDesign.label}</div>
                        </div>
                        <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);}}
                          style={{fontSize:9,color:V.mu,background:"transparent",border:`1px solid ${V.bd}`,borderRadius:4,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                          Clear
                        </button>
                      </div>
                    )}

                    {!activeKashaDesign&&(
                      <p style={{fontSize:10,color:V.mu,marginTop:2}}>Select a bespoke design above to apply it to the garment.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sleeve length toggle (fabric & pattern only) */}
              {productType!=="print"&&(
                <div>
                  <div style={sb}>Sleeve length</div>
                  <div style={{display:"flex",gap:6}}>
                    {(["half","full"] as const).map(v=>(
                      <button key={v} onClick={()=>setSleeveLength(v)} style={{flex:1,padding:"8px 0",fontSize:11,fontFamily:"inherit",cursor:"pointer",borderRadius:8,border:`1px solid ${sleeveLength===v?V.ac:V.bd}`,background:sleeveLength===v?V.aclt:V.sf,color:sleeveLength===v?V.ac:V.mu,fontWeight:sleeveLength===v?600:400,transition:"all .15s"}}>
                        {v.charAt(0).toUpperCase()+v.slice(1)} sleeve
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={()=>setStep(2)} style={{marginTop:4,padding:"10px 0",borderRadius:10,border:"none",background:V.ac,color:V.bg,fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:".04em"}}>
                Next: Customise parts →
              </button>
            </div>
          )}

          {/* ── STEP 2: Parts ─────────────────────────────────────────────── */}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={sb}>Customise individual parts</div>
                <p style={{fontSize:10,color:V.mu,marginBottom:10,lineHeight:1.5}}>Select a part, then choose a colour. These override the base style per zone.</p>

                {/* Quick apply */}
                <button onClick={()=>{if(zoneColors[activePartZone])PART_ZONES.forEach(z=>applyZoneColor(z.id,zoneColors[activePartZone]));}}
                  style={{fontSize:11,padding:"5px 10px",border:`1px solid ${V.bd}`,borderRadius:8,cursor:"pointer",background:"transparent",color:V.mu,marginBottom:10,fontFamily:"inherit"}}>
                  Apply colour to all parts
                </button>

                {/* Part rows */}
                {PART_ZONES.map(z=>{
                  const active=activePartZone===z.id; const col=zoneColors[z.id];
                  return(
                    <div key={z.id} onClick={()=>setActivePartZone(z.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:`1px solid ${active?V.ac:V.bd}`,background:active?V.aclt:V.sf,cursor:"pointer",marginBottom:5,transition:"all .15s"}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:col||primaryColor,border:`1px solid ${V.bd2}`,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:12,fontWeight:active?600:400}}>{z.label}</span>
                      <span style={{fontSize:10,color:V.mu,padding:"2px 8px",border:`1px solid ${V.bd}`,borderRadius:10}}>{col?col.toUpperCase():"Base"}</span>
                    </div>
                  );
                })}

                {/* Colour picker for active zone */}
                <div style={{marginTop:10,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:8,padding:10}}>
                  <div style={{fontSize:11,color:V.mu,marginBottom:7}}>Colour for <strong style={{color:V.tx}}>{PART_ZONES.find(z=>z.id===activePartZone)?.label}</strong></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                    {MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[activePartZone]===hex,()=>applyZoneColor(activePartZone,hex)))}
                    <label title="Custom" style={{width:28,height:28,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:V.mu,flexShrink:0}}>
                      +<input type="color" value={zoneColors[activePartZone]||primaryColor} onChange={e=>applyZoneColor(activePartZone,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                    </label>
                  </div>
                  {zoneColors[activePartZone]&&(
                    <button onClick={()=>applyZoneColor(activePartZone,"")} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0}}>✕ Clear zone colour</button>
                  )}
                </div>
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{flex:2,padding:"9px 0",borderRadius:10,border:"none",background:V.ac,color:V.bg,fontSize:12,fontWeight:700,cursor:"pointer"}}>Next: Add logo →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Logo ───────────────────────────────────────────────── */}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={sb}>Upload your logo <span style={{opacity:.6,fontWeight:400,letterSpacing:0,textTransform:"none"}}>(optional)</span></div>
                <label style={{display:"block",border:`1.5px dashed ${V.bd2}`,borderRadius:10,padding:16,textAlign:"center",cursor:"pointer",transition:"all .15s",marginBottom:10}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=V.ac)} onMouseLeave={e=>(e.currentTarget.style.borderColor=V.bd2)}>
                  <div style={{fontSize:20,marginBottom:4}}>⬆</div>
                  <div style={{fontSize:11,color:V.mu}}><strong style={{color:V.ac}}>Click to upload</strong></div>
                  <div style={{fontSize:10,color:V.mu,marginTop:2}}>PNG, SVG, JPG · transparent bg recommended</div>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{display:"none"}}/>
                </label>
                {logoPreview&&(
                  <div style={{marginBottom:10}}>
                    <div style={{width:"100%",aspectRatio:"2",background:V.sf,border:`1px solid ${V.bd}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative",marginBottom:6}}>
                      <img src={logoPreview} alt="Logo" style={{maxWidth:"80%",maxHeight:"80%",objectFit:"contain"}}/>
                    </div>
                    <button onClick={removeLogo} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0}}>✕ Remove logo</button>
                  </div>
                )}
              </div>

              {/* 9-point position grid */}
              <div>
                <div style={sb}>Logo position</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,maxWidth:120,marginBottom:10}}>
                  {POS_GRID.flat().map(pos=>(
                    <button key={pos} onClick={()=>setLogoPosition(pos)} style={{aspectRatio:"1",borderRadius:6,border:`1px solid ${logoPosition===pos?V.ac:V.bd}`,background:logoPosition===pos?V.aclt:V.sf,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:logoPosition===pos?V.ac:V.mu}}>
                      {pos==="center"?"◉":pos.includes("top-left")?"↖":pos.includes("top-center")?"↑":pos.includes("top-right")?"↗":pos.includes("mid-left")?"←":pos.includes("mid-right")?"→":pos.includes("bottom-left")?"↙":pos.includes("bottom-center")?"↓":"↘"}
                    </button>
                  ))}
                </div>
                {logoPreview&&<button onClick={repositionLogo} style={{fontSize:11,padding:"6px 12px",border:`1px solid ${V.bd}`,borderRadius:8,cursor:"pointer",background:V.sf,color:V.mu,fontFamily:"inherit"}}>Apply position</button>}
              </div>

              {/* Size slider */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:V.mu,marginBottom:6}}>
                  <span style={sb}>Logo size</span><span style={{color:V.tx,fontWeight:600}}>{logoSize}%</span>
                </div>
                <input type="range" min={10} max={100} step={5} value={logoSize}
                  onChange={e=>{setLogoSize(+e.target.value);if(logoObjRef.current){logoObjRef.current.scaleToWidth(Math.round(+e.target.value*(1024/100)));fcRef.current?.renderAll();syncTexture();}}}
                  style={{width:"100%",height:3,background:V.bd2,borderRadius:2,outline:"none",WebkitAppearance:"none",appearance:"none"}}/>
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(2)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
                <button onClick={()=>setStep(4)} style={{flex:2,padding:"9px 0",borderRadius:10,border:"none",background:V.ac,color:V.bg,fontSize:12,fontWeight:700,cursor:"pointer"}}>Next: Size →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Size ───────────────────────────────────────────────── */}
          {step===4&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={sb}>Choose your size</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {SIZES.map(s=>(
                    <button key={s} onClick={()=>setSize(s)} style={{width:44,height:44,border:`1px solid ${size===s?V.ac:V.bd}`,borderRadius:9,fontSize:13,cursor:"pointer",background:size===s?V.ac:"transparent",color:size===s?V.bg:V.mu,fontFamily:"inherit",fontWeight:600}}>
                      {s}
                    </button>
                  ))}
                </div>

                {/* Custom measurements */}
                <details style={{marginBottom:10}}>
                  <summary style={{fontSize:11,color:V.mu,cursor:"pointer",marginBottom:6}}>Custom measurements (optional)</summary>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                    {(["chest","shoulder","length","sleeve"] as const).map(key=>(
                      <div key={key}>
                        <label style={{fontSize:10,color:V.mu,display:"block",marginBottom:3,textTransform:"capitalize"}}>{key}</label>
                        <input value={customMeasurements[key]} onChange={e=>setCustomMeasurements(p=>({...p,[key]:e.target.value}))}
                          placeholder={'e.g. 38"'}
                          style={{width:"100%",padding:"6px 8px",background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:7,color:V.tx,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Quantity */}
                <div>
                  <div style={sb}>Quantity</div>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:28,height:28,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:6,color:V.tx,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>−</button>
                    <span style={{fontSize:15,fontWeight:600,minWidth:24,textAlign:"center"}}>{qty}</span>
                    <button onClick={()=>setQty(q=>q+1)} style={{width:28,height:28,background:V.sf,border:`1px solid ${V.bd}`,borderRadius:6,color:V.tx,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>+</button>
                  </div>
                </div>
              </div>

              {/* Design summary */}
              <div style={{background:V.sf,border:`1px solid ${V.bd}`,borderRadius:9,padding:10}}>
                <div style={sb}>Your design</div>
                {[
                  ["Product",   product.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")],
                  ["Style",     activeKashaDesign?`${activeKashaDesign.id} — ${activeKashaDesign.label}`:activePrintId?PATTERNS.find(p=>p.id===activePrintId)?.label||"—":primaryColor],
                  ["Size",      size],
                  ["Qty",       String(qty)],
                  ["Price",     formatPrice(product.priceInPaise)],
                ].map(([label,val])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${V.bd}`}}>
                    <span style={{fontSize:10,color:V.mu}}>{label}</span>
                    <span style={{fontSize:10,color:V.tx,fontWeight:500,maxWidth:160,textAlign:"right",wordBreak:"break-all"}}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",gap:6,marginTop:4}}>
                <button onClick={()=>setStep(3)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
                <button onClick={()=>cartMut.mutate()} disabled={cartMut.isPending} style={{flex:2,padding:"9px 0",borderRadius:10,border:"none",background:"#2d6a4f",color:"white",fontSize:12,fontWeight:700,cursor:"pointer",opacity:cartMut.isPending?.6:1}}>
                  {cartMut.isPending?"Adding…":"🛒 Add to Cart"}
                </button>
              </div>
              <Show when="signed-in">
                <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending} style={{padding:"8px 0",borderRadius:10,border:"none",background:V.ac,color:V.bg,fontSize:12,fontWeight:700,cursor:"pointer",opacity:saveMut.isPending?.6:1}}>
                  {saveMut.isPending?"Saving…":"💾 Save this design"}
                </button>
              </Show>
            </div>
          )}
        </div>

        {/* CENTER: 3D Viewer */}
        <div style={{flex:1,position:"relative",background:"radial-gradient(ellipse at center,#e8ede9 0%,#d4ddd5 100%)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          {/* Loading overlay — driven by React state, not DOM mutation */}
          {!modelDisplayed&&webglAvailable&&product.modelUrl&&(
            <div style={{position:"absolute",inset:0,background:V.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,zIndex:10,transition:"opacity .4s"}}>
              <div style={{width:36,height:36,border:`2px solid ${V.bd}`,borderTopColor:V.ac,borderRadius:"50%",animation:"spin .9s linear infinite"}}/>
              <p style={{fontSize:12,color:V.mu,letterSpacing:".04em"}}>Loading 3D preview…</p>
            </div>
          )}

          {mvReady&&product.modelUrl&&webglAvailable&&(
            <model-viewer ref={mvRef} src={toProxiedUrl(product.modelUrl)}
              camera-controls auto-rotate rotation-per-second="8deg"
              shadow-intensity="1" environment-image="neutral" exposure="1.0"
              camera-orbit="0deg 75deg 2.5m" min-camera-orbit="auto auto 1.5m" max-camera-orbit="auto auto 5m"
              interaction-prompt="none"
              style={{width:"100%",height:"100%","--poster-color":"transparent",opacity:modelDisplayed?1:0,transition:"opacity .4s"} as any}/>
          )}

          {(!product.modelUrl||!webglAvailable)&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,color:V.mu,padding:24,maxWidth:320,textAlign:"center"}}>
              {product.thumbnailUrl
                ? <img src={product.thumbnailUrl} alt={product.name} style={{maxHeight:360,objectFit:"contain",borderRadius:12,opacity:.9}}/>
                : <div style={{fontSize:64,opacity:.15}}>👕</div>}
              <p style={{fontSize:11,lineHeight:1.6}}>
                {!webglAvailable?"3D preview requires WebGL. Your design is still applied correctly.":"No 3D model uploaded for this product."}
              </p>
            </div>
          )}

          {/* Product badge */}
          <div style={{position:"absolute",top:14,left:14,background:"rgba(255,255,255,.90)",border:`1px solid ${V.bd}`,borderRadius:9,padding:"8px 12px",backdropFilter:"blur(8px)",boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{fontSize:11,fontWeight:700,color:V.ac}}>{product.name.replace(/\s*\[gt:GT\d+\]\s*$/,"")}</div>
            <div style={{fontSize:10,color:V.mu}}>{formatPrice(product.priceInPaise)}</div>
          </div>

          {/* Active design badge */}
          {(activeKashaDesign||activePrintId)&&(
            <div style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.90)",border:`1px solid ${V.bd}`,borderRadius:9,padding:"6px 10px",backdropFilter:"blur(8px)",boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
              <div style={{fontSize:9,color:V.mu,letterSpacing:".08em",textTransform:"uppercase"}}>Active Design</div>
              <div style={{fontSize:11,fontWeight:600,color:V.ac}}>
                {activeKashaDesign?`${activeKashaDesign.id} · ${activeKashaDesign.label}`:PATTERNS.find(p=>p.id===activePrintId)?.label}
              </div>
            </div>
          )}

          <div style={{position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",fontSize:10,color:"rgba(0,0,0,.4)",background:"rgba(255,255,255,.7)",padding:"4px 12px",borderRadius:20,pointerEvents:"none",letterSpacing:".04em",backdropFilter:"blur(4px)"}}>
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
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${V.bd2};border-radius:2px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;background:${V.ac};border-radius:50%;cursor:pointer;border:2px solid #fff}
        input[type=range]{-webkit-appearance:none;appearance:none}
      `}</style>
    </div>
  );
}
