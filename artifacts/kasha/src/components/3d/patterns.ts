// Curated print library shown in the 3D Customizer "Patterns" panel.
// Files live in `artifacts/kasha/public/patterns/` and are served from
// `${import.meta.env.BASE_URL}patterns/<file>`.
//
// To add a new print: drop the .jpg/.png into the folder above and append an
// entry here. The customizer picks it up automatically.

export interface PatternDef {
  id: string;
  label: string;
  file: string;
  swatchColors: string[]; // hint colors a designer can pair with the print
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

export type PatternZone = "all" | "front" | "back" | "leftSleeve" | "rightSleeve" | "collar";

export const ZONE_LABEL: Record<PatternZone, string> = {
  all: "All-Over Print",
  front: "Front",
  back: "Back",
  leftSleeve: "Left Sleeve",
  rightSleeve: "Right Sleeve",
  collar: "Collar",
};

// UV-mapped placement on the 1024×1024 design canvas. (left, top) is the
// top-left corner of the zone in texture pixels; (w, h) is its size.
// Scale is computed at runtime from w/h so each print fully covers its zone
// regardless of source-image dimensions.
export interface ZonePreset {
  left: number;
  top: number;
  w: number;
  h: number;
}

export const ZONE_PRESETS: Record<Exclude<PatternZone, "all">, ZonePreset> = {
  front:       { left: 250, top: 689, w: 538, h: 647 },
  back:        { left: 760, top: 672, w: 482, h: 685 },
  leftSleeve:  { left: 400, top: 116, w: 399, h: 174 },
  rightSleeve: { left: 804, top: 116, w: 403, h: 175 },
  collar:      { left: 262, top: 284, w: 509, h: 161 },
};

// Tile size used for the "Apply to whole T-shirt" all-over print. The source
// image is scaled to this size before being passed to fabric.Pattern, so it
// repeats sensibly across the 1024×1024 canvas instead of looking zoomed in.
export const ALL_OVER_TILE_PX = 384;

export function patternUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${file}`;
}
