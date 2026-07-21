/**
 * Garment "role" as understood by the try-on pipeline. This is intentionally
 * narrow today — only tops, bottoms, and dresses are wired up to the VTON
 * model. Outerwear/accessories/shoes/bags are NOT supported yet; extending
 * this union (and `ROLE_TO_VTON_CATEGORY` + `classifyProductRole`) is the
 * only place that should need to change to add them later.
 */
export type GarmentRole = "top" | "bottom" | "dress";

/** The category value IDM-VTON expects for a given garment role. */
export const ROLE_TO_VTON_CATEGORY: Record<GarmentRole, "upper_body" | "lower_body" | "dresses"> = {
  top: "upper_body",
  bottom: "lower_body",
  dress: "dresses",
};

/**
 * Per-category IDM-VTON inference tuning.
 *
 * lower_body uses more steps + crop=true because the model was trained mostly
 * on full-length lower-body references and defaults to "safe" trousers. Higher
 * step count + crop gives it a tighter look at the garment region and
 * meaningfully improves shorts/skort length fidelity.
 */
export const VTON_CATEGORY_TUNING: Record<
  "upper_body" | "lower_body" | "dresses",
  { steps: number; crop: boolean }
> = {
  upper_body: { steps: 30, crop: false },
  lower_body: { steps: 35, crop: true  },
  dresses:    { steps: 30, crop: false },
};

/**
 * Maps raw catalog category strings to an explicit length/style description
 * sent to IDM-VTON as `garment_des`. Explicit negation ("NOT full-length
 * trousers") is intentional — the model was trained mostly on full-length
 * lower-body garments and defaults to safe/long silhouettes without it.
 *
 * Keys must match the category values used in the DB and in the frontend's
 * TOP_CATEGORIES / BOTTOM_CATEGORIES / DRESS_CATEGORIES sets.
 */
export const CATEGORY_LENGTH_HINTS: Record<string, string> = {
  // Tops — upper-body garments; model handles these well without negation
  "polo":           "a short-sleeve golf polo shirt with a collar",
  "t-shirt":        "a short-sleeve t-shirt",
  "fabric-tshirt":  "a short-sleeve t-shirt",
  "pattern":        "a patterned short-sleeve polo shirt",
  "shirts":         "a short-sleeve button-up shirt",

  // Bottoms — explicit negation is critical; model biases toward full trousers
  "shorts":   "golf shorts ending well above the knee — short garment, NOT full-length trousers or pants",
  "skort":    "a golf skort (skirt-shorts hybrid) ending above the knee — short garment, NOT full-length trousers",
  "skorts":   "a golf skort (skirt-shorts hybrid) ending above the knee — short garment, NOT full-length trousers",
  "skirt":    "a golf skirt ending above or at the knee — NOT trousers or pants",
  "skirts":   "a golf skirt ending above or at the knee — NOT trousers or pants",
  "pants":    "full-length golf trousers reaching the ankle — long garment, NOT shorts",
  "trousers": "full-length tailored golf trousers reaching the ankle — long garment, NOT shorts",

  // Dresses
  "dress":       "a full-length golf dress",
  "dresses":     "a full-length golf dress",
  "golf dress":  "a full-length golf dress",
  "golf dresses":"a full-length golf dress",
};

/**
 * Build the `garment_des` text prompt for IDM-VTON.
 * Combines the product's display name with an explicit length/style hint
 * derived from its catalog category. Falls back to the raw product name when
 * the category is unrecognised (so the model still gets some signal).
 */
export function buildGarmentDescription(name: string, category: string | null | undefined): string {
  const hint = CATEGORY_LENGTH_HINTS[(category ?? "").trim().toLowerCase()];
  return hint ? `${name} — ${hint}` : name;
}

export interface TryOnGarment {
  productId: number;
  role: GarmentRole;
  /** Human-readable display name (product name). */
  name: string;
  /** IDM-VTON garment_des — category-derived description for better model guidance. */
  description: string;
  imageUrl: string;
  /** Whether to crop to the relevant body region before processing (helps lower-body accuracy). */
  crop: boolean;
}

export type TryOnJobStatus = "pending" | "processing" | "succeeded" | "failed";

export interface TryOnJob {
  id: string;
  userId: string;
  status: TryOnJobStatus;
  garments: TryOnGarment[];
  /** Total number of garments to process (so frontend can show "Step 1 of 2"). */
  garmentCount: number;
  /** How many garments have been fully processed so far. */
  processedCount: number;
  resultImageUrl: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  /** DB row ID of the generation_logs entry for this job (null when credits are disabled). */
  generationLogId: number | null;
}
