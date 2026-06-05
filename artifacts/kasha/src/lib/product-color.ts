const SWATCH_MAP: Record<string, string> = {
  "black":         "#0f0f0f",
  "charcoal":      "#36454f",
  "dark grey":     "#505050",
  "grey":          "#808080",
  "gray":          "#808080",
  "silver":        "#b4b4b4",
  "white":         "#f5f5f5",
  "ivory":         "#f0ead6",
  "cream":         "#f0e8d2",
  "beige":         "#dcc8af",
  "sand":          "#c2b280",
  "gold":          "#b8925a",
  "amber":         "#ffbf00",
  "yellow":        "#f5dc32",
  "olive":         "#6b6b14",
  "olive green":   "#3a6b1a",
  "forest green":  "#226b3e",
  "bottle green":  "#1a4a2d",
  "emerald":       "#1a6b3a",
  "jade":          "#1a6b4a",
  "avocado":       "#4a6b1a",
  "sage":          "#8fa67a",
  "teal":          "#1a6b6b",
  "aqua":          "#39b6c7",
  "turquoise":     "#40e0d0",
  "sky blue":      "#87ceeb",
  "steel blue":    "#1a4a6b",
  "slate blue":    "#1a3a4a",
  "royal blue":    "#1a1a6b",
  "navy":          "#001f5a",
  "midnight navy": "#1a1a4a",
  "indigo":        "#4b0082",
  "purple":        "#5a1a6b",
  "plum":          "#4a1a6b",
  "lavender":      "#dcb4f0",
  "magenta":       "#6b1a6b",
  "raspberry":     "#6b1a4a",
  "burgundy":      "#6b1a3a",
  "crimson":       "#6b1a1a",
  "maroon":        "#6b1a1a",
  "red":           "#d21e1e",
  "coral":         "#e87a48",
  "orange":        "#ff8c00",
  "pink":          "#e88a9a",
  "rose":          "#e88a9a",
  "chocolate":     "#6b3a1a",
  "brown":         "#654321",
  "cognac":        "#6b4a1a",
  "espresso":      "#3a1a1a",
  "khaki":         "#4a3a1a",
  "mauve":         "#6b4a4a",
};

export function colorLabelToSwatchHex(label: string): string {
  if (!label) return "";
  const first = label
    .split(/\s*[&,/]\s*/)[0]
    .trim()
    .toLowerCase()
    .replace(/\s+print$|\s+pattern$/i, "")
    .trim();
  return SWATCH_MAP[first] ?? "";
}

function extractSuffix(name: string): string {
  const m = name.match(/\s[—–]\s*(.+)$/);
  return m ? m[1].trim() : "";
}

export function getProductColorLabel(product: {
  colorLabel?: string | null;
  defaultColor?: string | null;
  name?: string | null;
  subType?: string | null;
}): string {
  if (product.colorLabel?.trim()) return product.colorLabel.trim();

  const suffix = extractSuffix(product.name ?? "");
  if (suffix) {
    if (/^GP\d+$/i.test(suffix)) {
      return product.subType === "printed" ? "Printed" : "";
    }
    if (/^[A-Z]{2,}\d/.test(suffix)) return "";
    return suffix;
  }

  return "";
}
