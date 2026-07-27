import { randomUUID } from "crypto";
import { logger } from "../../lib/logger";
import { uploadToR2 } from "../../lib/r2";
import { startFashnPrediction, pollFashnPrediction } from "./fashn";
import { ROLE_TO_FASHN_CATEGORY, type TryOnGarment, type TryOnJob } from "./types";
import { updateGenerationLog } from "../creditService";
import { compositeTopBottom } from "./compositor";

const jobs = new Map<string, TryOnJob>();
const MAX_JOB_AGE_MS = 30 * 60 * 1000;

function pruneOldJobs(): void {
  const cutoff = Date.now() - MAX_JOB_AGE_MS;
  for (const [id, job] of jobs) {
    if (job.updatedAt < cutoff) jobs.delete(id);
  }
}

export function getTryOnJob(id: string, userId: string): TryOnJob | null {
  const job = jobs.get(id);
  if (!job || job.userId !== userId) return null;
  return job;
}

export function submitTryOnJob(
  userId: string,
  humanImageUrl: string,
  garments: TryOnGarment[],
  opts?: { firstPredictionId?: string; generationLogId?: number | null },
): TryOnJob {
  pruneOldJobs();

  const id = randomUUID();
  const now = Date.now();
  const job: TryOnJob = {
    id,
    userId,
    status: "pending",
    garments,
    garmentCount: garments.length,
    processedCount: 0,
    resultImageUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    generationLogId: opts?.generationLogId ?? null,
  };
  jobs.set(id, job);

  void processTryOnJob(job, humanImageUrl, opts?.firstPredictionId).catch((err) => {
    logger.error({ err, jobId: id }, "vton: unhandled job processing error");
    job.status = "failed";
    job.error = "Unexpected error while generating your look";
    job.updatedAt = Date.now();
  });

  return job;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasRole(garments: TryOnGarment[], role: "top" | "bottom" | "dress"): boolean {
  return garments.some((g) => g.role === role);
}

/**
 * Two-garment parallel compositing path.
 *
 * Both garments are tried on **independently** against the original human
 * photo, then the results are blended at the waistline. This prevents the
 * quality degradation that occurs when the second garment is applied to the
 * already-processed first-garment image.
 *
 * Contract: `garments` must contain exactly one "top" and one "bottom".
 * `firstPredictionId` (if present) belongs to garments[0], which is always
 * the bottom garment because lookbook.ts sorts bottoms before tops.
 */
async function processParallelComposite(
  job: TryOnJob,
  humanImageUrl: string,
  firstPredictionId: string | undefined,
): Promise<void> {
  const jobStart = Date.now();

  const bottomGarment = job.garments.find((g) => g.role === "bottom")!;
  const topGarment = job.garments.find((g) => g.role === "top")!;

  logger.info(
    { jobId: job.id, bottomGarment: bottomGarment.name, topGarment: topGarment.name },
    "vton: parallel composite path — firing both predictions against original photo",
  );

  // garments[0] is always bottom (sorted in lookbook.ts); firstPredictionId
  // is the already-started bottom prediction from the credit-gate call.
  const bottomPredIdPromise: Promise<string> = firstPredictionId
    ? Promise.resolve(firstPredictionId)
    : startFashnPrediction({
        modelImageUrl: humanImageUrl,
        garmentImageUrl: bottomGarment.imageUrl,
        category: ROLE_TO_FASHN_CATEGORY[bottomGarment.role],
      });

  const topPredIdPromise: Promise<string> = startFashnPrediction({
    modelImageUrl: humanImageUrl,
    garmentImageUrl: topGarment.imageUrl,
    category: ROLE_TO_FASHN_CATEGORY[topGarment.role],
  });

  const [bottomPredId, topPredId] = await Promise.all([bottomPredIdPromise, topPredIdPromise]);

  // Poll both predictions in parallel.
  const [bottomResult, topResult] = await Promise.all([
    pollFashnPrediction(bottomPredId),
    pollFashnPrediction(topPredId),
  ]);

  job.processedCount = 2;
  job.updatedAt = Date.now();

  const totalElapsedSecs = Math.max(bottomResult.elapsedSecs, topResult.elapsedSecs);

  // Composite: upper body from top-garment result, lower body from bottom-garment result.
  const composited = await compositeTopBottom(topResult.resultUrl, bottomResult.resultUrl);

  const key = `lookbook/tryon-${job.id}.png`;
  const permanentUrl = await uploadToR2(key, composited, "image/png");

  const totalSecs = ((Date.now() - jobStart) / 1000).toFixed(1);
  logger.info(
    { jobId: job.id, totalSecs, elapsedSecs: totalElapsedSecs.toFixed(1) },
    "vton: parallel composite job succeeded",
  );

  if (job.generationLogId != null) {
    await updateGenerationLog(job.generationLogId, {
      replicateStatus: "succeeded",
      predictTimeSeconds: totalElapsedSecs,
    });
  }

  job.resultImageUrl = permanentUrl;
  job.status = "succeeded";
  job.updatedAt = Date.now();
}

/**
 * Single-garment (or dress) sequential path — unchanged from the original
 * implementation.
 */
async function processSequential(
  job: TryOnJob,
  humanImageUrl: string,
  firstPredictionId: string | undefined,
): Promise<void> {
  const jobStart = Date.now();
  let totalElapsedSecs = 0;
  let currentHumanImage = humanImageUrl;

  for (let i = 0; i < job.garments.length; i++) {
    const garment = job.garments[i]!;
    const category = ROLE_TO_FASHN_CATEGORY[garment.role];

    let predictionId: string;
    if (i === 0 && firstPredictionId) {
      predictionId = firstPredictionId;
    } else {
      predictionId = await startFashnPrediction({
        modelImageUrl: currentHumanImage,
        garmentImageUrl: garment.imageUrl,
        category,
      });
    }

    const { resultUrl, elapsedSecs } = await pollFashnPrediction(predictionId);
    totalElapsedSecs += elapsedSecs;
    currentHumanImage = resultUrl;
    job.processedCount += 1;
    job.updatedAt = Date.now();
  }

  const imgRes = await fetch(currentHumanImage);
  if (!imgRes.ok) throw new Error("Failed to download generated try-on image");
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const key = `lookbook/tryon-${job.id}.png`;
  const permanentUrl = await uploadToR2(key, buffer, "image/png");

  const totalSecs = ((Date.now() - jobStart) / 1000).toFixed(1);
  logger.info({ jobId: job.id, garmentCount: job.garmentCount, totalSecs }, "vton: job succeeded");

  if (job.generationLogId != null) {
    await updateGenerationLog(job.generationLogId, {
      replicateStatus: "succeeded",
      predictTimeSeconds: totalElapsedSecs,
    });
  }

  job.resultImageUrl = permanentUrl;
  job.status = "succeeded";
  job.updatedAt = Date.now();
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

async function processTryOnJob(
  job: TryOnJob,
  humanImageUrl: string,
  firstPredictionId?: string,
): Promise<void> {
  job.status = "processing";
  job.updatedAt = Date.now();

  try {
    const isParallelComposite =
      job.garments.length === 2 &&
      hasRole(job.garments, "top") &&
      hasRole(job.garments, "bottom");

    if (isParallelComposite) {
      await processParallelComposite(job, humanImageUrl, firstPredictionId);
    } else {
      await processSequential(job, humanImageUrl, firstPredictionId);
    }
  } catch (err) {
    logger.error({ err, jobId: job.id }, "vton: job failed");
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Try-on generation failed";
    job.updatedAt = Date.now();

    if (job.generationLogId != null) {
      await updateGenerationLog(job.generationLogId, {
        replicateStatus: "failed",
        errorMessage: job.error,
      });
    }
  }
}
