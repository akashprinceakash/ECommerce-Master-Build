/**
 * FASHN API client for virtual try-on.
 *
 * API:   https://api.fashn.ai/v1
 * Docs:  https://docs.fashn.ai
 *
 * Flow:
 *   1. POST /v1/run  → { id: string, status: "started" }
 *   2. GET  /v1/status/{id} (poll) → { status, output: string[] | null, error }
 *
 * Categories:
 *   "tops"       — upper-body garments (t-shirts, polo shirts, etc.)
 *   "bottoms"    — lower-body garments (pants, shorts, skirts, etc.)
 *   "one-pieces" — full-body garments (dresses, jumpsuits, etc.)
 */
import { logger } from "../../lib/logger";
import type { GarmentRole } from "./types";

const API_BASE = "https://api.fashn.ai/v1";

/** FASHN category for each garment role. */
export const ROLE_TO_FASHN_CATEGORY: Record<GarmentRole, "tops" | "bottoms" | "one-pieces"> = {
  top:    "tops",
  bottom: "bottoms",
  dress:  "one-pieces",
};

/**
 * Fixed cost estimate per FASHN generation (quality mode, USD).
 * FASHN charges per-prediction rather than per-second.  This value is used
 * for the DB cost ledger; update it if FASHN changes their pricing.
 */
export const FASHN_COST_PER_GENERATION_USD = 0.12;

// ── Internal types ─────────────────────────────────────────────────────────

type FashnStatus = "starting" | "processing" | "completed" | "failed";

interface FashnRunResponse {
  id: string;
  status: FashnStatus;
  error?: string | null;
}

interface FashnStatusResponse {
  id: string;
  status: FashnStatus;
  output: string[] | null;
  error: string | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────

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
  const body = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err: any = new Error(
      `FASHN API error (${res.status}): ${JSON.stringify(body)}`,
    );
    err.statusCode    = res.status;
    err.fashnBody     = body;
    err.isFashnError  = true;
    throw err;
  }
  return body as T;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface StartFashnParams {
  /** URL of the person/model image. Must be publicly reachable by FASHN. */
  humanImageUrl: string;
  /** URL of the garment/product image. Must be publicly reachable by FASHN. */
  garmentImageUrl: string;
  /** Garment role — used to derive the FASHN category. */
  garmentRole: GarmentRole;
}

/**
 * Start a FASHN try-on prediction and return its prediction ID.
 * Does NOT poll — call `pollFashnPrediction` to wait for the result.
 * Throws if FASHN rejects the request (auth error, bad URL, quota, etc.).
 */
export async function startFashnPrediction(params: StartFashnParams): Promise<string> {
  const { humanImageUrl, garmentImageUrl, garmentRole } = params;
  const category = ROLE_TO_FASHN_CATEGORY[garmentRole];

  // FASHN /run expects { model_name, inputs: { ... } }
  const body: Record<string, unknown> = {
    model_name: "fashn/tryon",
    inputs: {
      model_image:        humanImageUrl,
      garment_image:      garmentImageUrl,
      category,
      mode:               "quality",         // best results; balanced if cost becomes a concern
      garment_photo_type: "auto",            // FASHN auto-detects flat-lay vs model photo
      nsfw_filter:        true,
      cover_feet:         false,
      adjust_hands:       garmentRole === "top", // reduces hand artifacts for upper-body
      restore_background: false,
      restore_clothes:    true,              // preserves garment print / pattern / colour
      long_top:           false,
      num_samples:        1,
      seed:               Math.floor(Math.random() * 2_147_483_647),
    },
  };

  const prediction = await fashnFetch<FashnRunResponse>("/run", {
    method: "POST",
    body: JSON.stringify(body),
  });

  logger.info(
    { predictionId: prediction.id, garmentRole, category },
    "fashn: prediction started",
  );

  return prediction.id;
}

/**
 * Poll a FASHN prediction until it reaches a terminal status.
 * Returns the output image URL.
 */
export async function pollFashnPrediction(
  predictionId: string,
): Promise<{ resultUrl: string; costUsd: number }> {
  const TIMEOUT_MS  = 5 * 60 * 1000; // 5 minutes
  const POLL_INTERVAL_MS = 3000;
  const start = Date.now();

  let prediction = await fashnFetch<FashnStatusResponse>(`/status/${predictionId}`);

  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error("FASHN try-on timed out — please try again");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    prediction = await fashnFetch<FashnStatusResponse>(`/status/${predictionId}`);
  }

  const wallSecs = ((Date.now() - start) / 1000).toFixed(1);

  if (prediction.status !== "completed") {
    const msg = prediction.error ?? "FASHN try-on failed";
    logger.error({ predictionId, status: prediction.status, error: msg, wallSecs }, "fashn: prediction failed");
    throw new Error(msg);
  }

  logger.info({ predictionId, wallSecs }, "fashn: prediction completed");

  const output = prediction.output?.[0];
  if (!output) throw new Error("FASHN returned no output image");

  return { resultUrl: output, costUsd: FASHN_COST_PER_GENERATION_USD };
}

/**
 * Convenience wrapper: start a prediction and poll until done.
 * Used for subsequent garments in a multi-garment job.
 */
export async function runFashnVton(params: StartFashnParams): Promise<string> {
  const predictionId = await startFashnPrediction(params);
  const { resultUrl } = await pollFashnPrediction(predictionId);
  return resultUrl;
}
