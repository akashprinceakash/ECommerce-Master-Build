import { Router, type IRouter } from "express";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customizationsTable, userProfilesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import type { Request, Response } from "express";
import { createShiprocketOrder, getShiprocketLabel, requestShiprocketPickup } from "../lib/shiprocket";
import { sendOrderConfirmation } from "../lib/email";
import { logger } from "../lib/logger";
import { generateInvoicePdf } from "../lib/invoice";

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
    .from(ordersTable)
    .where(inArray(ordersTable.status, ["confirmed", "shipped", "delivered"]));

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

// ── FULFILLMENT HELPER ───────────────────────────────────────────────────────
// Triggers Shiprocket order creation + confirmation email for a confirmed order.
// Returns { shiprocketOrderId, awb } on success, throws on failure.
async function triggerFulfillment(order: typeof ordersTable.$inferSelect, orderIdSuffix?: string): Promise<{ shiprocketOrderId: string | null; awb: string | null; errorMessage: string | null }> {
  // Load items with products
  const rawItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const itemsWithProducts = await Promise.all(
    rawItems.map(async (it) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
      return { ...it, product };
    }),
  );

  // Resolve customer email from Clerk
  let customerEmail = "";
  try {
    const clerkUser = await clerkClient.users.getUser(order.userId);
    customerEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
  } catch (err) {
    logger.warn({ userId: order.userId, err }, "Admin fulfillment: could not fetch Clerk user email");
  }

  const sr = await createShiprocketOrder({
    orderId: order.id,
    orderDate: order.createdAt,
    customerName: order.shippingName,
    customerEmail,
    customerPhone: order.shippingPhone,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    items: itemsWithProducts.map((it) => ({
      name: it.product?.name ?? "KA.SHA Product",
      sku: it.product?.sku ?? "KASHA-SKU",
      units: it.quantity,
      sellingPrice: Math.round((it.product?.priceInPaise ?? it.priceInPaise) / 100),
    })),
    totalInRupees: Math.round(order.totalInPaise / 100),
  }, orderIdSuffix);

  if (sr.shiprocketOrderId) {
    await db.update(ordersTable)
      .set({ shiprocketOrderId: sr.shiprocketOrderId, shiprocketAwb: sr.awb, trackingUrl: sr.trackingUrl })
      .where(eq(ordersTable.id, order.id));
    logger.info({ orderId: order.id, srOrderId: sr.shiprocketOrderId }, "Admin fulfillment: Shiprocket order created");
  } else {
    logger.warn({ orderId: order.id }, "Admin fulfillment: Shiprocket returned no order ID");
  }

  // Send confirmation email in background — don't let email failure block the response
  if (customerEmail) {
    void sendOrderConfirmation({
      orderNumber: order.id,
      customerName: order.shippingName,
      customerEmail,
      items: itemsWithProducts.map((it) => ({
        name: it.product?.name ?? "KA.SHA Product",
        size: it.size,
        quantity: it.quantity,
        priceInPaise: it.priceInPaise,
      })),
      totalInPaise: order.totalInPaise,
      shippingChargeInPaise: order.shippingChargeInPaise ?? 0,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingPhone: order.shippingPhone,
      awb: sr.awb,
      trackingUrl: sr.trackingUrl,
    }).catch((err) => logger.error({ orderId: order.id, err }, "Admin fulfillment: email send failed"));
  }

  return { shiprocketOrderId: sr.shiprocketOrderId, awb: sr.awb, errorMessage: sr.errorMessage };
}

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

  // When admin confirms an order that hasn't been synced to Shiprocket yet,
  // fire-and-forget the fulfillment (Shiprocket order creation + email)
  if (status === "confirmed" && !updated.shiprocketOrderId) {
    void triggerFulfillment(updated).catch((err) =>
      logger.error({ orderId: updated.id, err, errMsg: err instanceof Error ? err.message : String(err) }, "Auto-fulfillment on confirm failed"),
    );
  }

  res.json(updated);
});

