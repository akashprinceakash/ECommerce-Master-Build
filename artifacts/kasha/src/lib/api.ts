export function getApiUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url ? url.replace(/\/+$/, "") : "";
}

/**
 * Resolves a stored asset path to an absolute URL.
 * Paths starting with /api/public/ are served by the API server, so
 * they need the API base URL prepended when frontend and backend run on
 * different origins (e.g. Vercel + Render).
 */
// One-time cache-bust marker: R2 thumbnails loaded before CORS was configured on the
// bucket got cached by browsers (immutable, max-age=1yr) WITHOUT CORS response headers.
// Some code paths load these images with crossOrigin="anonymous" (e.g. lookbook canvas
// background removal), which fails against that stale cached response. Appending a query
// param makes the browser treat it as a new URL and re-fetch with the correct headers.
const R2_CORS_CACHE_BUST = "corsfix=1";

export function getAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    if (url.includes(".r2.dev/") || url.includes(".r2.cloudflarestorage.com/")) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}${R2_CORS_CACHE_BUST}`;
    }
    return url;
  }
  const base = getApiUrl();
  return base ? `${base}${url}` : url;
}
