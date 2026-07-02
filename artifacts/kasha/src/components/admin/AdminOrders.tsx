import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { getAssetUrl, getApiUrl } from "@/lib/api";
import {
  Loader2, ChevronDown, ChevronRight, MapPin, CreditCard, Package,
  Eye, Download, X, Truck, RefreshCw, RotateCcw, CheckCircle2,
  Lock, Send, MessageSquare, AlertTriangle, Printer,
} from "lucide-react";
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
  remarks: string | null;
  paymentId: string | null;
  razorpayOrderId: string | null;
  razorpaySignature: string | null;
  shiprocketOrderId: string | null;
  shiprocketShipmentId: number | null;
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
      designSpec?: any;
      canvasData?: string | null;
      previewImageUrl?: string | null;
      frontImageUrl?: string | null;
      backImageUrl?: string | null;
      sideImageUrl?: string | null;
    } | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportOrdersCSV(orders: AdminOrder[], label: string) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const row = (...cells: (string | number | null | undefined)[]) => cells.map(esc).join(",");
  const rows: string[] = [];
  rows.push(row("Order #","Date","Status","Customer Name","Email","Phone","Remarks","Ship Address","City","State","Pincode","Product","Category","Size","Qty","Item Price (₹)","Order Total (₹)","Shipping Charge (₹)","Payment ID","Razorpay Order ID","Shiprocket Order #","AWB","Tracking URL"));
  for (const o of orders) {
    const date = new Date(o.createdAt).toLocaleDateString("en-IN");
    const total = (o.totalInPaise / 100).toFixed(2);
    const shipping = o.shippingChargeInPaise != null ? (o.shippingChargeInPaise / 100).toFixed(2) : "";
    if (o.items.length === 0) {
      rows.push(row(o.id, date, o.status, o.customerName, o.customerEmail, o.shippingPhone, o.remarks, o.shippingAddress, o.shippingCity, o.shippingState, o.shippingPostalCode, "", "", "", "", "", total, shipping, o.paymentId ?? "", o.razorpayOrderId ?? "", o.shiprocketOrderId ?? "", o.shiprocketAwb ?? "", o.trackingUrl ?? ""));
    } else {
      for (const it of o.items) {
        const itemPrice = ((it.priceInPaise * it.quantity) / 100).toFixed(2);
        rows.push(row(o.id, date, o.status, o.customerName, o.customerEmail, o.shippingPhone,  o.remarks,   o.shippingAddress, o.shippingCity, o.shippingState, o.shippingPostalCode, it.product?.name ?? "Unknown", it.product?.category ?? "", it.size, it.quantity, itemPrice, total, shipping, o.paymentId ?? "", o.razorpayOrderId ?? "", o.shiprocketOrderId ?? "", o.shiprocketAwb ?? "", o.trackingUrl ?? ""));
      }
    }
  }
  const csv = rows.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `kasha-orders-${label}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getAdminToken(): Promise<string | null> {
  const clerk = (window as any).Clerk;
  return clerk?.session ? await clerk.session.getToken() : null;
}

async function printShippingLabel(orderId: number) {
  try {
    const token = await getAdminToken();
    const res = await fetch(`/api/admin/orders/${orderId}/shipping-label`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || "Shipping label not available for this order."); return; }
    if (data.labelUrl) window.open(data.labelUrl, "_blank");
  } catch (e: any) { alert("Failed to fetch label: " + (e?.message ?? "Unknown error")); }
}

async function downloadInvoice(orderId: number) {
  try {
    const token = await getAdminToken();
    const res = await fetch(`/api/admin/orders/${orderId}/invoice`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error("Invoice not available");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `KASHA-Invoice-${String(orderId).padStart(6, "0")}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e: any) { alert("Invoice download failed: " + (e?.message ?? "Unknown error")); }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function renderCanvasJsonToPng(canvasJson: string, width = 2048, height = 2048): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const el = document.createElement("canvas"); el.width = width; el.height = height;
      const fc = new fabric.Canvas(el, { width, height, backgroundColor: "#ffffff" });
      fc.loadFromJSON(canvasJson, () => { fc.renderAll(); const url = fc.toDataURL({ format: "png", multiplier: 1 }); fc.dispose(); resolve(url); });
    } catch { resolve(null); }
  });
}

