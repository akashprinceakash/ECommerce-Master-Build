import { useState, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import ModelViewerCustomizer, { type CustomizerHandle } from "@/components/3d/ModelViewerCustomizer";

const GOLD = "#B8925A";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
type Size = (typeof SIZES)[number];

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    return clerk?.session ? await clerk.session.getToken() : null;
  } catch { return null; }
}

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (!(opts?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  priceInPaise: number;
  modelUrl: string;
  thumbnailUrl?: string | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();

  const customizerRef = useRef<CustomizerHandle>(null);

  const [size, setSize] = useState<Size>("M");
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => apiFetch(`/api/products/${id}`),
    enabled: id > 0,
  });

  // ── Save design ───────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to save your design");
      const canvasData = customizerRef.current?.getCanvasData();
      return apiFetch("/api/customizations", {
        method: "POST",
        body: JSON.stringify({
          productId: id,
          name: `${product?.name ?? "Custom"} — Bespoke`,
          color: "#ffffff",
          size,
          partsEnabled: {},
          canvasData: canvasData?.canvasJson ?? null,
          previewImageUrl: canvasData?.previewDataUrl ?? null,
        }),
      });
    },
    onSuccess: () =>
      toast({ title: "Design saved", description: "Your customisation has been saved to your account." }),
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Add to cart ──────────────────────────────────────────────────────────
  const cartMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to add to cart");
      const canvasData = customizerRef.current?.getCanvasData();
      const cust = await apiFetch("/api/customizations", {
        method: "POST",
        body: JSON.stringify({
          productId: id,
          name: `${product?.name ?? "Custom"} — Bespoke`,
          color: "#ffffff",
          size,
          partsEnabled: {},
          canvasData: canvasData?.canvasJson ?? null,
          previewImageUrl: canvasData?.previewDataUrl ?? null,
        }),
      });
      return apiFetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId: id,
          customizationId: cust.id,
          quantity: qty,
          size,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Added to cart", description: "Your bespoke piece is in the bag." });
      setLocation("/cart");
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Loading / not-found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div
            className="animate-spin rounded-full"
            style={{
              width: 32, height: 32,
              border: "2px solid rgba(184,146,90,0.2)",
              borderTopColor: GOLD,
            }}
          />
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
          Product not found.{" "}
          <Link href="/products" className="underline ml-1">Browse collection</Link>
        </div>
      </Layout>
    );
  }

  const isBusy = saveMut.isPending || cartMut.isPending;
  const productName = product.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "");

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>

        {/* ── Header strip ───────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-b border-neutral-200 bg-white"
          style={{ fontFamily: "'Josefin Sans', sans-serif" }}
        >
          <div className="flex items-center gap-4">
            <Link href={`/products/${id}`}>
              <button className="text-[9px] tracking-[0.3em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">
                ← Back to product
              </button>
            </Link>
            <div className="h-3.5 w-px bg-neutral-200" />
            <span className="text-[9px] tracking-[0.4em] uppercase" style={{ color: GOLD }}>
              Custom Studio · Beta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-serif text-base text-neutral-900">{productName}</span>
            <span className="text-[13px] font-medium" style={{ color: GOLD }}>
              {formatPrice(product.priceInPaise)}
            </span>
          </div>
        </div>

        {/* ── 3D Studio — fills remaining height ─────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <ModelViewerCustomizer
            ref={customizerRef}
            modelUrl={product.modelUrl}
            thumbnailUrl={product.thumbnailUrl}
            initialColor="#ffffff"
          />
        </div>

        {/* ── Action footer ───────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-5 px-6 py-4 border-t border-neutral-200 bg-white"
          style={{ fontFamily: "'Josefin Sans', sans-serif" }}
        >
          {/* Size selector */}
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-400 whitespace-nowrap">
              Size
            </span>
            <div className="flex gap-1">
              {SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="w-9 h-9 text-[11px] font-medium transition-all hover:opacity-80"
                  style={{
                    border: size === s ? `1.5px solid ${GOLD}` : "1.5px solid #e5e5e5",
                    color: size === s ? GOLD : "#888",
                    background: size === s ? "rgba(184,146,90,0.06)" : "transparent",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-400">Qty</span>
            <div className="flex items-center border border-neutral-200">
              <button
                className="w-8 h-8 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="w-8 text-center text-[13px] font-medium">{qty}</span>
              <button
                className="w-8 h-8 text-neutral-500 hover:text-neutral-900 transition-colors"
                onClick={() => setQty(q => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-3 ml-auto items-center">
            {user && (
              <button
                onClick={() => saveMut.mutate()}
                disabled={isBusy}
                className="h-11 px-6 text-[10px] tracking-[0.18em] uppercase border transition-all disabled:opacity-40 hover:opacity-80"
                style={{ borderColor: "rgba(184,146,90,0.45)", color: GOLD }}
              >
                {saveMut.isPending ? "Saving…" : "Save Design"}
              </button>
            )}
            <button
              onClick={() => cartMut.mutate()}
              disabled={isBusy}
              className="h-11 px-8 text-[10px] tracking-[0.18em] uppercase text-white transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: "#111111" }}
            >
              {cartMut.isPending
                ? "Adding…"
                : !user
                ? "Sign In to Order"
                : `Add to Bag · ${formatPrice(product.priceInPaise * qty)}`}
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
