// ─────────────────────────────────────────────────────────────────────────────
// gt-styles.ts  —  KA.SHA Design Style System
//
// Implements GT001–GT032 as programmatic canvas draw calls on the existing
// 1024×1024 Fabric.js texture canvas. No new UV mapping needed.
//
// How it works:
//   1. Each GT style is defined as a list of DrawLayer instructions.
//   2. applyGtStyle() executes those instructions onto the Fabric canvas using
//      plain fabric.Rect / fabric.Polygon objects tagged with { kashaGt: true }.
//   3. All GT objects are non-selectable and sit at z-index 0 (behind text/logos).
//   4. changeGtColors() re-runs with new colours so the customer can customise.
//   5. clearGtStyle() removes all GT objects cleanly.
//
// The customer flow:
//   Select GT001 → shirt fills automatically with the right colour zones
//   Pick a new primary colour → only the primary zones update instantly
//   Add text on top → text layers are unaffected
// ─────────────────────────────────────────────────────────────────────────────

import * as fabric from "fabric";

// ── Zone bounding boxes (top-left origin, 1024×1024 canvas) ─────────────────
// Measured from collar_t-shirt_model.glb via UV island detection.
export const UV_ZONES = {
  front:       { x0: 10,  y0: 341, x1: 500,  y1: 1019 },
  back:        { x0: 524, y0: 188, x1: 1007, y1: 1021 },
  collar:      { x0: 12,  y0: 183, x1: 519,  y1: 349  },
  leftSleeve:  { x0: 210, y0: 4,   x1: 608,  y1: 174  },
  rightSleeve: { x0: 617, y0: 2,   x1: 1015, y1: 173  },
} as const;

export type UVZoneName = keyof typeof UV_ZONES;

// ── Colour roles ─────────────────────────────────────────────────────────────
export type ColorRole = "primary" | "accent" | "tertiary";

export interface GtColors {
  primary:   string;
  accent:    string;
  tertiary?: string;
}

// ── Layer types ──────────────────────────────────────────────────────────────
type LayerType =
  | "fillZone"          // solid fill of an entire UV zone
  | "sidePanels"        // vertical side panels on front+back+sleeves
  | "sleeveBand"        // horizontal band at bottom of sleeves (cuffs)
  | "hemBand"           // horizontal band at bottom of front+back (hem)
  | "yokeDiagonal"      // diagonal yoke stripe front+back
  | "hourglassPanel"    // centre hourglass shape front+back
  | "centrePanelFront"  // straight centre column front only
  | "centrePanelBoth"   // straight centre column front+back
  | "raglanYoke"        // raglan shoulder yoke
  | "pinstripes";       // vertical pinstripes overlay

interface DrawLayer {
  type: LayerType;
  role: ColorRole;
  /** Extra params specific to the layer type */
  params?: Record<string, number>;
}

