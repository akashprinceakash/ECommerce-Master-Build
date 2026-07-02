import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, couponsTable, couponUsagesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

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
  } catch {
    res.status(401).json({ error: "Unauthorized" }); return null;
  }
}

/* ──────────────────────────────────────────────────────
   Shared validation helper — used by validate endpoint and payment routes
────────────────────────────────────────────────────── */
export async function validateCoupon(
  code: string,
  userId: string,
  itemsTotalInPaise: number,
  cartProductIds: number[] = [],
  cartCategories: string[] = [],
): Promise<{ discountInPaise: number; couponId: number; coupon: typeof couponsTable.$inferSelect } | { error: string }> {
  const upperCode = code.toUpperCase().trim();
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, upperCode));

  if (!coupon) return { error: "Invalid coupon code" };
  if (!coupon.isActive) return { error: "This coupon is no longer active" };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: "This coupon has expired" };
  if (itemsTotalInPaise < coupon.minOrderPaise) {
    const minRupees = Math.round(coupon.minOrderPaise / 100);
    return { error: `Minimum order value of ₹${minRupees} required for this code` };
  }

  if (coupon.maxUsages !== null) {
    const [row] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(couponUsagesTable)
      .where(eq(couponUsagesTable.couponId, coupon.id));
    if ((row?.cnt ?? 0) >= coupon.maxUsages) {
      return { error: "This coupon has reached its total usage limit" };
    }
  }

  const [userRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(couponUsagesTable)
    .where(and(eq(couponUsagesTable.couponId, coupon.id), eq(couponUsagesTable.userId, userId)));
  if ((userRow?.cnt ?? 0) >= coupon.maxUsagesPerUser) {
    return { error: "You have already used this coupon the maximum number of times" };
  }

  if (coupon.categoryRestriction && cartCategories.length > 0) {
    if (!cartCategories.includes(coupon.categoryRestriction)) {
      return { error: `This coupon is only valid for ${coupon.categoryRestriction} products` };
    }
  }

  if (coupon.productIds && coupon.productIds.length > 0 && cartProductIds.length > 0) {
    const hasMatch = cartProductIds.some(id => coupon.productIds!.includes(id));
    if (!hasMatch) return { error: "This coupon is not valid for items in your cart" };
  }

  let discountInPaise: number;
  if (coupon.type === "percentage") {
    discountInPaise = Math.round(itemsTotalInPaise * coupon.value / 100);
  } else {
    discountInPaise = coupon.value;
  }
  discountInPaise = Math.min(discountInPaise, itemsTotalInPaise);

  return { discountInPaise, couponId: coupon.id, coupon };
}

/* ──────────────────────────────────────────────────────
   POST /coupons/validate — authenticated, user-facing
────────────────────────────────────────────────────── */
router.post("/coupons/validate", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { code, cartTotal, productIds, categories } = req.body ?? {};

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ valid: false, message: "Please enter a coupon code" }); return;
  }
  const parsedTotal = parseInt(String(cartTotal ?? "0"), 10);
  if (!parsedTotal || parsedTotal <= 0) {
    res.status(400).json({ valid: false, message: "Invalid cart total" }); return;
  }

  const result = await validateCoupon(
    code,
    userId,
    parsedTotal,
    Array.isArray(productIds) ? productIds : [],
    Array.isArray(categories) ? categories : [],
  );

  if ("error" in result) {
    res.json({ valid: false, message: result.error }); return;
  }

  res.json({
    valid: true,
    discountInPaise: result.discountInPaise,
    couponId: result.couponId,
    couponCode: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    message: result.coupon.type === "percentage"
      ? `${result.coupon.value}% discount applied`
      : `₹${Math.round(result.discountInPaise / 100)} discount applied`,
  });
});

/* ──────────────────────────────────────────────────────
   Admin — GET /admin/coupons
────────────────────────────────────────────────────── */
router.get("/admin/coupons", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const coupons = await db.select({
    id: couponsTable.id,
    code: couponsTable.code,
    type: couponsTable.type,
    value: couponsTable.value,
    minOrderPaise: couponsTable.minOrderPaise,
    maxUsages: couponsTable.maxUsages,
    maxUsagesPerUser: couponsTable.maxUsagesPerUser,
    expiresAt: couponsTable.expiresAt,
    isActive: couponsTable.isActive,
    productIds: couponsTable.productIds,
    categoryRestriction: couponsTable.categoryRestriction,
    createdAt: couponsTable.createdAt,
    usageCount: sql<number>`(SELECT COUNT(*)::int FROM coupon_usages WHERE coupon_id = ${couponsTable.id})`,
  }).from(couponsTable).orderBy(desc(couponsTable.createdAt));

  res.json(coupons);
});

