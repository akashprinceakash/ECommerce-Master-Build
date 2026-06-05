import { Router, type IRouter } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { eq, and, inArray, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db, cartsTable, cartItemsTable, productsTable,
  ordersTable, orderItemsTable, customizationsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { createShiprocketOrder, getShippingRates } from "../lib/shiprocket";
import { sendOrderConfirmation } from "../lib/email";
import { generateInvoicePdf } from "../lib/invoice";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const keyId     = process.env["RAZORPAY_KEY_ID"]        ?? "";
const keySecret = process.env["RAZORPAY_KEY_SECRET"]    ?? "";
const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

const rzp = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

/* ──────────────────────────────────────────────────────
   Public config
────────────────────────────────────────────────────── */
router.get("/payment/config", (_req, res): void => {
  if (!keyId) { res.status(500).json({ error: "Razorpay not configured" }); return; }
  res.json({ keyId });
});

/* ──────────────────────────────────────────────────────
   Shipping rates — called before checkout to show cost
────────────────────────────────────────────────────── */

router.post("/shipping/rates", requireAuth, async (req, res): Promise<void> => {
  const { pincode, itemCount = 1, orderValueRupees = 0 } = req.body ?? {};
  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    res.status(400).json({ error: "Invalid pincode" }); return;
  }
  const weightKg = Math.max(0.1, Number(itemCount) * 0.4);
  const result = await getShippingRates(String(pincode), weightKg, Number(orderValueRupees));
  if (!result) {
    res.json({ chargeInPaise: 9900, courierName: "Standard Delivery" }); return;
  }
  res.json(result);
});

/* ──────────────────────────────────────────────────────
   Shared: validate & load cart for checkout
────────────────────────────────────────────────────── */
async function validateCheckoutCart(userId: string) {
  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (!cart) return { error: "Cart is empty" };

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  if (cartItems.length === 0) return { error: "Cart is empty" };

  const cartItemsWithProducts = await Promise.all(
    cartItems.map(async (item) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      return { ...item, product };
    }),
  );

  for (const item of cartItemsWithProducts) {
    if (!item.product) return { error: "A product in your cart is no longer available" };
    if (item.product.stock < item.quantity)
      return { error: `Only ${item.product.stock} unit${item.product.stock === 1 ? "" : "s"} left for "${item.product.name}"` };
  }

  const itemsTotalInPaise = cartItemsWithProducts.reduce(
    (sum, item) => sum + (item.product?.priceInPaise ?? 0) * item.quantity, 0,
  );
  if (itemsTotalInPaise <= 0) return { error: "Invalid cart total" };

  return { cart, cartItemsWithProducts, itemsTotalInPaise };
}

/* ──────────────────────────────────────────────────────
   Shared: post-order fulfillment (cart clear + stock + Shiprocket + email)
────────────────────────────────────────────────────── */
async function runFulfillment(
  order: typeof ordersTable.$inferSelect,
  userId: string,
) {
  // Clear cart
  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (cart) {
    await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  }

  // Deduct stock
  const rawItemsForStock = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  await Promise.all(
    rawItemsForStock.map((it) =>
      db.update(productsTable)
        .set({ stock: sql`GREATEST(${productsTable.stock} - ${it.quantity}, 0)` })
        .where(eq(productsTable.id, it.productId)),
    ),
  );

  // Load items + products for fulfillment
  const rawItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const itemsWithProducts = await Promise.all(
    rawItems.map(async (it) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
      return { ...it, product };
    }),
  );

  // Resolve customer email
  let customerEmail = "";
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    customerEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
  } catch (e) {
    logger.warn({ userId, e }, "Could not fetch Clerk user email");
  }

  // Shiprocket + email in background
  void (async () => {
    try {
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
      });

      if (sr.shiprocketOrderId) {
        await db.update(ordersTable)
          .set({ shiprocketOrderId: sr.shiprocketOrderId, shiprocketAwb: sr.awb, trackingUrl: sr.trackingUrl })
          .where(eq(ordersTable.id, order.id));
      }

      if (customerEmail) {
        let invoicePdf: Buffer | undefined;
        try {
          invoicePdf = await generateInvoicePdf({
            orderNumber: order.id,
            orderDate: order.createdAt ?? new Date(),
            customerName: order.shippingName,
            customerEmail,
            shippingAddress: order.shippingAddress,
            shippingCity: order.shippingCity,
            shippingState: order.shippingState,
            shippingPostalCode: order.shippingPostalCode,
            shippingPhone: order.shippingPhone,
            items: itemsWithProducts.map((it) => ({
              name: it.product?.name ?? "KA.SHA Product",
              size: it.size,
              quantity: it.quantity,
              priceInPaise: it.priceInPaise,
            })),
            shippingChargeInPaise: order.shippingChargeInPaise ?? 0,
            totalInPaise: order.totalInPaise,
          });
        } catch (pdfErr) {
          logger.error({ pdfErr, orderId: order.id }, "Invoice PDF generation failed — sending email without attachment");
        }

        await sendOrderConfirmation({
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
          invoicePdf,
        });
      }
    } catch (e) {
      logger.error({ orderId: order.id, e }, "Post-payment background tasks failed");
    }
  })();
}

