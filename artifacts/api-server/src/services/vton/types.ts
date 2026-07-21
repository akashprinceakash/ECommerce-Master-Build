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
