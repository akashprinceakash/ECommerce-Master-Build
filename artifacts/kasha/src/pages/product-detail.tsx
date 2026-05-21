import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useGetProduct, getGetProductQueryKey, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Plus, ShoppingBag, Wand2, ChevronRight, ShieldCheck, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useCart } from "@/contexts/CartContext";
import { getAssetUrl } from "@/lib/api";
import { SHOW_CUSTOMIZATION } from "@/lib/features";

export default function ProductDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { user } = useUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openCart, addToGuestCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);

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

  // Auto-add to cart when user signs in with a pending cart item for this product
  useEffect(() => {
    if (!user || !product) return;
    const raw = sessionStorage.getItem("pendingCartAdd");
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { productId: number; quantity: number; size: string | null };
      if (pending.productId !== id || !pending.size) return;
      sessionStorage.removeItem("pendingCartAdd");
      setSelectedSize(pending.size);
      setQuantity(pending.quantity);
      addToCartMutation.mutate({ data: { productId: id, quantity: pending.quantity, size: pending.size } });
    } catch {
      sessionStorage.removeItem("pendingCartAdd");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, product?.id]);

  function handleAddToCart() {
    if (!selectedSize) {
      toast({ title: "Select a size", description: "Please choose a size before adding to cart.", variant: "destructive" });
      return;
    }
    if (!user) {
      addToGuestCart({
        productId: id,
        productName: product?.name ?? "",
        thumbnailUrl: product?.thumbnailUrl ?? undefined,
        priceInPaise: product?.priceInPaise ?? 0,
        quantity,
        size: selectedSize,
      });
      toast({ title: "Added to cart", description: `${product?.name} added. Sign in at checkout to complete your order.` });
      openCart();
      return;
    }
    addToCartMutation.mutate({ data: { productId: id, quantity, size: selectedSize } });
  }

  function handleBuyNow() {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    if (!selectedSize) {
      toast({ title: "Select a size", description: "Please choose a size before purchasing.", variant: "destructive" });
      return;
    }
    addToCartMutation.mutate(
      { data: { productId: id, quantity, size: selectedSize } },
      { onSuccess: () => navigate("/cart") }
    );
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

  const mainThumbnail = getAssetUrl(product.thumbnailUrl) || "/images/product-tshirt.png";

  // Parse additional images from JSON string stored in DB
  let extraImages: string[] = [];
  if (product.additionalImages) {
    try { extraImages = (JSON.parse(product.additionalImages) as string[]).map(u => getAssetUrl(u) || u); } catch { extraImages = []; }
  }

  // All gallery images: main first, then extras
  const galleryImages = [mainThumbnail, ...extraImages];
  const displayImage = activeImg ?? mainThumbnail;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2 text-[11px] text-gray-400 font-medium tracking-wider">
          <Link href="/" className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/products" className="hover:text-black transition-colors">PRODUCTS</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{product.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "").toUpperCase()}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Product Image */}
          <div className="sticky top-24">
            <div className="aspect-[3/4] w-full bg-white overflow-hidden relative" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gray-50 animate-pulse" />
              )}
              <img
                src={displayImage}
                alt={product.name}
                onLoad={() => setImgLoaded(true)}
                className={`w-full h-full object-contain object-center transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
              {!product.available && (
                <div className="absolute top-4 left-4 bg-black text-white text-[10px] font-bold tracking-[0.15em] px-3 py-1">
                  SOLD OUT
                </div>
              )}
            </div>
            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {galleryImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveImg(img); setImgLoaded(false); }}
                    className={`w-16 h-16 bg-gray-100 overflow-hidden border-2 transition-colors ${
                      displayImage === img ? "border-black" : "border-transparent hover:border-gray-400"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col space-y-7 py-2">
            <div>
              <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-2 uppercase">
                {product.category || "Golf Collection"}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-black mb-3 leading-tight">{product.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}</h1>
              <div className="flex items-center gap-4">
                <p className="text-2xl font-bold text-black">{formatPrice(product.priceInPaise)}</p>
                {product.available ? (
                  <span className="text-[10px] font-bold tracking-[0.15em] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5">
                    IN STOCK
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-[0.15em] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5">
                    SOLD OUT
                  </span>
                )}
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>

            {/* Size Selector */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-[0.15em] text-black">SELECT SIZE</span>
                <button
                  className="text-[11px] text-gray-400 hover:text-black underline transition-colors tracking-wider"
                  onClick={() => setOpenAccordion(openAccordion === "sizing" ? null : "sizing")}
                >
                  SIZE GUIDE
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 text-[12px] font-bold border transition-all ${
                      selectedSize === size
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-gray-300 hover:border-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p className="text-[11px] text-gray-400 mt-2">Please select a size</p>
              )}
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
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                className="w-full border-2 border-black text-black text-[12px] font-bold tracking-[0.15em] py-4 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddToCart}
                disabled={addToCartMutation.isPending || !product.available}
              >
                <ShoppingBag className="w-4 h-4" />
                {addToCartMutation.isPending ? "ADDING..." : "ADD TO CART"}
              </button>

              <button
                className="w-full bg-black text-white text-[12px] font-bold tracking-[0.15em] py-4 hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleBuyNow}
                disabled={addToCartMutation.isPending || !product.available}
              >
                BUY NOW
              </button>

              {SHOW_CUSTOMIZATION && (
                <Link href={`/products/${product.id}/customize`}>
                  <button className="w-full border border-gray-300 text-black text-[12px] font-bold tracking-[0.12em] py-4 hover:border-black transition-all flex items-center justify-center gap-2 mt-1 hover:bg-gray-50">
                    <Wand2 className="w-4 h-4" />
                    CUSTOMISE THIS PIECE
                  </button>
                </Link>
              )}
            </div>

            {/* Trust Badge */}
            <div className="flex items-center gap-2 text-gray-500 py-3 border-y border-gray-100">
              <ShieldCheck className="w-4 h-4 text-black" />
              <span className="text-[11px] font-semibold">100% Authentic — Luxury Craftsmanship</span>
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
                  content: "Orders are processed within 1–3 business days. Metro deliveries: 3–5 business days. Other cities: 5–7 business days. Returns accepted within 7 days of delivery for unused, unwashed items in original condition with tags attached. Customised pieces are non-returnable."
                },
                {
                  key: "sizing",
                  title: "Sizing Information",
                  content: "Our garments are designed for a contemporary athletic fit. We recommend ordering your usual size. If you are between sizes, size up for a more relaxed fit. See our full size guide for measurements."
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
