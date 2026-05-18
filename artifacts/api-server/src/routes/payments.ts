import { Router, type IRouter } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { eq, and, inArray } from "drizzle-orm";
import { db, cartsTable, cartItemsTable, productsTable, ordersTable, orderItemsTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
const rzp = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

router.get("/payment/config", (_req, res): void => {
  if (!keyId) { res.status(500).json({ error: "Razorpay not configured" }); return; }
  res.json({ keyId });
});

/**
 * Step 1: Create a pending DB order + Razorpay order.
 * Cart contents and prices are snapshotted into order_items at this moment,
 * so the user cannot tamper with the cart between payment and verification.
 */
router.post("/payment/order", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const {
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
  } = req.body ?? {};
  if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingPostalCode || !shippingPhone) {
    res.status(400).json({ error: "Missing shipping fields" }); return;
  }

  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (!cart) { res.status(400).json({ error: "Cart is empty" }); return; }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  if (cartItems.length === 0) { res.status(400).json({ error: "Cart is empty" }); return; }

  const cartItemsWithProducts = await Promise.all(
    cartItems.map(async (item) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      return { ...item, product };
    })
  );
  const totalInPaise = cartItemsWithProducts.reduce(
    (sum, item) => sum + (item.product?.priceInPaise ?? 0) * item.quantity, 0,
  );
  if (totalInPaise <= 0) { res.status(400).json({ error: "Invalid cart total" }); return; }

  // Stock enforcement — check every item before creating the Razorpay order
  for (const item of cartItemsWithProducts) {
    if (!item.product) {
      res.status(400).json({ error: "A product in your cart is no longer available" }); return;
    }
    if (item.product.stock < item.quantity) {
      res.status(400).json({
        error: `Only ${item.product.stock} unit${item.product.stock === 1 ? "" : "s"} left for "${item.product.name}"`,
      }); return;
    }
  }

  // Cancel any prior pending orders for this user so we don't accumulate stale ones
  const stale = await db.select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "pending")));
  if (stale.length > 0) {
    await db.update(ordersTable)
      .set({ status: "cancelled" })
      .where(inArray(ordersTable.id, stale.map(s => s.id)));
  }

  // Create Razorpay order
  let rzpOrder;
  try {
    rzpOrder = await rzp.orders.create({
      amount: totalInPaise,
      currency: "INR",
      receipt: `rcpt_${userId.slice(-8)}_${Date.now()}`,
      notes: { userId },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.error?.description || e?.message || "Failed to create payment order" });
    return;
  }

  // Insert pending DB order with cart snapshot
  const [order] = await db.insert(ordersTable).values({
    userId,
    status: "pending",
    totalInPaise,
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
    razorpayOrderId: rzpOrder.id,
  }).returning();

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

  res.json({
    orderId: rzpOrder.id,
    dbOrderId: order.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    keyId,
  });
});

/**
 * Step 2: Verify the payment.
 *  - HMAC signature check
 *  - Fetch payment from Razorpay API and confirm status + amount + order linkage
 *  - Idempotent: if the pending order is already confirmed with the same payment, return it
 *  - On success: mark order confirmed, persist payment IDs, clear the cart
 */
router.post("/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp || !keySecret) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment verification fields" }); return;
  }

  // Find the pending DB order we created in step 1, scoped to this user
  const [dbOrder] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.razorpayOrderId, razorpay_order_id), eq(ordersTable.userId, userId)),
  );
  if (!dbOrder) { res.status(404).json({ error: "Order not found for this user" }); return; }

  // Idempotency: already confirmed with same payment? Just return it.
  if (dbOrder.status === "confirmed" && dbOrder.paymentId === razorpay_payment_id) {
    const fullOrder = await buildFullOrder(dbOrder.id);
    res.status(200).json(fullOrder); return;
  }
  if (dbOrder.status !== "pending") {
    res.status(409).json({ error: `Order is in '${dbOrder.status}' state and cannot be paid` }); return;
  }

  // 1) Verify HMAC signature
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) { res.status(400).json({ error: "Invalid payment signature" }); return; }

  // 2) Verify with Razorpay API: amount + order linkage + capture status
  let payment: any;
  try { payment = await rzp.payments.fetch(razorpay_payment_id); }
  catch (e: any) { res.status(400).json({ error: `Could not verify payment with Razorpay: ${e?.message ?? "unknown error"}` }); return; }

  if (payment.order_id !== razorpay_order_id) {
    res.status(400).json({ error: "Payment does not belong to this order" }); return;
  }
  if (Number(payment.amount) !== Number(dbOrder.totalInPaise)) {
    res.status(400).json({ error: "Payment amount does not match order total" }); return;
  }
  // Require funds to actually be captured before fulfilling. "authorized" is not enough —
  // the merchant must have settled the payment (Razorpay auto-captures by default).
  if (payment.status !== "captured") {
    res.status(400).json({ error: `Payment is not captured (status: ${payment.status})` }); return;
  }

  // 3) Confirm DB order, persist payment metadata, clear cart
  const [updated] = await db.update(ordersTable)
    .set({
      status: "confirmed",
      paymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    })
    .where(eq(ordersTable.id, dbOrder.id))
    .returning();

  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (cart) {
    await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  }

  const fullOrder = await buildFullOrder(updated.id);
  res.status(201).json(fullOrder);
});

async function buildFullOrder(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const itemsWithDetails = await Promise.all(items.map(async (it) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
    let customization = null;
    if (it.customizationId) {
      const [c] = await db.select().from(customizationsTable).where(eq(customizationsTable.id, it.customizationId));
      customization = c ?? null;
    }
    return { ...it, product, customization };
  }));
  return { ...order, items: itemsWithDetails };
}

export default router;
