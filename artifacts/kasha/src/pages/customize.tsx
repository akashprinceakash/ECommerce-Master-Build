import { useState } from "react";
import {
  useGetProduct,
  getGetProductQueryKey,
  useCreateCustomization,
  useAddToCart,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { TshirtCustomizer, type TshirtConfig } from "@/components/customizer/TshirtCustomizer";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomization } from "@/contexts/CustomizationContext";
import { useUser } from "@clerk/react";

export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCustomization } = useCustomization();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  const { data: product, isLoading } = useGetProduct(id, {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id) },
  });

  const createCustomization = useCreateCustomization();
  const addToCart = useAddToCart();

  const handleSaveAndAddToCart = async (config: TshirtConfig, previewUrl: string, designName: string) => {
    setIsSaving(true);
    try {
      // Save customized design preview to context (visible everywhere)
      setCustomization({
        productId: id,
        previewUrl,
        color: config.color,
        sleeves: config.sleeves,
        collar: config.collar,
        designName,
        savedAt: Date.now(),
      });

      // Persist to API if signed in
      let customizationId: number | undefined;
      if (user) {
        try {
          const saved = await createCustomization.mutateAsync({
            data: {
              productId: id,
              name: designName || `${product?.name} — Custom`,
              color: config.color,
              size: config.size,
              partsEnabled: { sleeves: config.sleeves, collar: config.collar } as any,
              canvasData: null,
              previewImageUrl: previewUrl,
            },
          });
          customizationId = saved.id;
        } catch {
          // API save failed — continue anyway
        }

        await addToCart.mutateAsync({
          data: {
            productId: id,
            customizationId,
            quantity: 1,
            size: config.size,
          },
        });

        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });

        toast({
          title: "Design saved!",
          description: "Your custom t-shirt has been added to your cart.",
        });
      } else {
        toast({
          title: "Design saved!",
          description: "Your customization is saved. Sign in to add to cart.",
        });
      }

      // Navigate back to product to see the customized design
      setLocation(`/products/${id}`);
    } catch {
      toast({
        title: "Error",
        description: "Could not save design. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#111]">
      {/* Studio Header */}
      <header
        className="h-14 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(14,14,14,0.97)" }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/products/${id}`}>
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <p className="text-white font-semibold text-sm leading-none">{product.name}</p>
            <p className="text-white/30 text-[10px] mt-0.5 tracking-wider">Bespoke Studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25 tracking-wider hidden sm:block">
            Customize → Save & Add to Cart
          </span>
        </div>
      </header>

      {/* Customizer */}
      <div className="flex-1">
        <TshirtCustomizer
          productId={id}
          productName={product.name}
          onSaveAndAddToCart={handleSaveAndAddToCart}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
