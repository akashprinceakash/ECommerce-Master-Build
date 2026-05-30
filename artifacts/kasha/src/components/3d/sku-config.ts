// ─────────────────────────────────────────────────────────────────────────────
// sku-config.ts — KA.SHA SKU parsing & design-config resolution
//
// SKU format reference
// ────────────────────
//  PRINT   : KS1000BGP001 … KS1000BGP034
//            KS = Ka.Sha | 1000 = print collection | BGP = golf print | NNN = design #
//
//  PATTERN : KS1001B-BB  … KS1005B-XX
//            KS = Ka.Sha | 100N = pattern style | B = golfwear base | -XX = colorway
//            colorway suffix encodes base+accent: e.g. BB = Blue+Black, RB = Red+Black
//
//  SOLID   : KS1000B-WH  … KS1000B-XX
//            KS = Ka.Sha | 1000 = base collection | B = golfwear | -XX = color code
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Solid colour codes ───────────────────────────────────────────────────────
export const SOLID_COLOR_MAP: Record<string, string> = {
  WH: "#f5f5f5",  // White
  BK: "#1a1a1a",  // Black
  NV: "#1a2c5e",  // Navy
  SB: "#4a8fd4",  // Sky Blue
  RD: "#c0392b",  // Red
  GN: "#1f7a45",  // Green
  OR: "#d4600a",  // Orange
  YL: "#c9a84c",  // Gold / Yellow
  PR: "#6b2fa0",  // Purple
  MR: "#7b241c",  // Maroon
  GR: "#5a5a5a",  // Grey
  WT: "#f5f5f5",  // White (alt code)
  // Full-name color codes (used in KS1000B{COLORNAME} format)
  POWDERBLUE: "#B0C4DE",
  NAVY:       "#1a2c5e",
  WHITE:      "#f5f5f5",
  BLACK:      "#1a1a1a",
  RED:        "#c0392b",
  GREEN:      "#1f7a45",
  GREY:       "#5a5a5a",
  MAROON:     "#7b241c",
  PURPLE:     "#6b2fa0",
  GOLD:       "#c9a84c",
  ORANGE:     "#d4600a",
  SKYBLUE:    "#4a8fd4",
};

// ── Pattern colorway suffix → channel colors ─────────────────────────────────
// colorA = dark channel (replaces black/dark pixels in the design PNG)
// colorB = light channel (replaces light/pink pixels in the design PNG)
// Convention: suffix[0] = primary/base color, suffix[1] = accent color
// "B" in position 2 always = Black (accent); "B" in position 1 = Blue (primary)
export interface PatternColors {
  colorA: string; // dark channel
  colorB: string; // light channel
  label: string;
}

export const PATTERN_SUFFIX_COLORS: Record<string, PatternColors> = {
  // Blue base + Black accent
  BLB: { colorA: "#1a1a1a", colorB: "#1e5ecd", label: "Blue + Black"    },
  // Beige base + Brown accent  (admin suffix BB = Beige & Brown)
  BB: { colorA: "#795548", colorB: "#E8D5B7", label: "Beige + Brown"   },
  // Red base + Black accent
  RB: { colorA: "#1a1a1a", colorB: "#c0392b", label: "Red + Black"     },
  // Pink base + Black accent  (admin suffix PB = Pink & Black)
  PB: { colorA: "#1a1a1a", colorB: "#FF69B4", label: "Pink + Black"    },
  // Pink base + Black accent (legacy three-letter code)
  PKB: { colorA: "#1a1a1a", colorB: "#FF69B4", label: "Pink + Black"   },
  // Orange base + Black accent
  OB: { colorA: "#1a1a1a", colorB: "#d4600a", label: "Orange + Black"  },
  // Sky Blue base + Brown accent  (admin suffix SB = Sky Blue & Brown)
  SB: { colorA: "#795548", colorB: "#90D5FF", label: "Sky Blue + Brown"},
  // Sky Blue base + Black accent (canonical code)
  SKB: { colorA: "#1a1a1a", colorB: "#90D5FF", label: "Sky Blue + Black"},
  // Green base + Black accent
  GB: { colorA: "#1a1a1a", colorB: "#576043", label: "Green + Black"   },
  // White base + Black accent
  WB: { colorA: "#1a1a1a", colorB: "#f0f0f0", label: "White + Black"   },
  // Navy base + Black accent
  NB: { colorA: "#1a1a1a", colorB: "#1a2c5e", label: "Navy + Black"    },
  // Yellow/Gold base + Black accent
  YB: { colorA: "#1a1a1a", colorB: "#c9a84c", label: "Gold + Black"    },
  // Maroon base + Black accent
  MB: { colorA: "#1a1a1a", colorB: "#7b241c", label: "Maroon + Black"  },
  // Red base + White accent
  RW: { colorA: "#f0f0f0", colorB: "#c0392b", label: "Red + White"     },
  // Blue base + White accent
  BW: { colorA: "#f0f0f0", colorB: "#1e5ecd", label: "Blue + White"    },
  // Navy base + White accent
  NW: { colorA: "#f0f0f0", colorB: "#1a2c5e", label: "Navy + White"    },
  // Green base + White accent
  GW: { colorA: "#f0f0f0", colorB: "#1f7a45", label: "Green + White"   },
  // Black base + Gold accent
  BG: { colorA: "#c9a84c", colorB: "#1a1a1a", label: "Black + Gold"    },
  // Black base + Red accent
  BR: { colorA: "#c0392b", colorB: "#1a1a1a", label: "Black + Red"     },
  // Black base + Pink accent  (admin suffix BP = Black & Pink)
  BP: { colorA: "#FF69B4", colorB: "#1a1a1a", label: "Black + Pink"    },
  // Navy base + Gold accent
  NG: { colorA: "#c9a84c", colorB: "#1a2c5e", label: "Navy + Gold"     },
};

