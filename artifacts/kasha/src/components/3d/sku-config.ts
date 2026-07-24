// ─────────────────────────────────────────────────────────────────────────────
// sku-config.ts — KA.SHA SKU parsing & design-config resolution
//
// SKU format reference
// ────────────────────
//  PRINT   : KS1000BGP001 … KS1000BGP034
//            KS = Ka.Sha | 1000 = print collection | BGP = golf print | NNN = design #
//
//  PATTERN : KS1001B-PAT-BLK,PNK  (new canonical format)
//            KS/KL = men's/women's | 100N = pattern style (1001-1006) | B = tee
//            -PAT- = variant type  | BLK,PNK = comma-separated zone color tokens
//            Token order → zone order: token[0]=colorB (base), token[1]=colorA (accent)
//            Single token → applied to all zones.
//
//            Legacy abbreviated suffix format is still parsed for backward compat:
//            KS1001B-BB  … KS1005B-XX   (BB = Beige+Brown, RB = Red+Black, …)
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
  GREY:       "#B0B0B0",  // Arctic Grey
  MAROON:     "#7b241c",
  PURPLE:     "#6b2fa0",
  GOLD:       "#c9a84c",
  ORANGE:     "#d4600a",
  SKYBLUE:    "#4a8fd4",
  ROYALBLUE:  "#310599",
  ROYELBLUE:  "#310599",
  DARKMAROON: "#7b241c",
  DARKNAVY:   "#0d1b3e",
  DARKGREEN:  "#145a30",
  LIGHTBLUE:  "#87CEEB",
  PINK:       "#FC8EAC",  // Flamingo Pink
  CORAL:      "#FF6B6B",
  TEAL:       "#008080",
  BURGUNDY:   "#800020",
  KHAKI:      "#8B7355",
  OLIVE:      "#556B2F",
  CHARCOAL:   "#36454F",
  MINT:       "#98FF98",
  LAVENDER:   "#E6E6FA",
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