/* ──────────────────────────────────────────────────────
   Step 1: Create Razorpay order + DB pending order
────────────────────────────────────────────────────── */
router.post("/payment/order", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const {
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
    shippingChargeInPaise: rawShippingCharge,
  } = req.body ?? {};
  const shippingChargeInPaise = Math.max(0, parseInt(String(rawShippingCharge ?? "0"), 10) || 0);
  if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingPostalCode || !shippingPhone) {
    res.status(400).json({ error: "Missing shipping fields" }); return;
  }

  if (!/^[a-zA-Z\s]{2,60}$/.test(String(shippingName).trim())) {
    res.status(400).json({ error: "Name must contain only letters and spaces (2–60 characters)" }); return;
  }
  const phoneDigits = String(shippingPhone).replace(/\D/g, "");
  if (!/^\d{10}$/.test(phoneDigits)) {
    res.status(400).json({ error: "Mobile number must be exactly 10 digits" }); return;
  }
  if (!/^\d{6}$/.test(String(shippingPostalCode))) {
    res.status(400).json({ error: "PIN code must be exactly 6 digits" }); return;
  }

  const cartResult = await validateCheckoutCart(userId);
  if ("error" in cartResult) { res.status(400).json({ error: cartResult.error }); return; }
  const { cartItemsWithProducts, itemsTotalInPaise } = cartResult;

  const totalInPaise = itemsTotalInPaise + shippingChargeInPaise;

  // Cancel stale pending orders
  const stale = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "pending")));
  if (stale.length > 0) {
    await db.update(ordersTable)
      .set({ status: "cancelled" })
      .where(inArray(ordersTable.id, stale.map((s) => s.id)));
  }

  let rzpOrder: any;
  try {
    rzpOrder = await rzp.orders.create({
      amount: totalInPaise,
      currency: "INR",
      receipt: `rcpt_${userId.slice(-8)}_${Date.now()}`,
      payment_capture: 1,
      notes: { userId },
    } as any);
  } catch (e: any) {
    res.status(500).json({ error: e?.error?.description || e?.message || "Failed to create payment order" });
    return;
  }

  const [order] = await db.insert(ordersTable).values({
    userId,
    status: "pending",
    paymentMethod: "online",
    totalInPaise,
    shippingChargeInPaise,
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
      }),
    ),
  );

  res.json({ orderId: rzpOrder.id, dbOrderId: order.id, amount: rzpOrder.amount, currency: rzpOrder.currency, keyId });
});

