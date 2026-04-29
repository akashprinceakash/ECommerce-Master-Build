// ─────────────────────────────────────────────────────────────────────────────
// gt-styles.ts  —  KA.SHA GT Design Style System  (v3 — procedural)
//
// Each GT style is rendered procedurally onto a 1024×1024 offscreen canvas
// using the same UV-zone coordinates the print library uses (ZONE_PRESETS).
// This guarantees the design lands on the correct parts of the shirt and
// matches the official spec sheets (e.g. GT003 = sage body + brown collar
// + thin brown cuff trim + thin brown hem trim — no oversized panels).
//
// API (unchanged from v2):
//   applyGtStyle(fc, style, colors?)
//   recolorGtStyle(fc, style, colors, syncFn)
//   clearGtStyle(fc)
// ─────────────────────────────────────────────────────────────────────────────
import * as fabric from "fabric";
import { ZONE_PRESETS } from "./patterns";

export interface GtColors {
  primary:   string;
  accent:    string;
  tertiary?: string;
}

export interface GtStyleDef {
  id:            string;
  label:         string;
  group:         GtGroup;
  defaultColors: GtColors;
}

export type GtGroup =
  | "classic" | "sport-side" | "triple" | "wave"
  | "hourglass" | "pinstripe" | "raglan";

export const GT_STYLES: GtStyleDef[] = [
  // Classic: solid body + contrast collar + thin cuff band + thin hem band
  { id:"GT001", label:"Sky & Oxblood",      group:"classic",    defaultColors:{ primary:"#C5D3DE", accent:"#362223" } },
  { id:"GT002", label:"Blush & Oxblood",    group:"classic",    defaultColors:{ primary:"#F0CED2", accent:"#362223" } },
  { id:"GT003", label:"Sage & Oxblood",     group:"classic",    defaultColors:{ primary:"#ACB1A1", accent:"#362223" } },
  { id:"GT004", label:"Sand & Oxblood",     group:"classic",    defaultColors:{ primary:"#E9DAC3", accent:"#362223" } },
  { id:"GT005", label:"White & Navy",       group:"classic",    defaultColors:{ primary:"#FFFFFF", accent:"#273878" } },
  // Sport Side: body + tapered side panels + outer half-sleeve
  { id:"GT006", label:"Olive & Black",      group:"sport-side", defaultColors:{ primary:"#576043", accent:"#000000" } },
  { id:"GT007", label:"Red & Black",        group:"sport-side", defaultColors:{ primary:"#DA1F26", accent:"#000000" } },
  { id:"GT008", label:"Navy & Black",       group:"sport-side", defaultColors:{ primary:"#273878", accent:"#000000" } },
  { id:"GT009", label:"Blush & Slate",      group:"sport-side", defaultColors:{ primary:"#F0CED2", accent:"#585858" } },
  // Triple Tone — primary body, accent collar+yoke, tertiary cuffs+hem
  { id:"GT010", label:"Pink/Black/Slate",   group:"triple",     defaultColors:{ primary:"#000000", accent:"#585858", tertiary:"#F0CED2" } },
  // Wave: wider tapered panels
  { id:"GT011", label:"Black & Slate",      group:"wave",       defaultColors:{ primary:"#000000", accent:"#585858" } },
  { id:"GT012", label:"Mint & Forest",      group:"wave",       defaultColors:{ primary:"#ACB1A1", accent:"#576043" } },
  { id:"GT013", label:"Blush & Cream",      group:"wave",       defaultColors:{ primary:"#F0CED2", accent:"#F8F4E9" } },
  { id:"GT014", label:"Sky & Cream",        group:"wave",       defaultColors:{ primary:"#C5D3DE", accent:"#F8F4E9" } },
  // Hourglass: vertical centre panel
  { id:"GT015", label:"Black & Blush",      group:"hourglass",  defaultColors:{ primary:"#000000", accent:"#F0CED2" } },
  { id:"GT016", label:"Sand & Cream",       group:"hourglass",  defaultColors:{ primary:"#E9DAC3", accent:"#F8F4E9" } },
  { id:"GT017", label:"Black & Slate",      group:"hourglass",  defaultColors:{ primary:"#000000", accent:"#585858" } },
  { id:"GT018", label:"Mint & Forest",      group:"hourglass",  defaultColors:{ primary:"#ACB1A1", accent:"#576043" } },
  // Pinstripe: vertical thin stripes + collar + cuffs
  { id:"GT019", label:"Forest & White",     group:"pinstripe",  defaultColors:{ primary:"#243C2F", accent:"#FFFFFF" } },
  { id:"GT020", label:"Slate & White",      group:"pinstripe",  defaultColors:{ primary:"#585858", accent:"#FFFFFF" } },
  { id:"GT021", label:"Black & White",      group:"pinstripe",  defaultColors:{ primary:"#000000", accent:"#FFFFFF" } },
  { id:"GT022", label:"Red & White",        group:"pinstripe",  defaultColors:{ primary:"#DA1F26", accent:"#FFFFFF" } },
  { id:"GT023", label:"Navy & White",       group:"pinstripe",  defaultColors:{ primary:"#273878", accent:"#FFFFFF" } },
  // Raglan: full-accent sleeves + collar + thin hem
  { id:"GT024", label:"Black & Blush",      group:"raglan",     defaultColors:{ primary:"#000000", accent:"#F0CED2" } },
  { id:"GT025", label:"Forest & Blush",     group:"raglan",     defaultColors:{ primary:"#243C2F", accent:"#F0CED2" } },
  { id:"GT026", label:"Red & White",        group:"raglan",     defaultColors:{ primary:"#DA1F26", accent:"#FFFFFF" } },
  { id:"GT027", label:"Forest & Mint",      group:"raglan",     defaultColors:{ primary:"#576043", accent:"#ACB1A1" } },
  { id:"GT028", label:"Forest & White",     group:"raglan",     defaultColors:{ primary:"#243C2F", accent:"#FFFFFF" } },
  { id:"GT029", label:"Black & Red",        group:"raglan",     defaultColors:{ primary:"#000000", accent:"#DA1F26" } },
  { id:"GT030", label:"Black & Slate",      group:"raglan",     defaultColors:{ primary:"#000000", accent:"#585858" } },
  { id:"GT031", label:"Navy & White",       group:"raglan",     defaultColors:{ primary:"#273878", accent:"#FFFFFF" } },
  { id:"GT032", label:"Oxblood & Sand",     group:"raglan",     defaultColors:{ primary:"#362223", accent:"#E9DAC3" } },
];

