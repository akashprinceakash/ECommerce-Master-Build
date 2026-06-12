import { Layout } from "@/components/layout/Layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Download, Package, CreditCard, Tag, Truck,
  Navigation, RotateCcw, XCircle, CheckCircle2, ShoppingBag, Clock, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssetUrl, getApiUrl } from "@/lib/api";
import { useAuth } from "@clerk/react";
import type { LucideIcon } from "lucide-react";

function gstRate(priceInPaise: number) {
  return priceInPaise < 250000 ? 0.05 : 0.18;
}
function calcGst(priceInPaise: number, qty: number) {
  const total = priceInPaise * qty;
  const rate = gstRate(priceInPaise);
  return total - Math.round(total / (1 + rate));
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:          { label: "Awaiting Payment",   cls: "border-amber-300 text-amber-700 bg-amber-50" },
  confirmed:        { label: "Order Confirmed",     cls: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  processing:       { label: "Processing",          cls: "border-blue-300 text-blue-700 bg-blue-50" },
  ready_to_ship:    { label: "Ready to Ship",       cls: "border-indigo-300 text-indigo-700 bg-indigo-50" },
  shipped:          { label: "Shipped",             cls: "border-indigo-300 text-indigo-700 bg-indigo-50" },
  in_transit:       { label: "In Transit",          cls: "border-indigo-400 text-indigo-700 bg-indigo-50" },
  out_for_delivery: { label: "Out for Delivery",    cls: "border-orange-300 text-orange-700 bg-orange-50" },
  delivered:        { label: "Delivered",           cls: "border-emerald-400 text-emerald-700 bg-emerald-50" },
  returned:         { label: "Returned",            cls: "border-rose-300 text-rose-700 bg-rose-50" },
  cancelled:        { label: "Cancelled",           cls: "border-rose-300 text-rose-700 bg-rose-50" },
};

const EVENT_ICON: Record<string, LucideIcon> = {
  order_placed:       ShoppingBag,
  payment_verified:   CreditCard,
  payment_confirmed:  CheckCircle2,
  shiprocket_created: Package,
  awb_assigned:       Tag,
  pickup_scheduled:   MapPin,
  picked_up:          Truck,
  in_transit:         Truck,
  out_for_delivery:   Navigation,
  delivered:          CheckCircle2,
  rto_initiated:      RotateCcw,
  returned:           RotateCcw,
  cancelled:          XCircle,
  status_updated:     Clock,
};

const EVENT_COLOR: Record<string, string> = {
  order_placed:       "text-slate-500 bg-slate-50 border-slate-200",
  payment_verified:   "text-emerald-600 bg-emerald-50 border-emerald-200",
  payment_confirmed:  "text-emerald-600 bg-emerald-50 border-emerald-200",
  shiprocket_created: "text-blue-600 bg-blue-50 border-blue-200",
  awb_assigned:       "text-blue-600 bg-blue-50 border-blue-200",
  pickup_scheduled:   "text-orange-500 bg-orange-50 border-orange-200",
  picked_up:          "text-orange-600 bg-orange-50 border-orange-200",
  in_transit:         "text-indigo-600 bg-indigo-50 border-indigo-200",
  out_for_delivery:   "text-indigo-700 bg-indigo-50 border-indigo-200",
  delivered:          "text-emerald-600 bg-emerald-50 border-emerald-200",
  rto_initiated:      "text-rose-500 bg-rose-50 border-rose-200",
  returned:           "text-rose-600 bg-rose-50 border-rose-200",
  cancelled:          "text-rose-600 bg-rose-50 border-rose-200",
  status_updated:     "text-slate-500 bg-slate-50 border-slate-200",
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { getToken } = useAuth();

  const { data: order, isLoading, error } = useGetOrder(id, {
    query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) }
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
    } catch {
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

  const isCompleted = order.status !== "pending" && order.status !== "cancelled";
  const itemsTotal = order.items.reduce((s, it) => s + it.priceInPaise * it.quantity, 0);
  const shippingCharge = (order as any).shippingChargeInPaise ?? 0;
  const totalGst = order.items.reduce((s, it) => s + calcGst(it.priceInPaise, it.quantity), 0);
  const subtotalExclGst = itemsTotal - totalGst;
  const events = order.events ?? [];
  const badge = STATUS_BADGE[order.status] ?? { label: order.status, cls: "border-border text-foreground" };

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
          <div className="flex items-center gap-3">
            <span className={`text-[11px] uppercase tracking-wider px-3 py-1.5 border ${badge.cls}`}>
              {badge.label}
            </span>
            {isCompleted && (
              <Button variant="outline" size="sm" className="rounded-none border-border/50 gap-2" onClick={handleDownloadInvoice}>
                <Download className="w-3.5 h-3.5" /> Invoice
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-2 space-y-8">
            {/* Order Timeline */}
            <div>
              <h2 className="font-serif text-xl font-medium border-b border-border/50 pb-4 mb-6">Order Timeline</h2>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 pl-2">
                  {order.status === "cancelled"
                    ? "This order was cancelled."
                    : "No tracking events yet. Updates will appear here automatically."}
                </div>
              ) : (
                <div className="relative">
                  {events.map((event, idx) => {
                    const Icon = EVENT_ICON[event.eventType] ?? Clock;
                    const colorCls = EVENT_COLOR[event.eventType] ?? EVENT_COLOR.status_updated;
                    const isLast = idx === events.length - 1;
                    return (
                      <div key={event.id} className="flex gap-4 relative">
                        {/* Vertical connector line */}
                        {!isLast && (
                          <div className="absolute left-[18px] top-10 bottom-0 w-px bg-border/40" />
                        )}
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center z-10 ${colorCls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {/* Content */}
                        <div className="pb-6 flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${isLast ? "text-foreground" : "text-foreground/80"}`}>
                              {event.title}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString("en-IN", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tracking link */}
              {(order as any).trackingUrl && (
                <div className="border border-border/50 p-4 bg-secondary/10 mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {(order as any).shiprocketAwb && <span className="font-medium text-foreground mr-1">AWB {(order as any).shiprocketAwb}</span>}
                    </span>
                  </div>
                  <a href={(order as any).trackingUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-2 flex-shrink-0">
                    Track Shipment →
                  </a>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <h2 className="font-serif text-xl font-medium border-b border-border/50 pb-4 mb-6">Items</h2>
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
          </div>

          {/* Sidebar */}
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
              <Button variant="outline" className="rounded-none w-full border-border/50 gap-2" onClick={handleDownloadInvoice}>
                <Download className="w-4 h-4" /> Download GST Invoice
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
