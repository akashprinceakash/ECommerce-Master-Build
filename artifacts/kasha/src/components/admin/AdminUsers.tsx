import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useUser } from "@clerk/react";
import { Loader2, ShieldCheck, ShieldOff, Trash2, Search } from "lucide-react";

interface AdminUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: number | null;
  lastSignInAt: number | null;
  isAdmin: boolean;
  role: string | null;
  adminViaEnv: boolean;
  orderCount: number;
  totalSpentInPaise: number;
  profilePhone: string | null;
}

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const setAdmin = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      apiFetch(`/api/admin/users/${userId}/admin`, { method: "PATCH", body: JSON.stringify({ isAdmin }) }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: vars.isAdmin ? "Admin granted" : "Admin revoked" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast({ title: "User deleted" });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q)
      || (u.firstName ?? "").toLowerCase().includes(q)
      || (u.lastName ?? "").toLowerCase().includes(q)
      || u.userId.toLowerCase().includes(q);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID…"
            className="w-full pl-10 pr-3 py-2 border border-border bg-background text-sm rounded-none focus:outline-none focus:border-primary"
          />
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} of {users.length}</div>
      </div>

      <div className="border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last Sign-in</th>
                <th className="text-right px-4 py-3">Orders</th>
                <th className="text-right px-4 py-3">Spent</th>
                <th className="text-center px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isSelf = u.userId === currentUser?.id;
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={u.userId} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.imageUrl ? (
                          <img src={u.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            {(u.email[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{fullName}{isSelf && <span className="text-xs text-primary ml-2">(you)</span>}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-4 py-3 text-right">{u.orderCount}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(u.totalSpentInPaise)}</td>
                    <td className="px-4 py-3 text-center">
                      {u.isAdmin ? (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-emerald-300 bg-emerald-50 text-emerald-700">
                          {u.adminViaEnv ? "Admin (env)" : "Admin"}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border text-muted-foreground">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.isAdmin ? (
                          <button
                            disabled={isSelf || u.adminViaEnv || setAdmin.isPending}
                            onClick={() => setAdmin.mutate({ userId: u.userId, isAdmin: false })}
                            title={u.adminViaEnv ? "Granted via ADMIN_EMAILS env var" : isSelf ? "Cannot revoke self" : "Revoke admin"}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-200"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            disabled={setAdmin.isPending}
                            onClick={() => setAdmin.mutate({ userId: u.userId, isAdmin: true })}
                            title="Grant admin"
                            className="p-2 hover:bg-emerald-50 hover:text-emerald-600 border border-transparent hover:border-emerald-200"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          disabled={isSelf || deleteUser.isPending}
                          onClick={() => setConfirmDelete(u)}
                          title={isSelf ? "Cannot delete self" : "Delete user"}
                          className="p-2 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-background border border-border max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete user?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete <span className="font-medium text-foreground">{confirmDelete.email}</span> from authentication and remove their profile. Their orders and designs will remain in the database for audit purposes. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-border hover:bg-muted">Cancel</button>
              <button
                onClick={() => deleteUser.mutate(confirmDelete.userId)}
                disabled={deleteUser.isPending}
                className="px-4 py-2 text-sm bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteUser.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
