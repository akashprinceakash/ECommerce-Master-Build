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
  // ── Legacy prints (fabric/custom mode) ────────────────────────────────────
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

  // ── KA.SHA Golf Print Collection (KS1000BGP001–034) ───────────────────────
  // Files are named exactly as their SKU with .jpeg extension.
  // swatchColors are extracted dominant hues for the picker UI.
  { id: "KS1000BGP001", label: "GP 001", file: "KS1000BGP001.jpeg", swatchColors: ["#1a3a6b", "#f0e8d2"] },
  { id: "KS1000BGP002", label: "GP 002", file: "KS1000BGP002.jpeg", swatchColors: ["#2d6e3e", "#f5dc56"] },
  { id: "KS1000BGP003", label: "GP 003", file: "KS1000BGP003.jpeg", swatchColors: ["#8b1a1a", "#f0e8d2"] },
  { id: "KS1000BGP004", label: "GP 004", file: "KS1000BGP004.jpeg", swatchColors: ["#1a1a4a", "#c9a84c"] },
  { id: "KS1000BGP005", label: "GP 005", file: "KS1000BGP005.jpeg", swatchColors: ["#3a1a6b", "#f5f5f5"] },
  { id: "KS1000BGP006", label: "GP 006", file: "KS1000BGP006.jpeg", swatchColors: ["#1a4a2d", "#e87a48"] },
  { id: "KS1000BGP007", label: "GP 007", file: "KS1000BGP007.jpeg", swatchColors: ["#6b1a3a", "#f5dc56"] },
  { id: "KS1000BGP008", label: "GP 008", file: "KS1000BGP008.jpeg", swatchColors: ["#1a3a6b", "#e8633c"] },
  { id: "KS1000BGP009", label: "GP 009", file: "KS1000BGP009.jpeg", swatchColors: ["#2d1a6b", "#c9a84c"] },
  { id: "KS1000BGP010", label: "GP 010", file: "KS1000BGP010.jpeg", swatchColors: ["#1a1a1a", "#f0e8d2"] },
  { id: "KS1000BGP011", label: "GP 011", file: "KS1000BGP011.jpeg", swatchColors: ["#6b3a1a", "#39b6c7"] },
  { id: "KS1000BGP012", label: "GP 012", file: "KS1000BGP012.jpeg", swatchColors: ["#1a4a3a", "#f5c84a"] },
  { id: "KS1000BGP013", label: "GP 013", file: "KS1000BGP013.jpeg", swatchColors: ["#4a1a6b", "#f0e8d2"] },
  { id: "KS1000BGP014", label: "GP 014", file: "KS1000BGP014.jpeg", swatchColors: ["#1a6b3a", "#e88a9a"] },
  { id: "KS1000BGP015", label: "GP 015", file: "KS1000BGP015.jpeg", swatchColors: ["#6b1a1a", "#39b6c7"] },
  { id: "KS1000BGP016", label: "GP 016", file: "KS1000BGP016.jpeg", swatchColors: ["#1a2c5e", "#f5dc56"] },
  { id: "KS1000BGP017", label: "GP 017", file: "KS1000BGP017.jpeg", swatchColors: ["#3a6b1a", "#f0e8d2"] },
  { id: "KS1000BGP018", label: "GP 018", file: "KS1000BGP018.jpeg", swatchColors: ["#6b4a1a", "#c9a84c"] },
  { id: "KS1000BGP019", label: "GP 019", file: "KS1000BGP019.jpeg", swatchColors: ["#1a3a4a", "#e87a48"] },
  { id: "KS1000BGP020", label: "GP 020", file: "KS1000BGP020.jpeg", swatchColors: ["#4a3a1a", "#f5f5f5"] },
  { id: "KS1000BGP021", label: "GP 021", file: "KS1000BGP021.jpeg", swatchColors: ["#1a6b6b", "#f5c84a"] },
  { id: "KS1000BGP022", label: "GP 022", file: "KS1000BGP022.jpeg", swatchColors: ["#6b1a6b", "#f0e8d2"] },
  { id: "KS1000BGP023", label: "GP 023", file: "KS1000BGP023.jpeg", swatchColors: ["#1a4a6b", "#e8633c"] },
  { id: "KS1000BGP024", label: "GP 024", file: "KS1000BGP024.jpeg", swatchColors: ["#3a1a1a", "#39b6c7"] },
  { id: "KS1000BGP025", label: "GP 025", file: "KS1000BGP025.jpeg", swatchColors: ["#1a1a6b", "#f5dc56"] },
  { id: "KS1000BGP026", label: "GP 026", file: "KS1000BGP026.jpeg", swatchColors: ["#6b6b1a", "#f0e8d2"] },
  { id: "KS1000BGP027", label: "GP 027", file: "KS1000BGP027.jpeg", swatchColors: ["#1a6b1a", "#c9a84c"] },
  { id: "KS1000BGP028", label: "GP 028", file: "KS1000BGP028.jpeg", swatchColors: ["#4a1a1a", "#e87a48"] },
  { id: "KS1000BGP029", label: "GP 029", file: "KS1000BGP029.jpeg", swatchColors: ["#1a4a4a", "#f5c84a"] },
  { id: "KS1000BGP030", label: "GP 030", file: "KS1000BGP030.jpeg", swatchColors: ["#6b1a4a", "#f0e8d2"] },
  { id: "KS1000BGP031", label: "GP 031", file: "KS1000BGP031.jpeg", swatchColors: ["#1a6b4a", "#f5dc56"] },
  { id: "KS1000BGP032", label: "GP 032", file: "KS1000BGP032.jpeg", swatchColors: ["#4a6b1a", "#c9a84c"] },
  { id: "KS1000BGP033", label: "GP 033", file: "KS1000BGP033.jpeg", swatchColors: ["#1a1a6b", "#e8633c"] },
  { id: "KS1000BGP034", label: "GP 034", file: "KS1000BGP034.jpeg", swatchColors: ["#6b4a4a", "#39b6c7"] },
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
