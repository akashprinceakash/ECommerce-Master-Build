import { getApiUrl } from "./api";

export async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) return clerk.session.getToken();
    return null;
  } catch { return null; }
}

export async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const isFormData = opts?.body instanceof FormData;
  const headers: Record<string, string> = { ...(opts?.headers as any) };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}
