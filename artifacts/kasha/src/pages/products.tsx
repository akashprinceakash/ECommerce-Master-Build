import { Layout } from "@/components/layout/Layout";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { useCustomization } from "@/contexts/CustomizationContext";

export default function ProductsPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const category = searchParams.get("category") || undefined;
  const { getCustomization } = useCustomization();

  const { data: products, isLoading, error } = useListProducts(
    { category },
    { query: { queryKey: getListProductsQueryKey({ category }) } }
  );

  const filterLinks = [
    { label: "All", href: "/products", key: null },
    { label: "Clothing", href: "/products?category=clothing", key: "clothing" },
    { label: "Accessories", href: "/products?category=accessories", key: "accessories" },
    { label: "Bespoke", href: "/products?category=bespoke", key: "bespoke" },
  ];

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-gray-50 border-b border-gray-200 py-10 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mb-4">
            <Link href="/" className="hover:text-black transition-colors">HOME</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black">
              {category ? category.charAt(0).toUpperCase() + category.slice(1) : "All Products"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-black">
            {category ? category.charAt(0).toUpperCase() + category.slice(1) : "The Collection"}
          </h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        {/* Filter Bar */}
        <div className="flex items-center gap-0 mb-8 border-b border-gray-200">
          {filterLinks.map(f => (
            <Link
              key={f.label}
              href={f.href}
              className={`text-[12px] font-bold tracking-[0.1em] px-5 py-3 border-b-2 -mb-px transition-colors ${
                (f.key === null ? !category : category === f.key)
                  ? "border-black text-black"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="py-20 text-center text-gray-500">
            <p>Failed to load products. Please try again later.</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <p>No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {products?.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link href={`/products/${product.id}`} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
                    {(() => {
                      const cust = getCustomization(product.id);
                      const img = cust?.previewUrl || product.thumbnailUrl || product.modelUrl;
                      return img ? (
                        <img
                          src={img}
                          alt={product.name}
                          className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-300 font-black tracking-widest text-xl">KA.SHA</span>
                        </div>
                      );
                    })()}
                    {getCustomization(product.id) ? (
                      <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />CUSTOM
                      </div>
                    ) : !product.available ? (
                      <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold tracking-[0.1em] px-2 py-0.5">
                        SOLD OUT
                      </div>
                    ) : null}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-black mb-0.5 group-hover:underline">{product.name}</h3>
                  <p className="text-[12px] text-gray-500">{formatPrice(product.priceInPaise)}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ProductSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4] w-full rounded-none bg-gray-100" />
      <Skeleton className="h-4 w-2/3 bg-gray-100" />
      <Skeleton className="h-3 w-1/3 bg-gray-100" />
    </div>
  );
}
