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

/** Returns true when the URL looks like a Cloudflare R2 asset we are allowed to proxy. */
function isAllowedR2Url(url: string): boolean {
  if (url.includes(".r2.dev/") || url.includes("r2.cloudflarestorage.com/")) return true;
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL + "/")) return true;
  return false;
}

/**
 * GET /api/r2-proxy?url=<full-r2-cdn-url>
 * Fetches an asset from R2 server-side and streams it back with CORS headers.
 * This bypasses the browser CORS restriction on the R2 public CDN domain.
 *
 * Strategy:
 *   1. If R2 SDK credentials are fully configured, use the S3 SDK (private access).
 *   2. Otherwise fall back to a plain server-side fetch of the public CDN URL.
 *      This works for public R2 buckets and avoids browser CORS problems.
 */
router.get("/r2-proxy", async (req, res): Promise<void> => {
  const url = req.query["url"] as string | undefined;
  if (!url) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  if (!isAllowedR2Url(url)) {
    res.status(403).json({ error: "URL is not a recognised R2 asset" });
    return;
  }

  // ── Path 1: full S3 SDK access ────────────────────────────────────────────
  if (r2Enabled()) {
    const key = keyFromR2Url(url);
    if (key) {
      try {
        const result = await getClient().send(
          new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        );

        const contentType = result.ContentType ?? "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("X-Robots-Tag", "noindex, noarchive");
        if (result.ContentLength) {
          res.setHeader("Content-Length", String(result.ContentLength));
        }

        (result.Body as Readable).pipe(res);
        return;
      } catch (err: any) {
        if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
          res.status(404).json({ error: "Asset not found" });
          return;
        }
        // Fall through to the HTTP fetch fallback on other errors
      }
    }
  }

  // ── Path 2: direct server-side HTTP fetch (public bucket fallback) ────────
  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "kasha-proxy/1.0" },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Asset not found upstream" });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex, noarchive");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).json({ error: "Failed to fetch asset from storage" });
  }
});

export default router;
