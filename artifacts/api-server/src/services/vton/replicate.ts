import { logger } from "../../lib/logger";

const REPLICATE_MODEL = "cuuupid/idm-vton";
const API_BASE = "https://api.replicate.com/v1";

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
    throw new Error(`Replicate API error (${res.status}): ${JSON.stringify(body)}`);
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

/**
 * Kick off an IDM-VTON prediction. `humanImageUrl` is the model/person photo,
 * `garmentImageUrl` is the catalog product image, and `vtonCategory` is the
 * IDM-VTON garment category ("upper_body" | "lower_body" | "dresses").
 * Returns the final output image URL once the prediction succeeds (polls
 * until terminal status).
 */
export async function runIdmVton(params: {
  humanImageUrl: string;
  garmentImageUrl: string;
  garmentDescription: string;
  vtonCategory: "upper_body" | "lower_body" | "dresses";
}): Promise<string> {
  const { humanImageUrl, garmentImageUrl, garmentDescription, vtonCategory } = params;

  const version = await getModelVersionId();

  let prediction = await replicateFetch<ReplicatePrediction>(`/predictions`, {
    method: "POST",
    body: JSON.stringify({
      version,
      input: {
        human_img: humanImageUrl,
        garm_img: garmentImageUrl,
        garment_des: garmentDescription,
        category: vtonCategory,
        crop: false,
        force_dc: vtonCategory === "dresses",
        steps: 20,
        seed: Math.floor(Math.random() * 1_000_000),
      },
    }),
  });

  const start = Date.now();
  logger.info({ predictionId: prediction.id, vtonCategory }, "vton: prediction started");

  const TIMEOUT_MS = 5 * 60 * 1000;
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error("Try-on generation timed out");
    }
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await replicateFetch<ReplicatePrediction>(`/predictions/${prediction.id}`);
  }

  const predictTimeSecs = ((Date.now() - start) / 1000).toFixed(1);

  if (prediction.status !== "succeeded") {
    logger.error({ prediction, predictTimeSecs }, "vton: replicate prediction failed");
    throw new Error(prediction.error || "Try-on generation failed");
  }

  logger.info({ predictionId: prediction.id, predictTimeSecs, vtonCategory }, "vton: prediction succeeded");

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) throw new Error("Try-on generation returned no output image");
  return output;
}