// ── MANUAL SHIPROCKET SYNC ───────────────────────────────────────────────────
// Lets admin manually push any confirmed order to Shiprocket — runs synchronously
// so the admin gets immediate success/failure feedback rather than "queued".
router.post("/admin/orders/:id/sync-shiprocket", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "pending" || order.status === "cancelled") {
    res.status(400).json({ error: `Cannot sync a ${order.status} order to Shiprocket` }); return;
  }

  try {
    // If the order already has a Shiprocket ID this is a re-sync attempt.
    // Append a short timestamp suffix so Shiprocket doesn't reject it as a duplicate order_id.
    const suffix = order.shiprocketOrderId ? `R${Date.now().toString().slice(-6)}` : undefined;
    const result = await triggerFulfillment(order, suffix);
    if (result.shiprocketOrderId) {
      res.json({ success: true, shiprocketOrderId: result.shiprocketOrderId, awb: result.awb });
    } else {
      const detail = result.errorMessage ?? "Shiprocket returned no order ID — check the Shiprocket dashboard for validation errors.";
      res.status(502).json({ error: detail });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ orderId: id, err, errMsg: msg }, "Manual Shiprocket sync failed");
    res.status(502).json({ error: `Shiprocket sync failed: ${msg}` });
  }
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

router.post("/admin/orders/:id/refund", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (!order.paymentId) { res.status(400).json({ error: "No Razorpay payment ID on record for this order" }); return; }

  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) { res.status(500).json({ error: "Razorpay credentials not configured" }); return; }

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rzRes = await fetch(`https://api.razorpay.com/v1/payments/${order.paymentId}/refund`, {
    method: "POST",
    headers: { "Authorization": `Basic ${basicAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const rzData: any = await rzRes.json();
  if (!rzRes.ok) {
    res.status(rzRes.status).json({ error: rzData?.error?.description ?? "Refund failed" });
    return;
  }
  await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, id));
  res.json({ refundId: rzData.id, amount: rzData.amount, status: rzData.status });
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

// GET /admin/orders/:id/shipping-label — get Shiprocket printable label URL for an order
router.get("/admin/orders/:id/shipping-label", requireAuth, async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const orderId = parseInt(String(req.params.id), 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!order.shiprocketShipmentId) { res.status(404).json({ error: "No shipment ID on record — label unavailable" }); return; }

    const labelUrl = await getShiprocketLabel(order.shiprocketShipmentId);
    if (!labelUrl) { res.status(404).json({ error: "Failed to generate label from Shiprocket" }); return; }

    res.json({ labelUrl });
  } catch (e: any) {
    logger.error({ err: e }, "Admin shipping label generation failed");
    res.status(500).json({ error: "Failed to generate label" });
  }
});

// POST /admin/orders/:id/request-pickup — request Shiprocket courier pickup for a shipment
router.post("/admin/orders/:id/request-pickup", requireAuth, async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const orderId = parseInt(String(req.params.id), 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!order.shiprocketShipmentId) {
      res.status(400).json({ error: "No Shiprocket shipment ID — sync to Shiprocket first" }); return;
    }

    const result = await requestShiprocketPickup(order.shiprocketShipmentId);

    if (result.success) {
      // Update status to ready_to_ship if it can still progress
      const progressable = ["confirmed", "processing"].includes(order.status);
      if (progressable) {
        await db.update(ordersTable).set({ status: "ready_to_ship" }).where(eq(ordersTable.id, orderId));
      }
      logger.info({ orderId, shipmentId: order.shiprocketShipmentId }, "Pickup requested successfully");
      res.json({ success: true, message: result.message });
    } else {
      res.status(502).json({ error: result.message });
    }
  } catch (e: any) {
    logger.error({ err: e }, "Admin request-pickup failed");
    res.status(500).json({ error: "Failed to request pickup" });
  }
});

// GET /admin/orders/:id/invoice — download invoice PDF as admin (bypasses userId check)
router.get("/admin/orders/:id/invoice", requireAuth, async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const orderId = parseInt(String(req.params.id), 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const items = await db
      .select({ name: productsTable.name, quantity: orderItemsTable.quantity, priceInPaise: orderItemsTable.priceInPaise, size: orderItemsTable.size })
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .where(eq(orderItemsTable.orderId, orderId));

    let customerEmail = "";
    try {
      const clerkUser = await clerkClient.users.getUser(order.userId);
      customerEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
    } catch (_) { /* ignore */ }

    const pdf = await generateInvoicePdf({
      orderNumber: order.id,
      orderDate: order.createdAt,
      customerName: order.shippingName,
      customerEmail,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingPhone: order.shippingPhone,
      items: items.map(i => ({
        name: i.name ?? "KA.SHA Product",
        size: i.size ?? "",
        quantity: i.quantity,
        priceInPaise: i.priceInPaise,
      })),
      shippingChargeInPaise: order.shippingChargeInPaise ?? 0,
      totalInPaise: order.totalInPaise,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="KASHA-Invoice-${String(orderId).padStart(6, "0")}.pdf"`);
    res.send(pdf);
  } catch (e: any) {
    logger.error({ err: e }, "Admin invoice generation failed");
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

export default router;
