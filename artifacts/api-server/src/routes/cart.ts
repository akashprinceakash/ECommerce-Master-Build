import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartsTable, cartItemsTable, productsTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getOrCreateCart(userId: string) {
  let [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (!cart) {
    [cart] = await db.insert(cartsTable).values({ userId }).returning();
  }
  return cart;
}

async function buildCartResponse(userId: string) {
  const cart = await getOrCreateCart(userId);
  const items = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.cartId, cart.id));

  const itemsWithDetails = await Promise.all(
    items.map(async (item) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      let customization = null;
      if (item.customizationId) {
        try {
          const [c] = await db.select().from(customizationsTable).where(eq(customizationsTable.id, item.customizationId));
          customization = c ?? null;
        } catch { /* schema mismatch — return item without customization detail */ }
      }
      return { ...item, product, customization };
    })
  );

  const totalInPaise = itemsWithDetails.reduce(
    (sum, item) => sum + ((item.product?.priceInPaise ?? 0) + ((item.customization as any)?.customizationChargeInPaise ?? 0)) * item.quantity,
    0
  );

  return {
    id: cart.id,
    userId: cart.userId,
    items: itemsWithDetails,
    totalInPaise,
    itemCount: itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0),
  };
}

router.get("/cart", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const cart = await buildCartResponse(userId);
  res.json(cart);
});

router.post("/cart/items", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { productId, customizationId, quantity, size, measurements } = req.body;
  if (!productId || !size) {
    res.status(400).json({ error: "productId and size are required" });
    return;
  }
  const cart = await getOrCreateCart(userId);

  let parsedMeasurements: Record<string, string> | undefined;
  if (measurements && typeof measurements === "object" && !Array.isArray(measurements)) {
    parsedMeasurements = Object.fromEntries(
      Object.entries(measurements as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && (v as string).length > 0)
        .map(([k, v]) => [k, v as string])
    );
  }

  const [item] = await db
    .insert(cartItemsTable)
    .values({
      cartId: cart.id,
      productId,
      customizationId: customizationId ?? null,
      quantity: quantity ?? 1,
      size,
      measurements: parsedMeasurements ?? null,
    })
    .returning();
  res.status(201).json(item);
});

router.patch("/cart/items/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const { quantity } = req.body;
  if (isNaN(id) || !quantity) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const cart = await getOrCreateCart(userId);
  const [updated] = await db
    .update(cartItemsTable)
    .set({ quantity })
    .where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.cartId, cart.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Cart item not found" });
    return;
  }
  res.json(updated);
});

router.delete("/cart/items/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const cart = await getOrCreateCart(userId);
  await db
    .delete(cartItemsTable)
    .where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.cartId, cart.id)));
  res.sendStatus(204);
});

router.delete("/cart/clear", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const cart = await getOrCreateCart(userId);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  res.sendStatus(204);
});

export default router;
