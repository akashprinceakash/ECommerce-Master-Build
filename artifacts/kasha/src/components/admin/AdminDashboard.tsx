import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { Loader2, IndianRupee, ShoppingBag, Package, Users, Palette, TrendingUp } from "lucide-react";

interface DashboardStats {
  totalRevenueInPaise: number;
  totalOrders: number;
  totalProducts: number;
  totalDesigns: number;
  totalCustomers: number;
  totalUsers: number;
  statusBreakdown: Record<string, { count: number; totalInPaise: number }>;
  recentOrders: Array<{
    id: number;
    status: string;
    totalInPaise: number;
    createdAt: string;
    customerEmail: string;
    customerName: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  shipped: "bg-violet-100 text-violet-800 border-violet-300",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-rose-100 text-rose-800 border-rose-300",
};

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch("/api/admin/dashboard"),
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  const cards = [
    { label: "Revenue", value: formatPrice(stats.totalRevenueInPaise), icon: IndianRupee, color: "text-emerald-600 bg-emerald-50" },
    { label: "Orders", value: stats.totalOrders.toString(), icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
    { label: "Products", value: stats.totalProducts.toString(), icon: Package, color: "text-violet-600 bg-violet-50" },
    { label: "Designs", value: stats.totalDesigns.toString(), icon: Palette, color: "text-fuchsia-600 bg-fuchsia-50" },
    { label: "Customers", value: stats.totalCustomers.toString(), icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
    { label: "Users", value: stats.totalUsers.toString(), icon: Users, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(c => (
          <div key={c.label} className="border border-border bg-card p-5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="text-xl font-semibold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-4">Order Status Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(stats.statusBreakdown).map(([status, data]) => (
            <div key={status} className={`border px-4 py-3 ${STATUS_COLORS[status] ?? "border-border bg-muted/20"}`}>
              <p className="text-xs uppercase tracking-wider font-semibold">{status}</p>
              <p className="text-2xl font-bold mt-1">{data.count}</p>
              <p className="text-xs mt-1 opacity-80">{formatPrice(data.totalInPaise)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-4">Recent Orders</h3>
        {stats.recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2">Placed</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map(o => (
                  <tr key={o.id} className="border-b border-border/40">
                    <td className="py-3">#{o.id}</td>
                    <td className="py-3">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] uppercase px-2 py-1 border ${STATUS_COLORS[o.status] ?? "border-border"}`}>{o.status}</span>
                    </td>
                    <td className="py-3 text-right font-medium">{formatPrice(o.totalInPaise)}</td>
                    <td className="py-3 text-right text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