// Kept for any legacy callers that still want the export; no longer used by
// the renderer. Prefer the procedural draw below.
export const GT_BASE_TEXTURES: Record<string, string> = {};

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL RENDERER
// ─────────────────────────────────────────────────────────────────────────────

const GT_TAG = "__kashaGtBg__";
const CANVAS_PX = 1024;

// Trim thicknesses (proportional to zone height)
const HEM_FRAC      = 0.05; // bottom hem band on front/back
const CUFF_FRAC     = 0.18; // bottom cuff band on sleeves
const RAGLAN_SLEEVE = 1.00; // raglan = entire sleeve in accent
const HOURGLASS_W   = 0.28; // centre panel = 28% of zone width

type Zone = { left:number; top:number; w:number; h:number };
const Z = ZONE_PRESETS;

/** Fill a zone rectangle with `color` (no anti-alias issues since we're drawing
 *  axis-aligned rects on a pixel grid). */
function fillZone(ctx: CanvasRenderingContext2D, z: Zone, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(z.left, z.top, z.w, z.h);
}

/** Bottom band of a zone — used for hem (front/back) and cuff (sleeves). */
function fillBottomBand(
  ctx: CanvasRenderingContext2D, z: Zone, color: string, frac: number,
): void {
  const h = Math.max(8, Math.round(z.h * frac));
  ctx.fillStyle = color;
  ctx.fillRect(z.left, z.top + z.h - h, z.w, h);
}

/** Thin vertical stripes evenly spaced across a zone. */
function drawPinstripes(
  ctx: CanvasRenderingContext2D, z: Zone, color: string,
  count = 7, stripeW = 4,
): void {
  ctx.fillStyle = color;
  const step = z.w / (count + 1);
  for (let i = 1; i <= count; i++) {
    const x = Math.round(z.left + i * step - stripeW / 2);
    ctx.fillRect(x, z.top, stripeW, z.h);
  }
}

