import { randomUUID } from "crypto";
import { logger } from "../../lib/logger";
import { uploadToR2 } from "../../lib/r2";
import { startIdmVtonPrediction, pollPrediction, IDM_VTON_COST_PER_SECOND_USD } from "./replicate";
import { ROLE_TO_VTON_CATEGORY, type TryOnGarment, type TryOnJob } from "./types";
import { updateGenerationLog } from "../creditService";

// In-memory job store. Fine for a single-instance deployment; jobs are
// short-lived (minutes) and only need to survive within the request/poll
// lifecycle of one try-on session.
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

/**
 * Enqueue a try-on generation job for a single human photo and 1-2 garments.
 *
 * @param firstPredictionId  If provided, garment[0]'s Replicate prediction has
 *   already been started (for atomic credit deduction in the route handler).
 *   The queue will skip the start step and jump straight to polling.
 * @param generationLogId    DB row to update with final status and cost.
 */
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

async function processTryOnJob(
  job: TryOnJob,
  humanImageUrl: string,
  firstPredictionId?: string,
): Promise<void> {
  job.status = "processing";
  job.updatedAt = Date.now();

  const jobStart = Date.now();
  let totalPredictTimeSecs = 0;

  try {
    let currentHumanImage = humanImageUrl;

    for (let i = 0; i < job.garments.length; i++) {
      const garment = job.garments[i]!;
      const vtonCategory = ROLE_TO_VTON_CATEGORY[garment.role];

      let predictionId: string;
      if (i === 0 && firstPredictionId) {
        // Garment 0 was already started in the route handler for atomic credit deduction.
        predictionId = firstPredictionId;
      } else {
        predictionId = await startIdmVtonPrediction({
          humanImageUrl: currentHumanImage,
          garmentImageUrl: garment.imageUrl,
          garmentDescription: garment.name,
          vtonCategory,
        });
      }

      const { resultUrl, predictTimeSecs } = await pollPrediction(predictionId);
      totalPredictTimeSecs += predictTimeSecs;
      currentHumanImage = resultUrl;
      job.processedCount += 1;
      job.updatedAt = Date.now();
    }

    // Persist the final result in R2 so it doesn't expire on Replicate's CDN.
    const imgRes = await fetch(currentHumanImage);
    if (!imgRes.ok) throw new Error("Failed to download generated try-on image");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const key = `lookbook/tryon-${job.id}.png`;
    const permanentUrl = await uploadToR2(key, buffer, "image/png");

    const totalSecs = ((Date.now() - jobStart) / 1000).toFixed(1);
    logger.info(
      { jobId: job.id, garmentCount: job.garmentCount, totalSecs },
      "vton: job succeeded",
    );

    // Update generation_logs with final cost + status.
    if (job.generationLogId != null) {
      const costUsd = totalPredictTimeSecs * IDM_VTON_COST_PER_SECOND_USD;
      await updateGenerationLog(job.generationLogId, {
        replicateStatus: "succeeded",
        predictTimeSeconds: totalPredictTimeSecs,
        replicateCostUsd: costUsd,
      });
    }

    job.resultImageUrl = permanentUrl;
    job.status = "succeeded";
    job.updatedAt = Date.now();
  } catch (err) {
    logger.error({ err, jobId: job.id }, "vton: job failed");
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Try-on generation failed";
    job.updatedAt = Date.now();

    // Record failure in generation_logs. Do NOT auto-refund the credit —
    // Replicate may have consumed compute even if the result was unusable.
    if (job.generationLogId != null) {
      await updateGenerationLog(job.generationLogId, {
        replicateStatus: "failed",
        errorMessage: job.error,
      });
    }
  }
}