// Default colours when suffix is not in the map
export const DEFAULT_PATTERN_COLORS: PatternColors = {
  colorA: "#1a1a1a",
  colorB: "#1e5ecd",
  label: "Blue + Black",
};

// ── Print SKU → PatternDef.id mapping ────────────────────────────────────────
// Each SKU maps directly to the PatternDef.id of the same name, which in turn
// references the physical file public/patterns/KS1000BGP001.jpeg etc.
// All 34 files are uploaded; this map is the canonical lookup used by parseSku().
export const PRINT_SKU_MAP: Record<string, string> = {
  "KS1000BGP001": "KS1000BGP001",
  "KS1000BGP002": "KS1000BGP002",
  "KS1000BGP003": "KS1000BGP003",
  "KS1000BGP004": "KS1000BGP004",
  "KS1000BGP005": "KS1000BGP005",
  "KS1000BGP006": "KS1000BGP006",
  "KS1000BGP007": "KS1000BGP007",
  "KS1000BGP008": "KS1000BGP008",
  "KS1000BGP009": "KS1000BGP009",
  "KS1000BGP010": "KS1000BGP010",
  "KS1000BGP011": "KS1000BGP011",
  "KS1000BGP012": "KS1000BGP012",
  "KS1000BGP013": "KS1000BGP013",
  "KS1000BGP014": "KS1000BGP014",
  "KS1000BGP015": "KS1000BGP015",
  "KS1000BGP016": "KS1000BGP016",
  "KS1000BGP017": "KS1000BGP017",
  "KS1000BGP018": "KS1000BGP018",
  "KS1000BGP019": "KS1000BGP019",
  "KS1000BGP020": "KS1000BGP020",
  "KS1000BGP021": "KS1000BGP021",
  "KS1000BGP022": "KS1000BGP022",
  "KS1000BGP023": "KS1000BGP023",
  "KS1000BGP024": "KS1000BGP024",
  "KS1000BGP025": "KS1000BGP025",
  "KS1000BGP026": "KS1000BGP026",
  "KS1000BGP027": "KS1000BGP027",
  "KS1000BGP028": "KS1000BGP028",
  "KS1000BGP029": "KS1000BGP029",
  "KS1000BGP030": "KS1000BGP030",
  "KS1000BGP031": "KS1000BGP031",
  "KS1000BGP032": "KS1000BGP032",
  "KS1000BGP033": "KS1000BGP033",
  "KS1000BGP034": "KS1000BGP034",
};

// ── Parsed SKU result types ──────────────────────────────────────────────────

export interface PrintSkuResult {
  type: "print";
  sku: string;
  patternId: string; // PatternDef.id
  designNumber: number;
}

