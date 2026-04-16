import { Layout } from "@/components/layout/Layout";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function ProductsPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const category = searchParams.get("category") || undefined;

  const { data: products, isLoading, error } = useListProducts(
    { category },
    { query: { queryKey: getListProductsQueryKey({ category }) } }
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-medium mb-4">
            {category ? `${category.charAt(0).toUpperCase() + category.slice(1)}` : "The Collection"}
          </h1>
          <div className="flex gap-6 text-sm">
            <Link href="/products" className={`hover:text-primary transition-colors ${!category ? 'text-primary font-medium border-b border-primary' : 'text-muted-foreground'}`}>All</Link>
            <Link href="/products?category=clothing" className={`hover:text-primary transition-colors ${category === 'clothing' ? 'text-primary font-medium border-b border-primary' : 'text-muted-foreground'}`}>Clothing</Link>
            <Link href="/products?category=accessories" className={`hover:text-primary transition-colors ${category === 'accessories' ? 'text-primary font-medium border-b border-primary' : 'text-muted-foreground'}`}>Accessories</Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>Failed to load products. Please try again later.</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products?.map((product, i) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <Link href={`/products/${product.id}`} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden bg-secondary/50 mb-4">
                    {product.thumbnailUrl || product.modelUrl ? (
                      <img 
                        src={product.thumbnailUrl || product.modelUrl} 
                        alt={product.name}
                        className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-serif italic bg-secondary">
                        KA.SHA
                      </div>
                    )}
                    {!product.available && (
                      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1 text-xs font-medium tracking-wider">
                        SOLD OUT
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors">{product.name}</h3>
                    <p className="text-muted-foreground text-sm">{formatPrice(product.priceInPaise)}</p>
                  </div>
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
    <div className="space-y-4">
      <Skeleton className="aspect-[3/4] w-full rounded-none bg-secondary" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3 bg-secondary" />
        <Skeleton className="h-4 w-1/3 bg-secondary" />
      </div>
    </div>
  );
}
