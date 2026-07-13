export function getApiUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url ? url.replace(/\/+$/, "") : "";
}

/**
 * Returns the base URL to use for file uploads (multipart/form-data).
 * Large files (3D models, images) must bypass the Vercel rewrite proxy, which
 * times out on payloads >~50 MB. Set VITE_UPLOAD_API_URL to the Render API
 * origin (e.g. https://api.kashaonline.in) so uploads go direct.
 * Falls back to getApiUrl() so local dev continues to work unchanged.
 */
export function getUploadApiUrl(): string {
  const url = import.meta.env.VITE_UPLOAD_API_URL as string | undefined;
  return url ? url.replace(/\/+$/, "") : getApiUrl();
}

/**
 * Resolves a stored asset path to an absolute URL.
 * Paths starting with /api/public/ are served by the API server, so
 * they need the API base URL prepended when frontend and backend run on
 * different origins (e.g. Vercel + Render).
 */
export function getAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return url;
  }
  const base = getApiUrl();
  return base ? `${base}${url}` : url;
}

/**
 * Rewrite direct R2 CDN URLs through our API proxy (`/api/r2-proxy`) so any
 * code path that needs `crossOrigin="anonymous"` access (canvas pixel reads,
 * fabric.js texture loads, model-viewer) never touches the raw R2 CDN URL.
 *
 * Why this matters: plain `<img src=...>` tags elsewhere in the app load the
 * exact same R2 URL WITHOUT a `crossOrigin` attribute. Chrome's HTTP/image
 * cache can key that response as "opaque" (no CORS), and later reusing the
 * identical URL in `crossOrigin="anonymous"` mode gets served the stale
 * opaque cache entry — producing a CORS error even though R2 itself returns
 * correct `Access-Control-Allow-Origin` headers. Routing through our own
 * `/api/r2-proxy` endpoint uses a completely different URL (so it can never
 * collide with the plain `<img>` cache entry) and always sets
 * `Access-Control-Allow-Origin: *` itself, independent of R2's CORS config.
 *
 * Local `/api/public/...` URLs (served by our own API, already same-origin)
 * are returned unchanged.
 */
export function toProxiedUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.includes(".r2.dev/") || url.includes("r2.cloudflarestorage.com/")) {
    const base = getApiUrl();
    return `${base}/api/r2-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
