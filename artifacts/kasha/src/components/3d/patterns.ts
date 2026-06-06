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
  customerLabel: string;
  file: string;
  swatchColors: string[];
}

export const PATTERNS: PatternDef[] = [
  // ── KA.SHA Golf Print Collection (KS1000BGP001–034) ───────────────────────
  // Files are served from R2 CDN as .jpg (KS1000BGP001.jpg … KS1000BGP034.jpg).
  // swatchColors are extracted dominant hues for the picker UI.
  { id: "KS1000BGP001", label: "GP 001", customerLabel: "Navy Blue & Cream",      file: "KS1000BGP001.jpg", swatchColors: ["#1a3a6b", "#f0e8d2"] },
  { id: "KS1000BGP002", label: "GP 002", customerLabel: "Forest Green & Gold",    file: "KS1000BGP002.jpg", swatchColors: ["#2d6e3e", "#f5dc56"] },
  { id: "KS1000BGP003", label: "GP 003", customerLabel: "Deep Red & Cream",       file: "KS1000BGP003.jpg", swatchColors: ["#8b1a1a", "#f0e8d2"] },
  { id: "KS1000BGP004", label: "GP 004", customerLabel: "Midnight Navy & Gold",   file: "KS1000BGP004.jpg", swatchColors: ["#1a1a4a", "#c9a84c"] },
  { id: "KS1000BGP005", label: "GP 005", customerLabel: "Royal Purple & White",   file: "KS1000BGP005.jpg", swatchColors: ["#3a1a6b", "#f5f5f5"] },
  { id: "KS1000BGP006", label: "GP 006", customerLabel: "Bottle Green & Coral",   file: "KS1000BGP006.jpg", swatchColors: ["#1a4a2d", "#e87a48"] },
  { id: "KS1000BGP007", label: "GP 007", customerLabel: "Burgundy & Gold",        file: "KS1000BGP007.jpg", swatchColors: ["#6b1a3a", "#f5dc56"] },
  { id: "KS1000BGP008", label: "GP 008", customerLabel: "Navy & Orange",          file: "KS1000BGP008.jpg", swatchColors: ["#1a3a6b", "#e8633c"] },
  { id: "KS1000BGP009", label: "GP 009", customerLabel: "Deep Purple & Gold",     file: "KS1000BGP009.jpg", swatchColors: ["#2d1a6b", "#c9a84c"] },
  { id: "KS1000BGP010", label: "GP 010", customerLabel: "Black & Cream",          file: "KS1000BGP010.jpg", swatchColors: ["#1a1a1a", "#f0e8d2"] },
  { id: "KS1000BGP011", label: "GP 011", customerLabel: "Chocolate & Teal",       file: "KS1000BGP011.jpg", swatchColors: ["#6b3a1a", "#39b6c7"] },
  { id: "KS1000BGP012", label: "GP 012", customerLabel: "Dark Teal & Amber",      file: "KS1000BGP012.jpg", swatchColors: ["#1a4a3a", "#f5c84a"] },
  { id: "KS1000BGP013", label: "GP 013", customerLabel: "Plum & Ivory",           file: "KS1000BGP013.jpg", swatchColors: ["#4a1a6b", "#f0e8d2"] },
  { id: "KS1000BGP014", label: "GP 014", customerLabel: "Emerald & Rose",         file: "KS1000BGP014.jpg", swatchColors: ["#1a6b3a", "#e88a9a"] },
  { id: "KS1000BGP015", label: "GP 015", customerLabel: "Crimson & Aqua",         file: "KS1000BGP015.jpg", swatchColors: ["#6b1a1a", "#39b6c7"] },
  { id: "KS1000BGP016", label: "GP 016", customerLabel: "Deep Navy & Gold",       file: "KS1000BGP016.jpg", swatchColors: ["#1a2c5e", "#f5dc56"] },
  { id: "KS1000BGP017", label: "GP 017", customerLabel: "Olive Green & Ivory",    file: "KS1000BGP017.jpg", swatchColors: ["#3a6b1a", "#f0e8d2"] },
  { id: "KS1000BGP018", label: "GP 018", customerLabel: "Cognac & Gold",          file: "KS1000BGP018.jpg", swatchColors: ["#6b4a1a", "#c9a84c"] },
  { id: "KS1000BGP019", label: "GP 019", customerLabel: "Slate Blue & Coral",     file: "KS1000BGP019.jpg", swatchColors: ["#1a3a4a", "#e87a48"] },
  { id: "KS1000BGP020", label: "GP 020", customerLabel: "Dark Khaki & White",     file: "KS1000BGP020.jpg", swatchColors: ["#4a3a1a", "#f5f5f5"] },
  { id: "KS1000BGP021", label: "GP 021", customerLabel: "Teal & Amber",           file: "KS1000BGP021.jpg", swatchColors: ["#1a6b6b", "#f5c84a"] },
  { id: "KS1000BGP022", label: "GP 022", customerLabel: "Magenta & Ivory",        file: "KS1000BGP022.jpg", swatchColors: ["#6b1a6b", "#f0e8d2"] },
  { id: "KS1000BGP023", label: "GP 023", customerLabel: "Steel Blue & Orange",    file: "KS1000BGP023.jpg", swatchColors: ["#1a4a6b", "#e8633c"] },
  { id: "KS1000BGP024", label: "GP 024", customerLabel: "Espresso & Aqua",        file: "KS1000BGP024.jpg", swatchColors: ["#3a1a1a", "#39b6c7"] },
  { id: "KS1000BGP025", label: "GP 025", customerLabel: "Indigo & Yellow",        file: "KS1000BGP025.jpg", swatchColors: ["#1a1a6b", "#f5dc56"] },
  { id: "KS1000BGP026", label: "GP 026", customerLabel: "Olive & Ivory",          file: "KS1000BGP026.jpg", swatchColors: ["#6b6b1a", "#f0e8d2"] },
  { id: "KS1000BGP027", label: "GP 027", customerLabel: "Jade Green & Gold",      file: "KS1000BGP027.jpg", swatchColors: ["#1a6b1a", "#c9a84c"] },
  { id: "KS1000BGP028", label: "GP 028", customerLabel: "Dark Brown & Coral",     file: "KS1000BGP028.jpg", swatchColors: ["#4a1a1a", "#e87a48"] },
  { id: "KS1000BGP029", label: "GP 029", customerLabel: "Teal & Gold",            file: "KS1000BGP029.jpg", swatchColors: ["#1a4a4a", "#f5c84a"] },
  { id: "KS1000BGP030", label: "GP 030", customerLabel: "Raspberry & Ivory",      file: "KS1000BGP030.jpg", swatchColors: ["#6b1a4a", "#f0e8d2"] },
  { id: "KS1000BGP031", label: "GP 031", customerLabel: "Jade Green & Yellow",    file: "KS1000BGP031.jpg", swatchColors: ["#1a6b4a", "#f5dc56"] },
  { id: "KS1000BGP032", label: "GP 032", customerLabel: "Avocado & Gold",         file: "KS1000BGP032.jpg", swatchColors: ["#4a6b1a", "#c9a84c"] },
  { id: "KS1000BGP033", label: "GP 033", customerLabel: "Royal Blue & Orange",    file: "KS1000BGP033.jpg", swatchColors: ["#1a1a6b", "#e8633c"] },
  { id: "KS1000BGP034", label: "GP 034", customerLabel: "Dusty Mauve & Aqua",     file: "KS1000BGP034.jpg", swatchColors: ["#6b4a4a", "#39b6c7"] },
];

