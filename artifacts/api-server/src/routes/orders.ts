import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function buildOrderResponse(order: typeof ordersTable.$inferSelect) {
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const itemsWithDetails = await Promise.all(
    items.map(async (item) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      let customization = null;
      if (item.customizationId) {
        const [c] = await db.select().from(customizationsTable).where(eq(customizationsTable.id, item.customizationId));
        customization = c ?? null;
      }
      return { ...item, product, customization };
    })
  );

  return { ...order, items: itemsWithDetails };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt));
  const ordersWithItems = await Promise.all(orders.map(buildOrderResponse));
  res.json(ordersWithItems);
});

// POST /orders has been removed. All orders must now be created through the
// Razorpay payment flow (POST /payment/order → checkout → POST /payment/verify)
// to guarantee that confirmed orders are backed by a captured payment.
router.post("/orders", requireAuth, (_req, res): void => {
  res.status(410).json({
    error: "Direct order creation is disabled. Use POST /api/payment/order to start checkout.",
  });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const fullOrder = await buildOrderResponse(order);
  res.json(fullOrder);
});

export default router;
