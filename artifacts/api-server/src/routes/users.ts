import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, userProfilesTable, ordersTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { sql } from "drizzle-orm";

// Only count orders that represent real spend — exclude pending/cancelled
const PAID_STATUSES = ["confirmed", "shipped", "delivered"] as const;

const router: IRouter = Router();

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  let [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    [profile] = await db.insert(userProfilesTable).values({ userId }).returning();
  }

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalSpentInPaise: sql<number>`coalesce(sum(total_in_paise), 0)::int`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), inArray(ordersTable.status, [...PAID_STATUSES])));

  const [designStats] = await db
    .select({ savedDesignsCount: sql<number>`count(*)::int` })
    .from(customizationsTable)
    .where(eq(customizationsTable.userId, userId));

  res.json({
    ...profile,
    totalOrders: orderStats?.totalOrders ?? 0,
    totalSpentInPaise: orderStats?.totalSpentInPaise ?? 0,
    savedDesignsCount: designStats?.savedDesignsCount ?? 0,
  });
});

router.post("/users/profile/upsert", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { displayName, email, phone, defaultShippingAddress } = req.body;

  const updateData: Record<string, unknown> = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (defaultShippingAddress !== undefined) updateData.defaultShippingAddress = defaultShippingAddress;

  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));

  let profile;
  if (existing) {
    const [updated] = await db
      .update(userProfilesTable)
      .set(updateData)
      .where(eq(userProfilesTable.userId, userId))
      .returning();
    profile = updated;
  } else {
    const [created] = await db
      .insert(userProfilesTable)
      .values({ userId, ...updateData })
      .returning();
    profile = created;
  }

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalSpentInPaise: sql<number>`coalesce(sum(total_in_paise), 0)::int`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), inArray(ordersTable.status, [...PAID_STATUSES])));

  const [designStats] = await db
    .select({ savedDesignsCount: sql<number>`count(*)::int` })
    .from(customizationsTable)
    .where(eq(customizationsTable.userId, userId));

  res.json({
    ...profile,
    totalOrders: orderStats?.totalOrders ?? 0,
    totalSpentInPaise: orderStats?.totalSpentInPaise ?? 0,
    savedDesignsCount: designStats?.savedDesignsCount ?? 0,
  });
});

export default router;