/* ──────────────────────────────────────────────────────
   Admin — POST /admin/coupons
────────────────────────────────────────────────────── */
router.post("/admin/coupons", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { code, type, value, minOrderPaise, maxUsages, maxUsagesPerUser, expiresAt, isActive, productIds, categoryRestriction } = req.body ?? {};

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ error: "code is required" }); return;
  }
  if (!["percentage", "fixed"].includes(type)) {
    res.status(400).json({ error: "type must be 'percentage' or 'fixed'" }); return;
  }
  const parsedValue = parseInt(String(value), 10);
  if (isNaN(parsedValue) || parsedValue <= 0) {
    res.status(400).json({ error: "value must be a positive integer" }); return;
  }
  if (type === "percentage" && parsedValue > 100) {
    res.status(400).json({ error: "percentage value must be between 1 and 100" }); return;
  }

  const upperCode = code.toUpperCase().trim();
  const [existing] = await db.select({ id: couponsTable.id }).from(couponsTable).where(eq(couponsTable.code, upperCode));
  if (existing) { res.status(409).json({ error: "A coupon with this code already exists" }); return; }

  const [coupon] = await db.insert(couponsTable).values({
    code: upperCode,
    type,
    value: parsedValue,
    minOrderPaise: minOrderPaise ? parseInt(String(minOrderPaise), 10) : 0,
    maxUsages: maxUsages ? parseInt(String(maxUsages), 10) : null,
    maxUsagesPerUser: maxUsagesPerUser ? parseInt(String(maxUsagesPerUser), 10) : 1,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: isActive !== false,
    productIds: Array.isArray(productIds) && productIds.length > 0 ? productIds : null,
    categoryRestriction: categoryRestriction?.trim() || null,
  }).returning();

  res.status(201).json(coupon);
});

/* ──────────────────────────────────────────────────────
   Admin — PUT /admin/coupons/:id
────────────────────────────────────────────────────── */
router.put("/admin/coupons/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { code, type, value, minOrderPaise, maxUsages, maxUsagesPerUser, expiresAt, isActive, productIds, categoryRestriction } = req.body ?? {};

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (code !== undefined) {
    const upperCode = (code as string).toUpperCase().trim();
    const [conflict] = await db.select({ id: couponsTable.id }).from(couponsTable)
      .where(and(eq(couponsTable.code, upperCode)));
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "A coupon with this code already exists" }); return;
    }
    update.code = upperCode;
  }
  if (type !== undefined) {
    if (!["percentage", "fixed"].includes(type)) { res.status(400).json({ error: "type must be 'percentage' or 'fixed'" }); return; }
    update.type = type;
  }
  if (value !== undefined) {
    const v = parseInt(String(value), 10);
    if (isNaN(v) || v <= 0) { res.status(400).json({ error: "value must be a positive integer" }); return; }
    update.value = v;
  }
  if (minOrderPaise !== undefined) update.minOrderPaise = parseInt(String(minOrderPaise), 10) || 0;
  if (maxUsages !== undefined) update.maxUsages = maxUsages ? parseInt(String(maxUsages), 10) : null;
  if (maxUsagesPerUser !== undefined) update.maxUsagesPerUser = parseInt(String(maxUsagesPerUser), 10) || 1;
  if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt as string) : null;
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  if (productIds !== undefined) update.productIds = Array.isArray(productIds) && productIds.length > 0 ? productIds : null;
  if (categoryRestriction !== undefined) update.categoryRestriction = (categoryRestriction as string)?.trim() || null;

  const [coupon] = await db.update(couponsTable).set(update).where(eq(couponsTable.id, id)).returning();
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json(coupon);
});

/* ──────────────────────────────────────────────────────
   Admin — DELETE /admin/coupons/:id
────────────────────────────────────────────────────── */
router.delete("/admin/coupons/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await db.delete(couponsTable).where(eq(couponsTable.id, id)).returning({ id: couponsTable.id });
  if (!result.length) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.sendStatus(204);
});

/* ──────────────────────────────────────────────────────
   Admin — GET /admin/coupons/:id/usages
────────────────────────────────────────────────────── */
router.get("/admin/coupons/:id/usages", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const usages = await db.select().from(couponUsagesTable)
    .where(eq(couponUsagesTable.couponId, id))
    .orderBy(desc(couponUsagesTable.usedAt));

  const enriched = await Promise.all(usages.map(async (u) => {
    let userEmail = u.userId;
    try {
      const clerkUser = await clerkClient.users.getUser(u.userId);
      userEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? u.userId;
    } catch {}
    return { ...u, userEmail };
  }));

  res.json(enriched);
});

export default router;
