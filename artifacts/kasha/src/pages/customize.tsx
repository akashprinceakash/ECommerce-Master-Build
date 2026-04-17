import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  useGetProduct,
  getGetProductQueryKey,
  useCreateCustomization,
  useGetLatestCustomizationForProduct,
  getGetLatestCustomizationForProductQueryKey,
  useAddToCart,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { ModelViewerCustomizer } from "@/components/3d/ModelViewerCustomizer";
import type { CustomizerHandle } from "@/components/3d/ModelViewerCustomizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, ShoppingBag, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/format";
import { Show } from "@clerk/react";

export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const customizerRef = useRef<CustomizerHandle>(null);

  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState("M");
  const [designName, setDesignName] = useState("");
  const [parts, setParts] = useState<Record<string, boolean>>({});
  const [studioKey, setStudioKey] = useState(0);
  const [canvasRestored, setCanvasRestored] = useState(false);

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(id, {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id) },
  });

  const { data: latestCustomization } = useGetLatestCustomizationForProduct(id, {
    query: { enabled: !!id, queryKey: getGetLatestCustomizationForProductQueryKey(id) },
  });

  useEffect(() => {
    if (product && !latestCustomization) {
      setColor(product.defaultColor || "#ffffff");
    }
  }, [product, latestCustomization]);

  useEffect(() => {
    if (latestCustomization) {
      setColor(latestCustomization.color);
      setSize(latestCustomization.size);
      setDesignName(latestCustomization.name);
      setParts((latestCustomization.partsEnabled as Record<string, boolean>) || {});
    }
  }, [latestCustomization]);

  // Restore canvas from saved customization after studio mounts
  useEffect(() => {
    if (!latestCustomization?.canvasData || canvasRestored) return;
    const timer = setTimeout(() => {
      if (customizerRef.current && latestCustomization.canvasData) {
        customizerRef.current.loadCanvasData(latestCustomization.canvasData);
        setCanvasRestored(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [latestCustomization, canvasRestored]);

  const createCustomization = useCreateCustomization();
  const addToCart = useAddToCart();

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast({ title: "Design Name Required", description: "Please enter a name for your design before saving.", variant: "destructive" });
      return;
    }

    const canvasData = customizerRef.current?.getCanvasData();

    try {
      await createCustomization.mutateAsync({
        data: {
          productId: id,
          name: designName,
          color,
          size,
          partsEnabled: parts,
          canvasData: canvasData?.canvasJson ?? null,
          previewImageUrl: canvasData?.previewDataUrl ?? null,
        },
      });
      toast({ title: "Design Saved", description: "Your bespoke design has been saved to your profile." });
      queryClient.invalidateQueries({ queryKey: getGetLatestCustomizationForProductQueryKey(id) });
    } catch {
      toast({ title: "Error", description: "Failed to save design. Please try again.", variant: "destructive" });
    }
  };

  const handleAddToCart = async () => {
    const canvasData = customizerRef.current?.getCanvasData();

    try {
      let customizationId = latestCustomization?.id;

      const needsUpdate = !customizationId
        || latestCustomization?.color !== color
        || latestCustomization?.size !== size
        || JSON.stringify(latestCustomization?.partsEnabled) !== JSON.stringify(parts)
        || !!canvasData?.canvasJson;

      if (needsUpdate) {
        const newCust = await createCustomization.mutateAsync({
          data: {
            productId: id,
            name: designName || `${product?.name} - Custom`,
            color,
            size,
            partsEnabled: parts,
            canvasData: canvasData?.canvasJson ?? null,
            previewImageUrl: canvasData?.previewDataUrl ?? null,
          },
        });
        customizationId = newCust.id;
      }

      await addToCart.mutateAsync({ data: { productId: id, customizationId, quantity: 1, size } });

      toast({ title: "Added to Cart", description: "Your customized item has been added to your bag." });
      setLocation("/cart");
    } catch {
      toast({ title: "Error", description: "Failed to add to cart. Please sign in or try again.", variant: "destructive" });
    }
  };

  const handleStartFresh = () => {
    setStudioKey(k => k + 1);
    setColor(product?.defaultColor || "#ffffff");
    setParts({});
    setDesignName("");
    setCanvasRestored(false);
  };

  if (isLoadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#100d0b" }}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "radial-gradient(circle at center, #1f232e 0%, #100d0b 100%)", color: "#f8f9fa" }}>
      {/* Studio Header */}
      <header
        className="h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50 backdrop-blur-md flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(16,13,11,0.9)" }}
      >
        <div className="flex items-center gap-4">
          <Link href={`/products/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif font-medium text-base hidden sm:block text-white">
              Bespoke Studio — {product.name}
            </h1>
            <p className="text-xs text-white/40">{formatPrice(product.priceInPaise)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder="Name your design..."
            className="hidden md:block w-44 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-white/20 rounded-none focus-visible:ring-0 focus-visible:border-white/60 px-0 h-8 text-sm text-white placeholder:text-white/30"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartFresh}
            className="text-[10px] tracking-wider text-white/40 hover:text-white/80 hover:bg-white/5 flex items-center gap-1.5"
            title="Start a fresh design"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Start Fresh</span>
          </Button>

          <Show when="signed-out">
            <Link href="/sign-in">
              <Button variant="outline" size="sm" className="text-xs rounded-none border-white/20 text-white hover:bg-white/10">
                Sign In to Save
              </Button>
            </Link>
          </Show>

          <Show when="signed-in">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDesign}
              disabled={createCustomization.isPending}
              className="text-xs rounded-none border-white/20 text-white hover:bg-white/10 flex items-center gap-2"
            >
              {createCustomization.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Show>

          <Button
            onClick={handleAddToCart}
            disabled={addToCart.isPending || createCustomization.isPending}
            size="sm"
            className="text-xs rounded-none flex items-center gap-2 bg-emerald-400/90 text-black hover:bg-emerald-300"
          >
            {addToCart.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingBag className="w-3 h-3" />}
            Add to Cart
          </Button>
        </div>
      </header>

      {/* Main Studio */}
      <div className="flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        <ModelViewerCustomizer
          key={studioKey}
          ref={customizerRef}
          modelUrl={product.modelUrl}
          thumbnailUrl={product.thumbnailUrl}
          initialColor={product.defaultColor || "#ffffff"}
          onColorChange={(c) => setColor(c)}
          onPartsChange={(p) => setParts(p)}
        />
      </div>
    </div>
  );
}