export interface PatternSkuResult {
  type: "pattern";
  sku: string;
  designId: string; // KashaDesignDef.id — e.g. "KS1001B"
  patternNumber: number; // 1001–1005
  suffix: string; // e.g. "BB"
  colorA: string;
  colorB: string;
  colorLabel: string;
}

export interface SolidSkuResult {
  type: "solid";
  sku: string;
  colorCode: string; // e.g. "NV"
  hex: string;
}

export interface UnknownSkuResult {
  type: "unknown";
  sku: string;
}

export type SkuResult =
  | PrintSkuResult
  | PatternSkuResult
  | SolidSkuResult
  | UnknownSkuResult;

// ── SKU parser ───────────────────────────────────────────────────────────────

/**
 * Parse a KA.SHA product SKU into its design configuration.
 *
 * Examples:
 *   parseSku("KS1000BGP005") → { type:"print", patternId:"tropical-bloom", … }
 *   parseSku("KS1001B-BB")   → { type:"pattern", designId:"KS1001B", colorA:"#1a1a1a", colorB:"#1e5ecd", … }
 *   parseSku("KS1000B-NV")   → { type:"solid", hex:"#1a2c5e", … }
 */
export function parseSku(sku: string): SkuResult {
  if (!sku) return { type: "unknown", sku };

  const upper = sku.trim().toUpperCase();

  // ── Print: KS1000BGP001 … KS1000BGP034
  const printMatch = upper.match(/^KS1000BGP(\d{3})$/);
  if (printMatch) {
    const num = parseInt(printMatch[1], 10);
    const patternId = PRINT_SKU_MAP[`KS1000BGP${String(num).padStart(3, "0")}`] ?? "paisley";
    return { type: "print", sku: upper, patternId, designNumber: num };
  }

  // ── Solid: KS1000B-XX (note: must check before pattern because both start with KS10)
  const solidMatch = upper.match(/^KS1000B-([A-Z]{2,3})$/);
  if (solidMatch) {
    const code = solidMatch[1];
    const hex = SOLID_COLOR_MAP[code] ?? "#f5f5f5";
    return { type: "solid", sku: upper, colorCode: code, hex };
  }

  // ── Solid (full color name, no hyphen): KS1000B{COLORNAME} e.g. KS1000BPOWDERBLUE
  const solidFullMatch = upper.match(/^KS1000B([A-Z]{4,})$/);
  if (solidFullMatch) {
    const code = solidFullMatch[1];
    const hex = SOLID_COLOR_MAP[code] ?? "#f5f5f5";
    return { type: "solid", sku: upper, colorCode: code, hex };
  }

  // ── Solid (long-name format): KS-{COLOR}-{NNN}  e.g. KS-BLK-001
  //    Allows admin-friendly color names without requiring the canonical KS1000B- prefix.
  const SOLID_LONGNAME_MAP: Record<string, string> = {
    BLK: "#1a1a1a", WHT: "#f5f5f5", NVY: "#1a2c5e", RED: "#c0392b",
    GRN: "#1f7a45", ORN: "#d4600a", GLD: "#c9a84c", PRP: "#6b2fa0",
    MRN: "#7b241c", GRY: "#5a5a5a", SKB: "#4a8fd4",
  };
  const solidLongMatch = upper.match(/^KS-([A-Z]{2,4})-(\d+)$/);
  if (solidLongMatch) {
    const code = solidLongMatch[1];
    const hex = SOLID_LONGNAME_MAP[code] ?? SOLID_COLOR_MAP[code] ?? "#1a1a1a";
    return { type: "solid", sku: upper, colorCode: code, hex };
  }

  // ── Pattern: KS1001B-XX … KS1005B-XX  (also accept without suffix → use default colors)
  const patternMatch = upper.match(/^KS(100[1-5])B(?:-([A-Z]{2,3}))?$/);
  if (patternMatch) {
    const patNum = parseInt(patternMatch[1], 10);
    const suffix = patternMatch[2] ?? "BB";
    const colors = PATTERN_SUFFIX_COLORS[suffix] ?? DEFAULT_PATTERN_COLORS;
    return {
      type: "pattern",
      sku: upper,
      designId: `KS${patternMatch[1]}B`,
      patternNumber: patNum,
      suffix,
      colorA: colors.colorA,
      colorB: colors.colorB,
      colorLabel: colors.label,
    };
  }

  return { type: "unknown", sku: upper };
}
