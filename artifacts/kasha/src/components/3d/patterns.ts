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

// Default placement on the 1024x1024 texture canvas. Real UV layouts vary by
// model, so the customer can drag/scale after placement using the existing
// Tweak controls.
export const ZONE_PRESETS: Record<Exclude<PatternZone, "all">, { left: number; top: number; size: number }> = {
  front:       { left: 320, top: 540, size: 380 },
  back:        { left: 720, top: 540, size: 380 },
  leftSleeve:  { left: 130, top: 180, size: 200 },
  rightSleeve: { left: 894, top: 180, size: 200 },
  collar:      { left: 512, top: 110, size: 180 },
};

export function patternUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${file}`;
}
