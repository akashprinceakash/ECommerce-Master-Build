// patterns.ts — KA.SHA Print & Pattern Library
//
// productType guide (set by admin when creating a product):
//   "fabric"  — customer can pick from the Print Library + change garment colors
//   "pattern" — customer sees a LOCKED GT style; only changes Primary/Accent/Tertiary colors
//   "print"   — customer can pick prints ONLY, no color changes (licensed/pre-set art)

export type ProductType = "fabric" | "pattern" | "print";

export interface PatternDef {
  id: string;
  label: string;
  file: string;
  swatchColors: string[];
}

export const PATTERNS: PatternDef[] = [
  { id: "paisley",         label: "P1",  file: "paisley.jpg",         swatchColors: ["#7a2030", "#f5c84a", "#39b6c7"] },
  { id: "vines-pink",      label: "P2",  file: "vines-pink.jpg",      swatchColors: ["#f6dce0", "#a4626a", "#e88a9a"] },
  { id: "blue-floral",     label: "P3",  file: "blue-floral.jpg",     swatchColors: ["#103a5a", "#cdb893", "#f0e8d2"] },
  { id: "green-flora",     label: "P4",  file: "green-flora.jpg",     swatchColors: ["#7fae3a", "#7a4a9b", "#e8633c"] },
  { id: "tropical-bloom",  label: "P5",  file: "tropical-bloom.jpg",  swatchColors: ["#152233", "#e87a48", "#7fae73"] },
  { id: "carnival",        label: "P6",  file: "carnival.jpg",        swatchColors: ["#152244", "#f4b400", "#e76b8a"] },
  { id: "ogee-warm",       label: "P7",  file: "ogee-warm.jpg",       swatchColors: ["#a04030", "#1f6e64", "#d8a878"] },
  { id: "smiley-pink",     label: "P8",  file: "smiley-pink.jpg",     swatchColors: ["#e6188a", "#f5dc56"] },
  { id: "graffiti",        label: "P9",  file: "graffiti.jpg",        swatchColors: ["#dc1e4a", "#f4a000", "#ffffff"] },
  { id: "money-bw",        label: "P10", file: "money-bw.jpg",        swatchColors: ["#f4ecd7", "#1a1a1a"] },
  { id: "orange-abstract", label: "P11", file: "orange-abstract.jpg", swatchColors: ["#ed7c2a", "#3552c0"] },
  { id: "kasha-gt015",     label: "P12", file: "kasha.png",           swatchColors: ["#000000", "#F0CED2"] },
];

export type PatternZone = "all" | "front" | "back" | "leftSleeve" | "rightSleeve" | "collar";

export const ZONE_LABEL: Record<PatternZone, string> = {
  all:         "All-Over Print",
  front:       "Front",
  back:        "Back",
  leftSleeve:  "Left Sleeve",
  rightSleeve: "Right Sleeve",
  collar:      "Collar",
};

export interface ZonePreset { left: number; top: number; w: number; h: number; }

export const ZONE_PRESETS: Record<Exclude<PatternZone, "all">, ZonePreset> = {
  front:       { left:  10, top: 341, w: 490, h: 678 },
  back:        { left: 524, top: 188, w: 483, h: 833 },
  collar:      { left:  12, top: 183, w: 507, h: 166 },
  leftSleeve:  { left: 210, top:   4, w: 398, h: 170 },
  rightSleeve: { left: 617, top:   2, w: 398, h: 171 },
};

export const ALL_OVER_TILE_PX = 384;

export function patternUrl(file: string): string {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const clean = base.endsWith("/") ? base : `${base}/`;
  return `${clean}patterns/${file}`;
}

// GT015 source pixel colors (used by gt-styles.ts pixel-swap engine)
export const GT015_SRC_A = { r: 0,   g: 0,   b: 0   };  // #000000 black
export const GT015_SRC_B = { r: 240, g: 206, b: 210 };  // #F0CED2 pink
export const GT015_TOLERANCE = 60;
