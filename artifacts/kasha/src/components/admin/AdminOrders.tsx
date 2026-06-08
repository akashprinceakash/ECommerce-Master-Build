import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { getAssetUrl } from "@/lib/api";
import { Loader2, ChevronDown, ChevronRight, MapPin, CreditCard, Package, Eye, Download, X, Truck, RefreshCw, RotateCcw } from "lucide-react";
import * as fabric from "fabric";

interface AdminOrder {
  id: number;
  userId: string;
  status: string;
  totalInPaise: number;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  paymentId: string | null;
  razorpayOrderId: string | null;
  razorpaySignature: string | null;
  shiprocketOrderId: string | null;
  shiprocketAwb: string | null;
  trackingUrl: string | null;
  shippingChargeInPaise: number | null;
  createdAt: string;
  updatedAt: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    id: number;
    quantity: number;
    size: string;
    priceInPaise: number;
    product: { name: string; thumbnailUrl: string | null; modelUrl?: string | null; category?: string | null } | null;
    customization: {
      id: number;
      name: string;
      color?: string | null;
      size?: string | null;
      partsEnabled?: any;
      canvasData?: string | null;
      previewImageUrl?: string | null;
    } | null;
  }>;
}

// Build and download a CSV of the given orders.
function exportOrdersCSV(orders: AdminOrder[], label: string) {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const row = (...cells: (string | number | null | undefined)[]) =>
    cells.map(esc).join(",");

  const rows: string[] = [];

  // Header
  rows.push(row(
    "Order #", "Date", "Status",
    "Customer Name", "Email", "Phone",
    "Ship Address", "City", "State", "Pincode",
    "Product", "Category", "Size", "Qty", "Item Price (₹)",
    "Order Total (₹)", "Shipping Charge (₹)",
    "Payment ID", "Razorpay Order ID",
    "Shiprocket Order #", "AWB", "Tracking URL",
  ));

  for (const o of orders) {
    const date = new Date(o.createdAt).toLocaleDateString("en-IN");
    const total = (o.totalInPaise / 100).toFixed(2);
    const shipping = o.shippingChargeInPaise != null ? (o.shippingChargeInPaise / 100).toFixed(2) : "";

    if (o.items.length === 0) {
      rows.push(row(
        o.id, date, o.status,
        o.customerName, o.customerEmail, o.shippingPhone,
        o.shippingAddress, o.shippingCity, o.shippingState, o.shippingPostalCode,
        "", "", "", "", "",
        total, shipping,
        o.paymentId ?? "", o.razorpayOrderId ?? "",
        o.shiprocketOrderId ?? "", o.shiprocketAwb ?? "", o.trackingUrl ?? "",
      ));
    } else {
      for (const it of o.items) {
        const itemPrice = ((it.priceInPaise * it.quantity) / 100).toFixed(2);
        rows.push(row(
          o.id, date, o.status,
          o.customerName, o.customerEmail, o.shippingPhone,
          o.shippingAddress, o.shippingCity, o.shippingState, o.shippingPostalCode,
          it.product?.name ?? "Unknown", it.product?.category ?? "",
          it.size, it.quantity, itemPrice,
          total, shipping,
          o.paymentId ?? "", o.razorpayOrderId ?? "",
          o.shiprocketOrderId ?? "", o.shiprocketAwb ?? "", o.trackingUrl ?? "",
        ));
      }
    }
  }

  const csv = rows.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kasha-orders-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Trigger a browser download of a data URL as a file.
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Render a fabric.js canvasJSON snapshot to a flat PNG dataURL using an offscreen canvas.
async function renderCanvasJsonToPng(canvasJson: string, width = 2048, height = 2048): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const el = document.createElement("canvas");
      el.width = width; el.height = height;
      const fc = new fabric.Canvas(el, { width, height, backgroundColor: "#ffffff" });
      fc.loadFromJSON(canvasJson, () => {
        fc.renderAll();
        const url = fc.toDataURL({ format: "png", multiplier: 1 });
        fc.dispose();
        resolve(url);
      });
    } catch { resolve(null); }
  });
}

