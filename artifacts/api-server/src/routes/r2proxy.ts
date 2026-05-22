import { Router, type IRouter } from "express";
import { r2Enabled, keyFromR2Url } from "../lib/r2";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";

const router: IRouter = Router();

const BUCKET     = process.env["R2_BUCKET_NAME"]     ?? "kasha-assets";
const PUBLIC_URL = (process.env["R2_PUBLIC_URL"]     ?? "").replace(/\/+$/, "");
const ENDPOINT   = process.env["R2_ENDPOINT"]        ?? "";
const ACCESS_KEY = process.env["R2_ACCESS_KEY_ID"]   ?? "";
const SECRET_KEY = process.env["R2_SECRET_ACCESS_KEY"] ?? "";

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });
}

/**
 * GET /api/r2-proxy?url=<full-r2-cdn-url>
 * Fetches an asset from R2 server-side and streams it back with CORS headers.
 * This bypasses the browser CORS restriction on the R2 public CDN domain.
 */
router.get("/r2-proxy", async (req, res): Promise<void> => {
  if (!r2Enabled()) {
    res.status(404).json({ error: "R2 not configured" });
    return;
  }

  const url = req.query["url"] as string | undefined;
  if (!url) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  // Only allow proxying objects that belong to our own R2 bucket
  const key = keyFromR2Url(url);
  if (!key) {
    res.status(403).json({ error: "URL is not a recognised R2 asset" });
    return;
  }

  try {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );

    const contentType = result.ContentType ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (result.ContentLength) {
      res.setHeader("Content-Length", String(result.ContentLength));
    }

    (result.Body as Readable).pipe(res);
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: "Asset not found" });
    } else {
      res.status(502).json({ error: "Failed to fetch asset from storage" });
    }
  }
});

export default router;
