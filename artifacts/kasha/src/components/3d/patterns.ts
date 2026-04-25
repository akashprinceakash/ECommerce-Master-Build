// ─── KA.SHA Customizer — Pattern & Zone Registry ──────────────────────────
// Curated catalogue of polo "patterns" (style families) shown in the 3D
// Customizer "Patterns" panel + the calibrated UV zones used to auto-place
// any image onto the correct panel of the t-shirt model.
//
// Files live in `artifacts/kasha/public/patterns/` and are served from
// `${import.meta.env.BASE_URL}patterns/<file>`.
//
// To add a new pattern: drop the .jpg/.png into the folder above and append
// an entry to `PATTERNS` below. The customizer picks it up automatically.

export interface PatternColorway {
  code: string;          // e.g. "GT001"
  file: string;          // filename of the colorway artwork (used as thumbnail)
  colors: string[];      // hex codes shown as little swatches
  label?: string;        // optional descriptor
}

export interface PatternDef {
  id: string;            // stable id used in fabric `data.kashaPrintId`
  label: string;         // headline label shown in the UI
  file: string;          // primary artwork (the one placed on the canvas)
  swatchColors: string[];// quick-glance palette for the card
  // Optional fields — present on curated GT families, absent on user uploads.
  range?: string;        // e.g. "GT001 – GT005"
  colorways?: PatternColorway[]; // every GT colorway in the family
}

// ── 7 Pattern families (one per GT range) ────────────────────────────────
export const PATTERNS: PatternDef[] = [
  {
    id: "gt001-005",
    label: "Classic Polo",
    range: "GT001 – GT005",
    file: "gt001.jpg",
    swatchColors: ["#C5D3DE", "#F0CED2", "#ACB1A1", "#E9DAC3", "#FFFFFF", "#362223"],
    colorways: [
      { code: "GT001", file: "gt001.jpg", colors: ["#C5D3DE", "#362223"] },
      { code: "GT002", file: "gt002.jpg", colors: ["#F0CED2", "#362223"] },
      { code: "GT003", file: "gt003.jpg", colors: ["#ACB1A1", "#362223"] },
      { code: "GT004", file: "gt001.jpg", colors: ["#E9DAC3", "#362223"] },
      { code: "GT005", file: "gt001.jpg", colors: ["#FFFFFF", "#273878"] },
    ],
  },
  {
    id: "gt006-009",
    label: "Athletic Panel Polo",
    range: "GT006 – GT009",
    file: "gt006.jpg",
    swatchColors: ["#576043", "#DA1F26", "#273878", "#000000"],
    colorways: [
      { code: "GT006", file: "gt006.jpg", colors: ["#576043", "#000000"] },
      { code: "GT007", file: "gt007.jpg", colors: ["#000000", "#DA1F26"] },
      { code: "GT008", file: "gt008.jpg", colors: ["#000000", "#273878"] },
      { code: "GT009", file: "gt006.jpg", colors: ["#F0CED2", "#585858"] },
    ],
  },
  {
    id: "gt010",
    label: "Tri-Tone Panel Polo",
    range: "GT010",
    file: "gt010.jpg",
    swatchColors: ["#F0CED2", "#000000", "#585858"],
    colorways: [
      { code: "GT010", file: "gt010.jpg", colors: ["#F0CED2", "#000000", "#585858"] },
    ],
  },
  {
    id: "gt011-014",
    label: "Mono Panel Polo",
    range: "GT011 – GT014",
    file: "gt011.jpg",
    swatchColors: ["#000000", "#585858"],
    colorways: [
      { code: "GT011", file: "gt011.jpg", colors: ["#000000", "#585858"] },
      { code: "GT012", file: "gt011.jpg", colors: ["#ACB1A1", "#576043"] },
      { code: "GT013", file: "gt011.jpg", colors: ["#273878", "#FFFFFF"] },
      { code: "GT014", file: "gt011.jpg", colors: ["#DA1F26", "#000000"] },
    ],
  },
  {
    id: "gt015-018",
    label: "Wave Panel Polo",
    range: "GT015 – GT018",
    file: "gt017.jpg",
    swatchColors: ["#000000", "#585858", "#ACB1A1", "#576043"],
    colorways: [
      { code: "GT015", file: "gt017.jpg", colors: ["#FFFFFF", "#273878"] },
      { code: "GT016", file: "gt017.jpg", colors: ["#F0CED2", "#362223"] },
      { code: "GT017", file: "gt017.jpg", colors: ["#000000", "#585858"] },
      { code: "GT018", file: "gt018.jpg", colors: ["#ACB1A1", "#576043"] },
    ],
  },
  {
    id: "gt019-023",
    label: "Seam-Line Polo",
    range: "GT019 – GT023",
    file: "gt019.jpg",
    swatchColors: ["#243C2F", "#585858", "#FFFFFF"],
    colorways: [
      { code: "GT019", file: "gt019.jpg", colors: ["#243C2F", "#FFFFFF"] },
      { code: "GT020", file: "gt020.jpg", colors: ["#585858", "#FFFFFF"] },
      { code: "GT021", file: "gt019.jpg", colors: ["#273878", "#FFFFFF"] },
      { code: "GT022", file: "gt019.jpg", colors: ["#000000", "#FFFFFF"] },
      { code: "GT023", file: "gt019.jpg", colors: ["#DA1F26", "#FFFFFF"] },
    ],
  },
  {
    id: "gt024-032",
    label: "Shoulder-Yoke Polo",
    range: "GT024 – GT032",
    file: "gt024.jpg",
    swatchColors: ["#000000", "#243C2F", "#DA1F26", "#F0CED2", "#FFFFFF"],
    colorways: [
      { code: "GT024", file: "gt024.jpg", colors: ["#F0CED2", "#000000"] },
      { code: "GT025", file: "gt025.jpg", colors: ["#F0CED2", "#243C2F"] },
      { code: "GT026", file: "gt026.jpg", colors: ["#DA1F26", "#FFFFFF"] },
      { code: "GT027", file: "gt024.jpg", colors: ["#273878", "#FFFFFF"] },
      { code: "GT028", file: "gt024.jpg", colors: ["#000000", "#FFFFFF"] },
      { code: "GT029", file: "gt024.jpg", colors: ["#585858", "#F0CED2"] },
      { code: "GT030", file: "gt024.jpg", colors: ["#576043", "#FFFFFF"] },
      { code: "GT031", file: "gt024.jpg", colors: ["#362223", "#F0CED2"] },
      { code: "GT032", file: "gt024.jpg", colors: ["#ACB1A1", "#000000"] },
    ],
  },
];

