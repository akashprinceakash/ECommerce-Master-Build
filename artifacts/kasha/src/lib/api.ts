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
export function getAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return url;
  }
  const base = getApiUrl();
  return base ? `${base}${url}` : url;
}
