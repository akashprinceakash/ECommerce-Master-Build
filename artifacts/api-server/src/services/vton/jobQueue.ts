import { randomUUID } from "crypto";
import { logger } from "../../lib/logger";
import { uploadToR2 } from "../../lib/r2";
import { runIdmVton } from "./replicate";
import { ROLE_TO_VTON_CATEGORY, type TryOnGarment, type TryOnJob } from "./types";

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
 * Enqueue a try-on generation job for a single human photo and 1-2 garments
 * (either a dress alone, or a top and/or bottom combo). Runs asynchronously;
 * poll `getTryOnJob` for status/result.
 */
export function submitTryOnJob(userId: string, humanImageUrl: string, garments: TryOnGarment[]): TryOnJob {
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
  };
  jobs.set(id, job);

  void processTryOnJob(job, humanImageUrl).catch((err) => {
    logger.error({ err, jobId: id }, "vton: unhandled job processing error");
    job.status = "failed";
    job.error = "Unexpected error while generating your look";
    job.updatedAt = Date.now();
  });

  return job;
}

async function processTryOnJob(job: TryOnJob, humanImageUrl: string): Promise<void> {
  job.status = "processing";
  job.updatedAt = Date.now();

  const jobStart = Date.now();

  try {
    // Chain garments sequentially: dress alone, or top then bottom (each pass
    // uses the previous result as the new "person" image so both pieces show).
    let currentHumanImage = humanImageUrl;
    for (const garment of job.garments) {
      const vtonCategory = ROLE_TO_VTON_CATEGORY[garment.role];
      const resultUrl = await runIdmVton({
        humanImageUrl: currentHumanImage,
        garmentImageUrl: garment.imageUrl,
        garmentDescription: garment.name,
        vtonCategory,
      });
      currentHumanImage = resultUrl;
      job.processedCount += 1;
      job.updatedAt = Date.now();
    }

    // Persist the final Replicate-hosted result into our own R2 storage so
    // it doesn't expire and is served from our CDN domain.
    const imgRes = await fetch(currentHumanImage);
    if (!imgRes.ok) throw new Error("Failed to download generated try-on image");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const key = `lookbook/tryon-${job.id}.png`;
    const permanentUrl = await uploadToR2(key, buffer, "image/png");

    const totalSecs = ((Date.now() - jobStart) / 1000).toFixed(1);
    logger.info({ jobId: job.id, garmentCount: job.garmentCount, totalSecs }, "vton: job succeeded");

    job.resultImageUrl = permanentUrl;
    job.status = "succeeded";
    job.updatedAt = Date.now();
  } catch (err) {
    logger.error({ err, jobId: job.id }, "vton: job failed");
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Try-on generation failed";
    job.updatedAt = Date.now();
  }
}
