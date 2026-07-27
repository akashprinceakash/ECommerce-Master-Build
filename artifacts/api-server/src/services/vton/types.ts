export type GarmentRole = "top" | "bottom" | "dress";

export const ROLE_TO_FASHN_CATEGORY: Record<GarmentRole, "tops" | "bottoms" | "one-pieces"> = {
  top: "tops",
  bottom: "bottoms",
  dress: "one-pieces",
};

export const FASHN_MODEL = "tryon-max" as const;
export const FASHN_CREDITS_PER_GENERATION = 4; // Try-On Max costs 4 credits per generated image (confirmed in FASHN docs)

export interface TryOnGarment {
  productId: number;
  role: GarmentRole;
  name: string;
  imageUrl: string;
  category: string;
}

export type TryOnJobStatus = "pending" | "processing" | "succeeded" | "failed";

export interface TryOnJob {
  id: string;
  userId: string;
  status: TryOnJobStatus;
  garments: TryOnGarment[];
  garmentCount: number;
  processedCount: number;
  resultImageUrl: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  generationLogId: number | null;
}
