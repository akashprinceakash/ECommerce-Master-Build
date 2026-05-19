import { Layout } from "@/components/layout/Layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssetUrl, getApiUrl } from "@/lib/api";
import { useAuth } from "@clerk/react";

/** GST rate for apparel (inclusive pricing): 5% ≤ ₹1000, 12% > ₹1000 */
function gstRate(priceInPaise: number) {
  return priceInPaise <= 100000 ? 0.05 : 0.12;
}
function calcGst(priceInPaise: number, qty: number) {
  const total = priceInPaise * qty;
  const rate = gstRate(priceInPaise);
  return total - Math.round(total / (1 + rate));
}

const STATUS_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];
const STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { getToken } = useAuth();

  const { data: order, isLoading, error } = useGetOrder(id, {
    query: { 
      enabled: !!id,
      queryKey: getGetOrderQueryKey(id)
    }
  });

  const handleDownloadInvoice = async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/orders/${id}/invoice`, { headers });
      if (!res.ok) throw new Error("Failed to fetch invoice");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KASHA-Invoice-${String(id).padStart(6, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Could not download invoice. Please try again.");
    }
  };

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

  const currentStep = STATUS_STEPS.indexOf(order.status);
  const itemsTotal = order.items.reduce((s, it) => s + it.priceInPaise * it.quantity, 0);
  const shippingCharge = (order as any).shippingChargeInPaise ?? 0;
  const totalGst = order.items.reduce((s, it) => s + calcGst(it.priceInPaise, it.quantity), 0);
  const subtotalExclGst = itemsTotal - totalGst;
  const isCompleted = order.status !== "pending" && order.status !== "cancelled";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-medium mb-2">Order #{String(order.id).padStart(6, "0")}</h1>
            <p className="text-muted-foreground text-sm">Placed on {formatDate(order.createdAt)}</p>
          </div>
          {isCompleted && (
            <Button
              variant="outline"
              className="rounded-none border-border/50 gap-2"
              onClick={handleDownloadInvoice}
            >
              <Download className="w-4 h-4" /> Download Invoice
            </Button>
          )}
        </div>

        {/* Order status tracker */}
        {order.status !== "cancelled" && (
          <div className="mb-10 bg-secondary/20 border border-border/50 p-6">
            <div className="flex items-center gap-0">
              {STATUS_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
                      idx <= currentStep
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border/40 text-muted-foreground"
                    }`}>
                      {idx < currentStep ? "✓" : idx + 1}
                    </div>
                    <span className={`text-[9px] uppercase tracking-wider text-center leading-tight ${idx <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 mx-1 ${idx < currentStep ? "bg-primary" : "bg-border/40"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {order.status === "cancelled" && (
          <div className="mb-10 bg-destructive/10 border border-destructive/30 px-6 py-4 text-sm text-destructive">
            This order was cancelled.
          </div>
        )}

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

            {/* Tracking */}
            {(order as any).trackingUrl && (
              <div className="border border-border/50 p-5 bg-secondary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-base font-medium">Shipment Tracking</h3>
                </div>
                {(order as any).shiprocketAwb && (
                  <p className="text-sm text-muted-foreground mb-2">AWB: <span className="font-medium text-foreground">{(order as any).shiprocketAwb}</span></p>
                )}
                <a
                  href={(order as any).trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Track your shipment →
                </a>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-secondary/20 p-6 border border-border/50">
              <h2 className="font-serif text-xl font-medium mb-5">Order Summary</h2>
              <div className="space-y-2.5 text-sm mb-5 border-b border-border/50 pb-5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal (excl. GST)</span>
                  <span>{formatPrice(subtotalExclGst)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>GST (5% / 12% incl.)</span>
                  <span>{formatPrice(totalGst)}</span>
                </div>
                {shippingCharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>{formatPrice(shippingCharge)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total (incl. GST)</span>
                <span className="font-medium">{formatPrice(order.totalInPaise)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">GSTIN: 07AJWPS2501D1Z6 · HSN: 61099010</p>
            </div>

            <div className="bg-secondary/20 p-6 border border-border/50">
              <h2 className="font-serif text-xl font-medium mb-5">Shipping Address</h2>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">{order.shippingName}</p>
                <p>{order.shippingAddress}</p>
                <p>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</p>
                <p className="pt-2">{order.shippingPhone}</p>
              </div>
            </div>

            {isCompleted && (
              <Button
                variant="outline"
                className="rounded-none w-full border-border/50 gap-2"
                onClick={handleDownloadInvoice}
              >
                <Download className="w-4 h-4" /> Download GST Invoice
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
