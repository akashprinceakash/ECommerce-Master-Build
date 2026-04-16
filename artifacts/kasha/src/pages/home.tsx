import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { useCustomization } from "@/contexts/CustomizationContext";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"MEN" | "WOMEN" | "KIDS">("MEN");
  const { openCart } = useCart();
  const { getCustomization } = useCustomization();

  const { data: products } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}) } }
  );

  const topSellers = products?.slice(0, 4) || [];
  const newArrivals = products?.slice(0, 4) || [];

  const categories = {
    MEN: [
      { title: "Golf T-Shirts", href: "/products?category=clothing", img: "/images/product-tshirt.png" },
      { title: "Golf Trousers", href: "/products?category=trousers", img: "/images/product-trousers.png" },
      { title: "Jackets & Outerwear", href: "/products?category=jackets", img: "/images/product-jacket.png" },
    ],
    WOMEN: [
      { title: "Performance Tops", href: "/products?category=clothing", img: "/images/product-tshirt.png" },
      { title: "Golf Bottoms", href: "/products?category=trousers", img: "/images/product-trousers.png" },
      { title: "Outerwear", href: "/products?category=jackets", img: "/images/product-jacket.png" },
    ],
    KIDS: [
      { title: "Junior Tops", href: "/products?category=clothing", img: "/images/product-tshirt.png" },
      { title: "Junior Bottoms", href: "/products?category=trousers", img: "/images/product-trousers.png" },
      { title: "Junior Jackets", href: "/products?category=jackets", img: "/images/product-jacket.png" },
    ],
  };

  return (
    <Layout>
      {/* ——— HERO ——— */}
      <section className="relative h-[85vh] min-h-[560px] overflow-hidden bg-gray-900">
        <div className="absolute inset-0">
          <img
            src="/images/product-jacket.png"
            alt="KA.SHA Golf Collection"
            className="w-full h-full object-cover object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
        </div>

        <div className="relative z-10 h-full flex flex-col items-start justify-center px-8 md:px-16 max-w-[780px]">
          <span className="text-[11px] font-bold tracking-[0.25em] text-white/70 mb-5 uppercase">
            New Collection — 2026
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Redefining<br />
            <span className="italic font-light">the Modern</span><br />
            Game.
          </h1>
          <p className="text-base md:text-lg text-white/75 max-w-md mb-10 leading-relaxed">
            Elevated performance wear for those who treat golf as a lifestyle, not just a sport.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/products">
              <button className="bg-white text-black text-[12px] font-bold tracking-[0.15em] px-8 py-4 hover:bg-gray-100 transition-colors">
                SHOP NEW ARRIVALS
              </button>
            </Link>
            <Link href="/products">
              <button className="border-2 border-white text-white text-[12px] font-bold tracking-[0.15em] px-8 py-4 hover:bg-white/10 transition-colors">
                EXPLORE COLLECTIONS
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ——— COLLECTIONS ——— */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-3">SHOP BY CATEGORY</p>
            <h2 className="text-4xl md:text-5xl font-black text-black mb-4">The Ka.Sha Collections</h2>
            <p className="text-[12px] font-bold tracking-[0.2em] text-gray-500">
              FIT. FABRIC. PRINT. EVERY PIECE FULLY CUSTOMISABLE.
            </p>
          </div>

          {/* Category tabs */}
          <div className="flex justify-center gap-0 mb-12 border-b border-gray-200">
            {(["MEN", "WOMEN", "KIDS"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-3 text-[12px] font-bold tracking-[0.15em] border-b-2 transition-colors -mb-px ${
                  activeTab === tab
                    ? "border-black text-black"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {categories[activeTab].map(cat => (
              <Link key={cat.title} href={cat.href} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 mb-4">
                  <img
                    src={cat.img}
                    alt={cat.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold tracking-[0.06em] text-black">{cat.title}</h3>
                  <span className="text-[11px] font-semibold tracking-[0.1em] text-gray-500 group-hover:text-black transition-colors flex items-center gap-1">
                    SHOP <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ——— TOP SELLERS ——— */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-2">TOP SELLERS</p>
              <h2 className="text-3xl md:text-4xl font-black text-black">The fairway favourites</h2>
            </div>
            <Link href="/products">
              <span className="text-[11px] font-bold tracking-[0.1em] text-gray-700 hover:text-black flex items-center gap-1 transition-colors">
                VIEW ALL <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {topSellers.length > 0 ? topSellers.map(product => {
              const cust = getCustomization(product.id);
              const img = cust?.previewUrl || product.thumbnailUrl;
              return (
              <Link key={product.id} href={`/products/${product.id}`} className="group block">
                <div className={`relative aspect-[3/4] overflow-hidden mb-3 ${img ? "bg-gray-100" : "bg-gray-200"}`}>
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-300 font-black tracking-widest text-xl">KA.SHA</span>
                    </div>
                  )}
                  {cust && (
                    <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />CUSTOM
                    </div>
                  )}
                  {!product.available && !cust && (
                    <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5">
                      SOLD OUT
                    </div>
                  )}
                </div>
                <h3 className="text-[13px] font-semibold text-black mb-0.5 group-hover:underline">{product.name}</h3>
                <p className="text-[12px] text-gray-500">{formatPrice(product.priceInPaise)}</p>
              </Link>
            );}) : (
              [1,2,3,4].map(i => (
                <div key={i} className="group block">
                  <div className="relative aspect-[3/4] bg-gray-200 mb-3 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded mb-1 animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ——— BRAND STORY ——— */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-4">OUR PHILOSOPHY</p>
              <h2 className="text-3xl md:text-4xl font-black text-black leading-tight mb-6">
                Where Performance<br />Meets Artistry
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                KA.SHA was born from a simple belief: that what you wear on the course should be as refined as your game. Each garment is crafted with precision performance fabrics and a keen eye for elevated design.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                We believe in conscious luxury — pieces that look exceptional, perform exceptionally, and are built to last. Nothing throwaway, nothing cheap.
              </p>
              <Link href="/heritage">
                <button className="text-[11px] font-bold tracking-[0.2em] text-black border-b-2 border-black pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors">
                  DISCOVER OUR STORY
                </button>
              </Link>
            </div>
            <div className="aspect-[4/5] bg-gray-100 overflow-hidden">
              <img
                src="/images/product-trousers.png"
                alt="KA.SHA craftsmanship"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ——— NEW ARRIVALS ——— */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-black">New Arrivals</h2>
              <p className="text-sm text-gray-500 mt-1">The latest from the KA.SHA studio</p>
            </div>
            <Link href="/products">
              <span className="text-[11px] font-bold tracking-[0.1em] text-gray-700 hover:text-black flex items-center gap-1 transition-colors">
                SEE ALL <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {newArrivals.length > 0 ? newArrivals.map(product => {
              const cust = getCustomization(product.id);
              const img = cust?.previewUrl || product.thumbnailUrl;
              return (
              <Link key={product.id} href={`/products/${product.id}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-300 font-black tracking-widest text-xl">KA.SHA</span>
                    </div>
                  )}
                  {cust ? (
                    <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />CUSTOM
                    </div>
                  ) : (
                    <div className="absolute top-2 left-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5">
                      NEW
                    </div>
                  )}
                </div>
                <h3 className="text-[13px] font-semibold text-black mb-0.5 group-hover:underline">{product.name}</h3>
                <p className="text-[12px] text-gray-500">{formatPrice(product.priceInPaise)}</p>
              </Link>
            );}) : (
              [1,2,3,4].map(i => (
                <div key={i} className="group block">
                  <div className="relative aspect-[3/4] bg-gray-200 mb-3 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded mb-1 animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ——— CUSTOMISE BANNER ——— */}
      <section className="py-16 bg-black">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Make It Yours.
            </h2>
            <p className="text-gray-400 max-w-md leading-relaxed">
              Use our Bespoke Studio to create a truly one-of-a-kind piece. Change colours, add prints, and upload your own designs or 3D models.
            </p>
          </div>
          <Link href="/products/1/customize">
            <button className="bg-white text-black text-[12px] font-bold tracking-[0.2em] px-10 py-4 hover:bg-gray-100 transition-colors whitespace-nowrap">
              OPEN BESPOKE STUDIO
            </button>
          </Link>
        </div>
      </section>

      {/* ——— NEWSLETTER ——— */}
      <section className="py-20 bg-[#3d4a33]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <p className="text-[10px] font-bold tracking-[0.3em] text-white/50 mb-3">STAY IN THE LOOP</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Join The Club</h2>
          <p className="text-white/70 mb-8 text-sm leading-relaxed">
            Get early access to new collections, exclusive drops, and insider styling tips direct to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-0 max-w-md mx-auto" onSubmit={e => e.preventDefault()}>
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 px-4 py-3 text-sm bg-white/10 border border-white/30 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60"
            />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold tracking-[0.2em] px-8 py-3 transition-colors"
            >
              SUBSCRIBE
            </button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-4">
            <input type="checkbox" id="consent" className="w-3 h-3" />
            <label htmlFor="consent" className="text-[10px] text-white/40">
              I agree to receive marketing communications from KA.SHA
            </label>
          </div>
        </div>
      </section>
    </Layout>
  );
}