/* ──────────────────────────────────────────────────────
   Step 2: Client-side verify (after modal callback)
────────────────────────────────────────────────────── */
router.post("/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp || !keySecret) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment verification fields" }); return;
  }

  const [dbOrder] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.razorpayOrderId, razorpay_order_id), eq(ordersTable.userId, userId)),
  );
  if (!dbOrder) { res.status(404).json({ error: "Order not found for this user" }); return; }

  if (dbOrder.status === "confirmed" && dbOrder.paymentId === razorpay_payment_id) {
    const full = await buildFullOrder(dbOrder.id);
    res.status(200).json(full); return;
  }
  if (dbOrder.status !== "pending") {
    res.status(409).json({ error: `Order is in '${dbOrder.status}' state and cannot be paid` }); return;
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    res.status(400).json({ error: "Invalid payment signature" }); return;
  }

  let payment: any;
  try { payment = await rzp.payments.fetch(razorpay_payment_id); }
  catch (e: any) {
    res.status(400).json({ error: `Could not verify payment: ${e?.message ?? "unknown error"}` }); return;
  }

  if (payment.order_id !== razorpay_order_id) {
    res.status(400).json({ error: "Payment does not belong to this order" }); return;
  }
  if (Number(payment.amount) !== Number(dbOrder.totalInPaise)) {
    res.status(400).json({ error: "Payment amount mismatch" }); return;
  }

  if (payment.status === "authorized") {
    try {
      await rzp.payments.capture(razorpay_payment_id, dbOrder.totalInPaise, "INR");
      payment = await rzp.payments.fetch(razorpay_payment_id);
      logger.info({ paymentId: razorpay_payment_id }, "Auto-captured authorized payment");
    } catch (e: any) {
      logger.error({ paymentId: razorpay_payment_id, e }, "Failed to capture authorized payment");
      res.status(400).json({ error: "Payment authorized but capture failed — please contact support" }); return;
    }
  }

  if (payment.status !== "captured") {
    res.status(400).json({ error: `Payment not captured (status: ${payment.status})` }); return;
  }

  const confirmed = await confirmOrder(dbOrder.id, razorpay_payment_id, razorpay_signature, userId);
  const full = await buildFullOrder(confirmed.id);
  res.status(201).json(full);
});

/* ──────────────────────────────────────────────────────
   COD Order — creates a confirmed order without payment
────────────────────────────────────────────────────── */
router.post("/payment/cod-order", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const {
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
    shippingChargeInPaise: rawShippingCharge,
  } = req.body ?? {};
  const shippingChargeInPaise = Math.max(0, parseInt(String(rawShippingCharge ?? "0"), 10) || 0);

  if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingPostalCode || !shippingPhone) {
    res.status(400).json({ error: "Missing shipping fields" }); return;
  }
  if (!/^[a-zA-Z\s]{2,60}$/.test(String(shippingName).trim())) {
    res.status(400).json({ error: "Name must contain only letters and spaces (2–60 characters)" }); return;
  }
  const phoneDigits = String(shippingPhone).replace(/\D/g, "");
  if (!/^\d{10}$/.test(phoneDigits)) {
    res.status(400).json({ error: "Mobile number must be exactly 10 digits" }); return;
  }
  if (!/^\d{6}$/.test(String(shippingPostalCode))) {
    res.status(400).json({ error: "PIN code must be exactly 6 digits" }); return;
  }

  const cartResult = await validateCheckoutCart(userId);
  if ("error" in cartResult) { res.status(400).json({ error: cartResult.error }); return; }
  const { cartItemsWithProducts, itemsTotalInPaise } = cartResult;

  // Block COD for customised / bespoke items
  const hasBespokeItem = cartItemsWithProducts.some(i => i.customizationId != null);
  if (hasBespokeItem) {
    res.status(400).json({ error: "Cash on Delivery is not available for customised/bespoke orders. Please choose online payment." });
    return;
  }

  const totalInPaise = itemsTotalInPaise + shippingChargeInPaise;

  // Cancel any stale pending (online) orders for this user
  const stale = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "pending")));
  if (stale.length > 0) {
    await db.update(ordersTable)
      .set({ status: "cancelled" })
      .where(inArray(ordersTable.id, stale.map((s) => s.id)));
  }

  // Create order directly as confirmed — no Razorpay involved
  const [order] = await db.insert(ordersTable).values({
    userId,
    status: "confirmed",
    paymentMethod: "cod",
    totalInPaise,
    shippingChargeInPaise,
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
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
      }),
    ),
  );

  // Run fulfillment in background (cart clear, stock deduction, Shiprocket, email)
  void runFulfillment(order, userId);

  const full = await buildFullOrder(order.id);
  res.status(201).json(full);
});

