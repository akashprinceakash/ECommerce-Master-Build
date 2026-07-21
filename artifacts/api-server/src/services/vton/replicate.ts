import { logger } from "../../lib/logger";

const REPLICATE_MODEL = "cuuupid/idm-vton";
const API_BASE = "https://api.replicate.com/v1";

/** Published IDM-VTON per-second billing rate (USD). */
export const IDM_VTON_COST_PER_SECOND_USD = 0.000225;

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error: string | null;
}

interface ReplicateModel {
  latest_version: { id: string };
}

function getToken(): string {
  const token = process.env["REPLICATE_API_TOKEN"];
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");
  return token;
}

async function replicateFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err: any = new Error(
      `Replicate API error (${res.status}): ${JSON.stringify(body)}`,
    );
    err.statusCode = res.status;
    err.replicateBody = body;
    throw err;
  }
  return body as T;
}

let cachedVersionId: string | null = null;

async function getModelVersionId(): Promise<string> {
  if (cachedVersionId) return cachedVersionId;
  const model = await replicateFetch<ReplicateModel>(`/models/${REPLICATE_MODEL}`);
  cachedVersionId = model.latest_version.id;
  return cachedVersionId;
}

export interface StartPredictionParams {
  humanImageUrl: string;
  garmentImageUrl: string;
  garmentDescription: string;
  vtonCategory: "upper_body" | "lower_body" | "dresses";
  /** Crop to the relevant body region before processing. Improves lower-body accuracy. */
  crop?: boolean;
}

/**
 * POST a new IDM-VTON prediction to Replicate and return its prediction ID.
 * Does NOT poll — call `pollPrediction` to wait for the result.
 * Throws if Replicate rejects the request (4xx/5xx / network error).
 */
export async function startIdmVtonPrediction(
  params: StartPredictionParams,
): Promise<string> {
  const { humanImageUrl, garmentImageUrl, garmentDescription, vtonCategory } = params;
  const version = await getModelVersionId();
  const prediction = await replicateFetch<ReplicatePrediction>("/predictions", {
    method: "POST",
    body: JSON.stringify({
      version,
      input: {
        human_img: humanImageUrl,
        garm_img: garmentImageUrl,
        garment_des: garmentDescription,
        category: vtonCategory,
        crop: crop ?? false,
        force_dc: vtonCategory === "dresses",
        steps: 20,
        seed: Math.floor(Math.random() * 1_000_000),
      },
    }),
  });
  logger.info({ predictionId: prediction.id, vtonCategory }, "vton: prediction started");
  return prediction.id;
}

/**
 * Poll a Replicate prediction (by ID) until it reaches a terminal status.
 * Returns the output image URL and the wall-clock time elapsed in seconds.
 */
export async function pollPrediction(
  predictionId: string,
): Promise<{ resultUrl: string; predictTimeSecs: number }> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const start = Date.now();

  let prediction = await replicateFetch<ReplicatePrediction>(
    `/predictions/${predictionId}`,
  );

  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error("Try-on generation timed out");
    }
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await replicateFetch<ReplicatePrediction>(
      `/predictions/${predictionId}`,
    );
  }

  const predictTimeSecs = (Date.now() - start) / 1000;

  if (prediction.status !== "succeeded") {
    logger.error({ prediction, predictTimeSecs }, "vton: replicate prediction failed");
    throw new Error(prediction.error ?? "Try-on generation failed");
  }

  logger.info(
    { predictionId, predictTimeSecs: predictTimeSecs.toFixed(1) },
    "vton: prediction succeeded",
  );

  const output = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;
  if (!output) throw new Error("Try-on generation returned no output image");
  return { resultUrl: output, predictTimeSecs };
}

/**
 * Convenience wrapper: start a prediction and poll until done.
 * Used for subsequent garments in a multi-garment job where no credit
 * deduction step is needed (credit was already deducted for garment 0).
 */
export async function runIdmVton(params: StartPredictionParams): Promise<string> {
  const predictionId = await startIdmVtonPrediction(params);
  const { resultUrl } = await pollPrediction(predictionId);
  return resultUrl;
}
