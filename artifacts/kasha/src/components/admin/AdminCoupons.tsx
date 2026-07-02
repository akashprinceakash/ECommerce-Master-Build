import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { getApiUrl } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Check, Users, Tag, ChevronDown, ChevronUp } from "lucide-react";

async function getToken(): Promise<string | null> {
  try { const c = (window as any).Clerk; return c?.session ? c.session.getToken() : null; } catch { return null; }
}
async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts?.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

interface CouponRow {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minOrderPaise: number;
  maxUsages: number | null;
  maxUsagesPerUser: number;
  expiresAt: string | null;
  isActive: boolean;
  productIds: number[] | null;
  categoryRestriction: string | null;
  createdAt: string;
  usageCount: number;
}

interface UsageRow {
  id: number;
  couponId: number;
  userId: string;
  userEmail: string;
  orderId: number | null;
  usedAt: string;
}

const EMPTY_FORM = {
  code: "",
  type: "percentage" as "percentage" | "fixed",
  value: "",
  minOrderRupees: "",
  maxUsages: "",
  maxUsagesPerUser: "1",
  expiresAt: "",
  categoryRestriction: "",
  isActive: true,
};

function formatDiscount(coupon: CouponRow): string {
  return coupon.type === "percentage" ? `${coupon.value}%` : formatPrice(coupon.value);
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";
  const d = new Date(expiresAt);
  return d < new Date()
    ? `Expired ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminCoupons() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expandedUsages, setExpandedUsages] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: coupons = [], isLoading } = useQuery<CouponRow[]>({
    queryKey: ["admin-coupons"],
    queryFn: () => apiFetch("/api/admin/coupons"),
  });

  const { data: usages = [] } = useQuery<UsageRow[]>({
    queryKey: ["admin-coupon-usages", expandedUsages],
    queryFn: () => apiFetch(`/api/admin/coupons/${expandedUsages}/usages`),
    enabled: expandedUsages !== null,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const body = {
        code: data.code.toUpperCase().trim(),
        type: data.type,
        value: data.type === "percentage"
          ? parseInt(data.value, 10)
          : Math.round(parseFloat(data.value) * 100),
        minOrderPaise: data.minOrderRupees ? Math.round(parseFloat(data.minOrderRupees) * 100) : 0,
        maxUsages: data.maxUsages ? parseInt(data.maxUsages, 10) : null,
        maxUsagesPerUser: parseInt(data.maxUsagesPerUser, 10) || 1,
        expiresAt: data.expiresAt || null,
        categoryRestriction: data.categoryRestriction.trim() || null,
        isActive: data.isActive,
      };
      if (editingId) {
        return apiFetch(`/api/admin/coupons/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
      }
      return apiFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      resetForm();
      toast({ title: editingId ? "Coupon updated" : "Coupon created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/admin/coupons/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setDeleteConfirm(null);
      toast({ title: "Coupon deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(c: CouponRow) {
    setForm({
      code: c.code,
      type: c.type,
      value: c.type === "percentage" ? String(c.value) : String(c.value / 100),
      minOrderRupees: c.minOrderPaise ? String(c.minOrderPaise / 100) : "",
      maxUsages: c.maxUsages !== null ? String(c.maxUsages) : "",
      maxUsagesPerUser: String(c.maxUsagesPerUser),
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      categoryRestriction: c.categoryRestriction ?? "",
      isActive: c.isActive,
    });
    setEditingId(c.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { toast({ title: "Code is required", variant: "destructive" }); return; }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0) {
      toast({ title: "Enter a valid discount value", variant: "destructive" }); return;
    }
    if (form.type === "percentage" && Number(form.value) > 100) {
      toast({ title: "Percentage must be 1–100", variant: "destructive" }); return;
    }
    saveMutation.mutate(form);
  }

  const isExpired = (c: CouponRow) => !!c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Coupon Codes</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-none text-xs tracking-widest">
          <Plus className="w-4 h-4" /> CREATE COUPON
        </Button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div className="border border-border mb-8 p-6 bg-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold">{editingId ? "Edit Coupon" : "New Coupon"}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE20"
                className="rounded-none font-mono uppercase"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as "percentage" | "fixed", value: "" }))}
                className="h-10 px-3 border border-input bg-background text-sm rounded-none"
              >
                <option value="percentage">Percentage Off (%)</option>
                <option value="fixed">Fixed Amount Off (₹)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{form.type === "percentage" ? "Percentage (1–100) *" : "Discount Amount (₹) *"}</Label>
              <Input
                type="number"
                value={form.value}
                onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                placeholder={form.type === "percentage" ? "20" : "500"}
                min="1"
                max={form.type === "percentage" ? "100" : undefined}
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Min Order Value (₹)</Label>
              <Input
                type="number"
                value={form.minOrderRupees}
                onChange={e => setForm(p => ({ ...p, minOrderRupees: e.target.value }))}
                placeholder="2000"
                min="0"
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Max Total Usages</Label>
              <Input
                type="number"
                value={form.maxUsages}
                onChange={e => setForm(p => ({ ...p, maxUsages: e.target.value }))}
                placeholder="Unlimited"
                min="1"
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Max Per User</Label>
              <Input
                type="number"
                value={form.maxUsagesPerUser}
                onChange={e => setForm(p => ({ ...p, maxUsagesPerUser: e.target.value }))}
                placeholder="1"
                min="1"
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category Restriction</Label>
              <Input
                value={form.categoryRestriction}
                onChange={e => setForm(p => ({ ...p, categoryRestriction: e.target.value }))}
                placeholder="polo, trouser (optional)"
                className="rounded-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 justify-end">
              <Label>Active</Label>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                className={`flex items-center gap-2 h-10 px-4 border text-sm font-medium transition-colors rounded-none ${
                  form.isActive ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-input text-muted-foreground"
                }`}
              >
                {form.isActive ? <><Check className="w-4 h-4" /> Active</> : <>Inactive</>}
              </button>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-3 pt-2">
              <Button type="submit" disabled={saveMutation.isPending} className="rounded-none text-xs tracking-widest px-8">
                {saveMutation.isPending ? "Saving…" : editingId ? "UPDATE COUPON" : "CREATE COUPON"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} className="rounded-none text-xs tracking-widest">
                CANCEL
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Coupons Table ── */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : coupons.length === 0 ? (
        <div className="py-16 text-center">
          <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No coupon codes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">CODE</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">DISCOUNT</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">MIN ORDER</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">USAGES</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">EXPIRY</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-wider">STATUS</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map(c => (
                <>
                  <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold tracking-wider">{c.code}</td>
                    <td className="px-4 py-3 font-medium">{formatDiscount(c)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.minOrderPaise > 0 ? formatPrice(c.minOrderPaise) : "None"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setExpandedUsages(expandedUsages === c.id ? null : c.id)}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{c.usageCount}{c.maxUsages !== null ? ` / ${c.maxUsages}` : ""}</span>
                        {expandedUsages === c.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isExpired(c) ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatExpiry(c.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                        disabled={toggleMutation.isPending}
                        className={`text-xs px-2.5 py-1 font-semibold border transition-colors rounded-sm ${
                          c.isActive
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => startEdit(c)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirm === c.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMutation.mutate(c.id)}
                              disabled={deleteMutation.isPending}
                              className="text-[10px] px-2 py-1 bg-destructive text-destructive-foreground font-semibold rounded-sm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[10px] px-2 py-1 border text-muted-foreground rounded-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(c.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedUsages === c.id && (
                    <tr key={`usage-${c.id}`}>
                      <td colSpan={7} className="bg-muted/20 px-4 py-3 border-b border-border">
                        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">REDEMPTION HISTORY</p>
                        {usages.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No redemptions yet.</p>
                        ) : (
                          <div className="space-y-1 max-h-52 overflow-y-auto">
                            {usages.map(u => (
                              <div key={u.id} className="flex items-center justify-between text-xs text-muted-foreground bg-background border border-border px-3 py-2">
                                <span>{u.userEmail}</span>
                                <span>Order #{u.orderId ? String(u.orderId).padStart(6, "0") : "—"}</span>
                                <span>{new Date(u.usedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
