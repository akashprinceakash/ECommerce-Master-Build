import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useGetProduct, getGetProductQueryKey, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Plus, ShoppingBag, Wand2, ChevronRight, ChevronLeft, ShieldCheck, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useCart } from "@/contexts/CartContext";
import { getAssetUrl } from "@/lib/api";
import { SHOW_CUSTOMIZATION } from "@/lib/features";
import { PersonalizeModal } from "@/components/layout/PersonalizeModal";

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
  const [activeIdx, setActiveIdx] = useState(0);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const sizingAccordionRef = useRef<HTMLDivElement>(null);

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

  const sizes = ["XS", "S", "M", "L", "XL", "XXL", "CUSTOM"];

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

  function getProductAltText(): string {
    const cat = (product?.category || "").toLowerCase();
    const gender = (product?.gender || "").toLowerCase();
    const sub = (product?.subType || "").toLowerCase();
    if (cat.includes("trouser") || cat.includes("pant")) {
      return gender === "women"
        ? "Premium stretch golf trousers for women with performance fit by Ka.sha"
        : "Premium stretch golf trousers for men with performance fit by Ka.sha";
    }
    if (cat.includes("skort") || cat.includes("skirt")) {
      return "Women's luxury golf skort with performance stretch fabric";
    }
    if (cat.includes("short")) {
      return "Premium golf shorts with performance stretch fabric by Ka.sha";
    }
    if (sub === "printed" || sub === "print") {
      return gender === "women"
        ? "Designer printed golf polo for women with premium athletic fit"
        : "Designer printed golf polo for men with premium athletic fit";
    }
    return gender === "women"
      ? "Women's luxury golf polo shirt in breathable dri fit fabric by Ka.sha"
      : "Men's luxury golf polo shirt in breathable dri fit fabric by Ka.sha";
  }

  const mainThumbnail = getAssetUrl(product.thumbnailUrl) || "/images/product-tshirt.png";

  // Parse additional images — handles both JSON arrays and raw URLs from CSV import
  let extraImages: string[] = [];
  if (product.additionalImages) {
    try {
      const parsed = JSON.parse(product.additionalImages);
      if (Array.isArray(parsed)) extraImages = parsed.map(u => getAssetUrl(u) || u).filter(Boolean);
      else if (typeof parsed === "string" && parsed.startsWith("http")) extraImages = [parsed];
    } catch {
      if (product.additionalImages.startsWith("http")) extraImages = [product.additionalImages];
    }
  }

  const galleryImages = [mainThumbnail, ...extraImages];

  const goPrev = () => { setImgLoaded(false); setActiveIdx(i => (i - 1 + galleryImages.length) % galleryImages.length); };
  const goNext = () => { setImgLoaded(false); setActiveIdx(i => (i + 1) % galleryImages.length); };
  const goTo   = (idx: number) => { if (idx !== activeIdx) { setImgLoaded(false); setActiveIdx(idx); } };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? goNext() : goPrev();
    touchStartX.current = null;
  };

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

          {/* Product Image Carousel */}
          <div>
            {/* Main slide area */}
            <div
              className="relative w-full overflow-hidden"
              style={{ background: "#F9F8F6", border: "1px solid rgba(0,0,0,0.07)", aspectRatio: "1 / 1" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {!imgLoaded && (
                <div className="absolute inset-0 bg-[#F0EEE9] animate-pulse z-0" />
              )}

              {/* Stacked images — fade between them */}
              {galleryImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${getProductAltText()} — view ${idx + 1}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={idx === 0 ? "high" : undefined}
                  onLoad={() => { if (idx === activeIdx) setImgLoaded(true); }}
                  className="absolute inset-0 w-full h-full object-contain object-center"
                  style={{ opacity: idx === activeIdx ? 1 : 0, transition: "opacity 0.5s ease", zIndex: idx === activeIdx ? 1 : 0 }}
                />
              ))}

              {!product.available && (
                <div className="absolute top-4 left-4 bg-black text-white text-[10px] font-bold tracking-[0.15em] px-3 py-1 z-10">
                  SOLD OUT
                </div>
              )}

              {/* Prev / Next arrows */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-white/85 backdrop-blur-sm hover:bg-white transition-all z-10"
                    style={{ border: "1px solid rgba(0,0,0,0.10)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={goNext}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-white/85 backdrop-blur-sm hover:bg-white transition-all z-10"
                    style={{ border: "1px solid rgba(0,0,0,0.10)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Image counter */}
                  <div className="absolute bottom-3 right-4 z-10" style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "rgba(0,0,0,0.4)" }}>
                    {activeIdx + 1} / {galleryImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Dot indicators */}
            {galleryImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {galleryImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goTo(idx)}
                    aria-label={`View image ${idx + 1}`}
                    style={{
                      width: idx === activeIdx ? 22 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: idx === activeIdx ? "#B8925A" : "rgba(0,0,0,0.18)",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      transition: "width 0.3s ease, background 0.3s ease",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {galleryImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="overflow-hidden transition-all"
                    style={{
                      width: 60,
                      height: 60,
                      background: "#F9F8F6",
                      border: `2px solid ${activeIdx === i ? "#1a1a1a" : "transparent"}`,
                      outline: activeIdx === i ? "none" : "1px solid rgba(0,0,0,0.10)",
                      transition: "border-color 0.2s",
                    }}
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
              <div className="flex items-center gap-4 flex-wrap">
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
              {/* Multi-piece order pricing */}
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                <p className="text-[10px] font-bold tracking-[0.22em] text-gray-400 mb-2 uppercase">Multi-piece pricing</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "1 Piece",    note: "Base price" },
                    { label: "2 Pieces",   note: "10% off",   highlight: true },
                    { label: "3 Pieces",   note: "15% off",   highlight: true },
                    { label: "4 Pieces",   note: "20% off",   highlight: true },
                  ].map(t => (
                    <div key={t.label} style={{
                      padding: "5px 10px",
                      border: `1px solid ${(t as any).highlight ? "rgba(184,146,90,0.35)" : "rgba(0,0,0,0.1)"}`,
                      borderRadius: 3,
                      background: (t as any).highlight ? "rgba(184,146,90,0.05)" : "transparent",
                      textAlign: "center",
                    }}>
                      <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: "0.08em", color: "rgba(0,0,0,0.45)" }}>{t.label}</div>
                      <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, fontWeight: 700, color: (t as any).highlight ? "#B8925A" : "#1a1a1a", letterSpacing: "0.06em" }}>{t.note}</div>
                    </div>
                  ))}
                  <Link href="/connect?type=bulk-order" style={{
                    padding: "5px 10px",
                    border: "1px solid rgba(184,146,90,0.5)",
                    borderRadius: 3,
                    background: "#B8925A",
                    textAlign: "center",
                    textDecoration: "none",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 10, letterSpacing: "0.08em", color: "rgba(255,255,255,0.75)" }}>5+ Pieces</div>
                    <div style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.06em" }}>Bulk Order →</div>
                  </Link>
                </div>
              </div>
            </div>

            {/* <p className="text-[11px] text-gray-400 tracking-wide">Inclusive of all taxes &nbsp;·&nbsp; Free shipping on all orders</p> */}
            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>

            {/* Size Selector */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-[0.15em] text-black">SELECT SIZE</span>
                <button
                  className="text-[11px] text-gray-400 hover:text-black underline transition-colors tracking-wider"
                  onClick={() => {
                    setOpenAccordion("sizing");
                    setTimeout(() => {
                      sizingAccordionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                >
                  SIZE GUIDE
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      if (size === "CUSTOM") {
                        setOpenAccordion("sizing");
                        setTimeout(() => {
                          sizingAccordionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                      }
                    }}
                    className={`h-11 text-[12px] font-bold border transition-all ${size === "CUSTOM" ? "px-4 min-w-[72px]" : "w-11"} ${
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

            {/* Personalise This T-Shirt */}
            {SHOW_CUSTOMIZATION && (
              <button
                onClick={() => setPersonalizeOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "14px 16px",
                  border: "1px solid #B8925A",
                  borderRadius: 4,
                  background: "#1a1a18",
                  cursor: "pointer",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#2a2520";
                  (e.currentTarget as HTMLElement).style.borderColor = "#d4a96a";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#1a1a18";
                  (e.currentTarget as HTMLElement).style.borderColor = "#B8925A";
                }}
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" style={{ color: "#B8925A" }} />
                  <div style={{ textAlign: "left" }}>
                    <div className="text-[12px] font-bold tracking-[0.12em] uppercase" style={{ color: "#B8925A" }}>
                      Personalise This T-Shirt
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Quick personalisation or full bespoke customisation
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#B8925A" }} />
              </button>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                className="w-full border-2 border-black text-black text-[14px] font-bold tracking-[0.15em] py-4 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddToCart}
                disabled={addToCartMutation.isPending || !product.available}
              >
                <ShoppingBag className="w-4 h-4" />
                {addToCartMutation.isPending ? "ADDING..." : "ADD TO CART"}
              </button>

              <button
                className="w-full bg-black text-white text-[14px] font-bold tracking-[0.15em] py-4 hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleBuyNow}
                disabled={addToCartMutation.isPending || !product.available}
              >
                BUY NOW
              </button>

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
                  key: "details" as const,
                  title: "Details & Care",
                  content: "Crafted with precision using premium performance fabrics. Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Iron on low heat. Store folded in a cool, dry place."
                },
                {
                  key: "shipping" as const,
                  title: "Shipping & Returns",
                  content: "Orders are processed within 1–3 business days. Metro deliveries: 3–5 business days. Other cities: 5–7 business days. Returns accepted within 7 days of delivery for unused, unwashed items in original condition with tags attached. Customised pieces are non-returnable."
                },
                {
                  key: "sizing" as const,
                  title: "Sizing Information",
                  content: "Our garments are designed for a contemporary athletic fit. We recommend ordering your usual size. If you are between sizes, size up for a more relaxed fit. See our full size guide for measurements."
                }
              ].map(item => (
                <div
                  key={item.key}
                  className="border-b border-gray-200"
                  ref={item.key === "sizing" ? sizingAccordionRef : undefined}
                >
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
      <PersonalizeModal
        isOpen={personalizeOpen}
        onClose={() => setPersonalizeOpen(false)}
        productId={product.id}
        productName={product.name}
        productSku={product.sku ?? undefined}
      />
    </Layout>
  );
}
