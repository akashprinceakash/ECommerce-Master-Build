import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartsTable, cartItemsTable, productsTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

/**
 * Volume-discount multiplier per item based on its own quantity.
 * Matches the tiers shown on the product page:
 *   1 piece  → full price
 *   2 pieces → 10% off
 *   3 pieces → 15% off
 *   4+ pieces → 20% off
 */
function tierMultiplier(qty: number): number {
  if (qty >= 4) return 0.80;
  if (qty === 3) return 0.85;
  if (qty === 2) return 0.90;
  return 1.0;
}

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

  // Apply volume-tier discount per item (discount is on product price only,
  // not on the customization charge which is a service fee).
  const totalInPaise = itemsWithDetails.reduce(
    (sum, item) => {
      const discountedProductPrice = Math.round((item.product?.priceInPaise ?? 0) * tierMultiplier(item.quantity));
      const customizationCharge = (item.customization as any)?.customizationChargeInPaise ?? 0;
      return sum + (discountedProductPrice + customizationCharge) * item.quantity;
    },
    0
  );

  const fullPriceTotal = itemsWithDetails.reduce(
    (sum, item) => sum + ((item.product?.priceInPaise ?? 0) + ((item.customization as any)?.customizationChargeInPaise ?? 0)) * item.quantity,
    0
  );
  const volumeDiscountInPaise = fullPriceTotal - totalInPaise;

  return {
    id: cart.id,
    userId: cart.userId,
    items: itemsWithDetails,
    totalInPaise,
    volumeDiscountInPaise,
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
  const { productId, customizationId, quantity, size, measurements } = req.body ?? {};
  const parsedProductId = Number(productId);
  const parsedQuantity  = Number(quantity ?? 1);
  if (!productId || isNaN(parsedProductId) || parsedProductId <= 0) {
    res.status(400).json({ error: "productId must be a positive integer" }); return;
  }
  if (!size || typeof size !== "string" || size.trim().length === 0) {
    res.status(400).json({ error: "size is required" }); return;
  }
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 100) {
    res.status(400).json({ error: "quantity must be a whole number between 1 and 100" }); return;
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
  const { quantity } = req.body ?? {};
  const parsedQty = Number(quantity);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid cart item ID" }); return;
  }
  if (!quantity || !Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 100) {
    res.status(400).json({ error: "quantity must be a whole number between 1 and 100" }); return;
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
