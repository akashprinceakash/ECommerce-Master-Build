import type { GarmentRole } from "./types";

// Mirrors the category groupings used on the storefront (see
// artifacts/kasha/src/pages/products.tsx) so a product's DB `category`
// deterministically maps to a VTON garment role.
const TOP_CATEGORIES = new Set(["t-shirt", "polo", "fabric-tshirt", "pattern", "shirts"]);
const BOTTOM_CATEGORIES = new Set(["pants", "trousers", "shorts", "skort", "skorts", "skirts"]);
const DRESS_CATEGORIES = new Set(["dress", "dresses", "golf dress", "golf dresses"]);

/**
 * Classify a product's DB `category` into a try-on garment role.
 * Returns null for categories not yet supported by the try-on pipeline
 * (e.g. outerwear like "jacket", accessories, shoes, bags).
 */
export function classifyProductRole(category: string | null | undefined): GarmentRole | null {
  const c = (category ?? "").toLowerCase().trim();
  if (TOP_CATEGORIES.has(c)) return "top";
  if (BOTTOM_CATEGORIES.has(c)) return "bottom";
  if (DRESS_CATEGORIES.has(c)) return "dress";
  return null;
}
