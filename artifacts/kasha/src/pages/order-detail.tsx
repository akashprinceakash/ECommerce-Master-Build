import { Layout } from "@/components/layout/Layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssetUrl } from "@/lib/api";

export default function OrderDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");

  const { data: order, isLoading, error } = useGetOrder(id, {
    query: { 
      enabled: !!id,
      queryKey: getGetOrderQueryKey(id)
    }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <Skeleton className="h-8 w-1/4 mb-12 bg-secondary" />
          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2 space-y-6">
              <Skeleton className="h-40 w-full bg-secondary rounded-none" />
              <Skeleton className="h-40 w-full bg-secondary rounded-none" />
            </div>
            <Skeleton className="h-80 w-full bg-secondary rounded-none" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center text-muted-foreground">
          <h2 className="text-2xl font-serif mb-4">Order not found</h2>
          <Link href="/orders" className="text-primary hover:underline">Return to orders</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-medium mb-2">Order #{order.id.toString().padStart(6, '0')}</h1>
            <p className="text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
          </div>
          <div className="bg-secondary/30 px-4 py-2 border border-border/50 inline-flex items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">Status:</span>
            <span className="font-medium uppercase tracking-wider text-primary">{order.status}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12 items-start">
          {/* Items */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="font-serif text-xl font-medium border-b border-border/50 pb-4">Items</h2>
            <div className="space-y-6">
              {order.items.map(item => (
                <div key={item.id} className="flex gap-6 border border-border/50 p-4 bg-background">
                  <div className="w-24 aspect-[3/4] bg-secondary flex-shrink-0 relative">
                    {(item.product.thumbnailUrl || item.product.modelUrl) && (
                      <img 
                        src={getAssetUrl(item.product.thumbnailUrl || item.product.modelUrl)} 
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/products/${item.productId}`}>
                        <h3 className="font-serif text-lg font-medium hover:text-primary transition-colors">{item.product.name}</h3>
                      </Link>
                      <div className="space-y-1 text-sm text-muted-foreground mt-2">
                        <p>Size: {item.size}</p>
                        <p>Quantity: {item.quantity}</p>
                        {item.customization && (
                          <p className="text-primary italic mt-1">Bespoke Design: {item.customization.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="font-medium self-end">
                      {formatPrice(item.priceInPaise * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-secondary/20 p-6 border border-border/50">
              <h2 className="font-serif text-xl font-medium mb-6">Order Summary</h2>
              <div className="space-y-3 text-sm mb-6 border-b border-border/50 pb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.totalInPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>Complimentary</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-medium">{formatPrice(order.totalInPaise)}</span>
              </div>
            </div>

            <div className="bg-secondary/20 p-6 border border-border/50">
              <h2 className="font-serif text-xl font-medium mb-6">Shipping Address</h2>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">{order.shippingName}</p>
                <p>{order.shippingAddress}</p>
                <p>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</p>
                <p className="pt-2">{order.shippingPhone}</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button variant="outline" className="rounded-none w-full border-border/50">
                Download Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
