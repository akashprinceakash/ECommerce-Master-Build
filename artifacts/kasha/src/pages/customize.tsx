import { useState } from "react";
import {
  useGetProduct,
  getGetProductQueryKey,
  useCreateCustomization,
  useAddToCart,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { ModelViewerCustomizer } from "@/components/3d/ModelViewerCustomizer";
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

  const handleSaveDesign = async (previewUrl: string, selectedSize: string, primaryColor: string) => {
    setIsSaving(true);
    try {
      // Save customized design preview to context (visible everywhere in app)
      setCustomization({
        productId: id,
        previewUrl,
        color: primaryColor,
        sleeves: "half",
        collar: "round",
        designName: `${product?.name ?? "Design"} — Custom`,
        savedAt: Date.now(),
      });

      // Persist to API + add to cart if signed in
      let customizationId: number | undefined;
      if (user) {
        try {
          const saved = await createCustomization.mutateAsync({
            data: {
              productId: id,
              name: `${product?.name ?? "Design"} — Custom`,
              color: primaryColor,
              size: selectedSize,
              partsEnabled: {} as any,
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
            size: selectedSize,
          },
        });

        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });

        toast({
          title: "Design saved!",
          description: "Your custom piece has been added to your cart.",
        });
      } else {
        toast({
          title: "Design saved!",
          description: "Your customization is saved. Sign in to add to cart.",
        });
      }

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
      <div className="min-h-screen bg-[#100d0b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#100d0b]">
      {/* Studio Header */}
      <header
        className="h-14 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(16,13,11,0.97)" }}
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

        <div className="hidden sm:flex items-center gap-4">
          <span className="text-[10px] text-white/25 tracking-wider">
            Craft your design → Save & Add to Cart
          </span>
        </div>
      </header>

      {/* Studio Body */}
      <div className="flex-1">
        <ModelViewerCustomizer
          modelUrl={product.modelUrl}
          thumbnailUrl={product.thumbnailUrl}
          initialColor="#ffffff"
          onSaveDesign={handleSaveDesign}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
