import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customizationsTable, userProfilesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import type { Request, Response } from "express";

const router: IRouter = Router();

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = typeof VALID_STATUSES[number];

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    if (role !== "admin" && !adminEmails.includes(primaryEmail ?? "")) {
      res.status(403).json({ error: "Forbidden" }); return null;
    }
    return userId;
  } catch { res.status(401).json({ error: "Unauthorized" }); return null; }
}

async function fetchUserMap(userIds: string[]) {
  const map: Record<string, { email: string; name: string }> = {};
  await Promise.all(userIds.map(async (uid) => {
    try {
      const u = await clerkClient.users.getUser(uid);
      const email = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? uid;
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || email;
      map[uid] = { email, name };
    } catch { map[uid] = { email: uid, name: uid }; }
  }));
  return map;
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
router.get("/admin/dashboard", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const [revenueRow] = await db
    .select({
      totalRevenueInPaise: sql<number>`coalesce(sum(total_in_paise), 0)::int`,
      totalOrders: sql<number>`count(*)::int`,
    })
    .from(ordersTable);

  const statusRows = await db
    .select({
      status: ordersTable.status,
      count: sql<number>`count(*)::int`,
      totalInPaise: sql<number>`coalesce(sum(total_in_paise), 0)::int`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.status);

  const [productCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(productsTable);

  const [designCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(customizationsTable);

  // distinct customer count
  const distinctCustomerRows = await db
    .selectDistinct({ userId: ordersTable.userId })
    .from(ordersTable);
  const customerCount = distinctCustomerRows.length;

  // total clerk users count (best-effort)
  let totalUsers = 0;
  try {
    const list = await clerkClient.users.getCount();
    totalUsers = typeof list === "number" ? list : 0;
  } catch { totalUsers = 0; }

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);
  const recentUserMap = await fetchUserMap([...new Set(recentOrders.map(o => o.userId))]);

  const statusBreakdown: Record<string, { count: number; totalInPaise: number }> = {};
  for (const s of VALID_STATUSES) statusBreakdown[s] = { count: 0, totalInPaise: 0 };
  for (const r of statusRows) {
    statusBreakdown[r.status] = { count: r.count, totalInPaise: r.totalInPaise };
  }

  res.json({
    totalRevenueInPaise: revenueRow?.totalRevenueInPaise ?? 0,
    totalOrders: revenueRow?.totalOrders ?? 0,
    totalProducts: productCount?.c ?? 0,
    totalDesigns: designCount?.c ?? 0,
    totalCustomers: customerCount,
    totalUsers,
    statusBreakdown,
    recentOrders: recentOrders.map(o => ({
      ...o,
      customerEmail: recentUserMap[o.userId]?.email ?? o.userId,
      customerName: recentUserMap[o.userId]?.name ?? o.userId,
    })),
  });
});

// ── ORDERS ───────────────────────────────────────────────────────────────────
router.get("/admin/orders", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const userMap = await fetchUserMap([...new Set(orders.map(o => o.userId))]);

  const ordersWithItems = await Promise.all(orders.map(async (o) => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
    const itemsDetailed = await Promise.all(items.map(async (it) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
      let customization = null;
      if (it.customizationId) {
        const [c] = await db.select().from(customizationsTable).where(eq(customizationsTable.id, it.customizationId));
        customization = c ?? null;
      }
      return { ...it, product, customization };
    }));
    return {
      ...o,
      items: itemsDetailed,
      customerEmail: userMap[o.userId]?.email ?? o.userId,
      customerName: userMap[o.userId]?.name ?? o.userId,
    };
  }));

  res.json(ordersWithItems);
});

router.patch("/admin/orders/:id/status", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { status } = req.body ?? {};
  if (!VALID_STATUSES.includes(status as OrderStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }); return;
  }
  const [updated] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(updated);
});

// ── USERS ────────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  let clerkUsers: any[] = [];
  try {
    const list = await clerkClient.users.getUserList({ limit: 200, orderBy: "-created_at" });
    clerkUsers = (list as any).data ?? list;
  } catch { clerkUsers = []; }

  // join with orders count
  const orderStats = await db
    .select({
      userId: ordersTable.userId,
      orderCount: sql<number>`count(*)::int`,
      totalSpentInPaise: sql<number>`coalesce(sum(total_in_paise), 0)::int`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.userId);
  const statsMap: Record<string, { orderCount: number; totalSpentInPaise: number }> = {};
  for (const s of orderStats) statsMap[s.userId] = { orderCount: s.orderCount, totalSpentInPaise: s.totalSpentInPaise };

  const profiles = await db.select().from(userProfilesTable);
  const profileMap: Record<string, typeof profiles[number]> = {};
  for (const p of profiles) profileMap[p.userId] = p;

  const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];

  const result = clerkUsers.map((u: any) => {
    const email = u.emailAddresses?.find?.((e: any) => e.id === u.primaryEmailAddressId)?.emailAddress ?? "";
    const role = u.publicMetadata?.role;
    const isAdmin = role === "admin" || adminEmails.includes(email);
    const stats = statsMap[u.id] ?? { orderCount: 0, totalSpentInPaise: 0 };
    const profile = profileMap[u.id];
    return {
      userId: u.id,
      email,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      imageUrl: u.imageUrl ?? null,
      createdAt: u.createdAt ?? null,
      lastSignInAt: u.lastSignInAt ?? null,
      isAdmin,
      role: role ?? null,
      adminViaEnv: !role && adminEmails.includes(email),
      orderCount: stats.orderCount,
      totalSpentInPaise: stats.totalSpentInPaise,
      profilePhone: profile?.phone ?? null,
      profileAddress: profile?.defaultShippingAddress ?? null,
    };
  });

  res.json(result);
});

router.patch("/admin/users/:id/admin", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const targetId = String(req.params.id);
  const { isAdmin } = req.body ?? {};
  if (typeof isAdmin !== "boolean") { res.status(400).json({ error: "isAdmin (boolean) is required" }); return; }
  if (targetId === adminId && !isAdmin) {
    res.status(400).json({ error: "You cannot revoke your own admin access" }); return;
  }
  try {
    const target = await clerkClient.users.getUser(targetId);
    const meta = (target.publicMetadata as any) ?? {};
    if (isAdmin) meta.role = "admin"; else delete meta.role;
    await clerkClient.users.updateUserMetadata(targetId, { publicMetadata: meta });
    res.json({ success: true, userId: targetId, isAdmin });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to update user role" });
  }
});

router.delete("/admin/users/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const targetId = String(req.params.id);
  if (targetId === adminId) { res.status(400).json({ error: "You cannot delete your own account" }); return; }
  try {
    await clerkClient.users.deleteUser(targetId);
    // also clean up profile
    await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, targetId));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to delete user" });
  }
});

export default router;