// Export the full design as PNGs covering all sides.
// Outputs:
//   1. <prefix>-3d-preview.png   — the saved 3D mockup (if available)
//   2. <prefix>-design-texture.png — the flat fabric canvas (this single texture wraps
//      front, back, both sleeves and the collar of the model — i.e. ALL sides).
async function exportDesignAllSides(
  customization: NonNullable<AdminOrder["items"][number]["customization"]>,
  prefix: string,
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];
  if (customization.previewImageUrl) {
    try {
      const res = await fetch(customization.previewImageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, `${prefix}-3d-preview.png`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      count++;
    } catch (e: any) { errors.push(`preview: ${e.message || e}`); }
  }
  if (customization.canvasData) {
    try {
      const parsed = JSON.parse(customization.canvasData);
      const canvasJSON = parsed.canvasJSON || parsed;
      const json = typeof canvasJSON === "string" ? canvasJSON : JSON.stringify(canvasJSON);
      const png = await renderCanvasJsonToPng(json);
      if (png) { downloadDataUrl(png, `${prefix}-design-texture.png`); count++; }
      else errors.push("canvas: render returned null");
    } catch (e: any) { errors.push(`canvas: ${e.message || e}`); }
  }
  return { count, errors };
}

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  shipped: "bg-violet-100 text-violet-800 border-violet-300",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-rose-100 text-rose-800 border-rose-300",
};

