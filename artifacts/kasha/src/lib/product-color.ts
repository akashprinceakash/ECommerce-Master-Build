interface NamedColor { name: string; r: number; g: number; b: number }

const NAMED_COLORS: NamedColor[] = [
  { name: "Black",        r: 15,  g: 15,  b: 15  },
  { name: "Charcoal",     r: 54,  g: 69,  b: 79  },
  { name: "Dark Grey",    r: 80,  g: 80,  b: 80  },
  { name: "Grey",         r: 128, g: 128, b: 128 },
  { name: "Silver",       r: 180, g: 180, b: 180 },
  { name: "White",        r: 245, g: 245, b: 245 },
  { name: "Ivory",        r: 240, g: 234, b: 214 },
  { name: "Cream",        r: 240, g: 232, b: 210 },
  { name: "Beige",        r: 220, g: 200, b: 175 },
  { name: "Sand",         r: 194, g: 178, b: 128 },
  { name: "Gold",         r: 184, g: 146, b: 90  },
  { name: "Amber",        r: 255, g: 191, b: 0   },
  { name: "Yellow",       r: 245, g: 220, b: 50  },
  { name: "Olive",        r: 107, g: 107, b: 20  },
  { name: "Olive Green",  r: 58,  g: 107, b: 26  },
  { name: "Forest Green", r: 34,  g: 110, b: 62  },
  { name: "Bottle Green", r: 26,  g: 74,  b: 45  },
  { name: "Emerald",      r: 26,  g: 107, b: 58  },
  { name: "Teal",         r: 26,  g: 107, b: 107 },
  { name: "Aqua",         r: 57,  g: 182, b: 199 },
  { name: "Turquoise",    r: 64,  g: 224, b: 208 },
  { name: "Sky Blue",     r: 135, g: 206, b: 235 },
  { name: "Steel Blue",   r: 26,  g: 74,  b: 107 },
  { name: "Slate Blue",   r: 26,  g: 58,  b: 74  },
  { name: "Royal Blue",   r: 26,  g: 26,  b: 107 },
  { name: "Navy",         r: 0,   g: 31,  b: 90  },
  { name: "Midnight Navy",r: 26,  g: 26,  b: 74  },
  { name: "Indigo",       r: 75,  g: 0,   b: 130 },
  { name: "Purple",       r: 90,  g: 26,  b: 107 },
  { name: "Plum",         r: 74,  g: 26,  b: 107 },
  { name: "Lavender",     r: 220, g: 180, b: 240 },
  { name: "Magenta",      r: 107, g: 26,  b: 107 },
  { name: "Raspberry",    r: 107, g: 26,  b: 74  },
  { name: "Burgundy",     r: 107, g: 26,  b: 58  },
  { name: "Crimson",      r: 107, g: 26,  b: 26  },
  { name: "Red",          r: 210, g: 30,  b: 30  },
  { name: "Coral",        r: 232, g: 122, b: 72  },
  { name: "Orange",       r: 255, g: 140, b: 0   },
  { name: "Pink",         r: 232, g: 138, b: 154 },
  { name: "Rose",         r: 232, g: 138, b: 154 },
  { name: "Chocolate",    r: 107, g: 58,  b: 26  },
  { name: "Brown",        r: 101, g: 67,  b: 33  },
  { name: "Cognac",       r: 107, g: 74,  b: 26  },
  { name: "Espresso",     r: 58,  g: 26,  b: 26  },
  { name: "Jade",         r: 26,  g: 107, b: 74  },
  { name: "Avocado",      r: 74,  g: 107, b: 26  },
  { name: "Khaki",        r: 74,  g: 58,  b: 26  },
  { name: "Mauve",        r: 107, g: 74,  b: 74  },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

export function hexToColorName(hex: string): string {
  if (!hex) return "";
  const rgb = hexToRgb(hex);
  if (!rgb) return "";

  let minDist = Infinity;
  let closestName = "";

  for (const c of NAMED_COLORS) {
    const dr = rgb.r - c.r;
    const dg = rgb.g - c.g;
    const db = rgb.b - c.b;
    const dist = Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
    if (dist < minDist) {
      minDist = dist;
      closestName = c.name;
    }
  }

  return closestName;
}

const COLOR_KEYWORDS = [
  "Navy", "Black", "White", "Charcoal", "Grey", "Gray",
  "Red", "Blue", "Green", "Yellow", "Pink", "Purple",
  "Orange", "Brown", "Cream", "Beige", "Gold", "Silver",
  "Burgundy", "Teal", "Coral", "Olive", "Indigo", "Maroon",
  "Khaki", "Turquoise", "Lavender", "Magenta", "Aqua",
  "Jade", "Coral", "Slate", "Royal", "Forest", "Midnight",
  "Crimson", "Cobalt", "Rose", "Ivory", "Cognac", "Chocolate",
];

function extractColorFromName(name: string): string {
  const found: string[] = [];
  const upper = name.toUpperCase();
  for (const kw of COLOR_KEYWORDS) {
    if (upper.includes(kw.toUpperCase()) && !found.includes(kw)) {
      found.push(kw);
    }
    if (found.length >= 2) break;
  }
  if (found.length > 0) return found.join(" & ");

  const match = name.match(/[—–-]\s*[A-Z]{0,4}\d*([A-Za-z][A-Za-z-]+)\s*$/);
  if (match) return match[1].replace(/-/g, " & ");

  return "";
}

const DEFAULT_WHITE = "#ffffff";

export function getProductColorLabel(product: {
  defaultColor?: string | null;
  name?: string | null;
}): string {
  const hex = product.defaultColor?.trim() ?? "";
  const isDefault = !hex || hex.toLowerCase() === DEFAULT_WHITE || hex.toLowerCase() === "#fff";

  if (!isDefault) {
    const fromHex = hexToColorName(hex);
    if (fromHex) return fromHex;
  }

  return extractColorFromName(product.name ?? "");
}
