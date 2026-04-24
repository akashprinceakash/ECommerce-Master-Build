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

// Calibrated UV placement for the t-shirt model used by /products/:id/customize.
// `left` / `top` are the IMAGE CENTRE on the 1024x1024 fabric canvas.
// `scale` is the literal Fabric scaleX/scaleY applied to the source bitmap.
// Source: KA.SHA design notes (24 Apr 2026).
export interface ZonePreset {
  left: number;
  top: number;
  scale: number;
}

export const ZONE_PRESETS: Record<PatternZone, ZonePreset> = {
  leftSleeve:  { left: 410, top: 90,  scale: 0.10 },
  rightSleeve: { left: 818, top: 95,  scale: 0.10 },
  collar:      { left: 268, top: 254, scale: 0.10 },
  front:       { left: 280, top: 683, scale: 0.10 },
  back:        { left: 777, top: 697, scale: 0.20 },
};

// "Apply to whole T-shirt" places the same print on every zone using the
// per-zone calibrated placements above, so the artwork sits correctly on each
// panel of the 3D model rather than tiling as a wallpaper.
export const ALL_OVER_ZONES: PatternZone[] = ["leftSleeve", "rightSleeve", "collar", "front", "back"];

export function patternUrl(fileOrUrl: string): string {
  // Already a fully qualified URL or a data: / blob: source — return as-is.
  if (/^(https?:|data:|blob:)/i.test(fileOrUrl)) return fileOrUrl;
  const base = import.meta.env.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${fileOrUrl}`;
}
