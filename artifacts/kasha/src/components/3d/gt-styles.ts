// ─────────────────────────────────────────────────────────────────────────────
// gt-styles.ts  —  KA.SHA GT Design Style System (GT001–GT032)
//
// HOW IT WORKS:
//   1. Each GT style is a list of layer instructions (fillZone, sidePanels,
//      hemBand, sleeveBand, hourglassPanel, raglanYoke, pinstripes).
//   2. renderTexture() paints the layers onto a NATIVE 1024×1024 HTML canvas —
//      coordinates are pixel-perfect with the UV map (no Fabric scaling).
//   3. applyGtStyle() loads the resulting PNG dataURL as a single FabricImage
//      covering the entire texture canvas, sent to back so text/logos/prints
//      stay on top.
//   4. Recoloring = simply re-render with new colors and swap the image.
//      No pixel-walk, no edge fringing.
// ─────────────────────────────────────────────────────────────────────────────

import * as fabric from "fabric";

// ── Zone bounding boxes (top-left origin, 1024×1024 canvas) ─────────────────
// Measured from collar_t-shirt_model.glb via UV island detection.
export const UV_ZONES = {
  front:       { x0: 10,  y0: 341, x1: 500,  y1: 1019 },
  back:        { x0: 524, y0: 188, x1: 1007, y1: 1021 },
  collar:      { x0: 12,  y0: 183, x1: 519,  y1: 349  },
  leftSleeve:  { x0: 210, y0: 4,   x1: 608,  y1: 174  },
  rightSleeve: { x0: 617, y0: 2,   x1: 1015, y1: 173  },
} as const;

export type UVZoneName = keyof typeof UV_ZONES;
const ALL_ZONES: UVZoneName[] = ["collar", "leftSleeve", "rightSleeve", "front", "back"];

// ── Colour roles ─────────────────────────────────────────────────────────────
export type ColorRole = "primary" | "accent" | "tertiary";

export interface GtColors {
  primary:   string;
  accent:    string;
  tertiary?: string;
}

// ── Layer types ──────────────────────────────────────────────────────────────
type LayerType =
  | "fillZone"          // solid fill of all zones, or just collar (zone:0)
  | "sidePanels"        // curved side panels on front+back + solid sleeves
  | "wavePanels"        // exaggerated curved side panels (wave group)
  | "sleeveBand"        // horizontal band at bottom of sleeves (cuffs)
  | "hemBand"           // horizontal band at bottom of front+back (hem)
  | "hourglassPanel"    // centre hourglass shape on front+back
  | "raglanYoke"        // diagonal raglan stripe at shoulders
  | "pinstripes";       // thin vertical lines on body

interface DrawLayer {
  type:    LayerType;
  role:    ColorRole;
  params?: Record<string, number>;
}

