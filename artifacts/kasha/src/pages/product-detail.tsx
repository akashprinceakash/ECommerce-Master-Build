import { Layout } from "@/components/layout/Layout";
import { useGetProduct, getGetProductQueryKey, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProductViewer } from "@/components/3d/ProductViewer";
import { ArrowRight, ShoppingBag, Undo, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

export default function ProductDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { user } = useUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    addToCartMutation.mutate({ data: { productId: id, quantity: 1 } });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <Skeleton className="aspect-[3/4] lg:aspect-auto lg:h-[700px] w-full rounded-none bg-secondary" />
            <div className="space-y-8 py-8">
              <Skeleton className="h-10 w-2/3 bg-secondary" />
              <Skeleton className="h-6 w-1/4 bg-secondary" />
              <Skeleton className="h-24 w-full bg-secondary" />
              <Skeleton className="h-14 w-full bg-secondary" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center text-muted-foreground">
          <h2 className="text-2xl font-serif mb-4">Product not found</h2>
          <Link href="/products" className="text-primary hover:underline">Return to collection</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* 3D Viewer Left Side */}
          <div className="sticky top-24 aspect-[3/4] lg:aspect-auto lg:h-[700px] w-full">
            <ProductViewer color={product.defaultColor} thumbnailUrl={product.thumbnailUrl} />
          </div>

          {/* Product Details Right Side */}
          <div className="flex flex-col space-y-10 py-4 lg:py-12">
            <div>
              <p className="text-sm font-medium tracking-widest text-muted-foreground mb-3 uppercase">
                {product.category}
              </p>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-4">{product.name}</h1>
              <p className="text-xl text-muted-foreground">{formatPrice(product.priceInPaise)}</p>
            </div>

            <div className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
              <div className="flex gap-4">
                <span className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                  <ShieldCheck className="w-4 h-4" /> AUTHENTIC
                </span>
                <span className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                  <Undo className="w-4 h-4" /> 14-DAY RETURNS
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50 space-y-3">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-sm tracking-widest rounded-none flex items-center justify-between px-8 border-foreground/30 hover:border-primary"
                onClick={handleAddToCart}
                disabled={addToCartMutation.isPending}
              >
                <span>{addToCartMutation.isPending ? "ADDING..." : "ADD TO CART"}</span>
                <ShoppingBag className="w-4 h-4" />
              </Button>

              <div className="bg-secondary/30 p-8 text-center space-y-4">
                <h3 className="font-serif text-xl font-medium">Create Your Unique Piece</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Use our bespoke studio to customize color, modify features, and add personal touches to your garment.
                </p>
                <div className="pt-4">
                  <Link href={`/products/${product.id}/customize`}>
                    <Button size="lg" className="w-full h-14 text-sm tracking-widest rounded-none flex items-center justify-between px-8">
                      <span>ENTER BESPOKE STUDIO</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="details" className="border-border/50">
                <AccordionTrigger className="font-serif text-lg hover:no-underline hover:text-primary">
                  Details & Care
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Crafted with precision using premium materials. Dry clean only. Iron on low heat. 
                  Do not bleach. Store in a cool, dry place away from direct sunlight to preserve the color and texture.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="shipping" className="border-border/50">
                <AccordionTrigger className="font-serif text-lg hover:no-underline hover:text-primary">
                  Shipping & Returns
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Complimentary express shipping on all domestic orders. International shipping calculated at checkout. 
                  Returns are accepted within 14 days of delivery for unworn items in perfect condition with original tags attached.
                  Customized pieces are final sale.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </Layout>
  );
}
