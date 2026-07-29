import { Layout } from "@/components/layout/Layout";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Package, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssetUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@clerk/react";

declare global { interface Window { Razorpay?: any } }

const STATUS_LABEL: Record<string, string> = {
  pending:               "Pending",
  confirmed:             "Confirmed",
  processing:            "Processing",
  ready_to_ship:         "Ready to Ship",
  shipped:               "Shipped",
  delivered:             "Delivered",
  cancelled:             "Cancelled",
  payment_failed:        "Payment Failed",
  payment_discontinued:  "Payment Discontinued",
};

const STATUS_CLASS: Record<string, string> = {
  pending:               "text-amber-600",
  confirmed:             "text-blue-600",
  processing:            "text-sky-600",
  ready_to_ship:         "text-indigo-600",
  shipped:               "text-violet-600",
  delivered:             "text-emerald-600",
  cancelled:             "text-rose-500",
  payment_failed:        "text-red-600 font-semibold",
  payment_discontinued:  "text-slate-500",
};

export default function OrdersPage() {
  const { data: orders, isLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() }
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const [retrying, setRetrying] = useState<number | null>(null);

  const retryPayment = async (orderId: number) => {
    if (!window.Razorpay) {
      toast({ title: "Payment unavailable", description: "Razorpay failed to load. Please refresh and try again.", variant: "destructive" });
      return;
    }
    setRetrying(orderId);
    try {
      const token = await getToken();
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const retryRes = await fetch(`/api/payment/retry/${orderId}`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new Error(err?.error ?? `Server error ${retryRes.status}`);
      }
      const { orderId: rzpOrderId, amount, currency, keyId } = await retryRes.json();

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount,
          currency,
          order_id: rzpOrderId,
          name: "KA.SHA",
          description: "Retry payment for your order",
          theme: { color: "#000000" },
          handler: async (resp: any) => {
            try {
              const verifyRes = await fetch("/api/payment/verify", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                }),
              });
              if (!verifyRes.ok) {
                const err = await verifyRes.json().catch(() => ({}));
                throw new Error(err?.error ?? "Payment verification failed");
              }
              queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
              toast({ title: "Payment successful!", description: `Order #${orderId} confirmed.` });
              resolve();
            } catch (err: any) {
              toast({ title: "Payment verification failed", description: err.message ?? "Please contact support.", variant: "destructive" });
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              toast({ title: "Payment cancelled", description: "You closed the payment window.", variant: "destructive" });
              reject(new Error("dismissed"));
            },
          },
        });
        rzp.on("payment.failed", (resp: any) => {
          const errMsg = resp?.error?.description ?? "Your payment could not be processed. Please try again.";
          toast({ title: "Payment failed", description: errMsg, variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          reject(new Error(errMsg));
        });
        rzp.open();
      });
    } catch (e: any) {
      if (e?.message !== "dismissed") {
        toast({ title: "Retry failed", description: e?.message ?? "There was an error. Please try again.", variant: "destructive" });
      }
    } finally {
      setRetrying(null);
    }
  };

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
              <div
                key={order.id}
                className={`border bg-background hover:bg-secondary/5 transition-colors group ${
                  (order.status as string) === "payment_failed"
                    ? "border-red-300 bg-red-50/30"
                    : "border-border/50"
                }`}
              >
                {(order.status as string) === "payment_failed" && (
                  <div className="px-6 md:px-8 pt-4 pb-0 flex items-start gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Your payment was declined for this order. Click "Retry Payment" to complete it now.
                    </span>
                  </div>
                )}

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
                      <p className={`font-medium ${STATUS_CLASS[order.status] ?? "text-primary"}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Order Number</p>
                      <p className="font-mono text-muted-foreground">#{order.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col gap-2">
                    {(order.status as string) === "payment_failed" ? (
                      <Button
                        disabled={retrying === order.id}
                        onClick={() => retryPayment(order.id)}
                        className="w-full md:w-auto rounded-none text-xs tracking-wider h-10 px-5 bg-red-600 hover:bg-red-700 text-white gap-2"
                      >
                        {retrying === order.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                        Retry Payment
                      </Button>
                    ) : (
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" className="w-full md:w-auto rounded-none border-border/50 group-hover:border-primary/50 transition-colors">
                          View Details <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                    {order.items.map(item => (
                      <div key={item.id} className="w-16 h-20 bg-secondary flex-shrink-0 relative" title={item.product.name}>
                        {(() => {
                          const c = (item as any).customization;
                          const imgUrl = c?.previewImageUrl || c?.frontImageUrl
                            ? (c.previewImageUrl || c.frontImageUrl)
                            : getAssetUrl(item.product.thumbnailUrl || item.product.modelUrl);
                          return imgUrl ? (
                            <img src={imgUrl} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : null;
                        })()}
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
