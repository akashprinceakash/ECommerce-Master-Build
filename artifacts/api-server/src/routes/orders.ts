import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartsTable, cartItemsTable, productsTable, customizationsTable } from "@workspace/db";
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

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone, paymentId } = req.body;

  if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingPostalCode || !shippingPhone) {
    res.status(400).json({ error: "Missing required shipping fields" });
    return;
  }

  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (!cart) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const cartItemsWithProducts = await Promise.all(
    cartItems.map(async (item) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      return { ...item, product };
    })
  );

  const totalInPaise = cartItemsWithProducts.reduce(
    (sum, item) => sum + (item.product?.priceInPaise ?? 0) * item.quantity,
    0
  );

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "confirmed",
      totalInPaise,
      shippingName,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingPostalCode,
      shippingPhone,
      paymentId: paymentId ?? null,
    })
    .returning();

  await Promise.all(
    cartItemsWithProducts.map((item) =>
      db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: item.productId,
        customizationId: item.customizationId ?? null,
        quantity: item.quantity,
        size: item.size,
        priceInPaise: item.product?.priceInPaise ?? 0,
      })
    )
  );

  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));

  const fullOrder = await buildOrderResponse(order);
  res.status(201).json(fullOrder);
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
