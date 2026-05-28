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
  KASHA_DESIGNS, applyKashaDesign, applyKashaDesignWithPrint, clearKashaDesign, SKU_KASHA_DESIGN_MAP,
  type KashaDesignDef, type RecolorOptions,
} from "@/components/3d/kasha-designs";
import { parseSku } from "@/components/3d/sku-config";

// ── Pattern colour recolor constants ─────────────────────────────────────────
const PAT_COLOR_A_DEFAULT = "#000000";   // Channel A source (dark / black)
const PAT_COLOR_B_DEFAULT = "#F0CED2";   // Channel B source (light / pink)

const PATTERN_PRESETS: { name: string; a: string; b: string }[] = [
  { name: "Original",  a: "#000000", b: "#F0CED2" },
  { name: "Ocean",     a: "#001a33", b: "#b8eeff" },
  { name: "Ember",     a: "#2e0a0a", b: "#ffd090" },
  { name: "Forest",    a: "#0d2b0d", b: "#c8f0a0" },
  { name: "Dusk",      a: "#1a0a2e", b: "#f0c8e8" },
  { name: "Slate",     a: "#1a1a2e", b: "#d0e8ff" },
  { name: "Cinder",    a: "#1a1a1a", b: "#f0f0d8" },
  { name: "Reef",      a: "#003333", b: "#c0f0ee" },
  { name: "Bordeaux",  a: "#2a0a18", b: "#ffc8c8" },
  { name: "Copper",    a: "#2d1b00", b: "#ffd8a0" },
  { name: "Midnight",  a: "#000814", b: "#e8e0ff" },
  { name: "Moss",      a: "#1c1c00", b: "#d8f0b0" },
];
const DARK_SWATCHES  = ["#000000","#1a1a2e","#2d1b00","#0d2b0d","#1a0a2e","#2e0a0a","#1a1a1a","#003333","#1c1c00","#2a0a18","#001a33","#ffffff"];
const LIGHT_SWATCHES = ["#F0CED2","#ffffff","#d0e8ff","#b8f0c8","#fff0cc","#e8d0f8","#ffd0d0","#c0f0ee","#ffe8b0","#ffc8e8","#c8e0a0","#d8c8f8"];
const RANDOM_DARK_PAT  = ["#000000","#1a1a2e","#2d1b00","#0d2b0d","#1a0a2e","#2e0a0a","#1a1a1a","#003333","#1c1c00","#2a0a18","#001a33","#000814"];
const RANDOM_LIGHT_PAT = ["#F0CED2","#ffffff","#d0e8ff","#b8f0c8","#fff0cc","#e8d0f8","#ffd0d0","#c0f0ee","#ffe8b0","#f0f0a0","#ffc8e8","#c8e0a0","#d8c8f8","#ffd8a0"];

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
// UV positions derived from ZONE_PRESETS (1024×1024 texture space):
//   front:       { left:10, top:341, w:490, h:678 }
//   back:        { left:524, top:188, w:483, h:833 }
//   leftSleeve:  { left:210, top:4,   w:398, h:170 }
//   rightSleeve: { left:617, top:2,   w:398, h:171 }
const LOGO_POSITIONS: Record<string, { left:number; top:number }> = {
  "front-left":    { left: 147, top: 490 },  // left chest zone
  "front-right":   { left: 363, top: 490 },  // right chest zone
  "back-center":   { left: 765, top: 604 },  // centre across back
  "left-sleeve":   { left: 816, top: 120 },  // rightSleeve UV zone → appears on left sleeve (UV is horizontally mirrored)
  "right-sleeve":  { left: 409, top: 120 },  // leftSleeve UV zone → appears on right sleeve (UV is horizontally mirrored)
  "collar-edge":   { left: 265, top: 240 },  // collar UV zone center: { left:12, top:183, w:507, h:166 }
  "collar-left":   { left: 140, top: 240 },  // left side of collar band
  "collar-right":  { left: 390, top: 240 },  // right side of collar band
};
// All UV zones are horizontally mirrored, so flipX:true corrects text/logos
// everywhere. The right-sleeve island is also vertically flipped, requiring
// an additional flipY:true (handled by placementFlipY).
function placementFlipX(placement: string): boolean {
  // The right-sleeve UV island is NOT horizontally mirrored like the rest of the body,
  // so flipX must stay false — the vertical flip (flipY) alone corrects the orientation.
  return placement !== "right-sleeve";
}
// The right-sleeve UV island is also flipped vertically relative to the left sleeve,
// so text/logos placed there need flipY:true as well to appear right-side up.
function placementFlipY(placement: string): boolean {
  return placement === "right-sleeve";
}
// Which 3-D view to jump to when a placement is selected
type CameraView = "front"|"back"|"right"|"left"|"collar-center"|"collar-left"|"collar-right";
const PLACEMENT_VIEW: Record<string, CameraView> = {
  "front-left":    "front",
  "front-right":   "front",
  "back-center":   "back",
  "left-sleeve":   "left",
  "right-sleeve":  "right",
  "collar-edge":   "collar-center",
  "collar-left":   "collar-left",
  "collar-right":  "collar-right",
};
const PLACEMENT_GROUPS = [
  { label:"FRONT",  items:[{key:"front-left",label:"Left"},{key:"front-right",label:"Right"},{key:"front-center",label:"Center"}] },
  { label:"BACK",   items:[{key:"back-top",label:"Top"},{key:"back-center",label:"Center"}] },
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
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j.error || j.message || text; } catch {}
    throw new Error(msg);
  }
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
    const base = getApiUrl();
    return `${base}/api/r2-proxy?url=${encodeURIComponent(url)}`;
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

  // ── Entry-modal URL params (?style=solid|print|pattern, ?design=KS100XB) ──
  // Set by CustomizeEntryModal when the user picks a product card — used to
  // pre-initialise userStyle + userChosenDesignId and skip Step 1 automatically.
  const _entryStyle = (new URLSearchParams(searchStr).get("style") ?? null) as "solid"|"print"|"pattern"|null;
  const _entryDesign = new URLSearchParams(searchStr).get("design");
  // Source of navigation: "modal" = came from CustomizeEntryModal, "product" = came from PDP
  const _fromSource = new URLSearchParams(searchStr).get("from") ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entryDesignRef = useRef(_entryDesign); // stable ref — captured once at mount

  // ── Wizard step (1–4) ────────────────────────────────────────────────────
  // Auto-advance to Step 2 when arriving via the entry modal (?style= present)
  const initialStep = isQuickMode ? 3 : (_entryStyle ? 2 : 1);
  const [step, setStep] = useState(() => initialStep);

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

  const { data: siteSettingsRaw } = useQuery<Record<string, unknown>>({
    queryKey: ["site-settings"],
    queryFn:  () => apiFetch("/api/site-settings"),
    staleTime: 60_000,
  });
  const hiddenPatternIds: string[] = Array.isArray(siteSettingsRaw?.hidden_patterns)
    ? (siteSettingsRaw!.hidden_patterns as string[])
    : [];
  const visiblePatterns = PATTERNS.filter(p => !hiddenPatternIds.includes(p.id));

  // In type-mode (arriving from home with ?type=), auto-load the first product of
  // that type so the 3D model shows even before the user selects a specific product.
  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["products-list"],
    queryFn:  () => apiFetch("/api/products"),
    enabled:  isTypeMode,
  });
  const defaultTypeProduct: Product | undefined = isTypeMode
    ? (() => {
        if (!allProducts) return undefined;
        if (garmentType === "pattern") {
          // Prefer KS1002B family (has 3D model); fall back to any pattern product
          return allProducts.find(p => p.sku?.startsWith("KS1002B"))
              ?? allProducts.find(p => p.subType === "pattern");
        }
        if (garmentType === "printed") {
          // Default to KS1000BGP004; fall back to any printed product
          return allProducts.find(p => p.sku === "KS1000BGP004")
              ?? allProducts.find(p => p.subType === "printed");
        }
        // solid: prefer subType="solid", otherwise first product
        return allProducts.find(p => p.subType === "solid")
            ?? allProducts.find(p => !p.subType)
            ?? allProducts[0];
      })()
    : undefined;
  // displayProduct: the product whose modelUrl/materials drive the 3D viewer
  const displayProduct = product ?? defaultTypeProduct;

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

  // ── SKU-driven flow state ─────────────────────────────────────────────────
  // What base type is this product?
  const skuProductType: "pattern" | "print" | "solid" =
    (productType === "pattern" || garmentType === "pattern") ? "pattern" :
    (productType === "print"   || garmentType === "printed") ? "print"   : "solid";
  // For Solid products: which customisation type did the user pick?
  const [customizationType, setCustomizationType] = useState<"color"|"print"|"pattern"|null>(null);
  // For Pattern customisation: colour recolour or print overlay?
  const [patternSubMode, setPatternSubMode] = useState<"color"|"print"|null>(null);
  // For Colour customisation: full body or individual parts?
  const [colorSubMode, setColorSubMode] = useState<"full"|"parts"|null>(null);

  const [showOtherDesigns, setShowOtherDesigns] = useState(false);
  // User-selected style from Step 1 (overrides SKU-derived type).
  // Seeded from ?style= URL param when arriving via CustomizeEntryModal.
  const [userStyle, setUserStyle] = useState<"solid"|"print"|"pattern"|null>(_entryStyle);
  const [userChosenDesignId, setUserChosenDesignId] = useState<string|null>(_entryDesign);
  // Effective type — user choice wins, falls back to SKU-driven type
  const effectiveSkuType: "pattern"|"print"|"solid" =
    userStyle === "pattern" ? "pattern" :
    userStyle === "print"   ? "print"   :
    userStyle === "solid"   ? "solid"   :
    skuProductType;

  // ── Responsive layout ─────────────────────────────────────────────────────
  const [screenW, setScreenW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1280);

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
  const [logoPosition, setLogoPosition] = useState("front-left");
  const [logoSize, setLogoSize] = useState(50);
  const [logoPreview, setLogoPreview] = useState<string|null>(null);
  const [logoPlaced, setLogoPlaced] = useState(false);

  // ── Text step state ───────────────────────────────────────────────────────
  const textObjRef = useRef<any>(null);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState("front-left");
  const [textPlaced, setTextPlaced] = useState(false);
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
  const [cameraView, setCameraView] = useState<CameraView>("front");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [colorTarget, setColorTarget] = useState<"all"|"front"|"back"|"leftSleeve"|"rightSleeve">("all");
  // ── Pattern colour channels ───────────────────────────────────────────────
  const [patColorA, setPatColorA] = useState(PAT_COLOR_A_DEFAULT);   // Channel A — dark tones
  const [patColorB, setPatColorB] = useState(PAT_COLOR_B_DEFAULT);   // Channel B — light tones
  const [patRecoloring, setPatRecoloring] = useState(false);         // spinner while recoloring
  // ── Sizing matrix + modal state ───────────────────────────────────────────
  const [sizeMode, setSizeMode] = useState<"standard"|"custom">("standard");
  const [sizeQty, setSizeQty] = useState<Record<string,number>>({S:0,M:0,L:0,XL:0,XXL:0});
  const [colorModalFor, setColorModalFor] = useState<"all"|"base"|"pattern"|"base-body"|"collar"|null>(null);
  const [pendingColorPick, setPendingColorPick] = useState<string|null>(null);
  const [printModalFor, setPrintModalFor] = useState<"all"|"base-body"|"collar"|"accent"|null>(null);
  const [pendingPrintKey, setPendingPrintKey] = useState<string|null>(null);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [modelPaused, setModelPaused] = useState(false);
  const historyStack = useRef<string[]>([]);
  const historyIdx = useRef(-1);

  // ── Design name ──────────────────────────────────────────────────────────
  const { data: existing } = useQuery<any>({
    queryKey: ["customization", id],
    queryFn:  () => apiFetch(`/api/customizations/product/${id}/latest`).catch(() => null),
    enabled:  !!id && !!user,
    retry:    false,
    staleTime: 30_000,
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
    if (!displayProduct?.modelUrl || !webglAvailable) { setModelDisplayed(true); return; }
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
  }, [mvReady, displayProduct?.modelUrl, webglAvailable]);

  // Sync userStyle when the URL param changes (e.g. navigating from pattern → solid via modal)
  useEffect(() => { setUserStyle(_entryStyle); }, [_entryStyle]);

  // Update styleTab when productType resolves (after data fetch)
  useEffect(() => {
    if (productType==="pattern") setStyleTab("pattern");
    else if (productType==="print") setStyleTab("print");
  }, [productType]);

  // Clear any applied KA.SHA pattern design when user is in solid or print mode
  useEffect(() => {
    if (effectiveSkuType === "solid" || effectiveSkuType === "print") {
      const fc = fcRef.current;
      if (!fc) return;
      const patternObjs = fc.getObjects().filter((o: any) => o?.data?.kashaDesign || o?.data?.kashaZonePrint);
      if (patternObjs.length > 0) {
        patternObjs.forEach((o: any) => fc.remove(o));
        setActiveKashaDesign(null);
        fc.renderAll();
        syncTexture();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSkuType]);

  // All users start at Step 1 to choose their style (no auto-advance)

  // Responsive layout listener
  useEffect(() => {
    const handler = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── KA.SHA Bespoke Design handler ────────────────────────────────────────
  // colorOverride: optional colors to apply in the same call; avoids stale-closure
  // issues when calling from effects where activeKashaDesign state hasn't updated yet.
  const handleSelectKashaDesign = useCallback(async (design: KashaDesignDef, colorOverride?: {colorA:string;colorB:string}) => {
    const fc=fcRef.current; if(!fc) return;
    const myReq=++kdRequestIdRef.current;
    setActiveKashaDesign(design);
    // When a print is active it acts as the base colour — keep it; design renders on top
    try{mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1,1,1,1]);}catch{}
    const recolor: RecolorOptions = colorOverride ?? { colorA: patColorA, colorB: patColorB };
    if (colorOverride) { setPatColorA(colorOverride.colorA); setPatColorB(colorOverride.colorB); }
    await applyKashaDesign(fc, design, recolor);
    if (myReq!==kdRequestIdRef.current) return;
    syncTexture();
    toast({title:`${design.id} applied`, description:design.label});
  }, [mats, patColorA, patColorB, syncTexture, toast]);

  // ── Pattern colour recolor ────────────────────────────────────────────────
  const applyPatternColors = useCallback(async (cA: string, cB: string) => {
    if (!activeKashaDesign) return;
    const fc=fcRef.current; if(!fc) return;
    setPatColorA(cA); setPatColorB(cB);
    setPatRecoloring(true);
    try {
      const recolor: RecolorOptions = { colorA: cA, colorB: cB };
      await applyKashaDesign(fc, activeKashaDesign, recolor);
      syncTexture();
    } finally { setPatRecoloring(false); }
  }, [activeKashaDesign, syncTexture]);

  // ── Pattern Design print — applies a tiled print into the same channel-B
  //    pixel areas that applyPatternColors recolours ─────────────────────────
  const applyPatternDesignPrint = useCallback(async (p: PatternDef) => {
    if (!activeKashaDesign) return;
    const fc = fcRef.current; if (!fc) return;
    setPatRecoloring(true);
    try {
      await applyKashaDesignWithPrint(fc, activeKashaDesign, patColorA, patternUrl(p.file));
      syncTexture();
    } finally { setPatRecoloring(false); }
  }, [activeKashaDesign, patColorA, syncTexture]);

  // ── Logo background removal (canvas-based white-threshold) ──────────────
  const removeBackground = useCallback(async () => {
    if (!logoPreview) return;
    setBgRemoving(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res,rej)=>{ img.onload=()=>res(); img.onerror=()=>rej(new Error("img")); img.src=toProxiedUrl(logoPreview!); });
      const c=document.createElement("canvas"); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height;
      const ctx=c.getContext("2d")!; ctx.drawImage(img,0,0);
      const d=ctx.getImageData(0,0,c.width,c.height); const p=d.data;
      for (let i=0;i<p.length;i+=4) { if(p[i]>220&&p[i+1]>220&&p[i+2]>220) p[i+3]=0; }
      ctx.putImageData(d,0,0);
      const newUrl=c.toDataURL("image/png");
      setLogoPreview(newUrl);
      if (logoObjRef.current&&fcRef.current) {
        const fc=fcRef.current; fc.remove(logoObjRef.current);
        const ni=await fabric.FabricImage.fromURL(newUrl,{crossOrigin:"anonymous"});
        const pos=LOGO_POSITIONS[logoPosition]||{left:512,top:512};
        const maxW=Math.round(logoSize*(1024/100));
        if(ni.width&&ni.width>maxW) ni.scaleToWidth(maxW);
        ni.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(logoPosition),flipY:placementFlipY(logoPosition)});
        fc.add(ni); fc.setActiveObject(ni); logoObjRef.current=ni;
        fc.renderAll(); syncTexture();
      }
      toast({title:"Background removed ✓"});
    } catch { toast({title:"Could not remove background",variant:"destructive"}); }
    finally { setBgRemoving(false); }
  }, [logoPreview, logoPosition, logoSize, syncTexture, toast]);

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
  const loadHTMLImage=(url:string)=>new Promise<HTMLImageElement>((res,rej)=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>res(img);img.onerror=rej;img.src=toProxiedUrl(url);});

  const applyAllOverPrint = useCallback(async (p: PatternDef) => {
    const fc=fcRef.current; if(!fc) return;
    kdRequestIdRef.current++;
    const hasDesign = !!activeKashaDesign;
    try {
      const img=await loadHTMLImage(patternUrl(p.file));
      const off=document.createElement("canvas");off.width=ALL_OVER_TILE_PX;off.height=ALL_OVER_TILE_PX;
      const ctx=off.getContext("2d"); if(ctx){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(img,0,0,ALL_OVER_TILE_PX,ALL_OVER_TILE_PX);}
      // When a KA.SHA design is active, the print becomes the BASE texture — the design stays on top.
      // Only clear the design when there is no active pattern (standalone all-over print).
      if (!hasDesign) { /* no design active — print takes full canvas */ }
      const pattern=new fabric.Pattern({source:off,repeat:"repeat"});
      (fc as any).backgroundColor=pattern;
      fc.renderAll();
      setAllOverPrintId(p.id); setActivePrintId(p.id);
      try{mats[0]?.mat?.pbrMetallicRoughness?.setBaseColorFactor?.([1,1,1,1]);}catch{}
      syncTexture();
      toast({
        title: hasDesign ? "Print applied as base texture" : "Print applied",
        description: hasDesign ? `${p.label} — pattern design remains on top.` : `${p.label} mapped across the whole garment.`,
      });
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
    const tileSize=128;
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

  // ── SKU-based auto-apply ──────────────────────────────────────────────────
  // When a product page links to the customiser (via ?id=), parse the product
  // SKU and immediately apply the correct design so the 3D model matches the
  // product the customer selected — no manual selection needed.

  // PATTERN auto-apply: apply zone textures + colorway derived from SKU suffix.
  // Gated on mats.length > 0 so syncTexture can actually push to the model;
  // the effect re-fires automatically when mats loads (via handleSelectKashaDesign dep).
  useEffect(() => {
    if (!canvasReady || productType !== "pattern" || autoAppliedRef.current) return;
    // Respect user's explicit style choice — don't force a pattern when the user
    // picked "solid" or "print" via the CustomizeEntryModal (?style= param).
    if (userStyle === "solid" || userStyle === "print") return;
    if (!product || !mats.length) return; // wait for model materials to be ready
    autoAppliedRef.current = true;

    // Parse the product's own SKU for colors (may have suffix like KS1002B-BB)
    const productSkuResult = parseSku(product.sku ?? "");

    // The ?design= param may be a bare design ID ("KS1002B") or a full SKU
    // ("KS1002B-BB") when arriving from the PersonalizeModal with a specific colorway.
    const rawDesignParam = entryDesignRef.current; // e.g. "KS1002B-BB" or "KS1002B"
    const entrySkuResult = parseSku(rawDesignParam ?? "");

    // Resolve the design ID and the best available colorway:
    // Priority: 1) full-SKU entry param  2) product SKU  3) defaults
    let designId: string;
    let colorOverride: {colorA:string;colorB:string} | undefined;

    if (entrySkuResult.type === "pattern") {
      // Full SKU passed in URL (e.g. KS1002B-BB) — use its design + colors
      designId = entrySkuResult.designId;
      colorOverride = { colorA: entrySkuResult.colorA, colorB: entrySkuResult.colorB };
    } else if (rawDesignParam) {
      // Bare design ID passed (e.g. "KS1002B") — use product SKU colors as fallback
      designId = rawDesignParam;
      if (productSkuResult.type === "pattern") {
        colorOverride = { colorA: productSkuResult.colorA, colorB: productSkuResult.colorB };
      }
    } else if (productSkuResult.type === "pattern") {
      // No entry param — derive everything from product SKU
      designId = productSkuResult.designId;
      colorOverride = { colorA: productSkuResult.colorA, colorB: productSkuResult.colorB };
    } else {
      // Fallback: legacy SKU_KASHA_DESIGN_MAP lookup
      designId = SKU_KASHA_DESIGN_MAP[product.sku ?? ""] ?? "KS1001B";
    }

    const design = KASHA_DESIGNS.find(d => d.id === designId) ?? KASHA_DESIGNS[0];
    // Apply colorB as the body/primary garment colour *before* zone textures are placed
    // on top, so any UV area not covered by a zone still shows the correct body colour.
    if (colorOverride) {
      baseBgRef.current = colorOverride.colorB;
      const fc = fcRef.current;
      if (fc) setFabricBg(fc, colorOverride.colorB);
      setPrimaryColor(colorOverride.colorB);
    }
    // Pass colorOverride directly so colors are applied atomically with the design,
    // and syncTexture fires with mats already populated (guaranteed by guard above).
    handleSelectKashaDesign(design, colorOverride);
  }, [canvasReady, productType, handleSelectKashaDesign, product, mats]);

  // PRINT auto-apply: select the correct print from the library based on SKU.
  // We only need canvasReady here — NOT mats.length. The print is applied to the
  // Fabric canvas immediately; the existing `useEffect([mats])` further down will
  // call syncTexture() once model materials arrive, pushing the texture to the model.
  const autoAppliedPrintRef = useRef(false);
  useEffect(() => {
    if (autoAppliedPrintRef.current) return;
    if (!canvasReady) return;

    let targetPatternId: string | null = null;

    if (product?.sku) {
      // Product loaded — resolve print ID from SKU
      const skuResult = parseSku(product.sku);
      if (skuResult.type === "print") {
        targetPatternId = skuResult.patternId;
      }
    } else if (isTypeMode && garmentType === "printed") {
      // Generic "printed" mode — default to blue-floral as before
      targetPatternId = "blue-floral";
    }

    if (!targetPatternId) return;
    const pattern = PATTERNS.find(p => p.id === targetPatternId);
    if (!pattern) return;
    autoAppliedPrintRef.current = true;
    applyAllOverPrint(pattern);
  }, [product, isTypeMode, garmentType, canvasReady, applyAllOverPrint]);

  // SOLID auto-apply: apply the correct base color from SKU when arriving on a solid product
  const autoAppliedSolidRef = useRef(false);
  useEffect(() => {
    if (autoAppliedSolidRef.current) return;
    if (!canvasReady) return;
    if (!product?.sku) return;

    const skuResult = parseSku(product.sku);
    if (skuResult.type !== "solid") return;

    autoAppliedSolidRef.current = true;
    applyPrimary(skuResult.hex);
  // applyPrimary is stable (defined with plain function, not useCallback), so we omit it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, canvasReady]);

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
      img.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(logoPosition),flipY:placementFlipY(logoPosition)});
      const fc=fcRef.current; if(!fc) return;
      if (logoObjRef.current) fc.remove(logoObjRef.current);
      fc.add(img); fc.setActiveObject(img); logoObjRef.current=img;
      setLogoPlaced(true);
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
    o.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(logoPosition),flipY:placementFlipY(logoPosition)});
    o.setCoords();
    fcRef.current?.renderAll(); syncTexture();
  };

  const removeLogo=()=>{
    const fc=fcRef.current; if(!fc) return;
    if(logoObjRef.current){fc.remove(logoObjRef.current);logoObjRef.current=null;setLogoPreview(null);setLogoPlaced(false);fc.renderAll();syncTexture();}
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
      flipX:placementFlipX(textPosition),flipY:placementFlipY(textPosition),
      selectable:true, evented:true,
      data:{tag:"user-text"},
    });
    fc.add(txt); fc.setActiveObject(txt);
    textObjRef.current=txt;
    setTextPlaced(true);
    fc.renderAll(); syncTexture();
  };

  const repositionText = () => {
    const o=textObjRef.current; if(!o) return;
    const pos=LOGO_POSITIONS[textPosition]||{left:512,top:512};
    o.set({left:pos.left, top:pos.top, originX:"center", originY:"center", flipX:placementFlipX(textPosition),flipY:placementFlipY(textPosition), fontSize:textFontSize, fill:textColor, fontFamily:textFont, fontWeight:textBold?"700":"400", fontStyle:textItalic?"italic":"normal"});
    o.setCoords();
    fcRef.current?.renderAll(); syncTexture();
  };

  const removeText = () => {
    const fc=fcRef.current; if(!fc) return;
    if(textObjRef.current){fc.remove(textObjRef.current);textObjRef.current=null;setTextPlaced(false);}
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

  /** Capture front, back and side snapshots by briefly rotating the model-viewer */
  const snapshotViews = useCallback(async (): Promise<{front:string;back:string;side:string}> => {
    const mv: any = mvRef.current;
    const fc = fcRef.current;
    try { await syncTexture(); } catch {}

    const captureAngle = async (orbit: string): Promise<string> => {
      if (mv && typeof mv.toDataURL === "function") {
        mv.cameraOrbit = orbit;
        // Wait two animation frames so model-viewer re-renders at the new angle
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
        await new Promise(r => setTimeout(r, 120));
        try { return mv.toDataURL("image/png", 1.0); } catch {}
      }
      if (fc) return fc.toDataURL({ format: "png", quality: 0.95, multiplier: 1 });
      return "";
    };

    const front = await captureAngle("0deg 75deg 2.5m");
    const back  = await captureAngle("180deg 75deg 2.5m");
    const side  = await captureAngle("90deg 75deg 2.5m");

    // Restore default front view
    if (mv) mv.cameraOrbit = "0deg 75deg 2.5m";

    return { front, back, side };
  }, [syncTexture]);

  // ── Save / Cart mutations ────────────────────────────────────────────────
  const buildPayload=async()=>{
    const fc=fcRef.current; if(!fc) throw new Error("Canvas not ready");
    const views = await snapshotViews();
    const effectiveQty = Object.values(sizeQty).reduce((a,b)=>a+b,0) || qty;
    const effectiveSize = Object.entries(sizeQty).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])[0]?.[0] || size;
    return {
      productId:id, name:designName||`${product?.name} Custom`,
      color:primaryColor, size:effectiveSize,
      partsEnabled:{qty:effectiveQty,zoneColors,primaryColor,kdDesignId:activeKashaDesign?.id||"",activePrintId,sleeveLength},
      canvasData:JSON.stringify({canvasJSON:JSON.stringify((fc as any).toJSON(["data"])),textureUrl:lastTextureUrlRef.current,primaryColor,kdDesignId:activeKashaDesign?.id||"",zoneColors,activePrintId,allOverPrintId,sleeveLength,productSku:product?.sku||"",skuProductType,customizationType:customizationType||(skuProductType==="print"?"print":skuProductType==="pattern"?"pattern":"color"),patternSubMode:patternSubMode||"",colorSubMode:colorSubMode||"",patColorA,patColorB}),
      previewImageUrl: views.front,
      frontImageUrl:   views.front,
      backImageUrl:    views.back,
      sideImageUrl:    views.side,
    };
  };
  const saveMut=useMutation({
    mutationFn:async()=>apiFetch("/api/customizations",{method:"POST",body:JSON.stringify(await buildPayload())}),
    onSuccess:()=>{toast({title:"Design Saved ✓"});queryClient.invalidateQueries({queryKey:["customization",id]});},
    onError:(e:any)=>toast({title:"Error",description:e.message,variant:"destructive"}),
  });
  const cartMut=useMutation({
    mutationFn:async()=>{
      const payload=await buildPayload();
      const effectiveQty=Object.values(sizeQty).reduce((a,b)=>a+b,0)||qty;
      const effectiveSize=Object.entries(sizeQty).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])[0]?.[0]||size;
      // Try to save the customisation; if it fails, still add to cart without a customisation ID
      let customizationId: number|null = null;
      try {
        const cust=await apiFetch("/api/customizations",{method:"POST",body:JSON.stringify(payload)});
        customizationId=cust.id??null;
      } catch { /* non-blocking — cart add will proceed */ }
      return apiFetch("/api/cart/items",{method:"POST",body:JSON.stringify({productId:id,customizationId,quantity:effectiveQty,size:effectiveSize})});
    },
    onSuccess:()=>{toast({title:"Added to Cart ✓",description:"Your custom design has been added."});setLocation("/cart");},
    onError:(e:any)=>toast({title:"Could not add to cart",description:e.message,variant:"destructive"}),
  });

  const handleAddToCart=()=>{
    if(!user){setLocation("/sign-in?redirect_url="+encodeURIComponent(window.location.pathname+window.location.search));return;}
    cartMut.mutate();
  };

  const handleSave=()=>{
    if(!user){setLocation("/sign-in?redirect_url="+encodeURIComponent(window.location.pathname+window.location.search));return;}
    saveMut.mutate();
  };

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
    const orbits: Record<CameraView, string> = {
      front:          "0deg 75deg 2.5m",
      back:           "180deg 75deg 2.5m",
      right:          "90deg 75deg 2.5m",
      left:           "-90deg 75deg 2.5m",
      "collar-center": "0deg 52deg 1.9m",
      "collar-left":   "-40deg 58deg 1.9m",
      "collar-right":  "40deg 58deg 1.9m",
    };
    mv.cameraOrbit = orbits[cameraView] ?? "0deg 75deg 2.5m";
  }, [cameraView, modelLoaded]);

  // Imperatively stop auto-rotate when entering step 3 (logo/text)
  useEffect(() => {
    const mv: any = mvRef.current; if (!mv || !modelLoaded) return;
    if (step === 3) {
      mv.removeAttribute("auto-rotate");
      mv.removeAttribute("auto-rotate-delay");
    }
  }, [step, modelLoaded]);

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


  const totalQty = Object.values(sizeQty).reduce((a,b)=>a+b,0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:V.bg,color:V.tx,fontFamily:"'Jost', sans-serif",overflow:"hidden"}}>

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
          <Link href={_fromSource === "modal" ? "/" : id ? `/products/${id}` : "/"} style={{
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
          <Link href="/" style={{display:"inline-flex",alignItems:"center"}}>
            <img
              src="https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Horizontal%20logo%20coloured%20(350%20by%2075)%20(1).svg"
              alt="KA.SHA — Home"
              style={{height:28,width:"auto",objectFit:"contain"}}
            />
          </Link>
        </div>

        {/* Center: studio name */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
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
              <button onClick={handleSave} disabled={saveMut.isPending}
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
          {isTypeMode && (
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
          )}
        </div>
      </header>

      {/* ── PROGRESS TRACKER BAR ─────────────────────────────────────────── */}
      <div style={{
        display:"flex",alignItems:"center",height:56,flexShrink:0,
        padding:"0 24px",gap:0,
        background:"#fff",
        borderBottom:`1.5px solid rgba(201,168,76,0.22)`,
        boxShadow:"0 2px 10px rgba(26,26,24,0.07)",
      }}>
        {([
          {n:1,label:"Style"},
          {n:2,label:"Design"},
          {n:3,label:"Logo & Text"},
          {n:4,label:"Sizing"},
        ] as const).map((s,i)=>{
          const active=step===s.n; const done=step>s.n;
          // Style step is locked when the user arrived with a pre-selected style
          // (e.g. from a product page). Clicking it does nothing to prevent
          // accidentally switching styles and breaking the current design.
          const locked = s.n===1 && _entryStyle!==null;
          return (
            <React.Fragment key={s.n}>
              {i>0&&<div style={{flex:1,height:2,borderRadius:2,background:done?V.ac:"rgba(26,26,24,0.14)",transition:"background .3s",margin:"0 4px"}}/>}
              <div onClick={locked?undefined:()=>setStep(s.n)} style={{
                display:"flex",alignItems:"center",gap:7,
                cursor:locked?"default":"pointer",
                padding:"5px 10px",borderRadius:99,
                background:active?V.aclt:"transparent",
                transition:"all .25s cubic-bezier(.16,1,.3,1)",
                opacity:locked?0.5:1,
              }}>
                <div style={{
                  width:24,height:24,borderRadius:"50%",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,
                  background:active?V.ac:done?V.ac:"#e8e4dc",
                  color:active?"#fff":done?"#fff":"#888",
                  border:`2px solid ${active||done?V.ac:"#d4cfc6"}`,
                  transition:"all .3s",
                  boxShadow:active?`0 0 0 3px ${V.aclt}`:"none",
                }}>{done?"✓":s.n}</div>
                <span style={{
                  fontSize:10,fontFamily:"'Jost',sans-serif",letterSpacing:".07em",
                  textTransform:"uppercase",fontWeight:active?700:400,
                  color:active?V.tx:done?V.ac:"#999",
                  transition:"all .3s",
                }}>{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <div style={{display:"flex",flex:1,overflow:"hidden",flexDirection:screenW<768?"column":"row"}}>

        {/* ── LEFT STEP PANEL ──────────────────────────────────────────────── */}
        <div style={{
          width:screenW<768?"100%":"40%",
          minWidth:screenW<768?undefined:340,
          maxWidth:screenW<768?undefined:560,
          height:screenW>=768?"100%":undefined,
          flex:screenW<768?"1 1 0":"0 0 40%",
          minHeight:screenW<768?0:undefined,
          order:screenW<768?2:1,
          display:"flex",flexDirection:"column",
          borderRight:screenW>=768?`1px solid rgba(26,26,24,0.07)`:undefined,
          borderTop:screenW<768?`1px solid rgba(201,168,76,0.15)`:undefined,
          background:V.sf,
          overflowY:"auto",
          overflowX:"hidden",
          scrollbarWidth:"thin",
          scrollbarColor:`${V.cream3} transparent`,
        }}>
          {/* Panel heading */}
          <div style={{
            padding:screenW<768?"12px 16px 10px":"20px 24px 16px",flexShrink:0,
            borderBottom:`1px solid rgba(26,26,24,0.07)`,
            background:V.sf,position:"sticky",top:0,zIndex:5,
          }}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:V.tx,letterSpacing:".02em"}}>
                  {step===1&&"Choose Your Style"}
                  {step===2&&effectiveSkuType==="print"&&"Choose Your Print"}
                  {step===2&&effectiveSkuType==="pattern"&&"Customise Your Design"}
                  {step===2&&effectiveSkuType==="solid"&&"Colour & Print Options"}
                  {step===3&&"Logo & Text"}
                  {step===4&&"Sizing & Quantity"}
                </div>
                <div style={{fontSize:9,color:V.mu,letterSpacing:".1em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",marginTop:3}}>
                  {step===1&&"Start your design — choose a customisation type"}
                  {step===2&&effectiveSkuType==="print"&&"Choose prints per garment section"}
                  {step===2&&effectiveSkuType==="pattern"&&"Customise body colour and pattern design"}
                  {step===2&&effectiveSkuType==="solid"&&"Apply colours and prints to each section"}
                  {step===3&&"Upload a logo or add custom text"}
                  {step===4&&"Set sizes & quantities for your order"}
                </div>
              </div>
              {/* Clear design button */}
              <button
                onClick={()=>{
                  const fc=fcRef.current;
                  if(step===2){
                    if(effectiveSkuType==="pattern"){
                      applyPatternColors(PAT_COLOR_A_DEFAULT,PAT_COLOR_B_DEFAULT);
                    } else if(effectiveSkuType==="solid"){
                      applyPrimary("#1a1a18");
                    }
                    clearAllOverPrint(); clearAllZonePrints(); saveHistory();
                  } else if(step===3){
                    if(fc){
                      fc.getObjects()
                        .filter((o:any)=>!o?.data?.kashaZonePrint&&!o?.data?.kdDesignZone&&(o.type==="image"||o.type==="textbox"))
                        .forEach((o:any)=>fc.remove(o));
                      fc.renderAll(); syncTexture();
                    }
                    setLogoPreview(null); logoObjRef.current=null;
                    setTextInput(""); setTextPlaced(false);
                  } else if(step===4){
                    setSizeQty({S:0,M:0,L:0,XL:0,XXL:0});
                    setCustomMeasurements({chest:"",shoulder:"",length:"",sleeve:""});
                  }
                }}
                style={{
                  flexShrink:0,marginTop:3,
                  padding:"5px 11px",borderRadius:8,
                  border:"1px solid rgba(196,92,92,0.3)",
                  background:"transparent",cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",fontSize:9,
                  fontWeight:600,letterSpacing:".08em",
                  textTransform:"uppercase" as const,
                  color:"#c45c5c",transition:"all .2s",
                  whiteSpace:"nowrap" as const,
                }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(196,92,92,0.08)";e.currentTarget.style.borderColor="rgba(196,92,92,0.55)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(196,92,92,0.3)";}}
              >↺ Reset</button>
            </div>
          </div>

          <div style={{padding:screenW<768?"14px 16px":"20px 24px",display:"flex",flexDirection:"column",gap:18,overflowX:"hidden",boxSizing:"border-box" as const,minWidth:0}}>

            {/* ══════════════════ STEP 1: CHOOSE STYLE ══════════════════════ */}
            {step===1&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{fontSize:12,color:V.mu,fontFamily:"'Jost',sans-serif",lineHeight:1.75}}>
                  Select a product style to get started — you'll customise colours, prints, and add your logo in the steps ahead.
                </div>

                {/* Solid + Print */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {([
                    {id:"solid" as const, label:"Solid", thumb:"https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/Solid-t-shirt (1).png"},
                    {id:"print" as const, label:"Print",  thumb:"https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/thumbnails/KS1000BGP001-01.png"},
                  ]).map(s=>{
                    const sel=userStyle===s.id||(userStyle===null&&(skuProductType as string)===s.id);
                    return(
                      <div key={s.id} onClick={()=>{
                        setUserStyle(s.id);
                        setStyleTab(s.id==="print"?"print":"solid");
                        setCustomizationType(s.id==="print"?"print":null);
                        if(s.id==="print") setPrintMode("fullBody");
                        setPatternSubMode(null); setColorSubMode(null);
                        setStep(2);
                      }} style={{
                        cursor:"pointer",borderRadius:12,overflow:"hidden",
                        border:`2px solid ${sel?V.ac:V.bd}`,transition:"all .2s",
                        boxShadow:sel?`0 2px 12px rgba(201,168,76,.25)`:"none",
                      }}>
                        <div style={{
                          width:"100%",aspectRatio:"3/4",background:V.sf2,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          padding:"8px 6px",boxSizing:"border-box" as const,overflow:"hidden",
                        }}>
                          <img src={s.thumb} alt={s.label} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block"}}
                            onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.2";}}/>
                        </div>
                        <div style={{padding:"8px 10px",background:sel?V.aclt:V.sf2}}>
                          <div style={{fontSize:10,fontFamily:"'Jost',sans-serif",fontWeight:sel?700:500,color:sel?V.ac:V.tx,letterSpacing:".06em",textTransform:"uppercase"}}>{s.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* KA.SHA Signature Patterns */}
                <div style={{...sb}}>KA.SHA Signature Patterns</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {KASHA_DESIGNS.map(d=>{
                    const sel=userStyle==="pattern"&&userChosenDesignId===d.id;
                    return(
                      <div key={d.id} onClick={()=>{
                        setUserStyle("pattern");
                        setUserChosenDesignId(d.id);
                        setStyleTab("pattern");
                        setCustomizationType("pattern");
                        setPatternSubMode("color");
                        handleSelectKashaDesign(d);
                        setStep(2);
                      }} style={{
                        cursor:"pointer",borderRadius:12,overflow:"hidden",
                        border:`2px solid ${sel?V.ac:V.bd}`,transition:"all .2s",
                        boxShadow:sel?`0 2px 12px rgba(201,168,76,.3)`:"none",
                      }}>
                        {d.thumbnail
                          ?<img src={d.thumbnail} alt={d.label} loading="eager" style={{width:"100%",aspectRatio:"1",objectFit:"cover",objectPosition:"top",display:"block"}}/>
                          :<div style={{width:"100%",aspectRatio:"1",background:V.sf2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:V.mu}}>◈</div>
                        }
                        <div style={{padding:"6px 8px",background:sel?V.aclt:V.sf2}}>
                          <div style={{fontSize:9,fontFamily:"'Jost',sans-serif",fontWeight:sel?700:500,color:sel?V.ac:V.tx,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════ STEP 2: DESIGN ═════════════════════════════ */}
            {step===2&&(()=>{

              // ── NEW FLAT DESIGN UI (user picked a style in Step 1) ──────────
              if (userStyle !== null) {
                const isPatternMode = effectiveSkuType === "pattern";
                const isPrintMode   = effectiveSkuType === "print";

                const TargetRow = ({title,desc,showColour,colourFor,showPrint,printFor}:{
                  title:string; desc?:string;
                  showColour?:boolean; colourFor?:"all"|"base"|"pattern"|"base-body"|"collar";
                  showPrint?:boolean; printFor?:"all"|"base-body"|"collar"|"accent";
                }) => (
                  <div style={{padding:"14px 16px",borderRadius:12,border:`1.5px solid ${V.ac}`,background:V.sf2,display:"flex",flexDirection:"column",gap:10}}>
                    <div>
                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:15,fontWeight:700,color:V.tx,letterSpacing:".04em",textTransform:"uppercase" as const}}>{title}</div>
                      {desc&&<div style={{fontSize:10,color:V.mu,marginTop:3,fontFamily:"'Jost',sans-serif",lineHeight:1.5}}>{desc}</div>}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {showColour&&(
                        <button onClick={()=>setColorModalFor(colourFor||"all")} style={{
                          flex:1,padding:"10px 0",borderRadius:8,
                          border:`1.5px solid ${V.ac}`,
                          background:V.aclt,cursor:"pointer",
                          fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:700,
                          letterSpacing:".06em",textTransform:"uppercase" as const,color:V.tx,transition:"all .2s",
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.background=V.ac;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=V.aclt;}}>
                          ● Colour
                        </button>
                      )}
                      {showPrint&&(
                        <button onClick={()=>setPrintModalFor(printFor||"all")} style={{
                          flex:1,padding:"10px 0",borderRadius:8,
                          border:`1.5px solid ${V.tx}`,
                          background:V.tx,cursor:"pointer",
                          fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:700,
                          letterSpacing:".06em",textTransform:"uppercase" as const,color:"#fff",transition:"all .2s",
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.borderColor=V.tx;e.currentTarget.style.color="#fff";}}>
                          ❋ Print
                        </button>
                      )}
                    </div>
                  </div>
                );

                return (
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>

                    {/* Active style indicator + Change button */}
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:10,background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.18)"}}>
                      <span style={{fontSize:9,color:V.mu,letterSpacing:".1em",textTransform:"uppercase" as const,fontFamily:"'Jost',sans-serif"}}>Style:</span>
                      <span style={{fontSize:11,fontFamily:"'Jost',sans-serif",fontWeight:600,color:V.tx}}>
                        {isPatternMode?(KASHA_DESIGNS.find(d=>d.id===userChosenDesignId)?.label||"Pattern"):isPrintMode?"Print":"Solid"}
                      </span>
                      {/* Change Style button hidden per client request */}
                    </div>

                    {isPatternMode&&(
                      <>
                        <TargetRow title="Base Body" desc="Background body colour and all-over print" showColour colourFor="all" showPrint printFor="all"/>
                        <TargetRow title="Pattern Design" desc="Recolour accent panels, trims, collar and sleeves" showColour colourFor="base" showPrint printFor="accent"/>
                        {activeKashaDesign&&(
                          <div style={{padding:"10px 14px",borderRadius:10,background:V.sf2,border:`1px solid ${V.bd}`,display:"flex",gap:10,alignItems:"center"}}>
                            {activeKashaDesign.thumbnail&&<img src={activeKashaDesign.thumbnail} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:6,border:`1px solid ${V.bd}`,flexShrink:0}}/>}
                            <div style={{flex:1}}>
                              <div style={{fontSize:9,color:V.mu,letterSpacing:".08em",textTransform:"uppercase" as const,fontFamily:"'Jost',sans-serif"}}>Active design</div>
                              <div style={{fontSize:11,fontFamily:"'Jost',sans-serif",fontWeight:600,color:V.tx,marginTop:2}}>{activeKashaDesign.label}</div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {isPrintMode&&(
                      <>
                        <TargetRow title="Full Body" desc="Apply a premium print to the entire garment" showPrint printFor="all"/>
                        <TargetRow title="Base Body" desc="Print on body, excluding the collar" showPrint printFor="base-body"/>
                        <TargetRow title="Collar" desc="Collar accent colour or print" showColour colourFor="collar" showPrint printFor="collar"/>
                      </>
                    )}

                    {!isPatternMode&&!isPrintMode&&(
                      <>
                        <TargetRow title="Full Body" desc="Colour or print the entire garment" showColour colourFor="all" showPrint printFor="all"/>
                        <TargetRow title="Base Body" desc="Body colour, excluding the collar" showColour colourFor="base-body" showPrint printFor="base-body"/>
                        <TargetRow title="Collar" desc="Collar accent colour or print" showColour colourFor="collar" showPrint printFor="collar"/>
                      </>
                    )}

                  </div>
                );
              }

              // ── LEGACY: direct product-page access (no style chosen in Step 1) ──
              // Determine what "mode" we are actually rendering
              const effectiveCustType = customizationType ?? (skuProductType==="print"?"print":skuProductType==="pattern"?"pattern":null);
              const isPatternMode = skuProductType==="pattern" || effectiveCustType==="pattern";
              const isPrintMode   = skuProductType==="print"   || effectiveCustType==="print";
              const isColorMode   = skuProductType==="solid"   && effectiveCustType==="color";

              // Back button helper
              const BackBtn = ({label,onClick:oc}:{label:string,onClick:()=>void})=>(
                <button onClick={oc} style={{
                  display:"flex",alignItems:"center",gap:6,marginBottom:4,
                  background:"none",border:"none",cursor:"pointer",padding:0,
                  fontFamily:"'Jost',sans-serif",fontSize:10,color:V.mu,letterSpacing:".06em",textTransform:"uppercase",
                }}>
                  ← {label}
                </button>
              );

              // Print gallery (shared between print-product and pattern→print sub-mode)
              // Click any thumbnail → immediately apply all-over
              const PrintGallery = ()=>{
                const gp=visiblePatterns.filter(p=>p.label.startsWith("GP"));
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div style={{...sb}}>Choose your print</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {gp.map(p=>{
                        const active=allOverPrintId===p.id;
                        return(
                          <div key={p.id} onClick={()=>{applyAllOverPrint(p);saveHistory();}} style={{
                            borderRadius:10,overflow:"hidden",cursor:"pointer",
                            border:`2px solid ${active?V.ac:V.bd}`,transition:"all .2s",
                            boxShadow:active?`0 2px 12px rgba(201,168,76,.3)`:"none",
                          }}>
                            <img src={patternUrl(p.file)} alt={p.label} loading="lazy" decoding="async"
                              style={{width:"100%",aspectRatio:"1",objectFit:"cover",display:"block"}}
                              onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}}/>
                            <div style={{padding:"5px 8px",background:active?V.aclt:V.sf2}}>
                              <div style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",color:active?V.ac:V.mu,fontWeight:active?700:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.label}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {allOverPrintId&&(
                      <button onClick={()=>{clearAllOverPrint();clearAllZonePrints();saveHistory();}} style={{
                        padding:"7px 0",borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,
                        background:"transparent",color:"#c45c5c",fontSize:10,fontWeight:500,
                        cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                      }}>✕ Remove print</button>
                    )}
                  </div>
                );
              };

              // KA.SHA design gallery + recolour (shared)
              // Renders a design card with thumbnail
              const DesignCard = ({d}:{d:typeof KASHA_DESIGNS[number]})=>{
                const sel=activeKashaDesign?.id===d.id;
                const thumb=d.thumbnail||(d.zones?.front||undefined);
                return (
                  <div onClick={()=>handleSelectKashaDesign(d)} style={{
                    borderRadius:10,overflow:"hidden",cursor:"pointer",
                    border:`2px solid ${sel?V.ac:V.bd}`,transition:"all .2s",
                    boxShadow:sel?`0 2px 12px rgba(201,168,76,.3)`:"none",
                  }}>
                    {thumb
                      ? <img src={thumb} alt={d.label} loading="eager" decoding="async"
                          style={{width:"100%",aspectRatio:"1",objectFit:"cover",objectPosition:"top",display:"block"}}/>
                      : <div style={{width:"100%",aspectRatio:"1",background:V.sf2,display:"flex",alignItems:"center",justifyContent:"center",color:V.mu,fontSize:24}}>◈</div>
                    }
                    <div style={{padding:"6px 10px",background:sel?V.aclt:V.sf2}}>
                      <div style={{fontSize:10,fontFamily:"'Jost',sans-serif",fontWeight:600,color:sel?V.ac:V.tx}}>{d.label}</div>
                    </div>
                  </div>
                );
              };

              const PatternGallery = ()=>(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>

                  {/* ── 1. RECOLOUR FIRST ───────────────────────────────── */}
                  {activeKashaDesign&&(
                    <div style={{display:"flex",flexDirection:"column",gap:10,padding:"14px",borderRadius:12,background:V.sf2,border:`1px solid ${V.bd}`}}>
                      <div style={{...sbT}}>Recolour your pattern design</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:9,color:V.mu,letterSpacing:".06em",fontFamily:"'Jost',sans-serif",marginBottom:4}}>DARK TONES</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{DARK_SWATCHES.map(h=>swatch(h,patColorA===h,()=>setPatColorA(h)))}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:V.mu,letterSpacing:".06em",fontFamily:"'Jost',sans-serif",marginBottom:4}}>LIGHT TONES</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{LIGHT_SWATCHES.map(h=>swatch(h,patColorB===h,()=>setPatColorB(h)))}</div>
                        </div>
                      </div>
                      <button onClick={()=>applyPatternColors(patColorA,patColorB)} disabled={patRecoloring} style={{padding:"9px 16px",borderRadius:8,border:"none",cursor:"pointer",background:V.ac,color:V.tx,fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",opacity:patRecoloring?.6:1,transition:"all .2s"}}>{patRecoloring?"Applying…":"✦ Apply Colours"}</button>
                      <div style={{height:1,background:V.bd,margin:"2px 0"}}/>
                      <div style={{fontSize:9,color:V.mu,letterSpacing:".06em",fontFamily:"'Jost',sans-serif"}}>BODY COLOUR</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {MAIN_PALETTE.map(h=>swatch(h,primaryColor===h,()=>applyPrimary(h)))}
                      </div>
                      <button onClick={()=>setColorModalFor("base")} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${V.ac}`,background:"transparent",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:9,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",color:V.ac,transition:"all .2s"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>⊕ Advanced Body Colour</button>
                      <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);}} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${V.bd}`,cursor:"pointer",background:"transparent",color:V.mu,fontFamily:"'Jost',sans-serif",fontSize:10}}>✕ Remove design</button>
                    </div>
                  )}

                  {/* ── 2. SIGNATURE DESIGNS ────────────────────────────── */}
                  {skuProductType==="pattern" ? (
                    /* Pattern SKU product: locked to assigned design; toggle reveals others */
                    <>
                      {!showOtherDesigns ? (
                        <button onClick={()=>setShowOtherDesigns(true)} style={{
                          padding:"10px 16px",borderRadius:10,cursor:"pointer",
                          border:`1.5px solid rgba(201,168,76,0.4)`,background:"transparent",
                          fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:600,
                          letterSpacing:".07em",textTransform:"uppercase",color:V.ac,
                          transition:"all .2s",textAlign:"left",
                        }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                          ◈ Choose other KA.SHA signature designs
                        </button>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{...sb}}>KA.SHA signature designs</div>
                            <button onClick={()=>setShowOtherDesigns(false)} style={{padding:"3px 10px",borderRadius:6,border:`1px solid ${V.bd}`,background:"transparent",cursor:"pointer",fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif"}}>✕ Close</button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,maxHeight:280,overflowY:"auto",paddingRight:4}}>
                            {KASHA_DESIGNS.filter(d=>d.id!==activeKashaDesign?.id).map(d=><DesignCard key={d.id} d={d}/>)}
                          </div>
                        </div>
                      )}
                    </>
                  ):(
                    /* Studio / solid → pattern: always show full gallery */
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{...sb}}>KA.SHA signature designs</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                        {KASHA_DESIGNS.map(d=><DesignCard key={d.id} d={d}/>)}
                      </div>
                    </div>
                  )}
                </div>
              );

              return (
                <div style={{display:"flex",flexDirection:"column",gap:18}}>

                  {/* ── PRINT product or print customisation type ─────────── */}
                  {isPrintMode&&!isPatternMode&&(
                    <PrintGallery/>
                  )}

                  {/* ── PATTERN product or pattern customisation type ──────── */}
                  {isPatternMode&&(
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>

                      {/* Sub-mode chooser */}
                      {patternSubMode===null&&(
                        <>
                          <div style={{fontSize:12,color:V.mu,fontFamily:"'Jost',sans-serif",lineHeight:1.6}}>
                            How would you like to customise the pattern?
                          </div>
                          {([
                            {id:"color" as const, icon:"◼", label:"Colour Customisation", desc:"Recolour the pattern using our curated palette"},
                            {id:"print" as const, icon:"❋", label:"Print Overlay",        desc:"Apply a premium print across the pattern panels"},
                          ]).map(c=>{
                            return (
                              <div key={c.id} onClick={()=>{
                                setPatternSubMode(c.id);
                                if(c.id==="print"){setStyleTab("print");setPrintMode("fullBody");}
                                else{setStyleTab("pattern");}
                              }} style={{
                                display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,cursor:"pointer",
                                border:`1.5px solid ${V.bd}`,background:"transparent",transition:"all .25s cubic-bezier(.16,1,.3,1)",
                              }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(201,168,76,0.5)";(e.currentTarget as HTMLElement).style.background=V.sf2;}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=V.bd;(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                <div style={{width:40,height:40,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:V.sf2,border:`1px solid ${V.bd}`,color:V.mu}}>{c.icon}</div>
                                <div style={{flex:1}}>
                                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:13,fontWeight:600,color:V.tx}}>{c.label}</div>
                                  <div style={{fontSize:10,color:V.mul,marginTop:2,fontFamily:"'Jost',sans-serif"}}>{c.desc}</div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Pattern → colour recolour */}
                      {patternSubMode==="color"&&(
                        <>
                          <BackBtn label="Back to options" onClick={()=>setPatternSubMode(null)}/>
                          <PatternGallery/>
                        </>
                      )}

                      {/* Pattern → print overlay */}
                      {patternSubMode==="print"&&(
                        <>
                          <BackBtn label="Back to options" onClick={()=>setPatternSubMode(null)}/>
                          <PrintGallery/>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── SOLID product → colour customisation ──────────────── */}
                  {isColorMode&&(
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>

                      {/* Sub-mode chooser: full body or parts */}
                      {colorSubMode===null&&(
                        <>
                          <div style={{fontSize:12,color:V.mu,fontFamily:"'Jost',sans-serif",lineHeight:1.6}}>
                            Apply colour to the full garment or customise individual zones?
                          </div>
                          {([
                            {id:"full" as const, icon:"◼", label:"Full Body Colour", desc:"One colour applied evenly across the whole garment"},
                            {id:"parts" as const, icon:"◩", label:"Parts Colour",   desc:"Choose different colours for collar, sleeves & body"},
                          ]).map(c=>{
                            return (
                              <div key={c.id} onClick={()=>setColorSubMode(c.id)} style={{
                                display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,cursor:"pointer",
                                border:`1.5px solid ${V.bd}`,background:"transparent",transition:"all .25s cubic-bezier(.16,1,.3,1)",
                              }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(201,168,76,0.5)";(e.currentTarget as HTMLElement).style.background=V.sf2;}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=V.bd;(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                <div style={{width:40,height:40,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:V.sf2,border:`1px solid ${V.bd}`,color:V.mu}}>{c.icon}</div>
                                <div style={{flex:1}}>
                                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:13,fontWeight:600,color:V.tx}}>{c.label}</div>
                                  <div style={{fontSize:10,color:V.mul,marginTop:2,fontFamily:"'Jost',sans-serif"}}>{c.desc}</div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Full body colour */}
                      {colorSubMode==="full"&&(
                        <>
                          <BackBtn label="Back to colour options" onClick={()=>setColorSubMode(null)}/>
                          <div style={{display:"flex",flexDirection:"column",gap:12}}>
                            <div style={{...sb}}>Body colour</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                              {MAIN_PALETTE.map(h=>swatch(h,primaryColor===h,()=>applyPrimary(h)))}
                            </div>
                            <button onClick={()=>setColorModalFor("base")} style={{marginTop:4,padding:"9px 16px",borderRadius:8,border:`1px solid ${V.ac}`,background:"transparent",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:V.ac,transition:"all .2s"}}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.aclt;}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                              ⊕ Advanced Colour Picker
                            </button>
                          </div>
                        </>
                      )}

                      {/* Parts colour */}
                      {colorSubMode==="parts"&&(
                        <>
                          <BackBtn label="Back to colour options" onClick={()=>setColorSubMode(null)}/>
                          <div style={{display:"flex",flexDirection:"column",gap:12}}>
                            <div style={{...sb}}>Base colour</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                              {MAIN_PALETTE.map(h=>swatch(h,primaryColor===h,()=>applyPrimary(h)))}
                            </div>
                            <div style={{...sb,marginTop:8}}>Zone colours</div>
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              {(["collar","leftSleeve","rightSleeve"] as const).filter(z=>zoneColors[z]!==undefined).map(z=>{
                                const label=z==="collar"?"Collar":z==="leftSleeve"?"Left Sleeve":"Right Sleeve";
                                return (
                                  <div key={z} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:V.sf2,border:`1px solid ${V.bd}`}}>
                                    <div style={{width:22,height:22,borderRadius:"50%",background:zoneColors[z as keyof typeof zoneColors]||primaryColor,border:`1.5px solid ${V.bd}`,flexShrink:0}}/>
                                    <span style={{flex:1,fontSize:11,fontFamily:"'Jost',sans-serif",color:V.tx,letterSpacing:".04em"}}>{label}</span>
                                    <button onClick={()=>setColorModalFor("base")} style={{fontSize:9,padding:"4px 10px",borderRadius:6,border:`1px solid ${V.ac}`,background:"transparent",cursor:"pointer",fontFamily:"'Jost',sans-serif",color:V.ac,letterSpacing:".06em",textTransform:"uppercase"}}>Change</button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                    </div>
                  )}

                  {/* Fallback: no customisation type selected yet (solid products before step 1) */}
                  {!isPrintMode&&!isPatternMode&&!isColorMode&&(
                    <div style={{padding:"16px",borderRadius:12,background:V.sf2,border:`1px solid ${V.bd}`,fontFamily:"'Jost',sans-serif",fontSize:12,color:V.mu,lineHeight:1.6}}>
                      Please go back to Step 1 and choose a customisation type to get started.
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ══════════════════ STEP 3: LOGO & TEXT ══════════════════════ */}
            {step===3&&(
              <div style={{display:"flex",flexDirection:"column",gap:18}}>

                {/* Logo section */}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{...sbT}}>Upload Logo</div>
                  {!logoPreview?(
                    <label style={{
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      gap:8,height:120,borderRadius:12,cursor:"pointer",
                      border:`1.5px dashed ${V.ac}`,background:V.aclt,
                      transition:"all .2s",
                    }}>
                      <input type="file" accept="image/*" style={{display:"none"}}
                        onChange={handleLogoUpload}/>
                      <span style={{fontSize:24,color:V.ac}}>⊕</span>
                      <span style={{fontSize:10,fontFamily:"'Jost',sans-serif",color:V.ac,letterSpacing:".08em",textTransform:"uppercase"}}>Drop or click to upload</span>
                      <span style={{fontSize:9,color:V.mul,fontFamily:"'Jost',sans-serif"}}>PNG, JPG, SVG</span>
                    </label>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:`1px solid ${V.bd}`}}>
                        <img src={logoPreview} alt="Logo preview" style={{width:"100%",height:120,objectFit:"contain",background:V.sf2,display:"block"}}/>
                        <button onClick={()=>{setLogoPreview(null);setLogoPlaced(false);if(logoObjRef.current&&fcRef.current){fcRef.current.remove(logoObjRef.current);logoObjRef.current=null;syncTexture();}}} style={{
                          position:"absolute",top:6,right:6,width:22,height:22,borderRadius:6,
                          border:`1px solid ${V.bd}`,background:"rgba(250,250,247,0.9)",cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:V.mu,
                        }}>×</button>
                      </div>
                      <button onClick={removeBackground} disabled={bgRemoving} style={{
                        padding:"8px 16px",borderRadius:8,border:`1px solid ${V.ac}`,
                        background:"transparent",cursor:"pointer",color:V.ac,
                        fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",
                        opacity:bgRemoving?.6:1,transition:"all .2s",
                      }}>{bgRemoving?"Removing…":"✦ Remove Background"}</button>
                    </div>
                  )}

                  {logoPreview&&(
                    <div style={{display:"flex",flexDirection:"column",gap:10,padding:"14px",borderRadius:12,background:V.sf2,border:`1px solid ${V.bd}`}}>
                      <div>
                        <div style={{...sb}}>Size — <span style={{color:V.ac}}>{(logoSize*0.376).toFixed(1)}&Prime;</span> <span style={{color:V.mu,fontWeight:400}}>({logoSize}%)</span></div>
                        <input type="range" min={5} max={60} value={logoSize} onChange={e=>{const v=+e.target.value;setLogoSize(v);if(logoObjRef.current){logoObjRef.current.scaleToWidth(Math.round(v*(1024/100)));logoObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}}
                          style={{width:"100%",accentColor:V.tx,cursor:"pointer",height:4,borderRadius:2,
                            background:`linear-gradient(to right,${V.tx} 0%,${V.tx} ${Math.round((logoSize-5)/55*100)}%,#c4bfb8 ${Math.round((logoSize-5)/55*100)}%,#c4bfb8 100%)`}}/>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text section */}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{...sbT}}>Add Text</div>
                  <textarea value={textInput} onChange={e=>setTextInput(e.target.value)} placeholder="Enter your text…"
                    rows={2} style={{
                      width:"100%",padding:"10px 12px",borderRadius:10,
                      border:`1px solid ${V.bd}`,background:V.sf2,
                      fontFamily:"'Jost',sans-serif",fontSize:12,color:V.tx,resize:"vertical",
                      outline:"none",boxSizing:"border-box",
                    }}/>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{...sb}}>Colour</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                        {MAIN_PALETTE.slice(0,8).map(h=>swatch(h,textColor===h,()=>{setTextColor(h);if(textObjRef.current){textObjRef.current.set({fill:h});fcRef.current?.renderAll();syncTexture();}}))}
                        <label title="Custom colour" style={{
                          width:22,height:22,borderRadius:"50%",cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          border:`1.5px dashed ${V.ac}`,background:V.aclt,flexShrink:0,
                          fontSize:13,color:V.ac,overflow:"hidden",position:"relative",
                        }}>
                          <span style={{pointerEvents:"none",lineHeight:1}}>+</span>
                          <input type="color" value={textColor} onChange={e=>{const v=e.target.value;setTextColor(v);if(textObjRef.current){textObjRef.current.set({fill:v});fcRef.current?.renderAll();syncTexture();}}}
                            style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/>
                        </label>
                        <div style={{width:22,height:22,borderRadius:"50%",background:textColor,border:`1.5px solid ${V.bd}`,flexShrink:0}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{...sb}}>Size</div>
                      <input type="range" min={14} max={80} value={textFontSize}
                        onChange={e=>{const v=+e.target.value;setTextFontSize(v);if(textObjRef.current){textObjRef.current.set({fontSize:v});textObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}}
                        style={{width:80,accentColor:V.tx,cursor:"pointer",height:4,borderRadius:2,
                          background:`linear-gradient(to right,${V.tx} 0%,${V.tx} ${Math.round((textFontSize-14)/66*100)}%,#c4bfb8 ${Math.round((textFontSize-14)/66*100)}%,#c4bfb8 100%)`}}/>
                      <div style={{fontSize:9,color:V.mu,textAlign:"center",fontFamily:"'Jost',sans-serif"}}>{textFontSize}px</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[
                      {f:"Tinos",            label:"Tinos"},
                      {f:"Playfair Display", label:"Playfair"},
                      {f:"Jost",             label:"Jost"},
                      {f:"Cormorant Garamond",label:"Cormorant"},
                      {f:"Impact",           label:"Impact"},
                      {f:"Anton",            label:"Anton"},
                      {f:"Bebas Neue",       label:"Bebas"},
                      {f:"Oswald",           label:"Oswald"},
                    ].map(({f,label})=>(
                      <button key={f} onClick={()=>{setTextFont(f);if(textObjRef.current){textObjRef.current.set({fontFamily:f});fcRef.current?.renderAll();syncTexture();}}} style={{
                        padding:"5px 10px",borderRadius:6,fontSize:10,fontFamily:f,
                        border:`1.5px solid ${textFont===f?V.ac:V.bd}`,
                        background:textFont===f?V.aclt:"transparent",
                        cursor:"pointer",color:textFont===f?V.tx:V.mu,transition:"all .2s",
                      }}>{label}</button>
                    ))}
                  </div>
                  {/* Text placement chips moved to right panel */}
                  <button onClick={()=>{
                    if(!textInput.trim())return;
                    applyText();
                  }} style={{
                    padding:"10px 16px",borderRadius:8,border:"none",background:V.ac,cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:700,letterSpacing:".08em",
                    textTransform:"uppercase",color:V.tx,transition:"all .2s",
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=V.ac;(e.currentTarget as HTMLElement).style.opacity="0.85";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=V.ac;(e.currentTarget as HTMLElement).style.opacity="1";}}>
                    ✦ Place Text on Garment
                  </button>
                </div>


              </div>
            )}

            {/* ══════════════════ STEP 4: SIZING ════════════════════════════ */}
            {step===4&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>

                {/* Design name */}
                <div>
                  <div style={{...sb}}>Design name</div>
                  <input value={designName} onChange={e=>setDesignName(e.target.value)}
                    placeholder={`${product?.name||"Custom"} Design`}
                    style={{
                      width:"100%",padding:"9px 12px",borderRadius:8,
                      border:`1px solid ${V.bd}`,background:V.sf2,
                      fontFamily:"'Jost',sans-serif",fontSize:12,color:V.tx,
                      outline:"none",boxSizing:"border-box",
                    }}/>
                </div>

                {/* Size × Qty table */}
                <div>
                  <div style={{...sb}}>Size &amp; quantity</div>
                  <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${V.bd}`}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:V.sf2,padding:"8px 12px",borderBottom:`1px solid ${V.bd}`}}>
                      <span style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",color:V.mu}}>Size</span>
                      <span style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",color:V.mu,textAlign:"center"}}>Qty</span>
                      <span style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",color:V.mu,textAlign:"right"}}>Chest (in)</span>
                    </div>
                    {([
                      {s:"S",chest:"36–37"},
                      {s:"M",chest:"38–39"},
                      {s:"L",chest:"40–41"},
                      {s:"XL",chest:"42–43"},
                      {s:"XXL",chest:"44–46"},
                    ]).map(({s,chest})=>(
                      <div key={s} style={{
                        display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                        alignItems:"center",padding:"8px 12px",
                        borderBottom:`1px solid rgba(26,26,24,0.05)`,
                        background:sizeQty[s]>0?V.aclt:"transparent",
                        transition:"background .2s",
                      }}>
                        <span style={{fontFamily:"'Jost',sans-serif",fontSize:12,fontWeight:700,color:sizeQty[s]>0?V.ac:V.tx,letterSpacing:".06em"}}>{s}</span>
                        <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                          <button onClick={()=>setSizeQty(q=>({...q,[s]:Math.max(0,q[s]-1)}))} style={{
                            width:22,height:22,borderRadius:6,border:`1px solid ${V.bd}`,
                            background:"transparent",cursor:"pointer",fontSize:14,color:V.mu,lineHeight:1,
                          }}>−</button>
                          <span style={{width:24,textAlign:"center",fontFamily:"'Jost',sans-serif",fontSize:12,fontWeight:600,color:V.tx}}>{sizeQty[s]||0}</span>
                          <button onClick={()=>setSizeQty(q=>({...q,[s]:q[s]+1}))} style={{
                            width:22,height:22,borderRadius:6,border:`1px solid ${V.bd}`,
                            background:"transparent",cursor:"pointer",fontSize:14,color:V.mu,lineHeight:1,
                          }}>+</button>
                        </div>
                        <span style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",textAlign:"right"}}>{chest}</span>
                      </div>
                    ))}
                    {totalQty>4&&(
                      <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.08)",borderTop:`1px solid rgba(201,168,76,0.25)`}}>
                        <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:"#b87a14",letterSpacing:".04em",lineHeight:1.5}}>
                          Orders above 4 pieces qualify for our <a href="/contact?subject=bulk" style={{color:"#c9a84c",fontWeight:700,textDecoration:"underline"}}>Bulk Enquiry</a> for better pricing and dedicated support.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price summary removed per client request */}

                {/* Custom measurements */}
                <div>
                  <div style={{...sb,marginBottom:6}}>Custom Measurements <span style={{fontSize:9,fontWeight:400,color:V.mu,marginLeft:4}}>(optional, in inches)</span></div>
                  <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:8,marginBottom:12}}>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:700,color:"#8b6914",letterSpacing:".06em",textTransform:"uppercase",lineHeight:1.6}}>
                      IMPORTANT: ALL SIZES BELOW ARE BODY MEASUREMENTS, NOT GARMENT MEASUREMENTS. PLEASE SPECIFY WHETHER YOUR INPUTS ARE BODY OR GARMENT MEASUREMENTS.
                    </div>
                  </div>
                  <div style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:10,lineHeight:1.5}}>
                    Leave blank to use standard sizing above. Fill in for a tailored fit.
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {(()=>{
                      const SIZE_CLASH: Record<string,{s:string;lo:number;hi:number}[]> = {
                        chest:    [{s:"S",lo:36,hi:37},{s:"M",lo:38,hi:39},{s:"L",lo:40,hi:41},{s:"XL",lo:42,hi:43},{s:"XXL",lo:44,hi:46}],
                        shoulder: [{s:"S",lo:16,hi:17},{s:"M",lo:17,hi:18},{s:"L",lo:18,hi:19},{s:"XL",lo:19,hi:20},{s:"XXL",lo:20,hi:21}],
                        length:   [{s:"S",lo:27,hi:28},{s:"M",lo:28,hi:29},{s:"L",lo:29,hi:30},{s:"XL",lo:30,hi:31},{s:"XXL",lo:31,hi:32}],
                        sleeve:   [{s:"S",lo:8, hi:9}, {s:"M",lo:9, hi:10},{s:"L",lo:10,hi:11},{s:"XL",lo:11,hi:12},{s:"XXL",lo:12,hi:13}],
                        waist:    [{s:"S",lo:30,hi:31},{s:"M",lo:32,hi:33},{s:"L",lo:34,hi:35},{s:"XL",lo:36,hi:37},{s:"XXL",lo:38,hi:40}],
                        hip:      [{s:"S",lo:34,hi:35},{s:"M",lo:36,hi:37},{s:"L",lo:38,hi:39},{s:"XL",lo:40,hi:41},{s:"XXL",lo:42,hi:44}],
                      };
                      return ([
                        {key:"chest",   label:"Chest"},
                        {key:"waist",   label:"Waist"},
                        {key:"hip",     label:"Hip"},
                        {key:"shoulder",label:"Shoulder Width"},
                        {key:"length",  label:"Garment Length"},
                        {key:"sleeve",  label:"Sleeve Length"},
                      ] as {key:string;label:string}[]).map(({key,label})=>(
                        <div key={key}>
                          <div style={{fontSize:9,fontFamily:"'Jost',sans-serif",letterSpacing:".07em",textTransform:"uppercase",color:V.mu,marginBottom:4}}>{label}</div>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            placeholder="—"
                            style={{
                              width:"100%",padding:"8px 10px",borderRadius:8,
                              border:`1px solid ${V.bd}`,background:V.sf2,
                              fontFamily:"'Jost',sans-serif",fontSize:12,color:V.tx,
                              outline:"none",boxSizing:"border-box" as const,
                            }}
                            onFocus={e=>e.target.style.borderColor=V.ac}
                            onBlur={e=>{
                              e.target.style.borderColor=V.bd;
                              const v=parseFloat(e.target.value);
                              const ranges=SIZE_CLASH[key];
                              if(!isNaN(v)&&ranges){
                                const match=ranges.find(sz=>v>=sz.lo&&v<=sz.hi);
                                const warn=e.target.nextElementSibling as HTMLElement|null;
                                if(warn){
                                  if(match){
                                    warn.textContent=`${v}" matches our standard ${match.s} size (${match.lo}–${match.hi}"). Consider selecting ${match.s} above instead.`;
                                    warn.style.display="block";
                                  } else {
                                    warn.style.display="none";
                                  }
                                }
                              }
                            }}
                            onChange={e=>{
                              const warn=e.target.nextElementSibling as HTMLElement|null;
                              if(warn){warn.style.display="none";}
                            }}
                          />
                          <div style={{display:"none",marginTop:4,fontSize:9,color:"#b87a14",fontFamily:"'Jost',sans-serif",lineHeight:1.4,padding:"5px 8px",background:"rgba(201,168,76,0.08)",borderRadius:6}}/>
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={{marginTop:8,fontSize:9,color:V.mu,fontFamily:"'Jost',sans-serif",fontStyle:"italic"}}>
                    Our team will contact you to confirm measurements before production.
                  </div>
                </div>

                {/* Price summary hidden per client request */}

                {/* WhatsApp bulk order callout */}
                <a href={`https://wa.me/919999999999?text=${encodeURIComponent(`Hi KA.SHA! I'd like to place a bulk order for ${totalQty||"multiple"} custom golf t-shirts.`)}`}
                  target="_blank" rel="noopener noreferrer" style={{
                    display:"flex",alignItems:"center",gap:12,
                    padding:"14px 18px",borderRadius:12,textDecoration:"none",
                    background:"linear-gradient(135deg,#25D366 0%,#128C7E 100%)",
                    boxShadow:"0 4px 16px rgba(37,211,102,0.25)",
                    transition:"all .25s",
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-1px)";(e.currentTarget as HTMLElement).style.boxShadow="0 6px 20px rgba(37,211,102,0.35)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(0)";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(37,211,102,0.25)";}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <div>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"#fff"}}>Bulk / Team Order?</div>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:"rgba(255,255,255,0.85)",marginTop:2}}>Chat with us on WhatsApp for 5+ pcs</div>
                  </div>
                </a>

              </div>
            )}

          </div>

          {/* ── BOTTOM NAV FOOTER ──────────────────────────────────────────── */}
          <div style={{
            position:"sticky",bottom:0,
            padding:"12px 20px",
            background:"rgba(250,250,247,0.97)",
            borderTop:`1px solid rgba(201,168,76,0.18)`,
            backdropFilter:"blur(12px)",
            display:"flex",alignItems:"center",gap:8,
            zIndex:20,flexShrink:0,
            boxShadow:"0 -4px 20px rgba(26,26,24,0.07)",
          }}>
            {/* Back */}
            <button
              onClick={()=>setStep(s=>Math.max(initialStep,s-1))}
              disabled={step===initialStep}
              style={{
                flex:1,padding:"11px 0",borderRadius:99,
                border:`1.5px solid ${step===initialStep?"rgba(26,26,24,0.12)":V.bd}`,
                background:"transparent",
                color:step===initialStep?V.mu:V.tx,
                fontSize:11,fontWeight:500,cursor:step===initialStep?"default":"pointer",
                fontFamily:"'Jost',sans-serif",letterSpacing:".06em",
                transition:"all 0.25s",
              }}
              onMouseEnter={e=>{if(step>initialStep){e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.ac;}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=step===initialStep?"rgba(26,26,24,0.12)":V.bd;e.currentTarget.style.color=step===initialStep?V.mu:V.tx;}}>
              ← Previous Step
            </button>

            {/* Continue / Add to Cart */}
            {step<4 ? (
              <>
                <button
                  onClick={()=>setStep(s=>Math.min(4,s+1))}
                  style={{
                    flex:2,padding:"11px 0",borderRadius:99,
                    border:"none",background:V.tx,color:"#fff",
                    fontSize:11,fontWeight:600,cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",letterSpacing:".07em",textTransform:"uppercase",
                    transition:"all 0.25s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}>
                  {step===1?"Continue to Design":step===2?"Continue to Logo & Text":"Continue to Sizing"} →
                </button>
                {!isTypeMode&&(
                  <button
                    onClick={handleAddToCart}
                    disabled={cartMut.isPending}
                    style={{
                      flex:1,padding:"11px 0",borderRadius:99,
                      border:`1.5px solid ${V.ac}`,background:V.aclt,color:V.tx,
                      fontSize:10,fontWeight:600,cursor:"pointer",
                      fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
                      opacity:cartMut.isPending?.6:1,transition:"all 0.25s",
                    }}
                    onMouseEnter={e=>{if(!cartMut.isPending){e.currentTarget.style.background=V.ac;}}}
                    onMouseLeave={e=>{e.currentTarget.style.background=V.aclt;}}>
                    {cartMut.isPending?"Adding…":"🛒 Cart"}
                  </button>
                )}
              </>
            ) : isTypeMode ? (
              <a href="/products" style={{
                flex:2,padding:"11px 0",borderRadius:99,textDecoration:"none",
                background:V.tx,color:"#fff",textAlign:"center",
                fontSize:11,fontWeight:600,cursor:"pointer",
                fontFamily:"'Jost',sans-serif",letterSpacing:".07em",textTransform:"uppercase",
                transition:"all 0.25s",display:"block",
              }}>
                Browse →
              </a>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={cartMut.isPending}
                style={{
                  flex:2,padding:"11px 0",borderRadius:99,
                  border:"none",background:V.ac,color:V.tx,
                  fontSize:11,fontWeight:600,cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",letterSpacing:".07em",textTransform:"uppercase",
                  opacity:cartMut.isPending?.6:1,transition:"all 0.25s",
                }}
                onMouseEnter={e=>{if(!cartMut.isPending){e.currentTarget.style.background=V.tx;e.currentTarget.style.color="#fff";}}}
                onMouseLeave={e=>{e.currentTarget.style.background=V.ac;e.currentTarget.style.color=V.tx;}}>
                {cartMut.isPending?"Adding…":"🛒 Add to Cart"}
              </button>
            )}
          </div>

        </div>

        {/* ── OLD_PANELS_REMOVED ── */}
        {(false as unknown as null) && activeTool && TOOLS.filter(t => !isQuickMode || (t.id !== "prints" && t.id !== "patterns")).map(t => {
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

        {/* ── TOOL PANEL (dead-coded) ───────────────────────────────────── */}
        {false && activeTool && (
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
                      {product?.thumbnailUrl && (
                        <img src={product?.thumbnailUrl||undefined} alt={product?.name||""}
                          style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>
                      )}
                      <div style={{padding:"14px"}}>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:V.tx,letterSpacing:".02em",marginBottom:4}}>
                          {product?.name?.replace(/\s*\[gt:GT\d+\]\s*$/,"")}
                        </div>
                        <div style={{fontSize:15,color:V.ac,fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:".04em"}}>
                          {formatPrice(product?.priceInPaise||0)}
                        </div>
                        {product?.description && (
                          <div style={{fontSize:11,color:V.mu,lineHeight:1.65,marginTop:8,fontFamily:"'Jost',sans-serif"}}>
                            {product?.description?.slice(0,120)}{(product?.description?.length||0)>120?"…":""}
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
                </div>
              )}

              {/* ── COLORS panel ──────────────────────────────────────── */}
              {activeTool==="colors"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {/* When a KA.SHA pattern design is active, only base colour is relevant.
                      Zone-part selectors are hidden — the design controls per-zone colouring. */}
                  {activeKashaDesign&&(
                    <div style={{background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:10,padding:"9px 12px",fontSize:11,color:V.mu,fontStyle:"italic",fontFamily:"'Jost',sans-serif",lineHeight:1.6}}>
                      Pattern design active — set the base colour below. Zone parts are controlled by the design.
                    </div>
                  )}
                  {/* Zone thumbnail selector — hide per-zone selectors when pattern is active */}
                  {(()=>{
                    const allZones:[string,string,string,string][]=[
                      ["all","Base Colour",
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
                    // When a KA.SHA pattern is active, hide per-zone selectors
                    const zones = activeKashaDesign ? allZones.slice(0,1) : allZones;
                    const cols = activeKashaDesign ? 1 : 5;
                    return(
                      <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:6}}>
                        {zones.map(([id,label,svgTpl,col])=>{
                          const isA=colorTarget===id||(activeKashaDesign&&id==="all");
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
                      {activeKashaDesign ? "Base Colour" : colorTarget==="all" ? "Colour — All Parts" : `Colour — ${["front","back","leftSleeve","rightSleeve"].includes(colorTarget)?{front:"Front",back:"Back",leftSleeve:"Left Sleeve",rightSleeve:"Right Sleeve"}[colorTarget as string]:"Part"}`}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:4}}>
                      {(activeKashaDesign||colorTarget==="all")
                        ? MAIN_PALETTE.map(hex=>swatch(hex,primaryColor===hex,()=>applyPrimary(hex)))
                        : MAIN_PALETTE.map(hex=>swatch(hex,zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]===hex,()=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,hex)))}
                    </div>
                    <div style={{fontSize:9,color:V.mu,letterSpacing:".06em",fontFamily:"'Jost',sans-serif",marginBottom:6,textTransform:"uppercase",fontWeight:600}}>Click the icon below to select a specific colour</div>
                    <label title="Pick a custom colour" aria-label="Pick a custom colour" style={{
                      display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer",
                      padding:"8px 14px",borderRadius:10,
                      border:`1.5px solid ${V.ac}`,background:V.aclt,
                      position:"relative",overflow:"hidden",
                      fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:600,
                      color:V.tx,letterSpacing:".05em",
                    }}>
                      <span style={{
                        width:28,height:28,borderRadius:6,
                        background:(activeKashaDesign||colorTarget==="all")
                          ?primaryColor
                          :zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]||primaryColor,
                        border:`1.5px solid rgba(26,26,24,0.18)`,
                        display:"inline-block",flexShrink:0,
                      }}/>
                      <span>🎨 Custom Colour Picker</span>
                      {(activeKashaDesign||colorTarget==="all")
                        ?<input type="color" value={primaryColor} onChange={e=>applyPrimary(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                        :<input type="color" value={zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]||primaryColor} onChange={e=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>}
                    </label>
                    {!activeKashaDesign&&colorTarget!=="all"&&zoneColors[colorTarget as Exclude<typeof colorTarget,"all">]&&(
                      <button onClick={()=>applyZoneColor(colorTarget as Exclude<typeof colorTarget,"all">,"")} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Reset this zone</button>
                    )}
                  </div>
                  {/* Reset All Zones — only shown when no pattern design is active */}
                  {!activeKashaDesign&&(
                    <button onClick={()=>{PART_ZONES.forEach(z=>applyZoneColor(z.id,""));setColorTarget("all");}} style={{
                      width:"100%",padding:"9px 0",borderRadius:99,
                      border:`1px solid rgba(196,92,92,.35)`,background:"transparent",
                      color:"#c45c5c",fontSize:10,fontWeight:600,cursor:"pointer",
                      fontFamily:"'Jost',sans-serif",letterSpacing:".08em",textTransform:"uppercase",transition:"all 0.2s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(196,92,92,.07)";e.currentTarget.style.borderColor="rgba(196,92,92,.6)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(196,92,92,.35)";}}>
                      ↺ Reset All Zones
                    </button>
                  )}
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
                    {visiblePatterns.map(p=>{
                      const sel=activePrintId===p.id;
                      const allApplied=allOverPrintId===p.id;
                      const inZone=Object.values(zonePrintIds).includes(p.id);
                      return(
                        <button key={p.id} onClick={()=>{applyAllOverPrint(p);setActivePrintId(p.id);saveHistory();}} title={p.label}
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
                          <div style={{width:36,height:36,borderRadius:7,background:`url(${patternUrl(p!.file)}) center/cover`,border:`1px solid ${V.bd}`,flexShrink:0}}/>
                          <div style={{fontSize:13,fontWeight:600,color:V.tx,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".02em"}}>{p!.label}</div>
                        </div>
                        {/* When a KA.SHA pattern design is active, print acts as base texture.
                            Hide By Part toggle — full body only applies beneath the design. */}
                        {activeKashaDesign&&(
                          <div style={{background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:8,padding:"8px 10px",fontSize:10,color:V.mu,fontStyle:"italic",fontFamily:"'Jost',sans-serif",lineHeight:1.55}}>
                            Pattern design active — print is applied as the base texture beneath the design.
                          </div>
                        )}
                        {productType!=="print"&&!activeKashaDesign&&(
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
                        {(productType==="print"||activeKashaDesign||printMode==="fullBody")&&(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            <button onClick={()=>{applyAllOverPrint(p!);saveHistory();}} style={{
                              padding:"9px 0",borderRadius:99,border:"none",
                              background:allOverPrintId===p!.id?V.tx:V.ac,
                              color:allOverPrintId===p!.id?"#fff":V.tx,
                              fontSize:11,fontWeight:600,cursor:"pointer",
                              fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",transition:"all 0.2s",
                            }}>
                              {allOverPrintId===p!.id
                                ? (productType==="print"?"✓ Selected": activeKashaDesign?"✓ Applied as Base":"✓ Applied")
                                : (productType==="print"?"Select Print": activeKashaDesign?"Apply as Base Texture":"Apply All-Over")}
                            </button>
                            {allOverPrintId&&productType!=="print"&&!activeKashaDesign&&(
                              <button onClick={()=>{clearAllOverPrint();saveHistory();}} style={{
                                padding:"7px 0",borderRadius:99,
                                border:`1px solid rgba(196,92,92,.35)`,background:"transparent",
                                color:"#c45c5c",fontSize:10,fontWeight:500,cursor:"pointer",
                                fontFamily:"'Jost',sans-serif",letterSpacing:".04em",
                              }}>✕ Remove print</button>
                            )}
                          </div>
                        )}
                        {productType!=="print"&&!activeKashaDesign&&printMode==="parts"&&(()=>{
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
                                  const applied=zonePrintIds[z.id]===p!.id;
                                  const otherPrint=zonePrintIds[z.id]&&zonePrintIds[z.id]!==p!.id;
                                  return(
                                    <button key={z.id}
                                      onClick={()=>{applied?clearZonePrint(z.id):applyZonePrint(z.id,p!);saveHistory();}}
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
                          <div style={{width:"100%",height:72,borderRadius:6,overflow:"hidden",background:V.sf,border:`1px solid ${V.bd}`,flexShrink:0}}>
                            {(d.thumbnail||d.zones.front)&&<img src={d.thumbnail||d.zones.front} alt={d.label} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block"}}/>}
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
                        <div style={{fontSize:12,fontWeight:600,color:V.tx,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>{activeKashaDesign!.id}</div>
                        <div style={{fontSize:12,color:V.mu,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>{activeKashaDesign!.label}</div>
                      </div>
                      <button onClick={()=>{const fc=fcRef.current;if(fc){clearKashaDesign(fc);syncTexture();}setActiveKashaDesign(null);saveHistory();}}
                        style={{fontSize:9,color:V.mu,background:"transparent",border:`1px solid ${V.bd}`,borderRadius:99,padding:"4px 10px",cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",flexShrink:0,transition:"all 0.2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                        Clear
                      </button>
                    </div>
                  )}

                  {/* ── Pattern Colours — only shown when a design is active ── */}
                  {activeKashaDesign&&(
                    <div style={{display:"flex",flexDirection:"column",gap:12,background:V.sf2,border:`1px solid ${V.bd}`,borderRadius:12,padding:"12px 12px 14px"}}>
                      {/* Header */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:V.tx,fontFamily:"'Jost',sans-serif"}}>Pattern Colours</div>
                          <div style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",marginTop:1}}>Recolor the design's two colour channels</div>
                        </div>
                        {patRecoloring&&<div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${V.bd}`,borderTopColor:V.ac,animation:"spin .8s linear infinite",flexShrink:0}}/>}
                      </div>

                      {/* Channel A — Dark tones */}
                      <div>
                        <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#555540",fontFamily:"'Jost',sans-serif",marginBottom:6}}>Channel A — Dark tones</div>
                        {/* Current preview */}
                        <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:V.bg,borderRadius:8,border:`1px solid ${V.bd}`,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:6,background:patColorA,border:`1px solid ${V.bd2}`,flexShrink:0,transition:"background .2s"}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",fontWeight:500}}>Color A</div>
                            <div style={{fontSize:10,color:"#888",fontFamily:"monospace",letterSpacing:".08em"}}>{patColorA.toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
                          {DARK_SWATCHES.map(hex=>(
                            <div key={hex} onClick={()=>{applyPatternColors(hex, patColorB);saveHistory();}} style={{
                              width:22,height:22,borderRadius:"50%",cursor:"pointer",flexShrink:0,
                              background:hex,
                              border:patColorA===hex?`2.5px solid ${V.ac}`:`1.5px solid ${hex==="#ffffff"?V.bd2:"transparent"}`,
                              boxShadow:patColorA===hex?`0 0 0 2px rgba(201,168,76,0.25)`:"none",
                              transform:patColorA===hex?"scale(1.15)":"scale(1)",
                              transition:"all .18s",
                            }} title={hex}/>
                          ))}
                          <label title="Custom dark colour" style={{width:22,height:22,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:V.mu,flexShrink:0}}>
                            +<input type="color" value={patColorA} onChange={e=>applyPatternColors(e.target.value, patColorB)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                          </label>
                        </div>
                      </div>

                      {/* Channel B — Light tones */}
                      <div>
                        <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#555540",fontFamily:"'Jost',sans-serif",marginBottom:6}}>Channel B — Light tones</div>
                        {/* Current preview */}
                        <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:V.bg,borderRadius:8,border:`1px solid ${V.bd}`,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:6,background:patColorB,border:`1px solid ${V.bd2}`,flexShrink:0,transition:"background .2s"}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:10,color:V.mu,fontFamily:"'Jost',sans-serif",fontWeight:500}}>Color B</div>
                            <div style={{fontSize:10,color:"#888",fontFamily:"monospace",letterSpacing:".08em"}}>{patColorB.toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
                          {LIGHT_SWATCHES.map(hex=>(
                            <div key={hex} onClick={()=>{applyPatternColors(patColorA, hex);saveHistory();}} style={{
                              width:22,height:22,borderRadius:"50%",cursor:"pointer",flexShrink:0,
                              background:hex,
                              border:patColorB===hex?`2.5px solid ${V.ac}`:`1.5px solid ${hex==="#ffffff"?V.bd2:"transparent"}`,
                              boxShadow:patColorB===hex?`0 0 0 2px rgba(201,168,76,0.25)`:"none",
                              transform:patColorB===hex?"scale(1.15)":"scale(1)",
                              transition:"all .18s",
                            }} title={hex}/>
                          ))}
                          <label title="Custom light colour" style={{width:22,height:22,borderRadius:"50%",cursor:"pointer",overflow:"hidden",position:"relative",border:`1.5px dashed ${V.bd2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:V.mu,flexShrink:0}}>
                            +<input type="color" value={patColorB} onChange={e=>applyPatternColors(patColorA, e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}}/>
                          </label>
                        </div>
                      </div>

                      {/* Mix preview */}
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:V.bg,borderRadius:8,border:`1px solid ${V.bd}`}}>
                        <div style={{fontSize:9,color:V.mu,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",flexShrink:0}}>Mix</div>
                        <div style={{width:18,height:18,borderRadius:4,background:patColorA,border:`1px solid ${V.bd2}`,flexShrink:0}}/>
                        <div style={{fontSize:10,color:V.mu}}>+</div>
                        <div style={{width:18,height:18,borderRadius:4,background:patColorB,border:`1px solid ${V.bd2}`,flexShrink:0}}/>
                        <div style={{fontSize:9,color:V.mu,flex:1,textAlign:"center",letterSpacing:".04em",fontFamily:"'Jost',sans-serif"}}>→</div>
                        <div style={{width:48,height:18,borderRadius:4,border:`1px solid ${V.bd2}`,flexShrink:0,background:`linear-gradient(90deg,${patColorA},${patColorB})`}}/>
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#555540",fontFamily:"'Jost',sans-serif",marginBottom:7}}>Quick Presets</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                          {PATTERN_PRESETS.map(p=>{
                            const isA=p.a===patColorA&&p.b===patColorB;
                            return(
                              <div key={p.name} onClick={()=>{applyPatternColors(p.a,p.b);saveHistory();}} title={`${p.name}: A=${p.a} B=${p.b}`} style={{
                                borderRadius:7,overflow:"hidden",cursor:"pointer",
                                border:`1.5px solid ${isA?V.ac:V.bd}`,
                                boxShadow:isA?`0 0 0 1.5px rgba(201,168,76,0.25)`:"none",
                                transition:"all .18s",
                              }}
                              onMouseEnter={e=>{if(!isA)e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";}}
                              onMouseLeave={e=>{if(!isA)e.currentTarget.style.borderColor=V.bd;}}>
                                <div style={{display:"flex",height:22}}>
                                  <div style={{flex:1,background:p.a}}/>
                                  <div style={{flex:1,background:p.b}}/>
                                </div>
                                <div style={{fontSize:8,color:isA?V.tx:"#888",textAlign:"center",padding:"3px 2px",background:V.bg,fontFamily:"'Jost',sans-serif",letterSpacing:".04em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Randomize / Swap / Reset row */}
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>{
                          const a=RANDOM_DARK_PAT[Math.floor(Math.random()*RANDOM_DARK_PAT.length)];
                          const b=RANDOM_LIGHT_PAT[Math.floor(Math.random()*RANDOM_LIGHT_PAT.length)];
                          applyPatternColors(a,b);saveHistory();
                        }} style={{flex:1,padding:"6px 0",fontSize:9,fontWeight:600,cursor:"pointer",borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,transition:"all .2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                          🎲 Random
                        </button>
                        <button onClick={()=>{applyPatternColors(patColorB,patColorA);saveHistory();}} style={{flex:1,padding:"6px 0",fontSize:9,fontWeight:600,cursor:"pointer",borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",border:`1px solid ${V.bd}`,background:"transparent",color:V.mu,transition:"all .2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.color=V.tx;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=V.bd;e.currentTarget.style.color=V.mu;}}>
                          ⇄ Swap A↔B
                        </button>
                        <button onClick={()=>{applyPatternColors(PAT_COLOR_A_DEFAULT,PAT_COLOR_B_DEFAULT);saveHistory();}} style={{flex:1,padding:"6px 0",fontSize:9,fontWeight:600,cursor:"pointer",borderRadius:99,fontFamily:"'Jost',sans-serif",letterSpacing:".06em",textTransform:"uppercase",border:`1px solid rgba(196,92,92,.3)`,background:"transparent",color:"#c45c5c",transition:"all .2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(196,92,92,.07)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                          ↺ Reset
                        </button>
                      </div>
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
                      <label style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:56,borderRadius:8,border:`1.5px solid ${V.bd}`,background:"#fff",cursor:"pointer",overflow:"hidden",position:"relative"}}>
                        <div style={{width:40,height:40,borderRadius:6,background:textColor,border:"1.5px solid rgba(0,0,0,.12)"}}/>
                        <input type="color" value={textColor} onChange={e=>{const v=e.target.value;setTextColor(v);if(textObjRef.current){textObjRef.current.set({fill:v});fcRef.current?.renderAll();syncTexture();}}} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/>
                      </label>
                      <div style={{fontSize:8,color:V.mu,letterSpacing:".05em",fontFamily:"'Jost',sans-serif",marginTop:4,textAlign:"center"}}>Pick your colour from the colour picker</div>
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

                  {/* Placement thumbnails */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:8}}>Placement</div>
                    {(()=>{
                      const cards=[
                        {key:"front-left",   label:"Chest Left",   cx:21,cy:40},
                        {key:"front-right",  label:"Chest Right",  cx:39,cy:40},
                        {key:"left-sleeve",  label:"Left Sleeve",  cx:7, cy:23},
                        {key:"right-sleeve", label:"Right Sleeve", cx:53,cy:23},
                        {key:"back-center",  label:"Centre Back",  cx:30,cy:52,back:true},
                        {key:"collar-edge",  label:"Collar Centre", cx:30,cy:9},
                        {key:"collar-left",  label:"Collar Left",  cx:22,cy:9},
                        {key:"collar-right", label:"Collar Right", cx:38,cy:9},
                      ] as {key:string;label:string;cx:number;cy:number;back?:boolean}[];
                      return(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                          {cards.map(c=>{
                            const isA=textPosition===c.key;
                            const svg=`<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/>${c.back?`<text x="30" y="54" text-anchor="middle" font-size="6" fill="#999" font-family="sans-serif">back</text>`:""}<circle cx="${c.cx}" cy="${c.cy}" r="3.5" fill="${isA?"#c9a84c":"#aaa"}"/></svg>`;
                            return(
                              <div key={c.key} onClick={()=>{setTextPosition(c.key);setCameraView(PLACEMENT_VIEW[c.key]||"front");setModelPaused(true);const mv_=mvRef.current as any;if(mv_){mv_.removeAttribute("auto-rotate");mv_.removeAttribute("auto-rotate-delay");}if(textObjRef.current){const pos=LOGO_POSITIONS[c.key]||{left:512,top:512};textObjRef.current.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(c.key),flipY:placementFlipY(c.key)});textObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}} style={{
                                display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",
                                padding:"7px 3px",borderRadius:9,transition:"all .18s",
                                border:`1.5px solid ${isA?V.ac:V.bd}`,background:isA?V.aclt:"transparent",
                              }}>
                                <div style={{width:36,height:41}} dangerouslySetInnerHTML={{__html:svg}}/>
                                <span style={{fontSize:7,textTransform:"uppercase",letterSpacing:".05em",fontFamily:"'Jost',sans-serif",color:isA?V.tx:V.mu,fontWeight:isA?700:400,textAlign:"center",lineHeight:1.2}}>{c.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
                          <img src={logoPreview||undefined} alt="Logo" style={{maxWidth:"80%",maxHeight:"80%",objectFit:"contain"}}/>
                        </div>
                        <button onClick={()=>{removeLogo();saveHistory();}} style={{fontSize:10,color:"#c45c5c",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Jost',sans-serif",letterSpacing:".04em"}}>✕ Remove logo</button>
                      </div>
                    )}
                  </div>
                  {/* Placement thumbnails */}
                  <div>
                    <div style={{fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:V.mu,fontFamily:"'Jost',sans-serif",marginBottom:8,...sb}}>Placement</div>
                    {(()=>{
                      const cards=[
                        {key:"front-left",   label:"Chest Left",   cx:21,cy:40},
                        {key:"front-right",  label:"Chest Right",  cx:39,cy:40},
                        {key:"left-sleeve",  label:"Left Sleeve",  cx:7, cy:23},
                        {key:"right-sleeve", label:"Right Sleeve", cx:53,cy:23},
                        {key:"back-center",  label:"Centre Back",  cx:30,cy:52,back:true},
                        {key:"collar-edge",  label:"Collar Centre", cx:30,cy:9},
                        {key:"collar-left",  label:"Collar Left",  cx:22,cy:9},
                        {key:"collar-right", label:"Collar Right", cx:38,cy:9},
                      ] as {key:string;label:string;cx:number;cy:number;back?:boolean}[];
                      return(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                          {cards.map(c=>{
                            const isA=logoPosition===c.key;
                            const svg=`<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/>${c.back?`<text x="30" y="54" text-anchor="middle" font-size="6" fill="#999" font-family="sans-serif">back</text>`:""}<circle cx="${c.cx}" cy="${c.cy}" r="3.5" fill="${isA?"#c9a84c":"#aaa"}"/></svg>`;
                            return(
                              <div key={c.key} onClick={()=>{setLogoPosition(c.key);setCameraView(PLACEMENT_VIEW[c.key]||"front");setModelPaused(true);const mv_=mvRef.current as any;if(mv_){mv_.removeAttribute("auto-rotate");mv_.removeAttribute("auto-rotate-delay");}if(logoObjRef.current){const pos=LOGO_POSITIONS[c.key]||{left:512,top:512};logoObjRef.current.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(c.key),flipY:placementFlipY(c.key)});logoObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}} style={{
                                display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",
                                padding:"7px 3px",borderRadius:9,transition:"all .18s",
                                border:`1.5px solid ${isA?V.ac:V.bd}`,background:isA?V.aclt:"transparent",
                              }}>
                                <div style={{width:36,height:41}} dangerouslySetInnerHTML={{__html:svg}}/>
                                <span style={{fontSize:7,textTransform:"uppercase",letterSpacing:".05em",fontFamily:"'Jost',sans-serif",color:isA?V.tx:V.mu,fontWeight:isA?700:400,textAlign:"center",lineHeight:1.2}}>{c.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
                      ["Style",   activeKashaDesign?`${activeKashaDesign!.id} — ${activeKashaDesign!.label}`:activePrintId?PATTERNS.find(p=>p.id===activePrintId)?.label||"—":primaryColor],
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
                      <button onClick={handleAddToCart} disabled={cartMut.isPending} style={{
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
                        <button onClick={handleSave} disabled={saveMut.isPending} style={{
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
          flex:screenW<768?"0 0 44vh":1,
          order:screenW<768?1:2,
          position:"relative",
          background:"radial-gradient(ellipse at 55% 40%, #c8c2b6 0%, #b8b1a4 60%, #a8a196 100%)",
          display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
          minWidth:0,
        }}>
          {/* Loading overlay */}
          {!modelDisplayed&&webglAvailable&&displayProduct?.modelUrl&&(
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

          {mvReady&&displayProduct?.modelUrl&&webglAvailable&&(
            <model-viewer ref={mvRef} src={toProxiedUrl(displayProduct.modelUrl)}
              camera-controls {...(step===3||modelPaused?{}:{"auto-rotate":true,"rotation-per-second":"8deg"})}
              shadow-intensity="1" environment-image="neutral" exposure="1.0"
              camera-orbit="0deg 75deg 2.5m" min-camera-orbit="auto auto 1.5m" max-camera-orbit="auto auto 5m"
              interaction-prompt="none"
              style={{width:"100%",height:"100%","--poster-color":"transparent",opacity:modelDisplayed?1:0,transition:"opacity .4s"} as any}/>
          )}

          {(!displayProduct?.modelUrl||!webglAvailable)&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,color:V.mu,padding:24,maxWidth:320,textAlign:"center"}}>
              {displayProduct?.thumbnailUrl
                ? <img src={displayProduct.thumbnailUrl} alt={displayProduct.name} style={{maxHeight:380,objectFit:"contain",borderRadius:14,boxShadow:"0 12px 48px rgba(26,26,24,0.12)",opacity:.95}}/>
                : <div style={{fontSize:64,opacity:.12}}>👕</div>}
              <p style={{fontSize:14,lineHeight:1.7,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>
                {isTypeMode
                  ? "Design your garment — browse products to select one for your cart."
                  : !webglAvailable?"3D preview requires WebGL. Your design is still applied correctly.":"No 3D model uploaded for this product."}
              </p>
            </div>
          )}

          {/* Product badge */}
          {/* Product badge — desktop bottom-left, mobile top-left */}
          {screenW>=768&&(
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
          )}

          {/* Pause / Resume 3D rotation toggle */}
          {mvReady&&displayProduct?.modelUrl&&webglAvailable&&(
            <button
              title={modelPaused?"Resume rotation":"Pause rotation"}
              onClick={()=>{
                const mv=mvRef.current as any; if(!mv) return;
                if(modelPaused){ mv.setAttribute("auto-rotate-delay","0"); mv.setAttribute("auto-rotate",""); mv.setAttribute("rotation-per-second","8deg"); }
                else { mv.removeAttribute("auto-rotate"); mv.removeAttribute("auto-rotate-delay"); }
                setModelPaused(p=>!p);
              }}
              style={{
                position:"absolute",top:14,right:14,zIndex:10,
                width:52,height:52,borderRadius:"50%",
                background:"rgba(250,250,247,0.95)",backdropFilter:"blur(12px)",
                border:"2px solid rgba(201,168,76,0.45)",
                display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:20,color:V.tx,
                boxShadow:"0 4px 20px rgba(26,26,24,0.18), 0 1px 4px rgba(201,168,76,0.20)",
                transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=V.ac;e.currentTarget.style.background="rgba(250,250,247,1)";e.currentTarget.style.boxShadow="0 6px 24px rgba(201,168,76,0.28), 0 2px 6px rgba(26,26,24,0.12)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.45)";e.currentTarget.style.background="rgba(250,250,247,0.95)";e.currentTarget.style.boxShadow="0 4px 20px rgba(26,26,24,0.18), 0 1px 4px rgba(201,168,76,0.20)";}}
            >{modelPaused?"▶":"⏸"}</button>
          )}

          {/* Active design badge — desktop bottom-right, hidden on mobile */}
          {(activeKashaDesign||activePrintId)&&screenW>=768&&(
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

          {/* Drag hint — desktop only */}
          {screenW>=768&&(
            <div style={{
              position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:11,letterSpacing:".16em",
              color:"rgba(26,26,24,0.22)",textTransform:"uppercase",
              pointerEvents:"none",whiteSpace:"nowrap",
            }}>
              Drag to rotate · Scroll to zoom
            </div>
          )}

          {/* Mobile horizontal view selector */}
          {screenW<768&&(
            <div style={{
              position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",
              display:"flex",gap:6,
              background:"rgba(250,250,247,0.93)",
              borderRadius:20,padding:"6px 10px",
              backdropFilter:"blur(12px)",
              border:`1px solid rgba(201,168,76,0.2)`,
              boxShadow:"0 2px 12px rgba(26,26,24,0.10)",
              zIndex:8,
            }}>
              {CAMERA_VIEWS.map(v=>{
                const isA=cameraView===v.id;
                return(
                  <button key={v.id} onClick={()=>setCameraView(v.id as any)} style={{
                    width:38,height:38,borderRadius:10,border:"none",cursor:"pointer",padding:0,
                    background:isA?V.aclt:V.sf2,
                    boxShadow:isA?`inset 0 0 0 1.5px ${V.ac}`:"none",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    overflow:"hidden",flexShrink:0,transition:"all .2s",
                  }}>
                    {product?.thumbnailUrl
                      ? <img src={product.thumbnailUrl} alt={v.label} style={{
                          width:"100%",height:"100%",objectFit:"cover",
                          opacity:isA?1:0.5,
                          filter:v.id==="back"?"brightness(0.7)":v.id==="right"||v.id==="left"?"brightness(0.85)":"none",
                          transform:v.id==="back"?"scaleX(-1)":"none",
                        }}/>
                      : <span style={{fontSize:14,opacity:isA?1:0.4}}>👕</span>
                    }
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Placement chips (step 3 desktop only) ─────────── */}
        {step===3&&screenW>=768&&(
          <div style={{
            width:200,flexShrink:0,overflowY:"auto",
            background:V.bg,
            borderLeft:`1px solid rgba(26,26,24,0.07)`,
            display:"flex",flexDirection:"column",
            order:3,
          }}>
            <div style={{padding:"20px 14px",display:"flex",flexDirection:"column",gap:18}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:600,color:V.tx,letterSpacing:".02em"}}>Placement</div>
              {/* ── Customisation charge: Rs 1 per sq inch ── */}
              {(logoPreview||textPlaced)&&(()=>{
                const logoW = logoSize * 0.376; // width in inches
                const logoArea = logoW * logoW * 0.75; // ~3:4 aspect ratio estimate
                const logoCharge = logoPreview ? Math.ceil(logoArea) : 0;
                const textH = textFontSize * (22/1024); // canvas 1024px ≈ 22" wide
                const textW = Math.max(1, textInput.length) * textFontSize * 0.55 * (22/1024);
                const textArea = textH * textW;
                const textCharge = textPlaced ? Math.ceil(textArea) : 0;
                const total = logoCharge + textCharge;
                return(
                  <div style={{padding:"10px 12px",borderRadius:10,background:V.sf2,border:`1px solid ${V.bd}`}}>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:V.mu,marginBottom:8}}>Customisation Charge</div>
                    {logoPreview&&<div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Jost',sans-serif",fontSize:11,color:V.tx,marginBottom:4}}><span>Logo</span><span style={{color:V.ac,fontWeight:600}}>₹{logoCharge}</span></div>}
                    {textPlaced&&<div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Jost',sans-serif",fontSize:11,color:V.tx,marginBottom:4}}><span>Text</span><span style={{color:V.ac,fontWeight:600}}>₹{textCharge}</span></div>}
                    <div style={{borderTop:`1px solid ${V.bd}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontFamily:"'Jost',sans-serif",fontSize:12,fontWeight:700,color:V.tx}}><span>Total</span><span style={{color:V.ac}}>₹{total}</span></div>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:8,color:V.mu,marginTop:5,fontStyle:"italic"}}>@ ₹1 per sq inch</div>
                  </div>
                );
              })()}
              {(()=>{
                const CHIPS=[
                  {key:"front-left",   label:"Chest Left",   cx:21,cy:40,back:false},
                  {key:"front-right",  label:"Chest Right",  cx:39,cy:40,back:false},
                  {key:"left-sleeve",  label:"Left Sleeve",  cx:7, cy:23,back:false},
                  {key:"right-sleeve", label:"Right Sleeve", cx:53,cy:23,back:false},
                  {key:"back-center",  label:"Centre Back",  cx:30,cy:52,back:true},
                  {key:"collar-edge",  label:"Collar Centre",cx:30,cy:9, back:false},
                  {key:"collar-left",  label:"Collar Left",  cx:22,cy:9, back:false},
                  {key:"collar-right", label:"Collar Right", cx:38,cy:9, back:false},
                ];
                const chipGrid=(isActive:(k:string)=>boolean, onSelect:(k:string)=>void)=>(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:5}}>
                    {CHIPS.map(c=>{
                      const isA=isActive(c.key);
                      const svg=`<svg viewBox="0 0 60 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 4L10 12L4 32L14 34L14 64H46L46 34L56 32L50 12L38 4L34 6C32 8 28 8 26 6Z" fill="#e8e4dc" stroke="#1a1a18" stroke-width="1.5"/>${c.back?`<text x="30" y="54" text-anchor="middle" font-size="6" fill="#999" font-family="sans-serif">back</text>`:""}<circle cx="${c.cx}" cy="${c.cy}" r="3.5" fill="${isA?"#c9a84c":"#aaa"}"/></svg>`;
                      return(
                        <div key={c.key} onClick={()=>onSelect(c.key)} style={{
                          display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",
                          padding:"8px 4px",borderRadius:9,transition:"all .18s",
                          border:`1.5px solid ${isA?V.ac:V.bd}`,background:isA?V.aclt:"transparent",
                        }}>
                          <div style={{width:38,height:43}} dangerouslySetInnerHTML={{__html:svg}}/>
                          <span style={{fontSize:7,textTransform:"uppercase",letterSpacing:".05em",fontFamily:"'Jost',sans-serif",color:isA?V.tx:V.mu,fontWeight:isA?700:400,textAlign:"center",lineHeight:1.2}}>{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
                return(
                  <>
                    {logoPreview&&(
                      <div>
                        <div style={{...sb,marginBottom:8}}>Logo</div>
                        {chipGrid(
                          k=>logoPosition===k,
                          k=>{setLogoPosition(k as any);setCameraView(PLACEMENT_VIEW[k]??"front");setModelPaused(true);const mv_=mvRef.current as any;if(mv_){mv_.removeAttribute("auto-rotate");mv_.removeAttribute("auto-rotate-delay");}if(logoObjRef.current){const pos=LOGO_POSITIONS[k]||{left:512,top:512};logoObjRef.current.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(k),flipY:placementFlipY(k)});logoObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}
                        )}
                      </div>
                    )}
                    {textPlaced&&(
                      <div>
                        <div style={{...sb,marginBottom:8}}>Text</div>
                        {chipGrid(
                          k=>textPosition===k,
                          k=>{setTextPosition(k as any);setCameraView(PLACEMENT_VIEW[k]??"front");setModelPaused(true);const mv_=mvRef.current as any;if(mv_){mv_.removeAttribute("auto-rotate");mv_.removeAttribute("auto-rotate-delay");}if(textObjRef.current){const pos=LOGO_POSITIONS[k]||{left:512,top:512};textObjRef.current.set({left:pos.left,top:pos.top,originX:"center",originY:"center",flipX:placementFlipX(k),flipY:placementFlipY(k)});textObjRef.current.setCoords();fcRef.current?.renderAll();syncTexture();}}
                        )}
                      </div>
                    )}
                    {!logoPreview&&!textPlaced&&(
                      <div style={{fontSize:11,color:V.mu,fontFamily:"'Jost',sans-serif",lineHeight:1.7,textAlign:"center",paddingTop:8}}>
                        Upload a logo or add text to see placement options.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      {/* ── COLOR PICKER MODAL ───────────────────────────────────────────── */}
      {colorModalFor&&(
        <div style={{
          position:"fixed",inset:0,zIndex:200,
          background:"rgba(26,26,24,0.55)",backdropFilter:"blur(6px)",
          display:"flex",alignItems:"center",justifyContent:"center",
        }} onClick={()=>{setColorModalFor(null);setPendingColorPick(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:V.bg,borderRadius:20,padding:"28px 28px 24px",
            width:340,maxHeight:"80vh",overflowY:"auto",
            boxShadow:"0 32px 80px rgba(26,26,24,0.32)",
            border:`1px solid rgba(201,168,76,0.18)`,
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:V.tx,letterSpacing:".02em"}}>
                Choose Colour
              </div>
              <button onClick={()=>{setColorModalFor(null);setPendingColorPick(null);}} style={{
                background:"transparent",border:"none",cursor:"pointer",
                fontSize:18,color:V.mu,lineHeight:1,padding:"2px 6px",
                borderRadius:99,transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=V.sf2;e.currentTarget.style.color=V.tx;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=V.mu;}}>✕</button>
            </div>

            {/* Instruction */}
            <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:V.mu,letterSpacing:".04em",marginBottom:16,padding:"8px 12px",background:V.sf2,borderRadius:8,border:`1px solid ${V.bd}`}}>
              Select a colour, then click <strong style={{color:V.ac}}>Apply</strong>.
            </div>

            {/* Preset swatches */}
            {(()=>{
              const pickedVal = colorModalFor==="pattern" ? patColorB : colorModalFor==="base" ? patColorA : primaryColor;
              const displayCol = pendingColorPick ?? pickedVal;
              const applyCol = (col: string) => {
                if(colorModalFor==="all"){
                  applyPrimary(col);
                } else if(colorModalFor==="base"){
                  setPatColorA(col);
                  applyPatternColors(col, patColorB);
                } else if(colorModalFor==="base-body"){
                  (["front","back","leftSleeve","rightSleeve"] as const).forEach(z=>applyZoneColor(z,col));
                } else if(colorModalFor==="collar"){
                  applyZoneColor("collar",col);
                } else {
                  setPatColorB(col);
                  applyPatternColors(patColorA, col);
                }
                setPendingColorPick(null);
                setColorModalFor(null);
              };
              return(<>
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:20}}>
                  {[
                    "#1a1a18","#2c2c2a","#4a4a48","#6b6b68","#9b9b98","#c8c8c4",
                    "#ffffff","#faf8f4","#f2ede4","#e8e2d8","#d4cfc6","#c9c4bb",
                    "#c9a84c","#e8c96a","#b8943e","#8b6914","#5c4209","#f5e6c0",
                    "#8B1A1A","#C24B4B","#E07070","#F0A0A0","#FDDEDE","#FFE4E4",
                    "#1A3A8B","#2B5CC8","#4D7FE0","#86AFF5","#C0D8FF","#E0EDFF",
                    "#1A6B3A","#2D9A54","#4DC472","#80E0A0","#B8F0CC","#DFF8E8",
                    "#6B1A8B","#9B3AC0","#C060E0","#D890F0","#ECC0F8","#F5E0FF",
                    "#8B4A1A","#C47030","#E09050","#F0B880","#F8D8B0","#FFF0E0",
                  ].map(col=>(
                    <button key={col} onClick={()=>setPendingColorPick(col)} style={{
                      width:"100%",aspectRatio:"1",borderRadius:8,cursor:"pointer",
                      background:col,
                      border:displayCol===col?`2.5px solid ${V.ac}`:`1px solid rgba(26,26,24,0.15)`,
                      transition:"all .15s",
                      boxShadow:displayCol===col?`0 2px 8px rgba(201,168,76,0.35)`:"none",
                    }} title={col}/>
                  ))}
                </div>
                {/* Custom colour picker */}
                <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:V.mu,letterSpacing:".06em",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>
                  Click the icon below to select a specific colour
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:18}}>
                  <div style={{width:40,height:40,borderRadius:10,background:displayCol,border:`1.5px solid ${V.bd}`,flexShrink:0}}/>
                  <input type="color" value={displayCol}
                    onChange={e=>setPendingColorPick(e.target.value)}
                    style={{width:48,height:40,padding:2,border:`1.5px solid ${V.bd}`,borderRadius:8,cursor:"pointer",background:V.sf2}}/>
                  <input type="text" value={displayCol}
                    onChange={e=>{
                      const v=e.target.value.trim();
                      if(/^#[0-9A-Fa-f]{6}$/.test(v)) setPendingColorPick(v);
                    }}
                    placeholder="#c9a84c"
                    style={{
                      flex:1,padding:"9px 12px",borderRadius:8,
                      border:`1.5px solid ${V.bd}`,background:V.sf2,
                      fontFamily:"'Jost',sans-serif",fontSize:12,color:V.tx,
                      outline:"none",letterSpacing:".04em",
                    }}
                    onFocus={e=>e.target.style.borderColor=V.ac}
                    onBlur={e=>e.target.style.borderColor=V.bd}/>
                </div>
                {/* Apply button */}
                <button onClick={()=>applyCol(displayCol)} style={{
                  width:"100%",padding:"12px 0",borderRadius:10,
                  background:`linear-gradient(135deg,${V.ac},#b8943e)`,
                  border:"none",cursor:"pointer",
                  fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:700,
                  color:"#fff",letterSpacing:".12em",textTransform:"uppercase",
                  boxShadow:"0 4px 16px rgba(201,168,76,0.35)",
                  transition:"all .2s",
                }}>Apply Colour</button>
              </>);
            })()}
          </div>
        </div>
      )}

      {/* ── PRINT PICKER MODAL ───────────────────────────────────────────── */}
      {printModalFor&&(
        <div style={{
          position:"fixed",inset:0,zIndex:200,
          background:"rgba(26,26,24,0.55)",backdropFilter:"blur(6px)",
          display:"flex",alignItems:"center",justifyContent:"center",
        }} onClick={()=>{setPrintModalFor(null);setPendingPrintKey(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:V.bg,borderRadius:20,padding:"28px 28px 24px",
            width:420,maxHeight:"80vh",overflowY:"auto",
            boxShadow:"0 32px 80px rgba(26,26,24,0.32)",
            border:`1px solid rgba(201,168,76,0.18)`,
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:V.tx,letterSpacing:".02em"}}>
                Choose Print
              </div>
              <button onClick={()=>{setPrintModalFor(null);setPendingPrintKey(null);}} style={{
                background:"transparent",border:"none",cursor:"pointer",
                fontSize:18,color:V.mu,lineHeight:1,padding:"2px 6px",
                borderRadius:99,transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=V.sf2;e.currentTarget.style.color=V.tx;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=V.mu;}}>✕</button>
            </div>

            {/* Instruction */}
            <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:V.mu,letterSpacing:".04em",marginBottom:16,padding:"8px 12px",background:V.sf2,borderRadius:8,border:`1px solid ${V.bd}`}}>
              Select a print, then click <strong style={{color:V.ac}}>Apply</strong>.
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
              {visiblePatterns.map(p=>{
                const isActive=(pendingPrintKey??allOverPrintId)===p.id;
                return(
                  <div key={p.id} onClick={()=>setPendingPrintKey(p.id)} style={{
                    cursor:"pointer",borderRadius:12,overflow:"hidden",
                    border:`2px solid ${isActive?V.ac:V.bd}`,
                    transition:"all .2s",
                    boxShadow:isActive?`0 4px 16px rgba(201,168,76,0.3)`:"none",
                  }}>
                    <div style={{
                      width:"100%",aspectRatio:"1",
                      background:`url(${patternUrl(p.file)}) center/cover`,
                    }}/>
                    <div style={{
                      padding:"6px 8px",background:isActive?V.aclt:V.sf2,
                      fontFamily:"'Jost',sans-serif",fontSize:9,
                      letterSpacing:".06em",textTransform:"uppercase",
                      color:isActive?V.tx:V.mu,fontWeight:isActive?700:400,
                      textAlign:"center",lineHeight:1.3,
                    }}>{p.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Apply button */}
            <button onClick={()=>{
              const chosen=pendingPrintKey? visiblePatterns.find(p=>p.id===pendingPrintKey):null;
              if(chosen){
                if(printModalFor==="base-body"){
                  applyZonePrint("front",chosen); applyZonePrint("back",chosen);
                  applyZonePrint("leftSleeve",chosen); applyZonePrint("rightSleeve",chosen);
                  applyZonePrint("collar",chosen);
                } else if(printModalFor==="collar"){
                  applyZonePrint("collar",chosen);
                } else if(printModalFor==="accent"){
                  applyPatternDesignPrint(chosen);
                } else {
                  applyAllOverPrint(chosen);
                }
                saveHistory();
              }
              setPendingPrintKey(null); setPrintModalFor(null);
            }} disabled={!pendingPrintKey} style={{
              display:"block",width:"100%",padding:"12px 0",borderRadius:10,
              background:pendingPrintKey?`linear-gradient(135deg,${V.ac},#b8943e)`:"rgba(26,26,24,0.08)",
              border:"none",cursor:pendingPrintKey?"pointer":"default",
              fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:700,
              color:pendingPrintKey?"#fff":V.mu,letterSpacing:".12em",textTransform:"uppercase",
              boxShadow:pendingPrintKey?"0 4px 16px rgba(201,168,76,0.35)":"none",
              transition:"all .2s",
            }}>Apply Print</button>

            {allOverPrintId&&(
              <button onClick={()=>{clearAllOverPrint();saveHistory();setPrintModalFor(null);setPendingPrintKey(null);}} style={{
                display:"block",width:"100%",marginTop:10,padding:"10px 0",
                borderRadius:99,border:`1px solid rgba(196,92,92,.35)`,
                background:"transparent",color:"#c45c5c",fontSize:11,
                cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".05em",
              }}>✕ Remove Print</button>
            )}
          </div>
        </div>
      )}

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