// ── Style definition ─────────────────────────────────────────────────────────
export interface GtStyleDef {
  id: string;
  label: string;
  group: string;
  defaultColors: GtColors;
  layers: DrawLayer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GT STYLE CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────
export const GT_STYLES: GtStyleDef[] = [

  // ── classic (GT001–GT005): solid body + contrast collar/cuffs/hem ─────────
  {
    id: "GT001", label: "Sky & Oxblood", group: "classic",
    defaultColors: { primary: "#C5D3DE", accent: "#362223" },
    layers: [
      { type: "fillZone",   role: "primary" },   // fills all zones
      { type: "fillZone",   role: "accent",  params: { zone: 0 } }, // collar only
      { type: "sleeveBand", role: "accent",  params: { frac: 0.30 } },
      { type: "hemBand",    role: "accent",  params: { frac: 0.07 } },
    ],
  },
  {
    id: "GT002", label: "Blush & Oxblood", group: "classic",
    defaultColors: { primary: "#F0CED2", accent: "#362223" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "fillZone",   role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand", role: "accent",  params: { frac: 0.30 } },
      { type: "hemBand",    role: "accent",  params: { frac: 0.07 } },
    ],
  },
  {
    id: "GT003", label: "Sage & Oxblood", group: "classic",
    defaultColors: { primary: "#ACB1A1", accent: "#362223" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "fillZone",   role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand", role: "accent",  params: { frac: 0.30 } },
      { type: "hemBand",    role: "accent",  params: { frac: 0.07 } },
    ],
  },
  {
    id: "GT004", label: "Sand & Oxblood", group: "classic",
    defaultColors: { primary: "#E9DAC3", accent: "#362223" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "fillZone",   role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand", role: "accent",  params: { frac: 0.30 } },
      { type: "hemBand",    role: "accent",  params: { frac: 0.07 } },
    ],
  },
  {
    id: "GT005", label: "White & Navy", group: "classic",
    defaultColors: { primary: "#FFFFFF", accent: "#273878" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "fillZone",   role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand", role: "accent",  params: { frac: 0.30 } },
      { type: "hemBand",    role: "accent",  params: { frac: 0.07 } },
    ],
  },

  // ── sport-side (GT006–GT009): body + contrast side panels + sleeves ───────
  {
    id: "GT006", label: "Olive & Black", group: "sport-side",
    defaultColors: { primary: "#576043", accent: "#000000" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT007", label: "Red & Black", group: "sport-side",
    defaultColors: { primary: "#DA1F26", accent: "#000000" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT008", label: "Navy & Black", group: "sport-side",
    defaultColors: { primary: "#273878", accent: "#000000" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT009", label: "Blush & Slate", group: "sport-side",
    defaultColors: { primary: "#F0CED2", accent: "#585858" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.28 } },
    ],
  },

  // ── triple (GT010): 3-colour sport with contrast collar ───────────────────
  {
    id: "GT010", label: "Blush/Black/Slate", group: "triple",
    defaultColors: { primary: "#000000", accent: "#585858", tertiary: "#F0CED2" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",   params: { frac: 0.28 } },
      { type: "fillZone",   role: "tertiary", params: { zone: 0 } },  // collar
    ],
  },

  // ── wave (GT011–GT014): curvy side panels ────────────────────────────────
  {
    id: "GT011", label: "Black & Slate", group: "wave",
    defaultColors: { primary: "#000000", accent: "#585858" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.32 } },
    ],
  },
  {
    id: "GT012", label: "Mint & Forest", group: "wave",
    defaultColors: { primary: "#ACB1A1", accent: "#576043" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.32 } },
    ],
  },
  {
    id: "GT013", label: "Blush & Cream", group: "wave",
    defaultColors: { primary: "#F0CED2", accent: "#F8F4E9" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.32 } },
    ],
  },
  {
    id: "GT014", label: "Sky & Cream", group: "wave",
    defaultColors: { primary: "#C5D3DE", accent: "#F8F4E9" },
    layers: [
      { type: "fillZone",   role: "primary" },
      { type: "sidePanels", role: "accent",  params: { frac: 0.32 } },
    ],
  },

  // ── hourglass (GT015–GT018): centre hourglass panel ───────────────────────
  {
    id: "GT015", label: "Blush & Black", group: "hourglass",
    defaultColors: { primary: "#000000", accent: "#F0CED2" },
    layers: [
      { type: "fillZone",      role: "primary" },
      { type: "hourglassPanel", role: "accent" },
    ],
  },
  {
    id: "GT016", label: "Sand & Cream", group: "hourglass",
    defaultColors: { primary: "#E9DAC3", accent: "#F8F4E9" },
    layers: [
      { type: "fillZone",      role: "primary" },
      { type: "hourglassPanel", role: "accent" },
    ],
  },
  {
    id: "GT017", label: "Black & Slate", group: "hourglass",
    defaultColors: { primary: "#000000", accent: "#585858" },
    layers: [
      { type: "fillZone",      role: "primary" },
      { type: "hourglassPanel", role: "accent" },
    ],
  },
  {
    id: "GT018", label: "Mint & Forest", group: "hourglass",
    defaultColors: { primary: "#ACB1A1", accent: "#576043" },
    layers: [
      { type: "fillZone",      role: "primary" },
      { type: "hourglassPanel", role: "accent" },
    ],
  },

  // ── pinstripe (GT019–GT023): pinstripe body ───────────────────────────────
  {
    id: "GT019", label: "Forest & White", group: "pinstripe",
    defaultColors: { primary: "#243C2F", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",  role: "primary" },
      { type: "pinstripes", role: "accent", params: { spacing: 28, width: 4 } },
    ],
  },
  {
    id: "GT020", label: "Slate & White", group: "pinstripe",
    defaultColors: { primary: "#585858", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",  role: "primary" },
      { type: "pinstripes", role: "accent", params: { spacing: 28, width: 4 } },
    ],
  },
  {
    id: "GT021", label: "Black & White", group: "pinstripe",
    defaultColors: { primary: "#000000", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",  role: "primary" },
      { type: "pinstripes", role: "accent", params: { spacing: 28, width: 4 } },
    ],
  },
  {
    id: "GT022", label: "Red & White", group: "pinstripe",
    defaultColors: { primary: "#DA1F26", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",  role: "primary" },
      { type: "pinstripes", role: "accent", params: { spacing: 28, width: 4 } },
    ],
  },
  {
    id: "GT023", label: "Navy & White", group: "pinstripe",
    defaultColors: { primary: "#273878", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",  role: "primary" },
      { type: "pinstripes", role: "accent", params: { spacing: 28, width: 4 } },
    ],
  },

  // ── raglan (GT024–GT032): raglan yoke + collar + cuffs ───────────────────
  {
    id: "GT024", label: "Black & Blush", group: "raglan",
    defaultColors: { primary: "#000000", accent: "#F0CED2" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT025", label: "Forest & Blush", group: "raglan",
    defaultColors: { primary: "#243C2F", accent: "#F0CED2" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT026", label: "Red & White", group: "raglan",
    defaultColors: { primary: "#DA1F26", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT027", label: "Forest & Mint", group: "raglan",
    defaultColors: { primary: "#576043", accent: "#ACB1A1" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT028", label: "Forest & White", group: "raglan",
    defaultColors: { primary: "#243C2F", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT029", label: "Black & Red", group: "raglan",
    defaultColors: { primary: "#000000", accent: "#DA1F26" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT030", label: "Black & Slate", group: "raglan",
    defaultColors: { primary: "#000000", accent: "#585858" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT031", label: "Navy & White", group: "raglan",
    defaultColors: { primary: "#273878", accent: "#FFFFFF" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
  {
    id: "GT032", label: "Oxblood & Sand", group: "raglan",
    defaultColors: { primary: "#362223", accent: "#E9DAC3" },
    layers: [
      { type: "fillZone",    role: "primary" },
      { type: "raglanYoke",  role: "accent" },
      { type: "fillZone",    role: "accent",  params: { zone: 0 } },
      { type: "sleeveBand",  role: "accent",  params: { frac: 0.28 } },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DRAWING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_NAMES: UVZoneName[] = ["collar", "leftSleeve", "rightSleeve", "front", "back"];

function getColor(colors: GtColors, role: ColorRole): string {
  if (role === "accent")   return colors.accent;
  if (role === "tertiary") return colors.tertiary ?? colors.accent;
  return colors.primary;
}

/** Tag applied to all GT objects so they can be found and removed/updated */
const GT_TAG = "kashaGt";

function makeBaseProps(color: string, tag: string): Partial<fabric.FabricObjectProps> {
  return {
    fill: color,
    selectable: false,
    evented: false,
    excludeFromExport: false,
    // Store tag for identification
    data: { [GT_TAG]: true, gtTag: tag },
  } as any;
}

// ── Individual draw functions ─────────────────────────────────────────────────

function drawFillZone(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const zoneParam = layer.params?.zone;

  // zone param: 0=collar only, undefined=all zones
  const zonesToFill: UVZoneName[] =
    zoneParam === 0 ? ["collar"] : ZONE_NAMES;

  return zonesToFill.map((zoneName) => {
    const z = UV_ZONES[zoneName];
    const rect = new fabric.Rect({
      left:   z.x0,
      top:    z.y0,
      width:  z.x1 - z.x0,
      height: z.y1 - z.y0,
      ...makeBaseProps(color, tag),
    });
    fc.add(rect);
    return rect;
  });
}

function drawSidePanels(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const frac  = layer.params?.frac ?? 0.28;
  const objs: fabric.FabricObject[] = [];

  // Side panels on front and back
  for (const zoneName of ["front", "back"] as UVZoneName[]) {
    const z = UV_ZONES[zoneName];
    const w  = z.x1 - z.x0;
    const pw = Math.round(w * frac);

    // Left panel
    const leftRect = new fabric.Rect({
      left: z.x0, top: z.y0, width: pw, height: z.y1 - z.y0,
      ...makeBaseProps(color, tag),
    });
    // Right panel
    const rightRect = new fabric.Rect({
      left: z.x1 - pw, top: z.y0, width: pw, height: z.y1 - z.y0,
      ...makeBaseProps(color, tag),
    });
    fc.add(leftRect);
    fc.add(rightRect);
    objs.push(leftRect, rightRect);
  }

  // Full sleeves as side accent
  for (const zoneName of ["leftSleeve", "rightSleeve"] as UVZoneName[]) {
    const z = UV_ZONES[zoneName];
    const rect = new fabric.Rect({
      left: z.x0, top: z.y0, width: z.x1 - z.x0, height: z.y1 - z.y0,
      ...makeBaseProps(color, tag),
    });
    fc.add(rect);
    objs.push(rect);
  }
  return objs;
}

function drawSleeveBand(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const frac  = layer.params?.frac ?? 0.28;
  const objs: fabric.FabricObject[] = [];

  for (const zoneName of ["leftSleeve", "rightSleeve"] as UVZoneName[]) {
    const z  = UV_ZONES[zoneName];
    const bh = Math.round((z.y1 - z.y0) * frac);
    const rect = new fabric.Rect({
      left: z.x0, top: z.y1 - bh, width: z.x1 - z.x0, height: bh,
      ...makeBaseProps(color, tag),
    });
    fc.add(rect);
    objs.push(rect);
  }
  return objs;
}

function drawHemBand(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const frac  = layer.params?.frac ?? 0.07;
  const objs: fabric.FabricObject[] = [];

  for (const zoneName of ["front", "back"] as UVZoneName[]) {
    const z  = UV_ZONES[zoneName];
    const bh = Math.round((z.y1 - z.y0) * frac);
    const rect = new fabric.Rect({
      left: z.x0, top: z.y1 - bh, width: z.x1 - z.x0, height: bh,
      ...makeBaseProps(color, tag),
    });
    fc.add(rect);
    objs.push(rect);
  }
  return objs;
}

function drawHourglassPanel(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const objs: fabric.FabricObject[] = [];

  for (const zoneName of ["front", "back"] as UVZoneName[]) {
    const z   = UV_ZONES[zoneName];
    const w   = z.x1 - z.x0;
    const h   = z.y1 - z.y0;
    const cx  = (z.x0 + z.x1) / 2;

    const topW    = Math.round(w * 0.52);
    const waistW  = Math.round(w * 0.28);
    const bottomW = Math.round(w * 0.52);
    const waistY  = z.y0 + Math.round(h * 0.55);

    const points = [
      { x: cx - topW / 2,    y: z.y0    },
      { x: cx + topW / 2,    y: z.y0    },
      { x: cx + waistW / 2,  y: waistY  },
      { x: cx + bottomW / 2, y: z.y1    },
      { x: cx - bottomW / 2, y: z.y1    },
      { x: cx - waistW / 2,  y: waistY  },
    ];

    const poly = new fabric.Polygon(points, {
      ...makeBaseProps(color, tag),
      left: 0, top: 0,
    } as any);
    fc.add(poly);
    objs.push(poly);
  }
  return objs;
}

function drawRaglanYoke(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color = getColor(colors, layer.role);
  const objs: fabric.FabricObject[] = [];

  // Front yoke
  {
    const z = UV_ZONES.front;
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    const yd = Math.round(h * 0.22); // yoke depth

    // Left diagonal
    const leftPts = [
      { x: z.x0,                        y: z.y0 },
      { x: z.x0 + Math.round(w * 0.40), y: z.y0 },
      { x: z.x0 + Math.round(w * 0.14), y: z.y0 + yd },
      { x: z.x0,                        y: z.y0 + Math.round(yd * 0.55) },
    ];
    // Right diagonal
    const rightPts = [
      { x: z.x1,                        y: z.y0 },
      { x: z.x1 - Math.round(w * 0.40), y: z.y0 },
      { x: z.x1 - Math.round(w * 0.14), y: z.y0 + yd },
      { x: z.x1,                        y: z.y0 + Math.round(yd * 0.55) },
    ];

    const leftPoly  = new fabric.Polygon(leftPts,  { ...makeBaseProps(color, tag), left: 0, top: 0 } as any);
    const rightPoly = new fabric.Polygon(rightPts, { ...makeBaseProps(color, tag), left: 0, top: 0 } as any);
    fc.add(leftPoly);
    fc.add(rightPoly);
    objs.push(leftPoly, rightPoly);
  }

  // Back yoke (same logic, slightly shorter)
  {
    const z = UV_ZONES.back;
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    const yd = Math.round(h * 0.16);

    const leftPts = [
      { x: z.x0,                        y: z.y0 },
      { x: z.x0 + Math.round(w * 0.38), y: z.y0 },
      { x: z.x0 + Math.round(w * 0.11), y: z.y0 + yd },
      { x: z.x0,                        y: z.y0 + Math.round(yd * 0.5) },
    ];
    const rightPts = [
      { x: z.x1,                        y: z.y0 },
      { x: z.x1 - Math.round(w * 0.38), y: z.y0 },
      { x: z.x1 - Math.round(w * 0.11), y: z.y0 + yd },
      { x: z.x1,                        y: z.y0 + Math.round(yd * 0.5) },
    ];

    const leftPoly  = new fabric.Polygon(leftPts,  { ...makeBaseProps(color, tag), left: 0, top: 0 } as any);
    const rightPoly = new fabric.Polygon(rightPts, { ...makeBaseProps(color, tag), left: 0, top: 0 } as any);
    fc.add(leftPoly);
    fc.add(rightPoly);
    objs.push(leftPoly, rightPoly);
  }

  return objs;
}

function drawPinstripes(
  fc: fabric.Canvas,
  colors: GtColors,
  layer: DrawLayer,
  tag: string,
): fabric.FabricObject[] {
  const color   = getColor(colors, layer.role);
  const spacing = layer.params?.spacing ?? 28;
  const lineW   = layer.params?.width   ?? 4;
  const objs: fabric.FabricObject[] = [];

  for (const zoneName of ["front", "back"] as UVZoneName[]) {
    const z = UV_ZONES[zoneName];
    let x = z.x0 + spacing;
    while (x < z.x1) {
      const line = new fabric.Line([x, z.y0, x, z.y1], {
        stroke: color,
        strokeWidth: lineW,
        selectable: false,
        evented: false,
        data: { [GT_TAG]: true, gtTag: tag },
      } as any);
      fc.add(line);
      objs.push(line);
      x += spacing;
    }
  }
  return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/** Remove all GT style objects from the canvas */
export function clearGtStyle(fc: fabric.Canvas): void {
  const toRemove = fc.getObjects().filter(
    (o) => (o as any).data?.[GT_TAG] === true
  );
  toRemove.forEach((o) => fc.remove(o));
}

/** Apply a GT style to the canvas with the given colours */
export function applyGtStyle(
  fc: fabric.Canvas,
  style: GtStyleDef,
  colors?: Partial<GtColors>,
): void {
  const resolvedColors: GtColors = {
    ...style.defaultColors,
    ...colors,
  };

  // Remove existing GT objects
  clearGtStyle(fc);

  // Draw layers bottom-to-top
  for (let i = 0; i < style.layers.length; i++) {
    const layer = style.layers[i];
    const tag   = `${style.id}_L${i}_${layer.type}`;

    switch (layer.type) {
      case "fillZone":
        drawFillZone(fc, resolvedColors, layer, tag);
        break;
      case "sidePanels":
        drawSidePanels(fc, resolvedColors, layer, tag);
        break;
      case "sleeveBand":
        drawSleeveBand(fc, resolvedColors, layer, tag);
        break;
      case "hemBand":
        drawHemBand(fc, resolvedColors, layer, tag);
        break;
      case "hourglassPanel":
        drawHourglassPanel(fc, resolvedColors, layer, tag);
        break;
      case "raglanYoke":
        drawRaglanYoke(fc, resolvedColors, layer, tag);
        break;
      case "pinstripes":
        drawPinstripes(fc, resolvedColors, layer, tag);
        break;
    }
  }

  // Move all GT objects to the bottom so text/logos stay on top
  const gtObjs = fc.getObjects().filter((o) => (o as any).data?.[GT_TAG] === true);
  gtObjs.forEach((o) => fc.sendObjectToBack(o));

  fc.renderAll();
}

/** Change just the colours of the active GT style (faster than full redraw) */
export function recolorGtStyle(
  fc: fabric.Canvas,
  style: GtStyleDef,
  colors: Partial<GtColors>,
): void {
  // Full redraw is clean and cheap — just re-apply
  applyGtStyle(fc, style, colors);
}