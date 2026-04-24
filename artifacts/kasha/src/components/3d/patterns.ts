// Curated print library shown in the 3D Customizer "Patterns" panel.
// Files live in `artifacts/kasha/public/patterns/` and are served from
// `${import.meta.env.BASE_URL}patterns/<file>`.
//
// To add a new print: drop the .jpg/.png into the folder above and append an
// entry here. The customizer picks it up automatically.

export interface PatternDef {
  id: string;
  label: string;
  file: string;          // filename inside /patterns OR a full URL (for uploaded prints)
  swatchColors: string[];
}

export const PATTERNS: PatternDef[] = [
  { id: "paisley",         label: "Paisley Bloom",     file: "paisley.jpg",         swatchColors: ["#7a2030", "#f5c84a", "#39b6c7"] },
  { id: "vines-pink",      label: "Vines Blush",       file: "vines-pink.jpg",      swatchColors: ["#f6dce0", "#a4626a", "#e88a9a"] },
  { id: "blue-floral",     label: "Indigo Daisy",      file: "blue-floral.jpg",     swatchColors: ["#103a5a", "#cdb893", "#f0e8d2"] },
  { id: "green-flora",     label: "Verdant Flora",     file: "green-flora.jpg",     swatchColors: ["#7fae3a", "#7a4a9b", "#e8633c"] },
  { id: "tropical-bloom",  label: "Tropical Noir",     file: "tropical-bloom.jpg",  swatchColors: ["#152233", "#e87a48", "#7fae73"] },
  { id: "carnival",        label: "Carnival Brights",  file: "carnival.jpg",        swatchColors: ["#152244", "#f4b400", "#e76b8a"] },
  { id: "ogee-warm",       label: "Ogee Warm",         file: "ogee-warm.jpg",       swatchColors: ["#a04030", "#1f6e64", "#d8a878"] },
  { id: "smiley-pink",     label: "Acid Smile",        file: "smiley-pink.jpg",     swatchColors: ["#e6188a", "#f5dc56"] },
  { id: "graffiti",        label: "Street Graffiti",   file: "graffiti.jpg",        swatchColors: ["#dc1e4a", "#f4a000", "#ffffff"] },
  { id: "money-bw",        label: "Money B&W",         file: "money-bw.jpg",        swatchColors: ["#f4ecd7", "#1a1a1a"] },
  { id: "orange-abstract", label: "Sun & Cobalt",      file: "orange-abstract.jpg", swatchColors: ["#ed7c2a", "#3552c0"] },
];

export type PatternZone = "front" | "back" | "leftSleeve" | "rightSleeve" | "collar";

export const ZONE_LABEL: Record<PatternZone, string> = {
  front: "Front",
  back: "Back",
  leftSleeve: "Left Sleeve",
  rightSleeve: "Right Sleeve",
  collar: "Collar",
};

// UV bounding box of every garment panel on the 1024x1024 fabric texture.
// `x`, `y` = top-left of the panel's UV island. `w`, `h` = its size.
// Designs are placed using a "cover" fit + a clipPath rectangle equal to this
// box, so the artwork fills the panel completely and never bleeds onto an
// adjacent panel. Calibrated from the KA.SHA design notes (24 Apr 2026).
export interface ZonePreset {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ZONE_PRESETS: Record<PatternZone, ZonePreset> = {
  // Sleeves and collar are compact UV islands.
  leftSleeve:  { x: 359, y: 39,  w: 102, h: 102 },
  rightSleeve: { x: 767, y: 44,  w: 102, h: 102 },
  collar:      { x: 217, y: 203, w: 102, h: 102 },
  // Torso panels carry the bulk of the artwork.
  front:       { x: 180, y: 540, w: 220, h: 290 },
  back:        { x: 624, y: 544, w: 305, h: 305 },
};

// "Apply to whole T-shirt" places the same print on every panel using the
// per-zone bounding boxes above, so the artwork sits correctly on each panel
// of the 3D model rather than tiling as a wallpaper.
export const ALL_OVER_ZONES: PatternZone[] = ["leftSleeve", "rightSleeve", "collar", "front", "back"];

// The default panel that newly-selected prints land on.
export const DEFAULT_ZONE: PatternZone = "front";

// Helper: derive the centre of a zone box.
export function zoneCenter(z: ZonePreset): { cx: number; cy: number } {
  return { cx: z.x + z.w / 2, cy: z.y + z.h / 2 };
}

// Helper: compute the "cover" scale that makes a source bitmap of size
// (imgW × imgH) fully cover the box (boxW × boxH) while keeping aspect ratio.
// One axis will overflow the box; we crop overflow with a clipPath.
export function coverScale(imgW: number, imgH: number, boxW: number, boxH: number): number {
  if (!imgW || !imgH) return 1;
  return Math.max(boxW / imgW, boxH / imgH);
}

export function patternUrl(fileOrUrl: string): string {
  // Already a fully qualified URL or a data: / blob: source — return as-is.
  if (/^(https?:|data:|blob:)/i.test(fileOrUrl)) return fileOrUrl;
  const base = import.meta.env.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${fileOrUrl}`;
}
