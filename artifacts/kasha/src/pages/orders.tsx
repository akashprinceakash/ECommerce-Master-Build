import { Layout } from "@/components/layout/Layout";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  const { data: orders, isLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() }
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <h1 className="text-4xl font-serif font-medium mb-12">Order History</h1>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full bg-secondary rounded-none" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="py-20 text-center border border-border/50 bg-secondary/10">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-xl font-serif mb-6">You haven't placed any orders yet.</p>
            <Link href="/products">
              <Button className="rounded-none tracking-widest text-xs h-12 px-8">START SHOPPING</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="border border-border/50 bg-background hover:bg-secondary/5 transition-colors group">
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 flex-1 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Order Placed</p>
                      <p className="font-medium">{formatDate(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Total</p>
                      <p className="font-medium">{formatPrice(order.totalInPaise)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Status</p>
                      <p className="font-medium capitalize text-primary">{order.status}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Order Number</p>
                      <p className="font-mono text-muted-foreground">#{order.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="outline" className="w-full md:w-auto rounded-none border-border/50 group-hover:border-primary/50 transition-colors">
                        View Details <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
                
                <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                    {order.items.map(item => (
                      <div key={item.id} className="w-16 h-20 bg-secondary flex-shrink-0 relative" title={item.product.name}>
                        {(item.product.thumbnailUrl || item.product.modelUrl) && (
                          <img 
                            src={item.product.thumbnailUrl || item.product.modelUrl} 
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