async function exportDesignAllSides(customization: NonNullable<AdminOrder["items"][number]["customization"]>, prefix: string): Promise<{ count: number; errors: string[] }> {
  let count = 0; const errors: string[] = [];

  // Download all saved view images
  const viewUrls: Array<{ url: string; filename: string }> = [
    { url: customization.frontImageUrl ?? "", filename: `${prefix}-front-view.png` },
    { url: customization.backImageUrl ?? "",  filename: `${prefix}-back-view.png` },
    { url: customization.sideImageUrl ?? "",  filename: `${prefix}-side-view.png` },
    { url: customization.previewImageUrl ?? "", filename: `${prefix}-3d-preview.png` },
  ];

  const token = await getAdminToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const downloadedUrls = new Set<string>();
  for (const { url, filename } of viewUrls) {
    if (!url || downloadedUrls.has(url)) continue;
    downloadedUrls.add(url);
    try {
      if (url.startsWith("data:")) {
        downloadDataUrl(url, filename); count++;
      } else {
        const proxyUrl = `${getApiUrl()}/api/admin/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        const res = await fetch(proxyUrl, { headers: authHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        downloadDataUrl(objectUrl, filename);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        count++;
      }
    } catch (e: any) { errors.push(`${filename}: ${e.message || e}`); }
  }

  // Also export canvas texture if no view images were saved
  if (count === 0 && customization.canvasData) {
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

// ── Status config ─────────────────────────────────────────────────────────────

const STATUSES = ["pending", "payment_failed", "confirmed", "processing", "ready_to_ship", "shipped", "delivered", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  pending:         "bg-amber-100 text-amber-800 border-amber-300",
  payment_failed:  "bg-red-100 text-red-800 border-red-400",
  confirmed:       "bg-blue-100 text-blue-800 border-blue-300",
  processing:      "bg-sky-100 text-sky-800 border-sky-300",
  ready_to_ship:   "bg-indigo-100 text-indigo-800 border-indigo-300",
  shipped:         "bg-violet-100 text-violet-800 border-violet-300",
  delivered:       "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled:       "bg-rose-100 text-rose-800 border-rose-300",
};
const STATUS_LABEL: Record<string, string> = {
  pending:         "Pending",
  payment_failed:  "Payment Failed",
  confirmed:       "Confirmed",
  processing:      "Processing",
  ready_to_ship:   "Ready to Ship",
  shipped:         "Shipped",
  delivered:       "Delivered",
  cancelled:       "Cancelled",
};

// ── Process Order panel ───────────────────────────────────────────────────────

type StepState = "done" | "active" | "locked";

function StepNumber({ n, state }: { n: number; state: StepState }) {
  if (state === "done") return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
  if (state === "locked") return <Lock className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 ml-0.5" />;
  return (
    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
      {n}
    </span>
  );
}

interface ProcessOrderPanelProps {
  order: AdminOrder;
  onConfirm: () => void;
  onSyncShiprocket: () => void;
  onRequestPickup: () => void;
  confirmPending: boolean;
  syncPending: boolean;
  pickupPending: boolean;
}

function ProcessOrderPanel({
  order, onConfirm, onSyncShiprocket, onRequestPickup,
  confirmPending, syncPending, pickupPending,
}: ProcessOrderPanelProps) {
  const s = order.status;
  const isPending      = s === "pending";
  const isCancelled    = s === "cancelled";
  const isConfirmed    = !isPending && !isCancelled;
  const hasShiprocket  = !!order.shiprocketOrderId;
  const hasAwb         = !!order.shiprocketAwb;          // AWB is the real gate for label + pickup
  const isDone         = s === "shipped" || s === "delivered";
  const isReadyOrBeyond = s === "ready_to_ship" || s === "shipped" || s === "delivered";

  // Derive a human-readable Shiprocket status label
  const srStatus = (() => {
    if (!hasShiprocket) return null;
    if (s === "delivered")     return { label: "Delivered",         colour: "text-emerald-700" };
    if (s === "shipped")       return { label: "Shipped",           colour: "text-violet-700"  };
    if (s === "ready_to_ship") return { label: "Pickup Scheduled",  colour: "text-indigo-700"  };
    if (hasAwb)                return { label: "AWB Assigned",      colour: "text-sky-700"     };
    return                            { label: "NEW",               colour: "text-amber-700"   };
  })();

  // Step states
  const step1State: StepState = isPending ? "active" : "done";
  const step2State: StepState = isPending ? "locked" : "active";
  const step3State: StepState = !isConfirmed ? "locked" : hasAwb ? "active" : "locked";
  const step4State: StepState = isDone ? "done" : (!hasAwb ? "locked" : "active");

  const AWB_HINT = 'Go to your Shiprocket dashboard \u2192 click "Ship Now" on this order to generate an AWB, then come back here.';

  const steps = [
    {
      n: 1, state: step1State,
      title: "Confirm Order",
      desc: step1State === "done" ? "Order confirmed" : "Verify payment and confirm the order",
      action: step1State === "active" ? (
        <button
          disabled={confirmPending}
          onClick={onConfirm}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
        >
          {confirmPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Confirm Order
        </button>
      ) : null,
    },
    {
      n: 2, state: step2State,
      title: "Print Invoice",
      desc: "Download the tax invoice PDF",
      action: step2State === "active" ? (
        <button
          onClick={() => downloadInvoice(order.id)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
        >
          <Download className="w-3 h-3" />
          Print Invoice
        </button>
      ) : null,
    },
    {
      n: 3, state: step3State,
      title: "Print Shipping Label",
      desc: hasAwb
        ? `AWB: ${order.shiprocketAwb}`
        : isConfirmed && !hasShiprocket
          ? "Sync to Shiprocket first (step above)"
          : isConfirmed
            ? AWB_HINT
            : "Confirm order first",
      action: hasAwb ? (
        <button
          onClick={() => printShippingLabel(order.id)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
        >
          <Truck className="w-3 h-3" />
          Print Label
        </button>
      ) : isConfirmed && !hasShiprocket ? (
        <button
          disabled={syncPending}
          onClick={onSyncShiprocket}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
        >
          {syncPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sync to Shiprocket
        </button>
      ) : null,
    },
    {
      n: 4, state: step4State,
      title: "Request Pickup",
      desc: isDone
        ? `${STATUS_LABEL[s] ?? s} — status updates automatically via webhooks`
        : isReadyOrBeyond
          ? "Pickup already scheduled"
          : hasAwb
            ? "Request courier pickup from Shiprocket"
            : isConfirmed
              ? AWB_HINT
              : "Confirm order first",
      action: !isDone && !isReadyOrBeyond && hasAwb ? (
        <button
          disabled={pickupPending}
          onClick={onRequestPickup}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition"
        >
          {pickupPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Request Pickup
        </button>
      ) : null,
    },
  ];

  return (
    <div className="border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Process Order</span>
        <span className="text-[10px] text-muted-foreground/60">Status updates automatically via Shiprocket webhooks</span>
      </div>

      {/* Shiprocket status bar */}
      {hasShiprocket && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-white border border-border/60 text-[11px]">
          <span className="text-muted-foreground">Shiprocket Order</span>
          <span className="font-mono font-semibold">#{order.shiprocketOrderId}</span>
          {srStatus && (
            <>
              <span className="text-muted-foreground">·  Status</span>
              <span className={`font-semibold ${srStatus.colour}`}>{srStatus.label}</span>
            </>
          )}
          {hasAwb ? (
            <>
              <span className="text-muted-foreground">·  AWB</span>
              <span className="font-mono font-semibold text-emerald-700">{order.shiprocketAwb}</span>
            </>
          ) : (
            <span className="text-amber-700 font-medium">·  No AWB yet — click "Ship Now" in the Shiprocket dashboard to generate one</span>
          )}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline ml-auto">
              Track →
            </a>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className={`p-3 border flex flex-col gap-2 ${
              step.state === "done"
                ? "border-emerald-200 bg-emerald-50/50"
                : step.state === "active"
                  ? "border-primary/30 bg-white"
                  : "border-border/50 bg-muted/20 opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              <StepNumber n={step.n} state={step.state} />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                step.state === "done" ? "text-emerald-700" : step.state === "active" ? "text-foreground" : "text-muted-foreground"
              }`}>
                {step.title}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
            {step.action && <div className="mt-auto pt-1">{step.action}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Refund Modal ───────────────────────────────────────────────────────────────

interface Refund {
  id: number;
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountInPaise: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

const REFUNDABLE_STATUSES = ["confirmed", "processing", "ready_to_ship", "shipped", "delivered"];

interface RefundModalProps {
  order: AdminOrder;
  onClose: () => void;
  onSuccess: () => void;
}

function RefundModal({ order, onClose, onSuccess }: RefundModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [amountRupees, setAmountRupees] = useState((order.totalInPaise / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  const canRefund = REFUNDABLE_STATUSES.includes(order.status) && !!order.paymentId;

  const { data: existingRefunds = [], isLoading: loadingRefunds } = useQuery<Refund[]>({
    queryKey: ["admin-refunds", order.id],
    queryFn: () => apiFetch(`/api/admin/orders/${order.id}/refunds`),
  });

  const hasRefund = existingRefunds.length > 0;

  const handleSubmit = async () => {
    const paise = Math.round(parseFloat(amountRupees) * 100);
    if (isNaN(paise) || paise <= 0 || paise > order.totalInPaise) {
      toast({ title: "Invalid amount", description: `Enter an amount between ₹0.01 and ${formatPrice(order.totalInPaise)}`, variant: "destructive" }); return;
    }
    if (!confirm(`Issue refund of ₹${(paise / 100).toFixed(2)} to ${order.customerName}?${reason ? `\nReason: ${reason}` : ""}\n\nThis cannot be undone.`)) return;
    setSubmitting(true);
    try {
      const result = await apiFetch(`/api/admin/orders/${order.id}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount: paise, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      });
      toast({ title: "Refund initiated", description: `Refund ID: ${result.refundId} · ${formatPrice(result.amount)} · ${result.status}` });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Refund failed", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white w-full max-w-md border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Issue Refund</div>
            <div className="font-mono font-bold text-lg">Order #{order.id}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Eligibility banner */}
          {!canRefund && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-[11px] uppercase tracking-wide mb-0.5">Not Eligible for Refund</div>
                {!order.paymentId
                  ? "This order has no recorded payment (COD or payment not yet completed)."
                  : `Orders in "${STATUS_LABEL[order.status] ?? order.status}" status cannot be refunded. Eligible statuses: Confirmed, Processing, Ready to Ship, Shipped, Delivered.`}
              </div>
            </div>
          )}

          {/* Existing refund history */}
          {loadingRefunds ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading refund history…</div>
          ) : hasRefund ? (
            <div className="p-3 bg-rose-50 border border-rose-200">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-rose-700 mb-2">Existing Refunds</div>
              {existingRefunds.map(r => (
                <div key={r.id} className="text-xs space-y-0.5 pb-2 mb-2 border-b border-rose-100 last:border-0 last:mb-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-rose-800">{r.razorpayRefundId}</span>
                    <span className="font-semibold">{formatPrice(r.amountInPaise)}</span>
                  </div>
                  <div className="text-muted-foreground">Status: {r.status} · {new Date(r.createdAt).toLocaleDateString()}</div>
                  {r.reason && <div className="text-muted-foreground italic">Reason: {r.reason}</div>}
                </div>
              ))}
              <div className="mt-2 text-xs text-rose-700 font-medium">A refund has already been issued. Issuing another may be rejected by Razorpay.</div>
            </div>
          ) : null}

          {/* Refund form */}
          {canRefund && !hasRefund && (
            <>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Refund Amount (Max: {formatPrice(order.totalInPaise)})
                </label>
                <div className="flex items-center border border-border focus-within:border-primary">
                  <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border bg-muted/30">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(order.totalInPaise / 100).toFixed(2)}
                    value={amountRupees}
                    onChange={e => setAmountRupees(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                  />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => setAmountRupees((order.totalInPaise / 100).toFixed(2))}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border hover:border-primary transition"
                  >
                    Full refund
                  </button>
                  <button
                    onClick={() => setAmountRupees(((order.totalInPaise / 100) / 2).toFixed(2))}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border hover:border-primary transition"
                  >
                    50%
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Reason <span className="normal-case text-muted-foreground/70">(optional — sent to customer)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Item out of stock, quality issue, customer request…"
                  className="w-full px-3 py-2 text-sm border border-border focus:border-primary outline-none resize-none bg-transparent"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 text-sm border border-border hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="flex-1 py-2 text-sm bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Issue Refund
                </button>
              </div>
            </>
          )}

          {/* View-only if refund already exists */}
          {(canRefund && hasRefund) && (
            <button
              onClick={onClose}
              className="w-full py-2 text-sm border border-border hover:bg-muted transition"
            >
              Close
            </button>
          )}

          {/* Not eligible — close only */}
          {!canRefund && (
            <button
              onClick={onClose}
              className="w-full py-2 text-sm border border-border hover:bg-muted transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Design Spec helpers ────────────────────────────────────────────────────────

function swatch(hex: string | null | undefined) {
  if (!hex) return null;
  return (
    <span className="inline-block w-3 h-3 border border-border align-middle ml-1" style={{ background: hex }} />
  );
}

interface DesignSpec {
  baseColor?: string | null;
  zoneColors?: Record<string, string> | null;
  kashaDesignId?: string | null;
  kashaDesignLabel?: string | null;
  printId?: string | null;
  printLabel?: string | null;
  printCustomerLabel?: string | null;
  patColorA?: string | null;
  patColorB?: string | null;
  hasLogo?: boolean | null;
  logoUrl?: string | null;
  logoPosition?: string | null;
  logoSize?: number | null;
  textContent?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  textColor?: string | null;
  textBold?: boolean | null;
  textItalic?: boolean | null;
  sleeveLength?: string | null;
}

const ZONE_DISPLAY: Record<string, string> = {
  collar: "Collar",
  front: "Front Body",
  back: "Back Body",
  leftSleeve: "Left Sleeve",
  rightSleeve: "Right Sleeve",
};

function deriveSpecFromCanvasData(canvasData: string | null | undefined): DesignSpec | null {
  if (!canvasData) return null;
  try {
    const cd = JSON.parse(canvasData);
    const spec: DesignSpec = {
      baseColor: cd.primaryColor ?? null,
      zoneColors: cd.zoneColors ?? null,
      kashaDesignId: cd.kdDesignId || null,
      kashaDesignLabel: null,
      printId: cd.activePrintId ?? cd.allOverPrintId ?? null,
      printLabel: null,
      patColorA: cd.patColorA ?? null,
      patColorB: cd.patColorB ?? null,
      sleeveLength: cd.sleeveLength ?? null,
    };
    const objects: any[] = cd.canvasJSON ? JSON.parse(cd.canvasJSON)?.objects ?? [] : [];
    const textObj = objects.find((o: any) => o.type === "i-text" || o.type === "text");
    if (textObj) {
      spec.textContent = textObj.text ?? null;
      spec.fontFamily = textObj.fontFamily ?? null;
      spec.fontSize = textObj.fontSize ?? null;
      spec.textColor = textObj.fill ?? null;
      spec.textBold = textObj.fontWeight === "700" || textObj.fontWeight === "bold";
      spec.textItalic = textObj.fontStyle === "italic";
    }
    return spec;
  } catch {
    return null;
  }
}

function DesignSpecCard({ spec, legacy = false }: { spec: DesignSpec; legacy?: boolean }) {
  const zones = spec.zoneColors ? Object.entries(spec.zoneColors).filter(([, v]) => !!v) : [];
  return (
    <div className="mb-3 p-3 bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-600">Manufacturing Spec</div>
        {legacy && (
          <span className="text-[9px] uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
            Auto-derived from canvas — run backfill for full data
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {spec.sleeveLength && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sleeve</span>
            <span className="font-semibold capitalize">{spec.sleeveLength}</span>
          </div>
        )}
        {spec.baseColor && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Base colour</span>
            <span className="font-mono font-semibold flex items-center">{spec.baseColor}{swatch(spec.baseColor)}</span>
          </div>
        )}
        {zones.map(([zone, color]) => (
          <div key={zone} className="flex justify-between items-center">
            <span className="text-muted-foreground">{ZONE_DISPLAY[zone] ?? zone}</span>
            <span className="font-mono font-semibold flex items-center">{color}{swatch(color)}</span>
          </div>
        ))}
        {spec.kashaDesignLabel && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">KA.SHA Design</span>
            <span className="font-semibold">{spec.kashaDesignLabel}</span>
          </div>
        )}
        {(spec.patColorA || spec.patColorB) && (
          <>
            {spec.patColorA && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pattern colour A</span>
                <span className="font-mono font-semibold flex items-center">{spec.patColorA}{swatch(spec.patColorA)}</span>
              </div>
            )}
            {spec.patColorB && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pattern colour B</span>
                <span className="font-mono font-semibold flex items-center">{spec.patColorB}{swatch(spec.patColorB)}</span>
              </div>
            )}
          </>
        )}
        {spec.printLabel && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Print</span>
            <span className="font-semibold">{spec.printCustomerLabel ?? spec.printLabel}</span>
          </div>
        )}
        {(spec.hasLogo || spec.logoPosition) && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Logo</span>
              <span className="font-semibold">Applied</span>
            </div>
            {spec.logoPosition && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Logo position</span>
                <span className="font-semibold capitalize">{spec.logoPosition.replace(/-/g, " ")}</span>
              </div>
            )}
            {spec.logoSize != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Logo size</span>
                <span className="font-semibold">{spec.logoSize}%</span>
              </div>
            )}
            {spec.logoUrl && (
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Logo URL</span>
                <a href={spec.logoUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-primary underline break-all">{spec.logoUrl}</a>
              </div>
            )}
          </>
        )}
        {spec.textContent && (
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">Text</span>
            <span className="font-semibold italic">
              &ldquo;{spec.textContent}&rdquo;
              {spec.fontFamily && <span className="font-normal not-italic text-muted-foreground ml-1">({spec.fontFamily}{spec.textBold ? ", Bold" : ""}{spec.textItalic ? ", Italic" : ""})</span>}
            </span>
          </div>
        )}
        {spec.textColor && spec.textContent && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Text colour</span>
            <span className="font-mono font-semibold flex items-center">{spec.textColor}{swatch(spec.textColor)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function he(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function colorCell(hex: string | null | undefined): string {
  if (!hex) return "";
  const safe = he(hex);
  return `${safe} <span style="display:inline-block;width:10px;height:10px;background:${safe};border:1px solid #ccc;vertical-align:middle"></span>`;
}

function printSpecSheet(order: AdminOrder) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const rows: string[] = [];
  for (const it of order.items) {
    const c = it.customization;
    const spec: DesignSpec | null = c?.designSpec
      ? (c.designSpec as DesignSpec)
      : deriveSpecFromCanvasData(c?.canvasData);
    const isLegacy = c && !c.designSpec && !!spec;
    const views: Array<{ label: string; url: string }> = [];
    const seen = new Set<string>();
    const tryAddView = (url: string | null | undefined, label: string) => {
      if (url && !seen.has(url)) { seen.add(url); views.push({ label, url }); }
    };
    tryAddView(c?.frontImageUrl, "Front");
    tryAddView(c?.backImageUrl, "Back");
    tryAddView(c?.sideImageUrl, "Side");
    tryAddView(c?.previewImageUrl, "3D Preview");

    const measurements: Array<[string, string]> = (it as any).measurements
      ? Object.entries((it as any).measurements as Record<string, string>)
      : [];

    const zoneRows = spec?.zoneColors
      ? Object.entries(spec.zoneColors).filter(([, v]) => !!v)
          .map(([z, color]) => `<tr><td>${he(ZONE_DISPLAY[z] ?? z)}</td><td style="font-family:monospace">${colorCell(color)}</td></tr>`)
          .join("")
      : "";

    const printName = spec?.printCustomerLabel ?? spec?.printLabel ?? "";

    rows.push(`
      <div class="item">
        <div class="item-header">
          <strong>${he(it.product?.name ?? "Unknown product")}</strong>
          <span>Size: ${he(it.size)} &middot; Qty: ${he(it.quantity)}</span>
        </div>
        ${c ? `<div class="design-name">Bespoke Design: ${he(c.name)}${isLegacy ? ' <em style="color:#b45309">(spec auto-derived)</em>' : ""}</div>` : ""}
        ${views.length > 0 ? `<div class="views">${views.map(v => `<div class="view-cell"><img src="${he(v.url)}" alt="${he(v.label)}" /><div>${he(v.label)}</div></div>`).join("")}</div>` : ""}
        ${measurements.length > 0 ? `<table class="spec-table" style="margin-bottom:8px"><thead><tr><th colspan="2">Q Club Measurements</th></tr></thead><tbody>${measurements.map(([k, v]) => `<tr><td>${he(k.replace(/([A-Z])/g, " $1").trim())}</td><td>${he(v)}</td></tr>`).join("")}</tbody></table>` : ""}
        ${spec ? `<table class="spec-table">
          <thead><tr><th colspan="2">Manufacturing Specification</th></tr></thead>
          <tbody>
            ${spec.sleeveLength ? `<tr><td>Sleeve</td><td style="text-transform:capitalize">${he(spec.sleeveLength)}</td></tr>` : ""}
            ${spec.baseColor ? `<tr><td>Base colour</td><td style="font-family:monospace">${colorCell(spec.baseColor)}</td></tr>` : ""}
            ${zoneRows}
            ${spec.kashaDesignLabel ? `<tr><td>KA.SHA Design</td><td>${he(spec.kashaDesignLabel)}</td></tr>` : ""}
            ${spec.patColorA ? `<tr><td>Pattern colour A</td><td style="font-family:monospace">${colorCell(spec.patColorA)}</td></tr>` : ""}
            ${spec.patColorB ? `<tr><td>Pattern colour B</td><td style="font-family:monospace">${colorCell(spec.patColorB)}</td></tr>` : ""}
            ${printName ? `<tr><td>Print</td><td>${he(printName)}</td></tr>` : ""}
            ${spec.hasLogo || spec.logoPosition ? `<tr><td>Logo</td><td>Applied${spec.logoPosition ? ` · position: ${he(spec.logoPosition.replace(/-/g, " "))}` : ""}${spec.logoSize != null ? ` · size: ${he(spec.logoSize)}%` : ""}</td></tr>` : ""}
            ${spec.logoUrl ? `<tr><td>Logo URL</td><td style="font-size:10px;word-break:break-all">${he(spec.logoUrl)}</td></tr>` : ""}
            ${spec.textContent ? `<tr><td>Text</td><td>&ldquo;${he(spec.textContent)}&rdquo;${spec.fontFamily ? ` &middot; ${he(spec.fontFamily)}${spec.textBold ? ", Bold" : ""}${spec.textItalic ? ", Italic" : ""}` : ""}</td></tr>` : ""}
            ${spec.textColor && spec.textContent ? `<tr><td>Text colour</td><td style="font-family:monospace">${colorCell(spec.textColor)}</td></tr>` : ""}
          </tbody>
        </table>` : `<p style="font-size:11px;color:#999;font-style:italic">No manufacturing spec recorded for this item.</p>`}
      </div>
    `);
  }

  const html = [
    `<!DOCTYPE html><html><head><meta charset="utf-8">`,
    `<title>KA.SHA Print Spec \u2014 Order #${he(order.id)}</title>`,
    `<style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1a1a18; padding: 32px; }
      h1 { font-size: 18px; font-weight: 700; letter-spacing: .05em; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 24px; }
      .customer { margin-bottom: 20px; padding: 12px; border: 1px solid #ddd; }
      .customer strong { display: block; margin-bottom: 4px; }
      .item { margin-bottom: 28px; padding-top: 16px; border-top: 1px solid #ccc; }
      .item-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
      .design-name { font-size: 11px; color: #555; margin-bottom: 10px; font-style: italic; }
      .views { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
      .view-cell { text-align: center; }
      .view-cell img { width: 120px; height: 120px; object-fit: contain; border: 1px solid #ddd; display: block; }
      .view-cell div { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; color: #888; }
      .spec-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
      .spec-table th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; border: 1px solid #ddd; }
      .spec-table td { padding: 5px 8px; border: 1px solid #eee; }
      .spec-table td:first-child { color: #666; width: 40%; }
      .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
      @media print { body { padding: 16px; } }
    </style></head><body>`,
    `<h1>KA.SHA \u2014 Print Specification</h1>`,
    `<div class="meta">Order #${he(order.id)} &middot; ${he(new Date(order.createdAt).toLocaleDateString("en-IN"))} &middot; Printed ${he(new Date().toLocaleString("en-IN"))}</div>`,
    `<div class="customer">`,
    `  <strong>${he(order.customerName)} &lt;${he(order.customerEmail)}&gt;</strong>`,
    `  ${he(order.shippingAddress)}, ${he(order.shippingCity)}, ${he(order.shippingState)} &mdash; ${he(order.shippingPostalCode)} &middot; ${he(order.shippingPhone)}`,
    order.remarks ? `  <br><em>Remarks: ${he(order.remarks)}</em>` : "",
    `</div>`,
    rows.join(""),
    `<div class="footer">KA.SHA &mdash; Internal Use Only</div>`,
    `<script>window.onload=function(){window.print();}<\/script>`,
    `</body></html>`,
  ].join("\n");

  w.document.write(html);
  w.document.close();
}

// ── Remarks callout ────────────────────────────────────────────────────────────
// Shown wherever an order has customer-entered remarks (measurements, gifting
// notes, delivery instructions, etc). Kept visually distinct (amber) so it
// can't be missed while processing the order.

function RemarksCallout({ remarks }: { remarks: string | null | undefined }) {
  if (!remarks) return null;
  return (
    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
      <div>
        <span className="font-semibold uppercase tracking-wide text-[10px] block mb-0.5">Customer Remarks</span>
        <span className="whitespace-pre-wrap">{remarks}</span>
      </div>
    </div>
  );
}
// ── Main component ─────────────────────────────────────────────────────────────

export function AdminOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("all");
  const [viewOrder, setViewOrder] = useState<AdminOrder | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [pickingUp, setPickingUp] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch("/api/admin/orders"),
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast({
        title: vars.status === "confirmed" ? "Order confirmed" : "Status updated",
        description: vars.status === "confirmed" ? "Shiprocket sync running in background — label will be available shortly." : undefined,
      });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const handleRefundSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  const syncShiprocket = async (orderId: number) => {
    setSyncing(orderId);
    try {
      const result = await apiFetch(`/api/admin/orders/${orderId}/sync-shiprocket`, { method: "POST" });
      if (result?.shiprocketOrderId) {
        toast({ title: "Synced to Shiprocket", description: `Order #${result.shiprocketOrderId} created${result.awb ? ` · AWB ${result.awb}` : ""}.` });
      } else {
        toast({ title: "Sync complete", description: "No order ID returned — check Shiprocket dashboard." });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast({ title: "Shiprocket sync failed", description: e.message, variant: "destructive" });
    } finally { setSyncing(null); }
  };

  const requestPickup = async (orderId: number) => {
    setPickingUp(orderId);
    try {
      const result = await apiFetch(`/api/admin/orders/${orderId}/request-pickup`, { method: "POST" });
      toast({ title: "Pickup requested", description: result.message ?? "Shiprocket will schedule a courier pickup." });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast({ title: "Pickup request failed", description: e.message, variant: "destructive" });
    } finally { setPickingUp(null); }
  };

  const toggle = (id: number) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

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
              className={`text-xs px-3 py-1.5 border uppercase tracking-wider transition ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
            >
              {STATUS_LABEL[s] ?? s} <span className="opacity-70 ml-1">({count})</span>
            </button>
          );
        })}
        <button
          onClick={() => exportOrdersCSV(filtered, filter)}
          disabled={filtered.length === 0}
          className="ml-auto flex items-center gap-1.5 text-xs px-4 py-1.5 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider transition"
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
              {/* Row header */}
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30" onClick={() => toggle(o.id)}>
                {expanded.has(o.id) ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                <div className="font-mono text-sm font-semibold">#{o.id}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {o.customerName}
                    {o.remarks && (
                      <MessageSquare className="w-3 h-3 text-amber-500 flex-shrink-0" aria-label="Has remarks" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{o.customerEmail}</div>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</div>
                <div className="text-sm font-semibold">{formatPrice(o.totalInPaise)}</div>
                <span className={`text-[10px] uppercase px-2 py-1 border ${STATUS_COLORS[o.status] ?? "border-border"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewOrder(o); }}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border hover:border-primary hover:bg-primary hover:text-primary-foreground transition flex items-center gap-1"
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
                          {it.product?.thumbnailUrl && <img src={getAssetUrl(it.product.thumbnailUrl)} alt="" className="w-12 h-12 object-cover" />}
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
                      <RemarksCallout remarks={o.remarks} />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2"><CreditCard className="w-3 h-3" /> Payment</div>
                      <div className="mb-2">
                        {o.razorpaySignature && o.paymentId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Payment Verified</span>
                        ) : o.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">❌ Payment Failed</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">⏳ Payment Pending</span>
                        )}
                      </div>
                      <div className="text-xs font-mono break-all">Payment ID: {o.paymentId ?? "—"}</div>
                      {o.razorpayOrderId && <div className="text-xs font-mono break-all text-muted-foreground">Razorpay Order: {o.razorpayOrderId}</div>}
                      {o.shiprocketOrderId && (
                        <div className="mt-2 text-xs text-emerald-700 font-mono">
                          Shiprocket #{o.shiprocketOrderId}{o.shiprocketAwb ? ` · AWB ${o.shiprocketAwb}` : ""}
                        </div>
                      )}
                      {o.trackingUrl && (
                        <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 block">Track shipment →</a>
                      )}
                    </div>
                  </div>

                  {/* ── Process Order panel ── */}
                  {o.status !== "cancelled" && (
                    <ProcessOrderPanel
                      order={o}
                      onConfirm={() => updateStatus.mutate({ id: o.id, status: "confirmed" })}
                      onSyncShiprocket={() => syncShiprocket(o.id)}
                      onRequestPickup={() => requestPickup(o.id)}
                      confirmPending={updateStatus.isPending && updateStatus.variables?.id === o.id}
                      syncPending={syncing === o.id}
                      pickupPending={pickingUp === o.id}
                    />
                  )}

                  {/* Refund + manual status override (secondary controls) */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                    <details className="group">
                      <summary className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition list-none flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                        Manual status override
                      </summary>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {STATUSES.map(s => (
                          <button
                            key={s}
                            disabled={o.status === s || updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: o.id, status: s })}
                            className={`text-[11px] uppercase px-3 py-1.5 border transition ${o.status === s ? `${STATUS_COLORS[s]} cursor-not-allowed` : "border-border hover:border-primary hover:bg-primary hover:text-primary-foreground"}`}
                          >
                            {STATUS_LABEL[s] ?? s}
                          </button>
                        ))}
                      </div>
                    </details>
                    {o.paymentId && o.status !== "cancelled" && (
                      <button
                        onClick={() => setRefundOrder(o)}
                        className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-rose-400 text-rose-600 hover:bg-rose-50 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
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

      {/* Full Order modal */}
      {viewOrder && (
        <FullOrderModal viewOrder={viewOrder} onClose={() => setViewOrder(null)}>
          <div className="sticky top-0 bg-white border-b border-border p-5 flex items-center justify-between z-10">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Full Order</div>
              <div id="full-order-title" className="text-xl font-bold font-mono">#{viewOrder.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase px-2 py-1 border ${STATUS_COLORS[viewOrder.status] ?? "border-border"}`}>
                {STATUS_LABEL[viewOrder.status] ?? viewOrder.status}
              </span>
              {viewOrder.status !== "pending" && (
                <button
                  onClick={() => downloadInvoice(viewOrder.id)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Print Invoice
                </button>
              )}
              {viewOrder.items.some(it => it.customization) && (
                <button
                  onClick={() => printSpecSheet(viewOrder)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-primary/40 text-primary hover:bg-primary/5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Spec Sheet
                </button>
              )}
              {viewOrder.shiprocketShipmentId && (
                <button
                  onClick={() => printShippingLabel(viewOrder.id)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Shipping Label
                </button>
              )}
              <button onClick={() => setViewOrder(null)} className="p-2 hover:bg-muted rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Process Order panel inside modal */}
            {viewOrder.status !== "cancelled" && (
              <ProcessOrderPanel
                order={viewOrder}
                onConfirm={() => { updateStatus.mutate({ id: viewOrder.id, status: "confirmed" }); setViewOrder({ ...viewOrder, status: "confirmed" }); }}
                onSyncShiprocket={() => syncShiprocket(viewOrder.id)}
                onRequestPickup={() => requestPickup(viewOrder.id)}
                confirmPending={updateStatus.isPending && updateStatus.variables?.id === viewOrder.id}
                syncPending={syncing === viewOrder.id}
                pickupPending={pickingUp === viewOrder.id}
              />
            )}

            {/* Customer + status */}
            <div className="grid md:grid-cols-3 gap-4 text-sm border-t border-border pt-5">
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total</div>
                <div className="text-base font-semibold">{formatPrice(viewOrder.totalInPaise)}</div>
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
                {viewOrder.razorpayOrderId && <div className="text-xs font-mono break-all text-muted-foreground">Razorpay Order: {viewOrder.razorpayOrderId}</div>}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Shiprocket</div>
                  {viewOrder.shiprocketOrderId ? (
                    <div className="text-xs font-mono text-emerald-700">
                      Order #{viewOrder.shiprocketOrderId}
                      {viewOrder.shiprocketAwb && <div>AWB: {viewOrder.shiprocketAwb}</div>}
                      {viewOrder.trackingUrl && <a href={viewOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline block mt-1">Track shipment →</a>}
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600">Not yet synced to Shiprocket</span>
                  )}
                </div>
              </div>
            </div>

            {/* Items with full design + export */}
            <div className="border-t border-border pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Package className="w-3 h-3" /> Items &amp; Designs</div>
              <div className="space-y-4">
                {viewOrder.items.map((it) => {
                  const c = it.customization;
                  return (
                    <div key={it.id} className="border border-border p-4 bg-muted/10">
                      <div className="flex-1 min-w-0">
                        {/* Product header */}
                        <div className="flex items-center gap-3 mb-3">
                          {(c?.previewImageUrl || it.product?.thumbnailUrl) && (
                            <div className="w-14 h-14 flex-shrink-0 bg-white border border-border overflow-hidden flex items-center justify-center">
                              {c?.previewImageUrl
                                ? <img src={c.previewImageUrl} alt="" className="w-full h-full object-cover" />
                                : <img src={getAssetUrl(it.product!.thumbnailUrl!)} alt="" className="w-full h-full object-cover" />}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{it.product?.name ?? "Unknown product"}</div>
                            {it.product?.category && (
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                                {it.product.category === "pattern" ? "Pattern T-Shirt" : "Fabric T-Shirt"}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Size <span className="font-semibold text-foreground">{it.size}</span> · Qty <span className="font-semibold text-foreground">{it.quantity}</span> · {formatPrice(it.priceInPaise * it.quantity)}
                            </div>
                          </div>
                        </div>

                        {/* Q Club measurements panel */}
                        {(it as any).measurements && Object.keys((it as any).measurements).length > 0 && (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-sm">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 mb-2">Q Club Measurements</div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                              {Object.entries((it as any).measurements as Record<string, string>).map(([key, val]) => (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                                  <span className="font-semibold text-foreground">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {c && (
                          <>
                            {/* Design meta */}
                            <div className="text-xs space-y-0.5 mb-3">
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

                            {/* All design views thumbnail strip */}
                            {(() => {
                              const views: Array<{ label: string; url: string }> = [];
                              const seen = new Set<string>();
                              const tryAdd = (url: string | null | undefined, label: string) => {
                                if (url && !seen.has(url)) { seen.add(url); views.push({ label, url }); }
                              };
                              tryAdd(c.frontImageUrl,   "Front");
                              tryAdd(c.backImageUrl,    "Back");
                              tryAdd(c.sideImageUrl,    "Side");
                              tryAdd(c.previewImageUrl, "3D Preview");
                              if (views.length === 0) return null;
                              return (
                                <div className="mb-3">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Design Views</div>
                                  <div className="flex flex-wrap gap-2">
                                    {views.map(({ label, url }) => (
                                      <div key={url} className="text-center">
                                        <div className="w-24 h-24 bg-white border border-border overflow-hidden flex items-center justify-center">
                                          <img src={url} alt={label} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Design Spec card — use stored spec or derive from canvasData for legacy records */}
                            {(() => {
                              const storedSpec = c.designSpec ? (c.designSpec as DesignSpec) : null;
                              const derivedSpec = !storedSpec ? deriveSpecFromCanvasData(c.canvasData) : null;
                              const spec = storedSpec ?? derivedSpec;
                              if (spec) return <DesignSpecCard spec={spec} legacy={!storedSpec} />;
                              return (
                                <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 text-[11px] text-muted-foreground italic">
                                  No manufacturing spec recorded for this design.
                                </div>
                              );
                            })()}
                          </>
                        )}

                        {/* Export button — always shown */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={exporting === it.id}
                            onClick={async () => {
                              setExporting(it.id);
                              const prefix = `kasha-order-${viewOrder.id}-item-${it.id}`;
                              if (c) {
                                const { count, errors } = await exportDesignAllSides(c, prefix);
                                setExporting(null);
                                if (count === 0) {
                                  toast({ title: "Nothing to export", description: errors.length ? `Export failed: ${errors.join("; ")}` : "This design has no preview or canvas data saved.", variant: "destructive" });
                                } else {
                                  toast({ title: `Exported ${count} file${count === 1 ? "" : "s"}`, description: errors.length ? `Some assets failed: ${errors.join("; ")}` : "PNG files downloaded." });
                                }
                              } else if (it.product?.thumbnailUrl) {
                                // Stock item — download the product thumbnail via proxy
                                try {
                                  const assetUrl = getAssetUrl(it.product.thumbnailUrl) ?? it.product.thumbnailUrl;
                                  const filename = `${prefix}-product-image.png`;
                                  const token = await getAdminToken();
                                  const proxyUrl = `${getApiUrl()}/api/admin/download-proxy?url=${encodeURIComponent(assetUrl)}&filename=${encodeURIComponent(filename)}`;
                                  const res = await fetch(proxyUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                  const blob = await res.blob();
                                  const objectUrl = URL.createObjectURL(blob);
                                  downloadDataUrl(objectUrl, filename);
                                  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                                  toast({ title: "Downloaded product image" });
                                } catch (e: any) {
                                  toast({ title: "Download failed", description: e?.message ?? "Could not download image", variant: "destructive" });
                                }
                                setExporting(null);
                              } else {
                                setExporting(null);
                                toast({ title: "No image available", description: "This product has no image on file.", variant: "destructive" });
                              }
                            }}
                            className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-primary bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
                          >
                            {exporting === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {c ? "Download All Design Views" : "Download Product Image"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Refund */}
            {viewOrder.paymentId && viewOrder.status !== "cancelled" && (
              <div className="border-t border-border pt-5 flex justify-end">
                <button
                  onClick={() => setRefundOrder(viewOrder)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-4 py-2 border border-rose-400 text-rose-600 hover:bg-rose-50 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Issue Refund
                </button>
              </div>
            )}
          </div>
        </FullOrderModal>
      )}

      {/* Refund modal */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

import { useEffect as _useEffect } from "react";
function FullOrderModal({ viewOrder, onClose, children }: { viewOrder: AdminOrder; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  _useEffect(() => {
    lastFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} aria-hidden={false}>
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="full-order-title" tabIndex={-1}
        className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
