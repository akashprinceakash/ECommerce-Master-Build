import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useGetProduct, getGetProductQueryKey, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductViewer } from "@/components/3d/ProductViewer";
import { Minus, Plus, ShoppingBag, Wand2, ChevronRight, ShieldCheck, RotateCcw, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useCart } from "@/contexts/CartContext";

export default function ProductDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { user } = useUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const { data: product, isLoading, error } = useGetProduct(id, {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(id)
    }
  });

  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Added to cart", description: `${product?.name} has been added to your cart.` });
        openCart();
      },
      onError: () => {
        toast({ title: "Error", description: "Could not add to cart. Please try again.", variant: "destructive" });
      }
    }
  });

  function handleAddToCart() {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    addToCartMutation.mutate({ data: { productId: id, quantity, size: selectedSize || "M" } });
  }

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-[4/5] w-full rounded-none bg-gray-100" />
            <div className="space-y-6 py-4">
              <Skeleton className="h-8 w-2/3 bg-gray-100" />
              <Skeleton className="h-6 w-1/4 bg-gray-100" />
              <Skeleton className="h-20 w-full bg-gray-100" />
              <Skeleton className="h-12 w-full bg-gray-100" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="max-w-[1400px] mx-auto px-6 py-32 text-center text-gray-500">
          <h2 className="text-2xl font-bold mb-4">Product not found</h2>
          <Link href="/products" className="text-black hover:underline text-sm font-semibold">
            Return to collection
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2 text-[11px] text-gray-400 font-medium">
          <Link href="/" className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/products" className="hover:text-black transition-colors">PRODUCTS</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{product.name.toUpperCase()}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Product Image / Viewer */}
          <div className="sticky top-24 aspect-[4/5] w-full bg-gray-100 overflow-hidden">
            <ProductViewer color={product.defaultColor} thumbnailUrl={product.thumbnailUrl} />
          </div>

          {/* Product Details */}
          <div className="flex flex-col space-y-7 py-2">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-gray-400 mb-2 uppercase">
                {product.category}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-black mb-3">{product.name}</h1>
              <p className="text-2xl font-bold text-black">{formatPrice(product.priceInPaise)}</p>
            </div>

            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>

            {/* Size Selector */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-[0.15em] text-black">SIZE</span>
                <button className="text-[11px] text-gray-400 hover:text-black underline transition-colors">SIZE GUIDE</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 text-[12px] font-bold border transition-colors ${
                      selectedSize === size
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-gray-300 hover:border-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <span className="text-[11px] font-bold tracking-[0.15em] text-black block mb-3">QUANTITY</span>
              <div className="flex items-center border border-gray-300 w-fit">
                <button
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-black transition-colors disabled:opacity-40"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-[14px] font-bold">{quantity}</span>
                <button
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-black transition-colors"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                className="w-full border-2 border-black text-black text-[12px] font-bold tracking-[0.15em] py-4 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                onClick={handleAddToCart}
                disabled={addToCartMutation.isPending}
              >
                <ShoppingBag className="w-4 h-4" />
                {addToCartMutation.isPending ? "ADDING..." : "ADD TO CART"}
              </button>

              <button
                className="w-full bg-black text-white text-[12px] font-bold tracking-[0.15em] py-4 hover:bg-gray-900 transition-colors"
              >
                BUY NOW
              </button>

              <Link href={`/products/${product.id}/customize`}>
                <button className="w-full border border-gray-300 text-black text-[12px] font-bold tracking-[0.12em] py-4 hover:border-black transition-colors flex items-center justify-center gap-2 mt-1">
                  <Wand2 className="w-4 h-4" />
                  CUSTOMISE THIS PIECE
                </button>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex gap-6 py-4 border-y border-gray-100">
              <div className="flex items-center gap-2 text-gray-500">
                <ShieldCheck className="w-4 h-4 text-black" />
                <span className="text-[11px] font-semibold">Authentic</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <RotateCcw className="w-4 h-4 text-black" />
                <span className="text-[11px] font-semibold">14-day Returns</span>
              </div>
            </div>

            {/* Accordion */}
            <div className="space-y-0 border-t border-gray-200">
              {[
                {
                  key: "details",
                  title: "Details & Care",
                  content: "Crafted with precision using premium performance fabrics. Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Iron on low heat. Store folded in a cool, dry place."
                },
                {
                  key: "shipping",
                  title: "Shipping & Returns",
                  content: "Complimentary standard shipping on all orders. Express options available at checkout. Returns accepted within 14 days of delivery for unworn items with original tags. Customized pieces are final sale."
                },
                {
                  key: "sizing",
                  title: "Sizing Information",
                  content: "Our garments are designed for a contemporary athletic fit. We recommend ordering your usual size. If you are between sizes, size up for a more relaxed fit."
                }
              ].map(item => (
                <div key={item.key} className="border-b border-gray-200">
                  <button
                    className="w-full flex items-center justify-between py-4 text-left"
                    onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)}
                  >
                    <span className="text-[13px] font-bold text-black">{item.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${openAccordion === item.key ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openAccordion === item.key && (
                    <div className="pb-4 text-sm text-gray-600 leading-relaxed">
                      {item.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
