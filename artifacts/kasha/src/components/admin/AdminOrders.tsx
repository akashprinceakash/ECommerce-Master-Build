import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight, MapPin, CreditCard, Package } from "lucide-react";

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
  createdAt: string;
  updatedAt: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    id: number;
    quantity: number;
    size: string;
    priceInPaise: number;
    product: { name: string; thumbnailUrl: string | null } | null;
    customization: { name: string } | null;
  }>;
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

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch("/api/admin/orders"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

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
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
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
                            <img src={it.product.thumbnailUrl} alt="" className="w-12 h-12 object-cover" />
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
                      <div className="text-xs font-mono break-all">Payment: {o.paymentId ?? "—"}</div>
                      {o.razorpayOrderId && <div className="text-xs font-mono break-all text-muted-foreground">Order: {o.razorpayOrderId}</div>}
                    </div>
                  </div>

                  {/* Status update */}
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
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