// ── Style definition ─────────────────────────────────────────────────────────
export interface GtStyleDef {
  id:            string;
  label:         string;
  group:         string;
  defaultColors: GtColors;
  layers:        DrawLayer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GT STYLE CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────
export const GT_STYLES: GtStyleDef[] = [
  // ── Classic (GT001–GT005): solid body + contrast collar/cuffs/hem ─────────
  { id:"GT001", label:"Sky & Oxblood",   group:"classic", defaultColors:{primary:"#C5D3DE", accent:"#362223"},
    layers:[{type:"fillZone",role:"primary"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.18}},{type:"hemBand",role:"accent",params:{frac:0.07}}]},
  { id:"GT002", label:"Blush & Oxblood", group:"classic", defaultColors:{primary:"#F0CED2", accent:"#362223"},
    layers:[{type:"fillZone",role:"primary"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.18}},{type:"hemBand",role:"accent",params:{frac:0.07}}]},
  { id:"GT003", label:"Sage & Oxblood",  group:"classic", defaultColors:{primary:"#ACB1A1", accent:"#362223"},
    layers:[{type:"fillZone",role:"primary"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.18}},{type:"hemBand",role:"accent",params:{frac:0.07}}]},
  { id:"GT004", label:"Sand & Oxblood",  group:"classic", defaultColors:{primary:"#E9DAC3", accent:"#362223"},
    layers:[{type:"fillZone",role:"primary"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.18}},{type:"hemBand",role:"accent",params:{frac:0.07}}]},
  { id:"GT005", label:"White & Navy",    group:"classic", defaultColors:{primary:"#FFFFFF", accent:"#273878"},
    layers:[{type:"fillZone",role:"primary"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.18}},{type:"hemBand",role:"accent",params:{frac:0.07}}]},

  // ── Sport-Side (GT006–GT009): curved side panels + full accent sleeves ────
  { id:"GT006", label:"Olive & Black",   group:"sport-side", defaultColors:{primary:"#576043", accent:"#000000"},
    layers:[{type:"fillZone",role:"primary"},{type:"sidePanels",role:"accent",params:{frac:0.26}}]},
  { id:"GT007", label:"Red & Black",     group:"sport-side", defaultColors:{primary:"#DA1F26", accent:"#000000"},
    layers:[{type:"fillZone",role:"primary"},{type:"sidePanels",role:"accent",params:{frac:0.26}}]},
  { id:"GT008", label:"Navy & Black",    group:"sport-side", defaultColors:{primary:"#273878", accent:"#000000"},
    layers:[{type:"fillZone",role:"primary"},{type:"sidePanels",role:"accent",params:{frac:0.26}}]},
  { id:"GT009", label:"Blush & Slate",   group:"sport-side", defaultColors:{primary:"#F0CED2", accent:"#585858"},
    layers:[{type:"fillZone",role:"primary"},{type:"sidePanels",role:"accent",params:{frac:0.26}}]},

  // ── Triple (GT010): curved side panels + tertiary collar ──────────────────
  { id:"GT010", label:"Blush/Black/Slate", group:"triple", defaultColors:{primary:"#000000", accent:"#585858", tertiary:"#F0CED2"},
    layers:[{type:"fillZone",role:"primary"},{type:"sidePanels",role:"accent",params:{frac:0.30}},{type:"fillZone",role:"tertiary",params:{zone:0}}]},

  // ── Wave (GT011–GT014): wider, exaggerated wavy panels ────────────────────
  { id:"GT011", label:"Black & Slate",   group:"wave", defaultColors:{primary:"#000000", accent:"#585858"},
    layers:[{type:"fillZone",role:"primary"},{type:"wavePanels",role:"accent",params:{frac:0.34}}]},
  { id:"GT012", label:"Mint & Forest",   group:"wave", defaultColors:{primary:"#ACB1A1", accent:"#576043"},
    layers:[{type:"fillZone",role:"primary"},{type:"wavePanels",role:"accent",params:{frac:0.34}}]},
  { id:"GT013", label:"Blush & Cream",   group:"wave", defaultColors:{primary:"#F0CED2", accent:"#F8F4E9"},
    layers:[{type:"fillZone",role:"primary"},{type:"wavePanels",role:"accent",params:{frac:0.34}}]},
  { id:"GT014", label:"Sky & Cream",     group:"wave", defaultColors:{primary:"#C5D3DE", accent:"#F8F4E9"},
    layers:[{type:"fillZone",role:"primary"},{type:"wavePanels",role:"accent",params:{frac:0.34}}]},

  // ── Hourglass (GT015–GT018): primary fills sides; accent hourglass centre ─
  { id:"GT015", label:"Blush & Black",   group:"hourglass", defaultColors:{primary:"#000000", accent:"#F0CED2"},
    layers:[{type:"fillZone",role:"primary"},{type:"hourglassPanel",role:"accent"}]},
  { id:"GT016", label:"Sand & Cream",    group:"hourglass", defaultColors:{primary:"#E9DAC3", accent:"#F8F4E9"},
    layers:[{type:"fillZone",role:"primary"},{type:"hourglassPanel",role:"accent"}]},
  { id:"GT017", label:"Black & Slate",   group:"hourglass", defaultColors:{primary:"#000000", accent:"#585858"},
    layers:[{type:"fillZone",role:"primary"},{type:"hourglassPanel",role:"accent"}]},
  { id:"GT018", label:"Mint & Forest",   group:"hourglass", defaultColors:{primary:"#ACB1A1", accent:"#576043"},
    layers:[{type:"fillZone",role:"primary"},{type:"hourglassPanel",role:"accent"}]},

  // ── Pinstripe (GT019–GT023): pinstripes on body ───────────────────────────
  { id:"GT019", label:"Forest & White",  group:"pinstripe", defaultColors:{primary:"#243C2F", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"pinstripes",role:"accent",params:{spacing:36,width:3}}]},
  { id:"GT020", label:"Slate & White",   group:"pinstripe", defaultColors:{primary:"#585858", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"pinstripes",role:"accent",params:{spacing:36,width:3}}]},
  { id:"GT021", label:"Black & White",   group:"pinstripe", defaultColors:{primary:"#000000", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"pinstripes",role:"accent",params:{spacing:36,width:3}}]},
  { id:"GT022", label:"Red & White",     group:"pinstripe", defaultColors:{primary:"#DA1F26", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"pinstripes",role:"accent",params:{spacing:36,width:3}}]},
  { id:"GT023", label:"Navy & White",    group:"pinstripe", defaultColors:{primary:"#273878", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"pinstripes",role:"accent",params:{spacing:36,width:3}}]},

  // ── Raglan (GT024–GT032): diagonal yoke + accent collar + sleeve cuff ─────
  { id:"GT024", label:"Black & Blush",   group:"raglan", defaultColors:{primary:"#000000", accent:"#F0CED2"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT025", label:"Forest & Blush",  group:"raglan", defaultColors:{primary:"#243C2F", accent:"#F0CED2"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT026", label:"Red & White",     group:"raglan", defaultColors:{primary:"#DA1F26", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT027", label:"Forest & Mint",   group:"raglan", defaultColors:{primary:"#576043", accent:"#ACB1A1"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT028", label:"Forest & White",  group:"raglan", defaultColors:{primary:"#243C2F", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT029", label:"Black & Red",     group:"raglan", defaultColors:{primary:"#000000", accent:"#DA1F26"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT030", label:"Black & Slate",   group:"raglan", defaultColors:{primary:"#000000", accent:"#585858"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT031", label:"Navy & White",    group:"raglan", defaultColors:{primary:"#273878", accent:"#FFFFFF"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
  { id:"GT032", label:"Oxblood & Sand",  group:"raglan", defaultColors:{primary:"#362223", accent:"#E9DAC3"},
    layers:[{type:"fillZone",role:"primary"},{type:"raglanYoke",role:"accent"},{type:"fillZone",role:"accent",params:{zone:0}},{type:"sleeveBand",role:"accent",params:{frac:0.16}}]},
];

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE-CANVAS RENDERER  (1024×1024, pixel-perfect with UV space)
// ─────────────────────────────────────────────────────────────────────────────

const TEX_SIZE = 1024;
const GT_BG_TAG = "__kashaGtBg__";

function getColor(colors: GtColors, role: ColorRole): string {
  if (role === "accent")   return colors.accent;
  if (role === "tertiary") return colors.tertiary ?? colors.accent;
  return colors.primary;
}

function paintFillZone(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer): void {
  ctx.fillStyle = color;
  const zoneParam = layer.params?.zone;
  const zones: UVZoneName[] = zoneParam === 0 ? ["collar"] : ALL_ZONES;
  for (const name of zones) {
    const z = UV_ZONES[name];
    ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
  }
}

/**
 * Curved side panels: per-side panel that's wide at the shoulder, narrows at
 * the waist, widens at the hem — matching the GT006 / GT017 sport silhouette.
 * Sleeves are filled solid in the same color.
 */
function paintSidePanels(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer, exaggerate = false): void {
  ctx.fillStyle = color;
  const frac      = layer.params?.frac ?? 0.26;
  const waistMul  = exaggerate ? 0.55 : 0.70;   // fraction of frac at narrowest point

  for (const name of ["front", "back"] as UVZoneName[]) {
    const z = UV_ZONES[name];
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    const pw      = w * frac;          // panel width at top/bottom
    const waistW  = pw * waistMul;     // panel width at waist
    const waistY  = z.y0 + h * 0.55;
    const cpY1    = z.y0 + h * 0.30;   // upper control point Y
    const cpY2    = z.y0 + h * 0.80;   // lower control point Y

    // LEFT panel of this body zone (curved inward then back outward)
    ctx.beginPath();
    ctx.moveTo(z.x0,        z.y0);
    ctx.lineTo(z.x0 + pw,   z.y0);
    ctx.bezierCurveTo(z.x0 + pw,     cpY1, z.x0 + waistW, cpY1, z.x0 + waistW, waistY);
    ctx.bezierCurveTo(z.x0 + waistW, cpY2, z.x0 + pw,     cpY2, z.x0 + pw,     z.y1);
    ctx.lineTo(z.x0,        z.y1);
    ctx.closePath();
    ctx.fill();

    // RIGHT panel (mirror)
    ctx.beginPath();
    ctx.moveTo(z.x1,        z.y0);
    ctx.lineTo(z.x1 - pw,   z.y0);
    ctx.bezierCurveTo(z.x1 - pw,     cpY1, z.x1 - waistW, cpY1, z.x1 - waistW, waistY);
    ctx.bezierCurveTo(z.x1 - waistW, cpY2, z.x1 - pw,     cpY2, z.x1 - pw,     z.y1);
    ctx.lineTo(z.x1,        z.y1);
    ctx.closePath();
    ctx.fill();
  }

  // Solid accent sleeves
  for (const name of ["leftSleeve", "rightSleeve"] as UVZoneName[]) {
    const z = UV_ZONES[name];
    ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
  }
}

function paintWavePanels(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer): void {
  paintSidePanels(ctx, color, layer, /*exaggerate=*/true);
}

function paintSleeveBand(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer): void {
  ctx.fillStyle = color;
  const frac = layer.params?.frac ?? 0.16;
  for (const name of ["leftSleeve", "rightSleeve"] as UVZoneName[]) {
    const z  = UV_ZONES[name];
    const bh = Math.round((z.y1 - z.y0) * frac);
    ctx.fillRect(z.x0, z.y1 - bh, z.x1 - z.x0, bh);
  }
}

function paintHemBand(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer): void {
  ctx.fillStyle = color;
  const frac = layer.params?.frac ?? 0.07;
  for (const name of ["front", "back"] as UVZoneName[]) {
    const z  = UV_ZONES[name];
    const bh = Math.round((z.y1 - z.y0) * frac);
    ctx.fillRect(z.x0, z.y1 - bh, z.x1 - z.x0, bh);
  }
}

/** Centre hourglass panel: narrows at waist, widens at top/bottom. */
function paintHourglassPanel(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  for (const name of ["front", "back"] as UVZoneName[]) {
    const z  = UV_ZONES[name];
    const w  = z.x1 - z.x0;
    const h  = z.y1 - z.y0;
    const cx = (z.x0 + z.x1) / 2;

    const topW    = w * 0.50;
    const waistW  = w * 0.22;
    const bottomW = w * 0.50;
    const waistY  = z.y0 + h * 0.55;
    const cpY1    = z.y0 + h * 0.25;
    const cpY2    = z.y0 + h * 0.85;

    ctx.beginPath();
    ctx.moveTo(cx - topW / 2,    z.y0);
    // right side, top → waist
    ctx.lineTo(cx + topW / 2,    z.y0);
    ctx.bezierCurveTo(cx + topW / 2,   cpY1, cx + waistW / 2, cpY1, cx + waistW / 2, waistY);
    ctx.bezierCurveTo(cx + waistW / 2, cpY2, cx + bottomW / 2, cpY2, cx + bottomW / 2, z.y1);
    // bottom → left side, back up to top
    ctx.lineTo(cx - bottomW / 2, z.y1);
    ctx.bezierCurveTo(cx - bottomW / 2, cpY2, cx - waistW / 2, cpY2, cx - waistW / 2, waistY);
    ctx.bezierCurveTo(cx - waistW / 2,  cpY1, cx - topW / 2,   cpY1, cx - topW / 2,   z.y0);
    ctx.closePath();
    ctx.fill();
  }
}

/** Diagonal raglan yoke at the shoulders of front+back. */
function paintRaglanYoke(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  for (const name of ["front", "back"] as UVZoneName[]) {
    const z  = UV_ZONES[name];
    const w  = z.x1 - z.x0;
    const h  = z.y1 - z.y0;
    const yd = h * (name === "front" ? 0.22 : 0.16);

    // Left diagonal
    ctx.beginPath();
    ctx.moveTo(z.x0,                   z.y0);
    ctx.lineTo(z.x0 + w * 0.40,        z.y0);
    ctx.lineTo(z.x0 + w * 0.14,        z.y0 + yd);
    ctx.lineTo(z.x0,                   z.y0 + yd * 0.55);
    ctx.closePath();
    ctx.fill();

    // Right diagonal
    ctx.beginPath();
    ctx.moveTo(z.x1,                   z.y0);
    ctx.lineTo(z.x1 - w * 0.40,        z.y0);
    ctx.lineTo(z.x1 - w * 0.14,        z.y0 + yd);
    ctx.lineTo(z.x1,                   z.y0 + yd * 0.55);
    ctx.closePath();
    ctx.fill();
  }
}

function paintPinstripes(ctx: CanvasRenderingContext2D, color: string, layer: DrawLayer): void {
  ctx.fillStyle = color;
  const spacing = Math.round(layer.params?.spacing ?? 36);
  const lineW   = Math.round(layer.params?.width   ?? 3);
  for (const name of ["front", "back"] as UVZoneName[]) {
    const z = UV_ZONES[name];
    // Snap to integer pixel coordinates so stripes are crisp (no sub-pixel blur).
    let x = z.x0 + spacing;
    while (x < z.x1) {
      const xi = Math.round(x - lineW / 2);
      ctx.fillRect(xi, z.y0, lineW, z.y1 - z.y0);
      x += spacing;
    }
  }
}

/** Render one GT style to a 1024×1024 PNG dataURL. */
function renderTexture(style: GtStyleDef, colors: GtColors): string {
  const canvas = document.createElement("canvas");
  canvas.width  = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.imageSmoothingEnabled = false;       // crisp edges
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  for (const layer of style.layers) {
    const color = getColor(colors, layer.role);
    switch (layer.type) {
      case "fillZone":       paintFillZone(ctx, color, layer);       break;
      case "sidePanels":     paintSidePanels(ctx, color, layer);     break;
      case "wavePanels":     paintWavePanels(ctx, color, layer);     break;
      case "sleeveBand":     paintSleeveBand(ctx, color, layer);     break;
      case "hemBand":        paintHemBand(ctx, color, layer);        break;
      case "hourglassPanel": paintHourglassPanel(ctx, color);        break;
      case "raglanYoke":     paintRaglanYoke(ctx, color);            break;
      case "pinstripes":     paintPinstripes(ctx, color, layer);     break;
    }
  }
  return canvas.toDataURL("image/png");
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/** Remove the GT background image from the Fabric canvas. */
export function clearGtStyle(fc: fabric.Canvas): void {
  // Bumping the version invalidates any in-flight applyGtStyle() so a stale
  // image can't reappear after a clear.
  applyVersion++;
  const toRemove = fc.getObjects().filter(
    (o) => (o as any).data?.tag === GT_BG_TAG
  );
  toRemove.forEach((o) => fc.remove(o));
  fc.renderAll();
}

// Monotonic version token — every applyGtStyle / clearGtStyle call bumps this.
// After awaiting FabricImage.fromURL we compare against the captured version;
// if it changed, a newer call has superseded us and we discard our result.
let applyVersion = 0;

/** Render the GT style and apply it as the bottom-most image on the canvas. */
export async function applyGtStyle(
  fc: fabric.Canvas,
  style: GtStyleDef,
  customColors?: Partial<GtColors>,
): Promise<void> {
  const myVersion = ++applyVersion;
  const colors: GtColors = { ...style.defaultColors, ...customColors };

  // Build the 1024×1024 texture
  const dataUrl = renderTexture(style, colors);
  if (!dataUrl) return;

  // Load as Fabric image covering the full canvas
  const img = await fabric.FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });

  // If a newer apply/clear call has happened while we were awaiting, drop this
  // result — never mutate the canvas with stale data.
  if (myVersion !== applyVersion) return;

  img.set({
    left:       0,
    top:        0,
    scaleX:     1,
    scaleY:     1,
    originX:    "left",
    originY:    "top",
    selectable: false,
    evented:    false,
    data:       { tag: GT_BG_TAG, styleId: style.id },
  } as any);

  // Remove the previous GT image (if any) AFTER the new one is loaded —
  // this avoids a momentary flash of the underlying canvas.
  const old = fc.getObjects().filter((o) => (o as any).data?.tag === GT_BG_TAG);

  fc.add(img);
  fc.sendObjectToBack(img);
  old.forEach((o) => fc.remove(o));
  fc.renderAll();
}