export type PatternZone = "all" | "front" | "back" | "leftSleeve" | "rightSleeve" | "collar" | "collarPlacket";

export const ZONE_LABEL: Record<PatternZone, string> = {
  all:           "All-Over Print",
  front:         "Front",
  back:          "Back",
  leftSleeve:    "Left Sleeve",
  rightSleeve:   "Right Sleeve",
  collar:        "Collar",
  collarPlacket: "Collar Placket",
};

export interface ZonePreset { left: number; top: number; w: number; h: number; }

export const ZONE_PRESETS: Record<Exclude<PatternZone, "all">, ZonePreset> = {
  front:         { left:  10, top: 341, w: 490, h: 678 },
  back:          { left: 524, top: 188, w: 483, h: 833 },
  collar:        { left:  12, top: 183, w: 507, h: 166 },
  leftSleeve:    { left: 210, top:   4, w: 398, h: 170 },
  rightSleeve:   { left: 617, top:   2, w: 398, h: 171 },
  collarPlacket: { left: 231, top: 380, w:  32, h: 180 },
};

export const ALL_OVER_TILE_PX = 256;

const R2_PATTERNS_BASE = "https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/patterns/";

export function patternUrl(file: string): string {
  return `${R2_PATTERNS_BASE}${file}`;
}

// GT015 source pixel colors (used by gt-styles.ts pixel-swap engine)
export const GT015_SRC_A = { r: 0,   g: 0,   b: 0   };  // #000000 black
export const GT015_SRC_B = { r: 240, g: 206, b: 210 };  // #F0CED2 pink
export const GT015_TOLERANCE = 60;