/** Tapered side panel — wider at bottom, narrow at top. Drawn as a triangle/
 *  trapezoid along the LEFT or RIGHT edge of a zone. */
function drawSidePanel(
  ctx: CanvasRenderingContext2D, z: Zone, color: string,
  side: "left" | "right", topFrac: number, bottomFrac: number,
): void {
  ctx.fillStyle = color;
  const topW    = z.w * topFrac;
  const bottomW = z.w * bottomFrac;
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(z.left,             z.top);
    ctx.lineTo(z.left + topW,      z.top);
    ctx.lineTo(z.left + bottomW,   z.top + z.h);
    ctx.lineTo(z.left,             z.top + z.h);
  } else {
    ctx.moveTo(z.left + z.w,             z.top);
    ctx.lineTo(z.left + z.w - topW,      z.top);
    ctx.lineTo(z.left + z.w - bottomW,   z.top + z.h);
    ctx.lineTo(z.left + z.w,             z.top + z.h);
  }
  ctx.closePath();
  ctx.fill();
}

/** Vertical centre panel running top-to-bottom of a zone. */
function drawCentrePanel(
  ctx: CanvasRenderingContext2D, z: Zone, color: string, widthFrac: number,
): void {
  const w  = z.w * widthFrac;
  const x  = z.left + (z.w - w) / 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, z.top, w, z.h);
}

/** Outer-half of a sleeve (the side furthest from the body). */
function fillOuterHalf(
  ctx: CanvasRenderingContext2D, z: Zone, color: string, side: "left" | "right",
): void {
  ctx.fillStyle = color;
  const halfW = z.w * 0.55;
  const x = side === "left" ? z.left : z.left + z.w - halfW;
  ctx.fillRect(x, z.top, halfW, z.h);
}

/** Render the full 1024×1024 GT texture for a given style + colours and
 *  return a data URL. */
