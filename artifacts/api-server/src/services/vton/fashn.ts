import { logger } from "../../lib/logger";
import { FASHN_MODEL, FASHN_CREDITS_PER_GENERATION } from "./types";

const API_BASE = "https://api.fashn.ai/v1";

function getApiKey(): string {
  const key = process.env["FASHN_API_KEY"];
  if (!key) throw new Error("FASHN_API_KEY is not set");
  return key;
}

async function fashnFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err: any = new Error(`FASHN API error (${res.status}): ${JSON.stringify(body)}`);
    err.statusCode = res.status;
    err.fashnBody = body;
    throw err;
  }
  return body as T;
}

export interface StartFashnPredictionParams {
  modelImageUrl: string;
  garmentImageUrl: string;
  category: "tops" | "bottoms" | "one-pieces";
}

export async function startFashnPrediction(params: StartFashnPredictionParams): Promise<string> {
  const { modelImageUrl, garmentImageUrl, category } = params;
  const body = await fashnFetch<{ id: string }>("/run", {
    method: "POST",
    body: JSON.stringify({
      model_name: FASHN_MODEL,
      inputs: {
        model_image: modelImageUrl,
        garment_image: garmentImageUrl,
        category,
        garment_photo_type: "auto",
      },
    }),
  });
  logger.info({ predictionId: body.id, category }, "fashn: prediction started");
  return body.id;
}

interface FashnStatusResponse {
  id: string;
  status: "starting" | "in_queue" | "processing" | "completed" | "failed";
  output?: string[] | null;
  error?: { name: string; message: string } | null;
}

export async function pollFashnPrediction(
  predictionId: string,
): Promise<{ resultUrl: string; elapsedSecs: number }> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const start = Date.now();

  let prediction = await fashnFetch<FashnStatusResponse>(`/status/${predictionId}`);

  while (prediction.status !== "completed" && prediction.status !== "failed") {
    if (Date.now() - start > TIMEOUT_MS) throw new Error("Try-on generation timed out");
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await fashnFetch<FashnStatusResponse>(`/status/${predictionId}`);
  }

  const elapsedSecs = (Date.now() - start) / 1000;

  if (prediction.status === "failed") {
    logger.error({ prediction, elapsedSecs }, "fashn: prediction failed");
    throw new Error(prediction.error?.message ?? "Try-on generation failed");
  }

  const output = prediction.output?.[0];
  if (!output) throw new Error("Try-on generation returned no output image");

  logger.info({ predictionId, elapsedSecs: elapsedSecs.toFixed(1) }, "fashn: prediction succeeded");
  return { resultUrl: output, elapsedSecs };
}

export function estimateGenerationCredits(garmentCount: number): number {
  return FASHN_CREDITS_PER_GENERATION * garmentCount;
}
