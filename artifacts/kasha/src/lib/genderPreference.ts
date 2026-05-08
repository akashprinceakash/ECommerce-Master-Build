export type Gender = "men" | "women" | "kids";

const STORAGE_KEY = "kasha:lastGender";

export function getLastGender(): Gender | undefined {
  if (typeof window === "undefined") return undefined;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "men" || v === "women" || v === "kids" ? v : undefined;
}

export function setLastGender(g: Gender): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, g);
}