// ── Zones ────────────────────────────────────────────────────────────────
export type PatternZone = "front" | "back" | "leftSleeve" | "rightSleeve" | "collar";

export const ZONE_LABEL: Record<PatternZone, string> = {
  front: "Front",
  back: "Back",
  leftSleeve: "Left Sleeve",
  rightSleeve: "Right Sleeve",
  collar: "Collar",
};

// Calibrated UV placement for the .glb t-shirt model used by
// /products/:id/customize. The fabric canvas is 1024 × 1024.
//
//   left / top   — IMAGE CENTRE on the 1024×1024 fabric texture
//   w    / h     — exact pixel BOUNDING BOX of the panel on the texture
//   scale        — fallback "calibrated" max scale used by all-over only
//
// The customer-facing placement code derives the actual scale by fitting the
// source bitmap inside (w × h). It NEVER upscales — see `fitScaleToZone`
// below — so designs sit naturally inside the panel and the customer can
// zoom in afterwards if they choose.
//
// Source: KA.SHA design notes (25 Apr 2026, client-supplied UV mapping).
export interface ZonePreset {
  left: number;
  top: number;
  scale: number;
  w: number;
  h: number;
}

export const ZONE_PRESETS: Record<PatternZone, ZonePreset> = {
  front:       { left: 250, top: 689, scale: 0.71, w: 538, h: 647 },
  back:        { left: 760, top: 672, scale: 0.45, w: 482, h: 685 },
  leftSleeve:  { left: 400, top: 116, scale: 0.48, w: 399, h: 174 },
  rightSleeve: { left: 804, top: 116, scale: 0.22, w: 403, h: 175 },
  collar:      { left: 262, top: 284, scale: 0.14, w: 509, h: 161 },
};

// "Apply to whole T-shirt" places the same print on every zone using the
// per-zone calibrated placements above, so the artwork sits correctly on each
// panel of the 3D model rather than tiling as a wallpaper.
export const ALL_OVER_ZONES: PatternZone[] = ["leftSleeve", "rightSleeve", "collar", "front", "back"];

// Auto-fit a source bitmap into a zone's bounding box.
// Returns the scaleX/scaleY (uniform) that makes the image fit ENTIRELY
// within `w × h` while preserving aspect ratio. We never go above 1.0,
// so the customer's design is never magnified beyond its native pixel size
// — the customer can zoom in manually later.
export function fitScaleToZone(
  imgW: number,
  imgH: number,
  zone: ZonePreset,
): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  const fit = Math.min(zone.w / imgW, zone.h / imgH);
  // Cap at 1.0 — never upscale a design. Always allow scaling DOWN to fit.
  return Math.min(fit, 1);
}

export function patternUrl(fileOrUrl: string): string {
  // Already a fully qualified URL or a data: / blob: source — return as-is.
  if (/^(https?:|data:|blob:)/i.test(fileOrUrl)) return fileOrUrl;
  const base = import.meta.env.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${fileOrUrl}`;
}
