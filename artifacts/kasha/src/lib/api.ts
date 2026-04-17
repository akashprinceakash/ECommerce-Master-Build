export function getApiUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url ? url.replace(/\/+$/, "") : "";
}
