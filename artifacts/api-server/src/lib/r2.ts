import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { logger } from "./logger";

const BUCKET     = process.env["R2_BUCKET_NAME"]     ?? "kasha-assets";
const PUBLIC_URL = (process.env["R2_PUBLIC_URL"]     ?? "").replace(/\/+$/, "");
const ENDPOINT   = process.env["R2_ENDPOINT"]        ?? "";
const ACCESS_KEY = process.env["R2_ACCESS_KEY_ID"]   ?? "";
const SECRET_KEY = process.env["R2_SECRET_ACCESS_KEY"] ?? "";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: ENDPOINT,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return _client;
}

/** Returns true when all required R2 env vars are present. */
export function r2Enabled(): boolean {
  return !!(ENDPOINT && ACCESS_KEY && SECRET_KEY && PUBLIC_URL);
}

/**
 * Upload a buffer to R2 and return the public CDN URL.
 * Key examples: "thumbnails/thumb-1234.jpg", "models/model-5678.glb"
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  const url = `${PUBLIC_URL}/${key}`;
  logger.info({ key, url }, "r2: uploaded");
  return url;
}

/** Delete an object from R2 by its key (no-op if key is blank). */
export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    logger.info({ key }, "r2: deleted");
  } catch (e) {
    logger.warn({ key, e }, "r2: delete failed (ignored)");
  }
}

/**
 * Extract the R2 object key from a full public CDN URL.
 * Returns null if the URL is not an R2 URL.
 */
export function keyFromR2Url(url: string | null | undefined): string | null {
  if (!url || !PUBLIC_URL) return null;
  if (url.startsWith(PUBLIC_URL)) {
    return url.slice(PUBLIC_URL.length).replace(/^\/+/, "");
  }
  return null;
}
