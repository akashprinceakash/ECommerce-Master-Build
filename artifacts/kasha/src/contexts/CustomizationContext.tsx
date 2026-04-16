import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ProductCustomization {
  productId: number;
  previewUrl: string;
  color: string;
  sleeves: "half" | "full" | "none";
  collar: "round" | "polo" | "vneck";
  designName: string;
  savedAt: number;
}

interface CustomizationContextType {
  getCustomization: (productId: number) => ProductCustomization | null;
  setCustomization: (data: ProductCustomization) => void;
  clearCustomization: (productId: number) => void;
  hasCustomization: (productId: number) => boolean;
}

const CustomizationContext = createContext<CustomizationContextType | null>(null);

const STORAGE_KEY = "kasha_customizations";

function loadFromStorage(): Record<number, ProductCustomization> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<number, ProductCustomization>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [customizations, setCustomizations] = useState<Record<number, ProductCustomization>>(loadFromStorage);

  useEffect(() => {
    saveToStorage(customizations);
  }, [customizations]);

  const getCustomization = useCallback((productId: number) => {
    return customizations[productId] ?? null;
  }, [customizations]);

  const setCustomization = useCallback((data: ProductCustomization) => {
    setCustomizations(prev => ({ ...prev, [data.productId]: data }));
  }, []);

  const clearCustomization = useCallback((productId: number) => {
    setCustomizations(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const hasCustomization = useCallback((productId: number) => {
    return !!(customizations[productId]);
  }, [customizations]);

  return (
    <CustomizationContext.Provider value={{ getCustomization, setCustomization, clearCustomization, hasCustomization }}>
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomization() {
  const ctx = useContext(CustomizationContext);
  if (!ctx) throw new Error("useCustomization must be used within CustomizationProvider");
  return ctx;
}