/* ──────────────────────────────────────────────────────
   Razorpay Webhook
────────────────────────────────────────────────────── */
router.post("/payment/webhook", async (req, res): Promise<void> => {
  res.status(200).json({ ok: true });

  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody   = (req as any).rawBody as Buffer | undefined;

  if (webhookSecret) {
    if (!signature || !rawBody) {
      logger.warn("Webhook received without signature or raw body — skipped");
      return;
    }
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (expected !== signature) {
      logger.warn("Webhook signature mismatch — skipped");
      return;
    }
  }

  const event = req.body?.event as string | undefined;
  if (event !== "payment.captured") return;

  const paymentEntity = req.body?.payload?.payment?.entity;
  if (!paymentEntity) return;

  const { id: paymentId, order_id: rzpOrderId, amount, status } = paymentEntity;
  if (status !== "captured") return;

  logger.info({ paymentId, rzpOrderId }, "Webhook: payment.captured");

  try {
    const [dbOrder] = await db.select().from(ordersTable)
      .where(eq(ordersTable.razorpayOrderId, rzpOrderId));

    if (!dbOrder) {
      logger.warn({ rzpOrderId }, "Webhook: no DB order found for Razorpay order");
      return;
    }
    if (dbOrder.status === "confirmed") {
      logger.info({ orderId: dbOrder.id }, "Webhook: order already confirmed — skipping");
      return;
    }
    if (dbOrder.status !== "pending") {
      logger.warn({ orderId: dbOrder.id, status: dbOrder.status }, "Webhook: order not in pending state");
      return;
    }
    if (Number(amount) !== Number(dbOrder.totalInPaise)) {
      logger.error({ paymentId, amount, expected: dbOrder.totalInPaise }, "Webhook: amount mismatch");
      return;
    }

    await confirmOrder(dbOrder.id, paymentId, "", dbOrder.userId);
    logger.info({ orderId: dbOrder.id }, "Webhook: order confirmed successfully");
  } catch (e) {
    logger.error({ e, paymentId, rzpOrderId }, "Webhook: error confirming order");
  }
});

/* ──────────────────────────────────────────────────────
   Shared: confirm prepaid order + run fulfillment
────────────────────────────────────────────────────── */
async function confirmOrder(
  orderId: number,
  paymentId: string,
  signature: string,
  userId: string,
) {
  const [updated] = await db.update(ordersTable)
    .set({ status: "confirmed", paymentId, razorpaySignature: signature || null })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "pending")))
    .returning();

  if (!updated) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    return existing;
  }

  await runFulfillment(updated, userId);
  return updated;
}

/* ──────────────────────────────────────────────────────
   Invoice PDF download
────────────────────────────────────────────────────── */
router.get("/orders/:orderId/invoice", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const orderId = parseInt(String(req.params["orderId"] ?? "0"), 10);
  if (!orderId) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, orderId), eq(ordersTable.userId, userId)),
  );
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "pending") { res.status(400).json({ error: "Payment not completed for this order" }); return; }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const itemsWithProducts = await Promise.all(
    items.map(async (it) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
      return { ...it, product };
    }),
  );

  let customerEmail = "";
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    customerEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
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
    items: itemsWithProducts.map((it) => ({
      name: it.product?.name ?? "KA.SHA Product",
      size: it.size,
      quantity: it.quantity,
      priceInPaise: it.priceInPaise,
    })),
    shippingChargeInPaise: order.shippingChargeInPaise ?? 0,
    totalInPaise: order.totalInPaise,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="KASHA-Invoice-${String(orderId).padStart(6, "0")}.pdf"`);
  res.send(pdf);
});

/* ──────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────── */
async function buildFullOrder(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  const items   = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
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