// ── Descriptive colour name → hex (unified lookup for PAT tokens + descriptive suffixes) ──
// Keys are UPPERCASE to match the uppercased SKU used inside parseSku().
// Convention: first SKU part = primary/base colour → colorB (light channel)
//             second SKU part = accent/dark colour  → colorA (dark channel)
//
// 3-letter canonical tokens (used in the new PAT-BLK,PNK format):
//   BLK=black  WHT=white  GRY=grey   PNK=pink   NVY=navy   BLU=blue
//   GRN=green  RED=red    GLD=gold   ORN=orange  PRP=purple MRN=maroon
//   SKB=sky-blue  TLQ=teal  BEG=beige  BRN=brown  CRL=coral
// Full-word names below already covered for backward compat with descriptive suffix format.
export const DESCRIPTIVE_COLOR_HEX: Record<string, string> = {
  // ── 3-letter PAT token aliases ─────────────────────────────────────────────
  BLK: "#1a1a1a",  // black
  WHT: "#f5f5f5",  // white
  GRY: "#808080",  // grey
  PNK: "#FF69B4",  // pink
  NVY: "#1a2c5e",  // navy
  BLU: "#1e5ecd",  // blue
  GRN: "#1f7a45",  // green
  // RED already present as a full-word key below — no 3-letter alias needed
  GLD: "#c9a84c",  // gold
  ORN: "#ff8c00",  // orange
  PRP: "#6b2fa0",  // purple
  MRN: "#7b241c",  // maroon
  SKB: "#87ceeb",  // sky blue
  TLQ: "#008080",  // teal
  BEG: "#dcc8af",  // beige
  BRN: "#654321",  // brown
  CRL: "#e87a48",  // coral
  CRM: "#f0e8d2",  // cream
  // ── Full-word names (backward compat with descriptive suffix format) ────────
  BLACK:        "#1a1a1a",
  WHITE:        "#f5f5f5",
  GREY:         "#808080",
  GRAY:         "#808080",
  CHARCOAL:     "#36454f",
  SILVER:       "#b4b4b4",
  IVORY:        "#f0ead6",
  CREAM:        "#f0e8d2",
  BEIGE:        "#dcc8af",
  SAND:         "#c2b280",
  STONE:        "#b2a99a",
  CAMEL:        "#c19a6b",
  TAN:          "#d2b48c",
  KHAKI:        "#4a3a1a",
  GOLD:         "#c9a84c",
  YELLOW:       "#f5dc32",
  AMBER:        "#ffbf00",
  ARTICHOKE:    "#8f9779",
  OLIVE:        "#6b6b14",
  OLIVEGREEN:   "#3a6b1a",
  SAGE:         "#8fa67a",
  EUCALYPTUS:   "#5c8d72",
  FERN:         "#4f7942",
  MINT:         "#98e4c0",
  FORESTGREEN:  "#226b3e",
  GREEN:        "#1f7a45",
  NAVY:         "#1a2c5e",
  ROYALBLUE:    "#1a1a6b",
  SKYBLUE:      "#87ceeb",
  POWDERBLUE:   "#b0c4de",
  COBALT:       "#1a1a8e",
  BLUE:         "#1e5ecd",
  TEAL:         "#1a6b6b",
  SLATE:        "#708090",
  RED:          "#c0392b",
  CRIMSON:      "#6b1a1a",
  MAROON:       "#7b241c",
  BURGUNDY:     "#6b1a3a",
  RUST:         "#b7410e",
  CORAL:        "#e87a48",
  PINK:         "#FF69B4",
  ROSE:         "#e88a9a",
  BLUSH:        "#f0c0b0",
  DUSTYROSE:    "#dcae96",
  RASPBERRY:    "#6b1a4a",
  PURPLE:       "#5a1a6b",
  LAVENDER:     "#dcb4f0",
  INDIGO:       "#4b0082",
  PLUM:         "#4a1a6b",
  MAUVE:        "#6b4a4a",
  BROWN:        "#654321",
  CHOCOLATE:    "#6b3a1a",
  COGNAC:       "#6b4a1a",
  ESPRESSO:     "#3a1a1a",
  ORANGE:       "#ff8c00",
  CLAY:         "#c4603b",
  TERRACOTTA:   "#c4603b",
  // ── Multi-word names (space-joined form; resolveColorToken also tries space-stripped) ──
  // Raj can type "Sea Green", "Dark Grey", etc. in admin — spaces are normalised away.
  SEAGREEN:     "#2e8b57",
  DARKGREY:     "#404040",
  DARKGRAY:     "#404040",
  LIGHTGREY:    "#d3d3d3",
  LIGHTGRAY:    "#d3d3d3",
  DARKGREEN:    "#145a30",
  DARKNAVY:     "#0d1b3e",
  DARKBLUE:     "#00008b",
  LIGHTBLUE:    "#87ceeb",
  HOTPINK:      "#ff69b4",
  BABYPINK:     "#ffb6c1",
  BABYBLUE:     "#89cff0",
  ROSEGOLD:     "#b76e79",
  OFFWHITE:     "#f8f4e3",
  // FORESTGREEN, ROYALBLUE, SKYBLUE, POWDERBLUE, OLIVEGREEN, DUSTYROSE
  // already defined in the full-word section above — not repeated here.
  MINTGREEN:    "#98ff98",
  NAVYBLUE:     "#001f5b",
  COBALTBLUE:   "#0047ab",
  EMERALDGREEN: "#50c878",
  DUSTYPINK:    "#d4a5a5",
  BURNTORANGE:  "#cc5500",
  DEEPRED:      "#8b0000",
  WINERED:      "#722f37",
  BOTTLEGREEN:  "#006a4e",
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

// ── Zone fill types ───────────────────────────────────────────────────────────
// A zone fill describes what fills a single recolor channel in a PAT-format SKU.
// kind:"color" is the existing behavior; kind:"print" replaces that channel
// with a tiled GP print texture.
//
// Convention: zoneFills[0] = colorB slot (base/light channel)
//             zoneFills[1] = colorA slot (dark/accent channel)
//
// SKU token syntax inside PAT-…:
//   BLK        → { kind:"color", hex:"#1a1a1a" }
//   PRT-006    → { kind:"print", patternId:"KS1000BGP006", printNum:6 }
//   PRT006     → same (hyphen is optional)

export type ZoneFill =
  | { kind: "color"; hex: string }
  | { kind: "print"; patternId: string; printNum: number }
  /**
   * Token was not a valid hex code, not a known name/abbreviation, and not a
   * print reference.  The token is preserved verbatim so the UI can surface
   * an actionable error instead of silently rendering a fallback colour.
   */
  | { kind: "unresolved"; token: string };

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
  designId: string;    // KashaDesignDef.id — always KS-prefixed, e.g. "KS1001B"
  patternNumber: number; // 1001–1006
  suffix: string;      // raw suffix after the first hyphen, e.g. "PAT-BLK,PNK" or "BB"
  colorA: string;      // dark/accent channel hex (zone 1); "#808080" placeholder when fillA is a print
  colorB: string;      // light/primary channel hex (zone 0); "#808080" placeholder when fillB is a print
  colorLabel: string;
  /**
   * Positional zone colors resolved from the PAT token list.
   * Index 0 = colorB (primary/base), index 1 = colorA (accent/dark).
   * Single-token SKUs set all elements to the same hex.
   * Always length ≥ 1; use colorA/colorB for 2-zone backward compat.
   */
  zoneColors: string[];
  /**
   * Per-slot fill descriptors for the new mixed color+print PAT format.
   * Index 0 = colorB slot (base/light channel).
   * Index 1 = colorA slot (dark/accent channel).
   * Both slots are always populated; kind:"color" is the existing behavior.
   *
   * Examples:
   *   KS1007B-PAT-BLK,PRT-006  → [{ kind:"color", hex:"#1a1a1a" }, { kind:"print", patternId:"KS1000BGP006", printNum:6 }]
   *   KS1007B-PAT-PRT-003,PRT-006 → [{ kind:"print",… }, { kind:"print",… }]
   *   KS1007B-PAT-BLK,CRM      → [{ kind:"color",… }, { kind:"color",… }] (existing)
   */
  zoneFills: ZoneFill[];
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

// Pattern design (collar/accent overlay) combined with an all-over body print.
// SKU format: KS100NB-GPnnn-{ColorName}
// e.g. KS1001B-GP006-Grey → KS1001B design in grey + KS1000BGP006 body print
export interface PatternPrintSkuResult {
  type: "pattern+print";
  sku: string;
  designId: string;      // e.g. "KS1001B"
  patternNumber: number; // pattern series number
  patternId: string;     // body print id, e.g. "KS1000BGP006"
  designNumber: number;  // GP print number
  colorA: string;        // dark channel for the pattern design
  colorB: string;        // light/main channel for the pattern design
  colorLabel: string;
}

export type SkuResult =
  | PrintSkuResult
  | PatternSkuResult
  | PatternPrintSkuResult
  | SolidSkuResult
  | UnknownSkuResult;

// ── SKU parser ───────────────────────────────────────────────────────────────

/**
 * Resolve a color token (3-letter alias, full name, or 2-letter code) to a hex string.
 * Returns null when the token is not found in any lookup table.
 * This is the single authoritative lookup used by both solid-color and PAT parsing.
 */
export function resolveColorToken(token: string): string | null {
  const t = token.trim().toUpperCase();
  // Try exact match first (handles 3-letter codes and single-word names like "NAVY").
  const exact = DESCRIPTIVE_COLOR_HEX[t] ?? SOLID_COLOR_MAP[t];
  if (exact) return exact;
  // Strip internal spaces so Raj can type "Sea Green", "Dark Grey", "Bottle Green"
  // and have them resolve the same as the joined-word key "SEAGREEN" / "DARKGREY".
  const joined = t.replace(/\s+/g, "");
  if (joined !== t) {
    return DESCRIPTIVE_COLOR_HEX[joined] ?? SOLID_COLOR_MAP[joined] ?? null;
  }
  return null;
}

/**
 * Parse a KA.SHA product SKU into its design configuration.
 *
 * Examples:
 *   parseSku("KS1000BGP005")           → { type:"print", … }
 *   parseSku("KS1001B-PAT-BLK,PNK")   → { type:"pattern", designId:"KS1001B", colorB:"#1a1a1a", colorA:"#FF69B4", … }
 *   parseSku("KL1003B-PAT-NVY")        → { type:"pattern", designId:"KS1003B", colorB:"#1a2c5e", colorA:"#1a2c5e", … }
 *   parseSku("KS1001B-BB")             → { type:"pattern", … }  (legacy abbreviated suffix)
 *   parseSku("KS1000B-NV")             → { type:"solid", hex:"#1a2c5e", … }
 */
export function parseSku(sku: string): SkuResult {
  if (!sku) return { type: "unknown", sku };

  const upper = sku.trim().toUpperCase();

  // ── New general format: [KS|KL][STYLE][TYPE]-[SLD|PRT]-[VALUE] ────────────
  // Handles T-shirts, all bottom-wear (F=shorts/pants, D=dress, G=skort), and any
  // top style (B) that does NOT use a bare legacy prefix.
  // PAT- suffix is intentionally excluded here so it falls through to the existing
  // pattern handler below which carries full zone-design logic.
  //
  // Examples handled:
  //   KS1003B-SLD-NVY      → solid navy T-shirt
  //   KS1002F-SLD-BLK      → solid black shorts
  //   KL1015G-SLD-Sea Green → solid sea-green skort (space-stripped by resolveColorToken)
  //   KS1003B-PRT-001      → all-over print #001 on T-shirt (Bug 1)
  //   KL1002F-PRT-010      → all-over print #010 on women's shorts
  //   KS1001B-PRT-003,BROWN → print #003 body + KS1001B zone design in brown (Bug 2)
  //   KS1001B-SLD-BLK      → solid black polo (SLD trumps zone-design for simple colourways)
  const newFmtMatch = upper.match(/^(KS|KL)(\d{4})([BFDG])-(SLD|PRT)-(.+)$/);
  if (newFmtMatch) {
    const [, , styleStr, typeCode, variantType, valueStr] = newFmtMatch;
    const styleNum = parseInt(styleStr, 10);
    // B-type styles 1001-1007 that include a color after the print number get
    // routed to "pattern+print" so the zone-design effect can layer artwork on top.
    const isPatternStyle = typeCode === "B" && styleNum >= 1001 && styleNum <= 1007;

    if (variantType === "SLD") {
      const hex = resolveColorToken(valueStr.split(",")[0].trim()) ?? "#f5f5f5";
      return { type: "solid", sku: upper, colorCode: valueStr.split(",")[0].trim(), hex };
    }

    if (variantType === "PRT") {
      const parts = valueStr.split(",").map(t => t.trim());
      const printNum = parseInt(parts[0], 10);
      if (!isNaN(printNum)) {
        const padded    = String(printNum).padStart(3, "0");
        const printKey  = `KS1000BGP${padded}`;
        const patternId = PRINT_SKU_MAP[printKey] ?? printKey;

        // PRT-NNN,COLOR on a pattern-style B product → pattern+print with colour
        if (isPatternStyle && parts.length > 1) {
          const designId  = `KS${styleStr}B`;
          const colorB    = resolveColorToken(parts[1]) ?? DEFAULT_PATTERN_COLORS.colorB;
          const colorA    = parts[2]
            ? resolveColorToken(parts[2]) ?? DEFAULT_PATTERN_COLORS.colorA
            : DEFAULT_PATTERN_COLORS.colorA;
          return {
            type:          "pattern+print" as const,
            sku:           upper,
            designId,
            patternNumber: styleNum,
            patternId,
            designNumber:  printNum,
            colorA,
            colorB,
            colorLabel:    parts.slice(1).join("+"),
          };
        }

        // PRT-NNN (no colour, or non-pattern style) → pure all-over print
        return { type: "print", sku: upper, patternId, designNumber: printNum };
      }
    }
  }

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

  // ── Standalone print: bare SKUs registered in PRINT_SKU_MAP (e.g. KS1006B, KL1007B) ──
  // Must run BEFORE the patternMatch block below because styles 1001-1006 would
  // otherwise be caught as zone-design patterns. Only exact bare-SKU matches fire here
  // — suffixed variants (KS1006B-PAT-BLK) still fall through to patternMatch.
  if (PRINT_SKU_MAP[upper]) {
    const patternId = PRINT_SKU_MAP[upper];
    return { type: "print", sku: upper, patternId, designNumber: 0 };
  }

  // ── Pattern: KS1001B-… / KL1001B-… (men's and women's, styles 1001-1007) ──
  //
  // Accepts three suffix formats (resolved in order below):
  //   1. New canonical:  -PAT-BLK,PNK   (comma-separated 3-letter color tokens)
  //   2. Legacy short:   -BB / -RB / …  (in PATTERN_SUFFIX_COLORS table)
  //   3. Descriptive:    -ARTICHOKE-BROWN  (hyphen-separated full color names)
  //
  // KL prefix is accepted and mapped to the matching KS design id so that
  // women's pattern products share the same zone texture artwork as men's.
  // (The women's 3D model mesh is chosen separately via product.modelUrl.)
  const patternMatch = upper.match(/^(KS|KL)(100[1-7])B(?:-(.+))?$/);
  if (patternMatch) {
    const styleNum  = patternMatch[2];                 // "1001" … "1007"
    const patNum    = parseInt(styleNum, 10);
    const rawSuffix = (patternMatch[3] ?? "").trim();
    // KL designs use the same zone artwork as their KS equivalents.
    const designId  = `KS${styleNum}B`;

    // ── Legacy combo: -KS1000BGP{NNN}-{COLOR}  (backward compatibility) ──────
    // Old admin format: KS1001B-KS1000BGP003-BROW
    // New equivalent:   KS1001B-PRT-003,BROWN  (handled by newFmtMatch above)
    // Both should produce type:"pattern+print" so the zone-design effect layers
    // the KS1001B artwork on top of the body print in the specified colour.
    const legacyKsPrint = rawSuffix.match(/^KS1000BGP(\d{3})(?:-(.+))?$/i);
    if (legacyKsPrint) {
      const printNum  = parseInt(legacyKsPrint[1], 10);
      const padded    = String(printNum).padStart(3, "0");
      const printKey  = `KS1000BGP${padded}`;
      const patternId = PRINT_SKU_MAP[printKey] ?? printKey;
      const colorStr  = (legacyKsPrint[2] ?? "").toUpperCase();
      const colorParts = colorStr.split(/[-,]/).filter(Boolean);
      const colorB = resolveColorToken(colorParts[0] ?? "") ?? DEFAULT_PATTERN_COLORS.colorB;
      const colorA = colorParts[1]
        ? resolveColorToken(colorParts[1]) ?? DEFAULT_PATTERN_COLORS.colorA
        : DEFAULT_PATTERN_COLORS.colorA;
      return {
        type:          "pattern+print" as const,
        sku:           upper,
        designId,
        patternNumber: patNum,
        patternId,
        designNumber:  printNum,
        colorA,
        colorB,
        colorLabel:    colorStr || "Default",
      };
    }

    // ── Suffix contains a print reference (GP\d{3}…) → pattern + body print ──
    // e.g. KS1001B-GP006-Grey: KS1001B design in grey, body print = KS1000BGP006.
    const gpInSuffix = rawSuffix.match(/^GP(\d{3})(?:-(.+))?$/i);
    if (gpInSuffix) {
      const printNum  = parseInt(gpInSuffix[1], 10);
      const padded    = String(printNum).padStart(3, "0");
      const patternId = `KS1000BGP${padded}`;
      const colorStr  = (gpInSuffix[2] ?? "").toUpperCase();
      const colorParts = colorStr.split("-").filter(Boolean);
      const c1 = colorParts[0] ?? "";
      const c2 = colorParts[1] ?? "";
      const colorB = DESCRIPTIVE_COLOR_HEX[c1] ?? DEFAULT_PATTERN_COLORS.colorB;
      const colorA = c2
        ? (DESCRIPTIVE_COLOR_HEX[c2] ?? DEFAULT_PATTERN_COLORS.colorA)
        : DEFAULT_PATTERN_COLORS.colorA;
      return {
        type:          "pattern+print" as const,
        sku:           upper,
        designId,
        patternNumber: patNum,
        patternId,
        designNumber:  printNum,
        colorA,
        colorB,
        colorLabel:    colorStr || "Default",
      };
    }

    // ── New canonical format: -PAT-TOKEN[,TOKEN…] ─────────────────────────────
    // e.g. KS1001B-PAT-BLK,PNK      → zone0=black solid, zone1=pink solid
    //      KL1003B-PAT-NVY           → both zones = navy solid
    //      KS1007B-PAT-BLK,PRT-006   → zone0=black solid, zone1=GP006 print
    //      KS1007B-PAT-PRT-003,PRT-006 → both zones = prints
    //
    // Token format:
    //   Color token:  "BLK", "CRM", "NAVY", "Sea Green", …  (any resolveColorToken input)
    //   Print token:  "PRT-006" or "PRT006"  (PRT- prefix followed by 1-3 digit print number)
    //
    // Zone convention:
    //   zoneColors[0] = colorB  (primary / base  / light channel)
    //   zoneColors[1] = colorA  (accent  / dark  / shadow channel)
    const ZONE_COUNT = 2; // current designs have exactly 2 recolor channels

    /** Resolve a single PAT token to a ZoneFill. */
    const resolvePATToken = (tok: string): ZoneFill => {
      // Print token: PRT-NNN or PRTNNN (1-3 digit number)
      const prtMatch = tok.match(/^PRT-?(\d{1,3})$/i);
      if (prtMatch) {
        const num = parseInt(prtMatch[1], 10);
        const padded = String(num).padStart(3, "0");
        const key = `KS1000BGP${padded}`;
        const patternId = PRINT_SKU_MAP[key] ?? key;
        return { kind: "print", patternId, printNum: num };
      }
      // Bare 6-character hex (no leading #) — applied directly, no name lookup needed
      if (/^[0-9A-Fa-f]{6}$/.test(tok)) {
        return { kind: "color", hex: `#${tok.toUpperCase()}` };
      }
      // Named colour token (3-letter code, full name, multi-word…)
      const hex = resolveColorToken(tok);
      if (hex) return { kind: "color", hex };
      // Nothing matched — surface a typed error; do NOT silently fall back to a default colour
      console.error(
        `[SKU] parseSku("${upper}"): token "${tok}" could not be resolved — ` +
        `not a 6-char hex, not in SOLID_COLOR_MAP, not in DESCRIPTIVE_COLOR_HEX. ` +
        `No colour will be applied for this slot.`,
      );
      return { kind: "unresolved", token: tok };
    };

    if (rawSuffix.startsWith("PAT-")) {
      const tokenStr = rawSuffix.slice(4); // everything after "PAT-"
      const tokens   = tokenStr.split(",").map(t => t.trim()).filter(Boolean);

      let fills: ZoneFill[];

      if (tokens.length === 0) {
        // "PAT-" with nothing after it → fall back to defaults
        fills = [
          { kind: "color", hex: DEFAULT_PATTERN_COLORS.colorB },
          { kind: "color", hex: DEFAULT_PATTERN_COLORS.colorA },
        ];
      } else if (tokens.length === 1) {
        // Single token → broadcast to all zones
        const fill = resolvePATToken(tokens[0]);
        fills = Array(ZONE_COUNT).fill(fill) as ZoneFill[];
      } else {
        if (tokens.length !== ZONE_COUNT) {
          console.warn(
            `[SKU] ${upper}: PAT token count (${tokens.length}) does not match ` +
            `zone count (${ZONE_COUNT}). Extra tokens will be ignored.`,
          );
        }
        fills = tokens.slice(0, ZONE_COUNT).map(resolvePATToken);
        // Pad to ZONE_COUNT if fewer tokens than zones
        while (fills.length < ZONE_COUNT) {
          fills.push(fills[0] ?? { kind: "color", hex: DEFAULT_PATTERN_COLORS.colorA });
        }
      }

      // Backward-compat hex values: use a neutral placeholder for print / unresolved slots
      // so any code that reads colorA/colorB without checking zoneFills still compiles.
      // "unresolved" slots get the same placeholder — the UI surfaces the error separately.
      const PRINT_PLACEHOLDER = "#808080";
      const fillHex = (f: ZoneFill): string =>
        f.kind === "color" ? f.hex : PRINT_PLACEHOLDER;
      const fill0 = fills[0];
      const fill1 = fills[1] ?? fills[0];
      const colorB = fillHex(fill0);
      const colorA = fillHex(fill1);

      const toTitle = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
      const colorLabel = tokens.length > 0
        ? tokens.map(t => t.toUpperCase().startsWith("PRT") ? t.toUpperCase() : toTitle(t)).join(" + ")
        : "Default";

      return {
        type: "pattern",
        sku: upper,
        designId,
        patternNumber: patNum,
        suffix: rawSuffix,
        colorA,
        colorB,
        colorLabel,
        zoneColors: fills.map(f => f.kind === "color" ? f.hex : PRINT_PLACEHOLDER),
        zoneFills: fills,
      };
    }

    // ── Legacy abbreviated suffix (in PATTERN_SUFFIX_COLORS) or no suffix ───
    if (!rawSuffix || PATTERN_SUFFIX_COLORS[rawSuffix]) {
      const colors = PATTERN_SUFFIX_COLORS[rawSuffix] ?? DEFAULT_PATTERN_COLORS;
      return {
        type: "pattern",
        sku: upper,
        designId,
        patternNumber: patNum,
        suffix: rawSuffix || "BB",
        colorA: colors.colorA,
        colorB: colors.colorB,
        colorLabel: colors.label,
        zoneColors: [colors.colorB, colors.colorA],
        zoneFills: [
          { kind: "color", hex: colors.colorB },
          { kind: "color", hex: colors.colorA },
        ],
      };
    }

    // ── Descriptive colour-name suffix: e.g. ARTICHOKE-BROWN, NAVY-BLACK ────
    // Parts are separated by hyphens inside the suffix portion.
    // Convention (mirrors PATTERN_SUFFIX_COLORS):
    //   part[0] = primary / base colour  → colorB (light channel)
    //   part[1] = accent / dark colour   → colorA (dark channel)
    const colorParts = rawSuffix.split("-").filter(Boolean);
    const c1 = colorParts[0] ?? "";
    const c2 = colorParts[1] ?? "";

    const colorB = DESCRIPTIVE_COLOR_HEX[c1] ?? DEFAULT_PATTERN_COLORS.colorB;
    const colorA = c2
      ? (DESCRIPTIVE_COLOR_HEX[c2] ?? DEFAULT_PATTERN_COLORS.colorA)
      : DEFAULT_PATTERN_COLORS.colorA;

    const toTitle = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
    const colorLabel = colorParts.map(toTitle).join(" + ");

    return {
      type: "pattern",
      sku: upper,
      designId,
      patternNumber: patNum,
      suffix: rawSuffix,
      colorA,
      colorB,
      colorLabel,
      zoneColors: [colorB, colorA],
      zoneFills: [
        { kind: "color", hex: colorB },
        { kind: "color", hex: colorA },
      ],
    };
  }

  return { type: "unknown", sku: upper };
}