export function AdminOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("all");
  const [viewOrder, setViewOrder] = useState<AdminOrder | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch("/api/admin/orders"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      if (vars.status === "confirmed") {
        toast({ title: "Order confirmed", description: "Shiprocket sync has been queued automatically." });
      } else {
        toast({ title: "Status updated" });
      }
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const [refunding, setRefunding] = useState<number | null>(null);
  const issueRefund = async (order: AdminOrder) => {
    if (!confirm(`Issue a full refund of ${formatPrice(order.totalInPaise)} to ${order.customerName}? This cannot be undone.`)) return;
    setRefunding(order.id);
    try {
      const result = await apiFetch(`/api/admin/orders/${order.id}/refund`, { method: "POST" });
      toast({
        title: "Refund issued",
        description: `Refund ID: ${result.refundId} · Amount: ${formatPrice(result.amount)} · Status: ${result.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast({ title: "Refund failed", description: e.message, variant: "destructive" });
    } finally {
      setRefunding(null);
    }
  };

  const [syncing, setSyncing] = useState<number | null>(null);
  const syncShiprocket = async (orderId: number) => {
    setSyncing(orderId);
    try {
      const result = await apiFetch(`/api/admin/orders/${orderId}/sync-shiprocket`, { method: "POST" });
      if (result?.shiprocketOrderId) {
        toast({
          title: "Synced to Shiprocket",
          description: `Order #${result.shiprocketOrderId} created${result.awb ? ` · AWB ${result.awb}` : ""}.`,
        });
      } else {
        toast({ title: "Sync complete", description: "No order ID returned — check Shiprocket dashboard." });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast({ title: "Shiprocket sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  };

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div>
      {/* Filter pills + CSV export */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(["all", ...STATUSES] as const).map(s => {
          const count = s === "all" ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 border uppercase tracking-wider transition ${
                filter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary"
              }`}
            >
              {s} <span className="opacity-70 ml-1">({count})</span>
            </button>
          );
        })}

        <button
          onClick={() => exportOrdersCSV(filtered, filter)}
          disabled={filtered.length === 0}
          className="ml-auto flex items-center gap-1.5 text-xs px-4 py-1.5 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider transition"
          title={`Export ${filtered.length} order${filtered.length === 1 ? "" : "s"} as CSV`}
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV ({filtered.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No orders to show.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="border border-border bg-card">
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30" onClick={() => toggle(o.id)}>
                {expanded.has(o.id) ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                <div className="font-mono text-sm font-semibold">#{o.id}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{o.customerName}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.customerEmail}</div>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm font-semibold">{formatPrice(o.totalInPaise)}</div>
                <span className={`text-[10px] uppercase px-2 py-1 border ${STATUS_COLORS[o.status] ?? "border-border"}`}>{o.status}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewOrder(o); }}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border hover:border-primary hover:bg-primary hover:text-primary-foreground transition flex items-center gap-1"
                  title="View full order details"
                >
                  <Eye className="w-3 h-3" /> View
                </button>
              </div>

              {expanded.has(o.id) && (
                <div className="border-t border-border p-5 space-y-5 bg-muted/10">
                  {/* Items */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2"><Package className="w-3 h-3" /> Items</div>
                    <div className="space-y-2">
                      {o.items.map(it => (
                        <div key={it.id} className="flex items-center gap-3 text-sm border border-border/50 p-2 bg-background">
                          {it.product?.thumbnailUrl && (
                            <img src={getAssetUrl(it.product.thumbnailUrl)} alt="" className="w-12 h-12 object-cover" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{it.product?.name ?? "Unknown product"}</div>
                            <div className="text-xs text-muted-foreground">
                              Size {it.size} · Qty {it.quantity}
                              {it.customization && <span className="ml-2 italic text-primary">Bespoke: {it.customization.name}</span>}
                            </div>
                          </div>
                          <div className="font-mono text-sm">{formatPrice(it.priceInPaise * it.quantity)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping & payment */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2"><MapPin className="w-3 h-3" /> Shipping</div>
                      <div className="font-medium">{o.shippingName}</div>
                      <div className="text-muted-foreground">{o.shippingAddress}</div>
                      <div className="text-muted-foreground">{o.shippingCity}, {o.shippingState} - {o.shippingPostalCode}</div>
                      <div className="text-muted-foreground">{o.shippingPhone}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2"><CreditCard className="w-3 h-3" /> Payment</div>
                      {/* Payment verification badge */}
                      <div className="mb-2">
                        {o.razorpaySignature && o.paymentId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✅ Payment Verified
                          </span>
                        ) : o.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                            ❌ Payment Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            ⏳ Payment Pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono break-all">Payment ID: {o.paymentId ?? "—"}</div>
                      {o.razorpayOrderId && <div className="text-xs font-mono break-all text-muted-foreground">Razorpay Order: {o.razorpayOrderId}</div>}
                    </div>
                  </div>

                  {/* Shiprocket status */}
                  <div className="flex flex-wrap items-center gap-3 py-2 border-t border-border/50 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground uppercase tracking-wider"><Truck className="w-3 h-3" /> Shiprocket:</span>
                    {o.shiprocketOrderId ? (
                      <span className="font-mono text-emerald-700">#{o.shiprocketOrderId}{o.shiprocketAwb ? ` · AWB ${o.shiprocketAwb}` : ""}</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Not synced</span>
                    )}
                    {!o.shiprocketOrderId && o.status !== "pending" && o.status !== "cancelled" && (
                      <button
                        disabled={syncing === o.id}
                        onClick={() => syncShiprocket(o.id)}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
                      >
                        {syncing === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Sync to Shiprocket
                      </button>
                    )}
                  </div>

                  {/* Status update + refund */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Update status:</span>
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        disabled={o.status === s || updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: o.id, status: s })}
                        className={`text-[11px] uppercase px-3 py-1.5 border transition ${
                          o.status === s
                            ? `${STATUS_COLORS[s]} cursor-not-allowed`
                            : "border-border hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    {o.paymentId && o.status !== "cancelled" && (
                      <button
                        disabled={refunding === o.id}
                        onClick={() => issueRefund(o)}
                        className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-rose-400 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                      >
                        {refunding === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Issue Refund
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View Full Order modal */}
      {viewOrder && (
        <FullOrderModal viewOrder={viewOrder} onClose={() => setViewOrder(null)}>
            <div className="sticky top-0 bg-white border-b border-border p-5 flex items-center justify-between z-10">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Full Order</div>
                <div id="full-order-title" className="text-xl font-bold font-mono">#{viewOrder.id}</div>
              </div>
              <button
                onClick={() => setViewOrder(null)}
                className="p-2 hover:bg-muted rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Customer + status */}
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Customer</div>
                  <div className="font-medium">{viewOrder.customerName}</div>
                  <div className="text-xs text-muted-foreground">{viewOrder.customerEmail}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Placed</div>
                  <div>{new Date(viewOrder.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                  <span className={`text-[10px] uppercase px-2 py-1 border ${STATUS_COLORS[viewOrder.status] ?? "border-border"}`}>
                    {viewOrder.status}
                  </span>
                </div>
              </div>

              {/* Shipping + payment */}
              <div className="grid md:grid-cols-2 gap-4 text-sm border-t border-border pt-5">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2"><MapPin className="w-3 h-3" /> Ship to</div>
                  <div className="font-medium">{viewOrder.shippingName}</div>
                  <div className="text-muted-foreground">{viewOrder.shippingAddress}</div>
                  <div className="text-muted-foreground">{viewOrder.shippingCity}, {viewOrder.shippingState} - {viewOrder.shippingPostalCode}</div>
                  <div className="text-muted-foreground">{viewOrder.shippingPhone}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2"><CreditCard className="w-3 h-3" /> Payment</div>
                  <div className="text-xs font-mono break-all">Payment: {viewOrder.paymentId ?? "—"}</div>
                  {viewOrder.razorpayOrderId && (
                    <div className="text-xs font-mono break-all text-muted-foreground">Razorpay Order: {viewOrder.razorpayOrderId}</div>
                  )}
                  <div className="text-base font-semibold mt-2">Total: {formatPrice(viewOrder.totalInPaise)}</div>
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Shiprocket</div>
                    {viewOrder.shiprocketOrderId ? (
                      <div className="text-xs font-mono text-emerald-700">
                        Order #{viewOrder.shiprocketOrderId}
                        {viewOrder.shiprocketAwb && <div>AWB: {viewOrder.shiprocketAwb}</div>}
                        {viewOrder.trackingUrl && (
                          <a href={viewOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline block mt-1">Track shipment →</a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600">Not synced</span>
                        {viewOrder.status !== "pending" && viewOrder.status !== "cancelled" && (
                          <button
                            disabled={syncing === viewOrder.id}
                            onClick={() => syncShiprocket(viewOrder.id)}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
                          >
                            {syncing === viewOrder.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Sync now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items with full design + export */}
              <div className="border-t border-border pt-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="w-3 h-3" /> Items &amp; Designs
                </div>
                <div className="space-y-4">
                  {viewOrder.items.map((it) => {
                    const c = it.customization;
                    return (
                      <div key={it.id} className="border border-border p-4 bg-muted/10">
                        <div className="flex items-start gap-4">
                          {/* Preview */}
                          <div className="w-32 h-32 flex-shrink-0 bg-white border border-border overflow-hidden flex items-center justify-center">
                            {c?.previewImageUrl ? (
                              <img src={c.previewImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : it.product?.thumbnailUrl ? (
                              <img src={getAssetUrl(it.product.thumbnailUrl)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-muted-foreground">No preview</span>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{it.product?.name ?? "Unknown product"}</div>
                            {it.product?.category && (
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                                {it.product.category === "pattern" ? "Pattern T-Shirt" : "Fabric T-Shirt"}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              Size <span className="font-semibold text-foreground">{it.size}</span> · Qty <span className="font-semibold text-foreground">{it.quantity}</span> · {formatPrice(it.priceInPaise * it.quantity)}
                            </div>
                            {c && (
                              <div className="mt-2 text-xs space-y-0.5">
                                <div><span className="text-muted-foreground">Bespoke design:</span> <span className="font-medium">{c.name}</span></div>
                                {c.color && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Body colour:</span>
                                    <span className="inline-block w-3 h-3 border border-border" style={{ background: c.color }} />
                                    <span className="font-mono">{c.color}</span>
                                  </div>
                                )}
                                {c.partsEnabled?.presetName && (
                                  <div><span className="text-muted-foreground">Pattern / preset:</span> <span className="font-mono">{c.partsEnabled.presetName}</span></div>
                                )}
                              </div>
                            )}

                            {/* Export buttons */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {c ? (
                                <button
                                  disabled={exporting === it.id}
                                  onClick={async () => {
                                    setExporting(it.id);
                                    const prefix = `kasha-order-${viewOrder.id}-item-${it.id}`;
                                    const { count, errors } = await exportDesignAllSides(c, prefix);
                                    setExporting(null);
                                    if (count === 0) {
                                      toast({
                                        title: "Nothing to export",
                                        description: errors.length ? `Export failed: ${errors.join("; ")}` : "This design has no preview or canvas data saved.",
                                        variant: "destructive",
                                      });
                                    } else {
                                      toast({
                                        title: `Exported ${count} file${count === 1 ? "" : "s"}`,
                                        description: errors.length
                                          ? `Some assets failed: ${errors.join("; ")}`
                                          : "PNG files downloaded covering all sides.",
                                      });
                                    }
                                  }}
                                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-primary bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
                                >
                                  {exporting === it.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3" />
                                  )}
                                  Export Design as PNG (all sides)
                                </button>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock item — no bespoke design</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
        </FullOrderModal>
      )}
    </div>
  );
}

// Accessible dialog wrapper — handles Escape, focus trap basics, ARIA roles,
// and click-outside-to-close. Body scroll is locked while the modal is open.
import { useRef as _useRef, useEffect as _useEffect } from "react";
function FullOrderModal({ viewOrder, onClose, children }: { viewOrder: AdminOrder; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = _useRef<HTMLDivElement>(null);
  const lastFocused = _useRef<HTMLElement | null>(null);

  _useEffect(() => {
    lastFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the dialog so keyboard users land in it
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-order-title"
        tabIndex={-1}
        className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