function renderGtTexture(style: GtStyleDef, colors: GtColors): string {
  const cv = document.createElement("canvas");
  cv.width = CANVAS_PX; cv.height = CANVAS_PX;
  const ctx = cv.getContext("2d")!;
  // Transparent background so anything outside the UV islands stays clear
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  const P = colors.primary;
  const A = colors.accent;
  const T = colors.tertiary ?? colors.accent;

  // 1. BODY FILL — every group starts with primary on body + sleeves.
  fillZone(ctx, Z.front,        P);
  fillZone(ctx, Z.back,         P);
  fillZone(ctx, Z.leftSleeve,   P);
  fillZone(ctx, Z.rightSleeve,  P);

  switch (style.group) {
    case "classic": {
      // Brown collar, thin cuff trim, thin hem trim. Matches GT001-GT005 spec.
      fillZone(ctx, Z.collar, A);
      fillBottomBand(ctx, Z.front,       A, HEM_FRAC);
      fillBottomBand(ctx, Z.back,        A, HEM_FRAC);
      fillBottomBand(ctx, Z.leftSleeve,  A, CUFF_FRAC);
      fillBottomBand(ctx, Z.rightSleeve, A, CUFF_FRAC);
      break;
    }
    case "sport-side": {
      // Tapered side panels along outer edges of front + back, plus outer
      // half of each sleeve in accent.
      drawSidePanel(ctx, Z.front, A, "left",  0.05, 0.20);
      drawSidePanel(ctx, Z.front, A, "right", 0.05, 0.20);
      drawSidePanel(ctx, Z.back,  A, "left",  0.05, 0.20);
      drawSidePanel(ctx, Z.back,  A, "right", 0.05, 0.20);
      fillOuterHalf(ctx, Z.leftSleeve,  A, "left");
      fillOuterHalf(ctx, Z.rightSleeve, A, "right");
      fillZone(ctx, Z.collar, A);
      break;
    }
    case "triple": {
      // 3-tone: primary body, accent yoke (top half of front/back), tertiary
      // cuffs + hem.
      ctx.fillStyle = A;
      ctx.fillRect(Z.front.left, Z.front.top, Z.front.w, Z.front.h * 0.40);
      ctx.fillRect(Z.back.left,  Z.back.top,  Z.back.w,  Z.back.h  * 0.40);
      fillZone(ctx, Z.collar, A);
      fillBottomBand(ctx, Z.front,       T, HEM_FRAC);
      fillBottomBand(ctx, Z.back,        T, HEM_FRAC);
      fillBottomBand(ctx, Z.leftSleeve,  T, CUFF_FRAC);
      fillBottomBand(ctx, Z.rightSleeve, T, CUFF_FRAC);
      break;
    }
    case "wave": {
      // Wider tapered panels than sport-side; full accent collar + cuffs.
      drawSidePanel(ctx, Z.front, A, "left",  0.08, 0.38);
      drawSidePanel(ctx, Z.front, A, "right", 0.08, 0.38);
      drawSidePanel(ctx, Z.back,  A, "left",  0.08, 0.38);
      drawSidePanel(ctx, Z.back,  A, "right", 0.08, 0.38);
      fillBottomBand(ctx, Z.leftSleeve,  A, CUFF_FRAC * 1.3);
      fillBottomBand(ctx, Z.rightSleeve, A, CUFF_FRAC * 1.3);
      fillZone(ctx, Z.collar, A);
      break;
    }
    case "hourglass": {
      // Vertical centre panel, plus accent collar + thin cuff trim.
      drawCentrePanel(ctx, Z.front, A, HOURGLASS_W);
      drawCentrePanel(ctx, Z.back,  A, HOURGLASS_W);
      fillZone(ctx, Z.collar, A);
      fillBottomBand(ctx, Z.leftSleeve,  A, CUFF_FRAC * 0.6);
      fillBottomBand(ctx, Z.rightSleeve, A, CUFF_FRAC * 0.6);
      break;
    }
    case "pinstripe": {
      // Vertical thin stripes on body + accent collar + thin cuff trim.
      drawPinstripes(ctx, Z.front, A, 7, 4);
      drawPinstripes(ctx, Z.back,  A, 7, 4);
      fillZone(ctx, Z.collar, A);
      fillBottomBand(ctx, Z.leftSleeve,  A, CUFF_FRAC * 0.5);
      fillBottomBand(ctx, Z.rightSleeve, A, CUFF_FRAC * 0.5);
      break;
    }
    case "raglan": {
      // Sleeves entirely in accent; accent collar; thin hem trim on body.
      fillZone(ctx, Z.leftSleeve,  A);
      fillZone(ctx, Z.rightSleeve, A);
      fillZone(ctx, Z.collar,      A);
      fillBottomBand(ctx, Z.front, A, HEM_FRAC * RAGLAN_SLEEVE);
      fillBottomBand(ctx, Z.back,  A, HEM_FRAC * RAGLAN_SLEEVE);
      break;
    }
  }

  return cv.toDataURL("image/png");
}

// ─────────────────────────────────────────────────────────────────────────────
// FABRIC INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/** Remove the GT background layer */
export function clearGtStyle(fc: fabric.Canvas): void {
  fc.getObjects()
    .filter((o) => (o as any).data?.tag === GT_TAG)
    .forEach((o) => fc.remove(o));
}

/** Apply a GT style — renders the texture procedurally with the given colours
 *  and adds it to the canvas as the bottom-most editable layer. */
export async function applyGtStyle(
  fc:           fabric.Canvas,
  style:        GtStyleDef,
  customColors?: Partial<GtColors>,
): Promise<void> {
  const colors: GtColors = { ...style.defaultColors, ...customColors };
  const textureUrl = renderGtTexture(style, colors);

  clearGtStyle(fc);

  const img = await fabric.FabricImage.fromURL(textureUrl, { crossOrigin: "anonymous" });
  img.set({
    left: 0, top: 0,
    width: CANVAS_PX, height: CANVAS_PX,
    scaleX: 1, scaleY: 1,
    originX: "left", originY: "top",
    // Editable on the CANVAS tab — the customer can drag / scale / rotate
    // the GT print so they can reposition it over a specific zone.
    selectable: true, evented: true,
    data: { tag: GT_TAG, styleId: style.id },
  } as any);

  fc.add(img);
  fc.sendObjectToBack(img);
  fc.renderAll();
}

/** Recolour the active GT style and sync the 3D texture. */
export async function recolorGtStyle(
  fc:          fabric.Canvas,
  style:       GtStyleDef,
  newColors:   Partial<GtColors>,
  syncTexture: () => void,
): Promise<void> {
  await applyGtStyle(fc, style, newColors);
  syncTexture();
}
