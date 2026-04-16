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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, ShoppingBag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/format";
import { Show } from "@clerk/react";

export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState("M");
  const [designName, setDesignName] = useState("");
  const [parts, setParts] = useState<Record<string, boolean>>({});

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(id, {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(id),
    },
  });

  const { data: latestCustomization } = useGetLatestCustomizationForProduct(id, {
    query: {
      enabled: !!id,
      queryKey: getGetLatestCustomizationForProductQueryKey(id),
    },
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

  const createCustomization = useCreateCustomization();
  const addToCart = useAddToCart();

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast({
        title: "Design Name Required",
        description: "Please enter a name for your design before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createCustomization.mutateAsync({
        data: {
          productId: id,
          name: designName,
          color,
          size,
          partsEnabled: parts,
          canvasData: null,
          previewImageUrl: null,
        },
      });

      toast({
        title: "Design Saved",
        description: "Your bespoke design has been saved to your profile.",
      });

      queryClient.invalidateQueries({ queryKey: getGetLatestCustomizationForProductQueryKey(id) });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save design. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = async () => {
    try {
      let customizationId = latestCustomization?.id;

      if (
        !customizationId ||
        latestCustomization?.color !== color ||
        latestCustomization?.size !== size ||
        JSON.stringify(latestCustomization?.partsEnabled) !== JSON.stringify(parts)
      ) {
        const newCust = await createCustomization.mutateAsync({
          data: {
            productId: id,
            name: designName || `${product?.name} - Custom`,
            color,
            size,
            partsEnabled: parts,
            canvasData: null,
            previewImageUrl: null,
          },
        });
        customizationId = newCust.id;
      }

      await addToCart.mutateAsync({
        data: { productId: id, customizationId, quantity: 1, size },
      });

      toast({
        title: "Added to Cart",
        description: "Your customized item has been added to your bag.",
      });

      setLocation("/cart");
    } catch {
      toast({
        title: "Error",
        description: "Failed to add to cart. Please sign in or try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoadingProduct) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!product) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at center, #1f232e 0%, #100d0b 100%)", color: "#f8f9fa" }}
    >
      {/* Studio Header */}
      <header
        className="h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50 backdrop-blur-md"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(16,13,11,0.9)" }}
      >
        <div className="flex items-center gap-4">
          <Link href={`/products/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif font-medium text-lg hidden sm:block text-white">
              Bespoke Studio: {product.name}
            </h1>
            <p className="text-xs text-white/40">{formatPrice(product.priceInPaise)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder="Name your design..."
            className="hidden md:block w-48 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-white/20 rounded-none focus-visible:ring-0 focus-visible:border-white/60 px-0 h-8 text-sm text-white placeholder:text-white/30"
          />
          <Show when="signed-out">
            <Link href="/sign-in">
              <Button variant="outline" className="text-xs tracking-wider rounded-none border-white/20 text-white hover:bg-white/10">
                Sign In to Save
              </Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Button
              variant="outline"
              onClick={handleSaveDesign}
              disabled={createCustomization.isPending}
              className="text-xs tracking-wider rounded-none border-white/20 text-white hover:bg-white/10 flex items-center gap-2"
            >
              {createCustomization.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Show>
          <Button
            onClick={handleAddToCart}
            disabled={addToCart.isPending}
            className="text-xs tracking-wider rounded-none flex items-center gap-2 bg-emerald-400/90 text-black hover:bg-emerald-300"
          >
            {addToCart.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ShoppingBag className="w-3 h-3" />
            )}
            Add to Cart
          </Button>
        </div>
      </header>

      {/* Main Customizer */}
      <div className="flex-1" style={{ height: "calc(100vh - 64px)" }}>
        <ModelViewerCustomizer
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
