import { Router, type IRouter } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { eq, and, inArray, isNull, or, sql, desc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db, cartsTable, cartItemsTable, productsTable,
  ordersTable, orderItemsTable, customizationsTable, orderEventsTable, refundsTable, couponsTable, couponUsagesTable, type OrderItem,
} from "@workspace/db";
import { validateCoupon } from "./coupons";
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
  const { pincode, itemCount = 1, orderValueRupees = 0, cod = false } = req.body ?? {};
  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    res.status(400).json({ error: "Invalid pincode" }); return;
  }
  const weightKg = Math.max(0.1, Number(itemCount) * 0.4);
  const result = await getShippingRates(String(pincode), weightKg, Number(orderValueRupees), Boolean(cod));
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
        paymentMethod: order.paymentMethod === "cod" ? "cod" : "online",
      });

      if (sr.shiprocketOrderId) {
        await db.update(ordersTable)
          .set({
            shiprocketOrderId: sr.shiprocketOrderId,
            shiprocketShipmentId: sr.shiprocketShipmentId,
            shiprocketAwb: sr.awb,
            trackingUrl: sr.trackingUrl,
          })
          .where(eq(ordersTable.id, order.id));

        // Record Shiprocket creation event
        await db.insert(orderEventsTable).values({
          orderId: order.id,
          eventType: "shiprocket_created",
          title: "Shipment Created",
          description: `Shiprocket Order #${sr.shiprocketOrderId}`,
        });

        // If AWB was assigned immediately (prepaid courier), record it
        if (sr.awb) {
          await db.insert(orderEventsTable).values({
            orderId: order.id,
            eventType: "awb_assigned",
            title: "AWB Assigned",
            description: `Tracking: ${sr.awb}`,
          });
          // Advance status to processing since AWB is assigned
          await db.update(ordersTable)
            .set({ status: "processing" })
            .where(eq(ordersTable.id, order.id));
        }
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
  (req as any).log?.info({ userId }, "payment/order: initiated");
  if (!rzp) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const {
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
    shippingChargeInPaise: rawShippingCharge,
    remarks: rawRemarks,
    couponCode: rawCouponCode,
  } = req.body ?? {};
  const shippingChargeInPaise = Math.max(0, parseInt(String(rawShippingCharge ?? "0"), 10) || 0);
  // Cap length defensively — this is free text from the checkout form
  const remarks = typeof rawRemarks === "string" && rawRemarks.trim() ? rawRemarks.trim().slice(0, 1000) : null;
  const appliedCouponCode = typeof rawCouponCode === "string" && rawCouponCode.trim() ? rawCouponCode.trim().toUpperCase() : null;
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

  let discountInPaise = 0;
  let validatedCouponCode: string | null = null;
  if (appliedCouponCode) {
    const cartProductIds = cartItemsWithProducts.map(i => i.productId);
    const couponResult = await validateCoupon(appliedCouponCode, userId, itemsTotalInPaise, cartProductIds);
    if ("error" in couponResult) { res.status(400).json({ error: couponResult.error }); return; }
    discountInPaise = couponResult.discountInPaise;
    validatedCouponCode = appliedCouponCode;
  }

  const totalInPaise = Math.max(0, itemsTotalInPaise + shippingChargeInPaise - discountInPaise);

  // ── Idempotency: reuse an existing pending/payment_failed order if the cart total matches ──
  // Query most-recent first for deterministic ordering; prevents cancelling a still-usable order.
  const [existingOrder] = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.userId, userId),
      inArray(ordersTable.status, ["pending", "payment_failed"]),
    ))
    .orderBy(desc(ordersTable.createdAt))
    .limit(1);

  if (existingOrder?.razorpayOrderId) {
    if (existingOrder.totalInPaise === totalInPaise) {
      // Same total — try to verify the Razorpay order is still open
      let rzpStatus: string | null = null;
      try {
        const rzpExisting = await rzp.orders.fetch(existingOrder.razorpayOrderId);
        rzpStatus = rzpExisting.status;
        if (rzpStatus === "created") {
          // Razorpay order still open — reuse it (idempotent, no new order)
          logger.info({ orderId: existingOrder.id, rzpOrderId: existingOrder.razorpayOrderId }, "Reusing existing pending Razorpay order (idempotent)");
          void db.insert(orderEventsTable).values({ orderId: existingOrder.id, eventType: "checkout_resumed", title: "Checkout Resumed", description: "Reusing existing Razorpay order" });
          res.json({ orderId: rzpExisting.id, dbOrderId: existingOrder.id, amount: rzpExisting.amount, currency: rzpExisting.currency, keyId });
          return;
        }
        if (rzpStatus === "paid") {
          // Payment already captured on the Razorpay side — DO NOT cancel this order.
          // Kick off auto-confirm in the background; /payment/verify or webhook will also catch this.
          logger.warn({ orderId: existingOrder.id, rzpOrderId: existingOrder.razorpayOrderId }, "Existing order rzpStatus=paid — triggering background auto-confirm");
          void (async () => {
            try {
              const rzpPayments = await (rzp as any).orders.fetchPayments(existingOrder.razorpayOrderId);
              const captured = (rzpPayments?.items ?? []).find((p: any) => p.status === "captured");
              if (captured) {
                await confirmOrder(existingOrder.id, captured.id, "", existingOrder.userId);
                logger.info({ orderId: existingOrder.id, paymentId: captured.id }, "Auto-confirmed previously paid order via /payment/order probe");
              }
            } catch (e) {
              logger.error({ orderId: existingOrder.id, err: (e as any)?.message }, "Auto-confirm failed — webhook will retry");
            }
          })();
          res.status(409).json({ error: "Your previous payment is being processed. Please check your order history shortly." });
          return;
        }
        // Razorpay status is expired or otherwise terminal (not "created" and not "paid") —
        // safe to cancel this DB order and create a fresh one.
        await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, existingOrder.id));
        logger.info({ orderId: existingOrder.id, rzpStatus }, "Cancelled expired Razorpay order before creating new one");
      } catch (fetchErr) {
        // Razorpay API unavailable — return the existing order optimistically.
        // HMAC signature verification in /payment/verify will catch any invalid payment later.
        logger.warn({ orderId: existingOrder.id, err: (fetchErr as any)?.message }, "Razorpay fetch failed transiently — reusing existing order optimistically");
        void db.insert(orderEventsTable).values({ orderId: existingOrder.id, eventType: "checkout_resumed", title: "Checkout Resumed (Optimistic)", description: "Razorpay fetch failed — reusing existing order" });
        res.json({ orderId: existingOrder.razorpayOrderId, dbOrderId: existingOrder.id, amount: existingOrder.totalInPaise, currency: "INR", keyId });
        return;
      }
    } else {
      // Cart total changed — cancel only this old order, then create fresh
      await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, existingOrder.id));
      logger.info({ orderId: existingOrder.id, oldTotal: existingOrder.totalInPaise, newTotal: totalInPaise }, "Cancelled stale order (cart total changed)");
    }
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

  let order: typeof ordersTable.$inferSelect;
  try {
    const [inserted] = await db.insert(ordersTable).values({
      userId,
      status: "pending",
      paymentMethod: "online",
      totalInPaise,
      shippingChargeInPaise,
      shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
      remarks,
      razorpayOrderId: rzpOrder.id,
      couponCode: validatedCouponCode,
      discountInPaise: discountInPaise || 0,
    }).returning();
    order = inserted;
  } catch (insertErr: any) {
    // Graceful unique constraint conflict: another concurrent request already inserted this Razorpay order.
    // Fetch it and return it rather than surfacing a 500.
    if (insertErr?.code === "23505") {
      logger.warn({ rzpOrderId: rzpOrder.id, err: insertErr?.detail }, "Unique constraint on razorpay_order_id — concurrent request, fetching existing row");
      const [conflict] = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.userId, userId), inArray(ordersTable.status, ["pending", "payment_failed"])))
        .orderBy(desc(ordersTable.createdAt)).limit(1);
      if (conflict) {
        res.json({ orderId: conflict.razorpayOrderId ?? rzpOrder.id, dbOrderId: conflict.id, amount: rzpOrder.amount, currency: rzpOrder.currency, keyId });
        return;
      }
    }
    logger.error({ err: insertErr?.message }, "Failed to insert order row");
    res.status(500).json({ error: "Failed to create order — please try again" });
    return;
  }

  await Promise.all(
    cartItemsWithProducts.map((item) =>
      db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: item.productId,
        customizationId: item.customizationId ?? null,
        quantity: item.quantity,
        size: item.size,
        priceInPaise: item.product?.priceInPaise ?? 0,
        measurements: (item as any).measurements ?? null,
      }),
    ),
  );

  // Record order placed event (fire-and-forget — non-critical)
  void db.insert(orderEventsTable).values({ orderId: order.id, eventType: "order_placed", title: "Order Placed", description: `Razorpay Order: ${rzpOrder.id} · Awaiting payment` });

  res.json({ orderId: rzpOrder.id, dbOrderId: order.id, amount: rzpOrder.amount, currency: rzpOrder.currency, keyId });
});

/* ──────────────────────────────────────────────────────
   Retry: reopen payment for a payment_failed DB order
   Returns existing Razorpay order ID if still open,
   otherwise creates a new one tied to the same DB order.
────────────────────────────────────────────────────── */
router.post("/payment/retry/:orderId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  (req as any).log?.info({ userId, orderId: req.params["orderId"] }, "payment/retry: initiated");
  if (!rzp || !keyId || !keySecret) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const orderId = parseInt(String(req.params["orderId"] ?? "0"), 10);
  if (!orderId) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [dbOrder] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, userId)));

  if (!dbOrder) { res.status(404).json({ error: "Order not found" }); return; }
  if (!["pending", "payment_failed"].includes(dbOrder.status)) {
    res.status(409).json({ error: `Order cannot be retried (status: ${dbOrder.status})` }); return;
  }
  if (!dbOrder.razorpayOrderId) {
    res.status(400).json({ error: "No Razorpay order ID on record for this order" }); return;
  }

  // Try to reuse the existing Razorpay order if it's still open
  try {
    const rzpExisting = await rzp.orders.fetch(dbOrder.razorpayOrderId);
    if (rzpExisting.status === "created") {
      logger.info({ orderId, rzpOrderId: dbOrder.razorpayOrderId }, "Retry: reusing existing open Razorpay order");
      void db.insert(orderEventsTable).values({ orderId, eventType: "payment_retry", title: "Payment Retry", description: `Reusing Razorpay Order: ${dbOrder.razorpayOrderId}` });
      res.json({ orderId: rzpExisting.id, dbOrderId: dbOrder.id, amount: rzpExisting.amount, currency: rzpExisting.currency, keyId });
      return;
    }
    if (rzpExisting.status === "paid") {
      // Payment already captured on Razorpay — confirm the existing DB order and refuse to clone/cancel.
      logger.warn({ orderId, rzpOrderId: dbOrder.razorpayOrderId }, "Retry: Razorpay order already paid — auto-confirming in background");
      void (async () => {
        try {
          const rzpPayments = await (rzp as any).orders.fetchPayments(dbOrder.razorpayOrderId);
          const captured = (rzpPayments?.items ?? []).find((p: any) => p.status === "captured");
          if (captured) {
            await confirmOrder(dbOrder.id, captured.id, "", userId);
            logger.info({ orderId, paymentId: captured.id }, "Retry: auto-confirmed existing paid order");
          }
        } catch (e) {
          logger.error({ orderId, err: (e as any)?.message }, "Retry: auto-confirm of paid order failed — webhook will retry");
        }
      })();
      res.status(409).json({ error: "Your previous payment is being processed. Please check your order history shortly." });
      return;
    }
    // Any other status (e.g. "expired") — fall through to clone and create fresh Razorpay order
  } catch (_) {
    // Transient Razorpay fetch failure — optimistically reuse the existing order ID
    logger.warn({ orderId, rzpOrderId: dbOrder.razorpayOrderId }, "Retry: Razorpay fetch failed transiently — reusing existing order optimistically");
    void db.insert(orderEventsTable).values({ orderId, eventType: "payment_retry", title: "Payment Retry (Optimistic)", description: "Razorpay fetch failed transiently" });
    res.json({ orderId: dbOrder.razorpayOrderId, dbOrderId: dbOrder.id, amount: dbOrder.totalInPaise, currency: "INR", keyId });
    return;
  }

  // Existing Razorpay order is expired/paid — create a fresh Razorpay order and
  // a NEW DB order (clone of the old one) rather than overwriting razorpayOrderId.
  // This preserves the old razorpayOrderId → old DB order mapping so late
  // payment.captured webhooks for the original attempt can still recover it.
  let rzpOrder: any;
  try {
    rzpOrder = await rzp.orders.create({
      amount: dbOrder.totalInPaise,
      currency: "INR",
      receipt: `retry_${orderId}_${Date.now()}`,
      payment_capture: 1,
      notes: { userId, retryForOrderId: String(orderId) },
    } as any);
  } catch (e: any) {
    res.status(500).json({ error: e?.error?.description || e?.message || "Failed to create retry payment order" });
    return;
  }

  // Fetch items from the old order to copy into the new one
  const originalItems: OrderItem[] = await db.select().from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));

  // Insert new DB order — preserves the old row intact with its original razorpayOrderId
  const [newDbOrder] = await db.insert(ordersTable).values({
    userId,
    status: "pending",
    paymentMethod: "online",
    totalInPaise: dbOrder.totalInPaise,
    shippingChargeInPaise: dbOrder.shippingChargeInPaise,
    shippingName: dbOrder.shippingName,
    shippingAddress: dbOrder.shippingAddress,
    shippingCity: dbOrder.shippingCity,
    shippingState: dbOrder.shippingState,
    shippingPostalCode: dbOrder.shippingPostalCode,
    shippingPhone: dbOrder.shippingPhone,
    remarks: dbOrder.remarks,
    razorpayOrderId: rzpOrder.id,
    couponCode: dbOrder.couponCode,
    discountInPaise: dbOrder.discountInPaise,
  }).returning();

  // Clone order items into the new order
  if (originalItems.length > 0) {
    await Promise.all(originalItems.map(item =>
      db.insert(orderItemsTable).values({
        orderId: newDbOrder.id,
        productId: item.productId,
        customizationId: item.customizationId,
        quantity: item.quantity,
        size: item.size,
        priceInPaise: item.priceInPaise,
        measurements: item.measurements,
      }),
    ));
  }

  // Cancel the old DB order — it retains its razorpayOrderId so any late webhook can recover it.
  // The webhook allows confirming cancelled orders with no paymentId (race-recovery path).
  await db.update(ordersTable)
    .set({ status: "cancelled" })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, userId)));

  void db.insert(orderEventsTable).values({ orderId: newDbOrder.id, eventType: "payment_retry", title: "Payment Retry", description: `New Razorpay Order: ${rzpOrder.id} (original #${orderId} expired — now cancelled)` });
  logger.info({ oldOrderId: orderId, newOrderId: newDbOrder.id, newRzpOrderId: rzpOrder.id }, "Retry: cloned to new DB order for expired original — old row preserved for webhook recovery");

  res.json({ orderId: rzpOrder.id, dbOrderId: newDbOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency, keyId });
});

/* ──────────────────────────────────────────────────────
   Step 2: Client-side verify (after modal callback)
────────────────────────────────────────────────────── */
router.post("/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  (req as any).log?.info({ userId }, "payment/verify: initiated");
  if (!rzp || !keySecret) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment verification fields" }); return;
  }

  const [dbOrder] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.razorpayOrderId, razorpay_order_id), eq(ordersTable.userId, userId)),
  );
  if (!dbOrder) { res.status(404).json({ error: "Order not found for this user" }); return; }

  // Event: verify called
  void db.insert(orderEventsTable).values({
    orderId: dbOrder.id,
    eventType: "verify_called",
    title: "Payment Verification Started",
    description: `Payment ID: ${razorpay_payment_id}`,
  });

  // Idempotent: already confirmed with this exact payment
  if (dbOrder.status === "confirmed" && dbOrder.paymentId === razorpay_payment_id) {
    const full = await buildFullOrder(dbOrder.id);
    res.status(200).json(full); return;
  }

  // Allow retry from payment_failed state (Razorpay allows multiple attempts per order)
  if (!["pending", "payment_failed"].includes(dbOrder.status)) {
    res.status(409).json({ error: `Order is in '${dbOrder.status}' state and cannot be paid` }); return;
  }

  // Step 1: Verify HMAC signature — this is the authoritative proof that Razorpay captured money
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    (req as any).log?.warn({ razorpay_order_id, razorpay_payment_id }, "verify: invalid signature — possible tampering");
    void db.insert(orderEventsTable).values({
      orderId: dbOrder.id,
      eventType: "signature_invalid",
      title: "Invalid Payment Signature",
      description: `Possible tampering detected for Payment ID: ${razorpay_payment_id}`,
    });
    res.status(400).json({ error: "Invalid payment signature" }); return;
  }

  // Event: signature verified
  void db.insert(orderEventsTable).values({
    orderId: dbOrder.id,
    eventType: "signature_verified",
    title: "Signature Verified",
    description: `HMAC signature valid for Payment ID: ${razorpay_payment_id}`,
  });

  // Step 2: Fetch payment details from Razorpay to confirm status.
  // CRITICAL: if fetch fails AFTER signature is verified, we still confirm —
  // the HMAC signature is proof that Razorpay completed the capture.
  let payment: any;
  let paymentFetchFailed = false;
  try {
    payment = await rzp.payments.fetch(razorpay_payment_id);
    logger.info({ paymentId: razorpay_payment_id, status: payment.status }, "verify: fetched payment status from Razorpay");
  } catch (e: any) {
    paymentFetchFailed = true;
    logger.error({ paymentId: razorpay_payment_id, err: e?.message }, "verify: payments.fetch failed after valid signature — trusting HMAC and confirming order");
    void db.insert(orderEventsTable).values({
      orderId: dbOrder.id,
      eventType: "payment_fetch_failed",
      title: "Payment Fetch Failed (Signature Trusted)",
      description: `Razorpay API unreachable after valid HMAC — confirming on signature trust. Error: ${e?.message ?? "unknown"}`,
    });
  }

  if (!paymentFetchFailed) {
    // Validate fetched payment details
    if (payment.order_id !== razorpay_order_id) {
      res.status(400).json({ error: "Payment does not belong to this order" }); return;
    }
    if (Number(payment.amount) !== Number(dbOrder.totalInPaise)) {
      logger.error({ paymentId: razorpay_payment_id, got: payment.amount, expected: dbOrder.totalInPaise }, "verify: amount mismatch");
      void db.insert(orderEventsTable).values({
        orderId: dbOrder.id,
        eventType: "amount_mismatch",
        title: "Payment Amount Mismatch",
        description: `Got ₹${payment.amount / 100}, expected ₹${dbOrder.totalInPaise / 100}`,
      });
      res.status(400).json({ error: "Payment amount mismatch — please contact support" }); return;
    }

    // Auto-capture if only authorized (manual capture mode)
    if (payment.status === "authorized") {
      try {
        await rzp.payments.capture(razorpay_payment_id, dbOrder.totalInPaise, "INR");
        payment = await rzp.payments.fetch(razorpay_payment_id);
        logger.info({ paymentId: razorpay_payment_id }, "verify: auto-captured authorized payment");
        void db.insert(orderEventsTable).values({
          orderId: dbOrder.id,
          eventType: "payment_captured",
          title: "Payment Auto-Captured",
          description: `Payment ID: ${razorpay_payment_id} captured from authorized state`,
        });
      } catch (e: any) {
        logger.error({ paymentId: razorpay_payment_id, err: e?.message }, "verify: capture failed after authorization");
        res.status(400).json({ error: "Payment authorized but capture failed — please contact support" }); return;
      }
    }

    if (payment.status !== "captured") {
      logger.warn({ paymentId: razorpay_payment_id, status: payment.status }, "verify: payment not captured");
      res.status(400).json({ error: `Payment not captured (status: ${payment.status})` }); return;
    }
  }

  // Confirm the order — signature verified (and optionally fetch confirmed captured status).
  // confirmOrder fires fulfillment in the background; it only throws if the DB update fails.
  const confirmed = await confirmOrder(dbOrder.id, razorpay_payment_id, razorpay_signature, userId);
  const full = await buildFullOrder(confirmed.id);
  res.status(201).json(full);
});

/* ──────────────────────────────────────────────────────
   COD Order — creates a confirmed order without payment
────────────────────────────────────────────────────── */
router.post("/payment/cod-order", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  (req as any).log?.info({ userId }, "payment/cod-order: initiated");

  const {
    shippingName, shippingAddress, shippingCity, shippingState, shippingPostalCode, shippingPhone,
    shippingChargeInPaise: rawShippingCharge, remarks: rawRemarks, couponCode: rawCodCouponCode,
  } = req.body ?? {};
  const shippingChargeInPaise = Math.max(0, parseInt(String(rawShippingCharge ?? "0"), 10) || 0);

  const remarks = typeof rawRemarks === "string" && rawRemarks.trim() ? rawRemarks.trim().slice(0, 1000) : null;
  const appliedCodCouponCode = typeof rawCodCouponCode === "string" && rawCodCouponCode.trim() ? rawCodCouponCode.trim().toUpperCase() : null;
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

  let codDiscountInPaise = 0;
  let codValidatedCouponCode: string | null = null;
  if (appliedCodCouponCode) {
    const cartProductIds = cartItemsWithProducts.map(i => i.productId);
    const couponResult = await validateCoupon(appliedCodCouponCode, userId, itemsTotalInPaise, cartProductIds);
    if ("error" in couponResult) { res.status(400).json({ error: couponResult.error }); return; }
    codDiscountInPaise = couponResult.discountInPaise;
    codValidatedCouponCode = appliedCodCouponCode;
  }

  const totalInPaise = Math.max(0, itemsTotalInPaise + shippingChargeInPaise - codDiscountInPaise);

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
    remarks,
    couponCode: codValidatedCouponCode,
    discountInPaise: codDiscountInPaise || 0,
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
        measurements: (item as any).measurements ?? null,
      }),
    ),
  );

  // Record events for COD order (placed + confirmed in one step)
  void (async () => {
    await db.insert(orderEventsTable).values({ orderId: order.id, eventType: "order_placed", title: "Order Placed", description: "Cash on Delivery" });
    await db.insert(orderEventsTable).values({ orderId: order.id, eventType: "payment_confirmed", title: "Order Confirmed", description: "COD order confirmed" });
  })();

  // Track coupon usage for COD orders (fire-and-forget)
  if (order.couponCode && order.discountInPaise > 0) {
    void (async () => {
      try {
        const [coupon] = await db.select({ id: couponsTable.id }).from(couponsTable)
          .where(eq(couponsTable.code, order.couponCode!));
        if (coupon) {
          await db.insert(couponUsagesTable).values({ couponId: coupon.id, userId, orderId: order.id });
        }
      } catch (e) {
        logger.error({ orderId: order.id, couponCode: order.couponCode, err: e }, "COD: coupon usage tracking failed");
      }
    })();
  }

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

  const reqLog = (req as any).log ?? logger;
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody   = (req as any).rawBody as Buffer | undefined;

  if (webhookSecret) {
    if (!signature || !rawBody) {
      reqLog.warn("Webhook received without signature or raw body — skipped");
      return;
    }
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (expected !== signature) {
      reqLog.warn("Webhook signature mismatch — skipped");
      return;
    }
  }
  reqLog.info({ event: req.body?.event }, "Webhook: received");

  const event = req.body?.event as string | undefined;
  const paymentEntity = req.body?.payload?.payment?.entity;
  if (!paymentEntity) return;

  const { id: paymentId, order_id: rzpOrderId, amount } = paymentEntity;

  // ── payment.captured: idempotent order confirmation ──────────────────
  if (event === "payment.captured") {
    if (paymentEntity.status !== "captured") return;

    logger.info({ paymentId, rzpOrderId }, "Webhook: payment.captured");

    try {
      const [dbOrder] = await db.select().from(ordersTable)
        .where(eq(ordersTable.razorpayOrderId, rzpOrderId));

      if (!dbOrder) {
        logger.warn({ rzpOrderId }, "Webhook: no DB order found for Razorpay order");
        return;
      }

      // Log webhook received event for audit trail
      void db.insert(orderEventsTable).values({
        orderId: dbOrder.id,
        eventType: "webhook_received",
        title: "Webhook: Payment Captured",
        description: `Event: payment.captured · Payment ID: ${paymentId}`,
      });

      if (dbOrder.status === "confirmed" || dbOrder.status === "processing" ||
          dbOrder.status === "shipped"   || dbOrder.status === "delivered") {
        logger.info({ orderId: dbOrder.id, status: dbOrder.status }, "Webhook: order already confirmed — skipping");
        return;
      }
      // Recover orders that were race-cancelled (status=cancelled, no paymentId) —
      // if Razorpay says payment.captured we must confirm them rather than drop the event.
      // Orders cancelled by admin/user after payment would already have a paymentId set.
      if (dbOrder.status === "cancelled" && !dbOrder.paymentId) {
        logger.warn({ orderId: dbOrder.id }, "Webhook: race-cancelled order with no paymentId — recovering via captured event");
        // fall through to amount check + confirmOrder
      } else if (!["pending", "payment_failed"].includes(dbOrder.status)) {
        logger.warn({ orderId: dbOrder.id, status: dbOrder.status }, "Webhook: order cannot be confirmed from current state");
        return;
      }
      if (Number(amount) !== Number(dbOrder.totalInPaise)) {
        logger.error({ paymentId, got: amount, expected: dbOrder.totalInPaise }, "Webhook: amount mismatch");
        return;
      }

      await confirmOrder(dbOrder.id, paymentId, "", dbOrder.userId);
      logger.info({ orderId: dbOrder.id }, "Webhook: order confirmed via payment.captured");
    } catch (e) {
      logger.error({ err: e, paymentId, rzpOrderId }, "Webhook: error confirming order");
    }
    return;
  }

  // ── payment.failed: mark order as payment_failed ─────────────────────
  if (event === "payment.failed") {
    logger.info({ paymentId, rzpOrderId }, "Webhook: payment.failed");

    try {
      const [dbOrder] = await db.select().from(ordersTable)
        .where(eq(ordersTable.razorpayOrderId, rzpOrderId));

      if (!dbOrder) {
        logger.warn({ rzpOrderId }, "Webhook payment.failed: no DB order found");
        return;
      }

      // Log webhook received for audit trail
      void db.insert(orderEventsTable).values({
        orderId: dbOrder.id,
        eventType: "webhook_received",
        title: "Webhook: Payment Failed",
        description: `Event: payment.failed · Payment ID: ${paymentId}`,
      });

      if (dbOrder.status !== "pending") {
        logger.info({ orderId: dbOrder.id, status: dbOrder.status }, "Webhook payment.failed: order not in pending state — skipping");
        return;
      }

      await db.update(ordersTable)
        .set({ status: "payment_failed" })
        .where(and(eq(ordersTable.id, dbOrder.id), eq(ordersTable.status, "pending")));

      await db.insert(orderEventsTable).values({
        orderId: dbOrder.id,
        eventType: "payment_failed",
        title: "Payment Failed",
        description: `Payment ID: ${paymentId}`,
      });

      logger.info({ orderId: dbOrder.id }, "Webhook: order marked payment_failed");
    } catch (e) {
      logger.error({ err: e, paymentId, rzpOrderId }, "Webhook payment.failed: error");
    }
    return;
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
  // Accept from pending/payment_failed (normal flow) AND from cancelled-with-no-paymentId
  // (race-recovery: order was race-cancelled before confirmation arrived via verify or webhook).
  const [updated] = await db.update(ordersTable)
    .set({ status: "confirmed", paymentId, razorpaySignature: signature || null })
    .where(and(
      eq(ordersTable.id, orderId),
      or(
        inArray(ordersTable.status, ["pending", "payment_failed"]),
        and(eq(ordersTable.status, "cancelled"), isNull(ordersTable.paymentId)),
      ),
    ))
    .returning();

  if (!updated) {
    // Already confirmed or in a terminal state — return existing
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    return existing;
  }

  // Fire-and-forget event insert — must NEVER block or throw back to the caller.
  // The status update above is the critical DB write; event logging is non-critical.
  void db.insert(orderEventsTable).values({
    orderId,
    eventType: "payment_verified",
    title: "Payment Confirmed",
    description: `Payment ID: ${paymentId}`,
  }).catch((e: unknown) =>
    logger.error({ orderId, err: e }, "confirmOrder: event insert failed (non-critical — order IS confirmed)"),
  );

  // Track coupon usage (fire-and-forget — order is already confirmed)
  const confirmedOrder = updated;
  if (confirmedOrder?.couponCode && confirmedOrder.discountInPaise > 0) {
    void (async () => {
      try {
        const [coupon] = await db.select({ id: couponsTable.id }).from(couponsTable)
          .where(eq(couponsTable.code, confirmedOrder.couponCode!));
        if (coupon) {
          const [alreadyUsed] = await db.select({ id: couponUsagesTable.id }).from(couponUsagesTable)
            .where(and(eq(couponUsagesTable.couponId, coupon.id), eq(couponUsagesTable.orderId, orderId)));
          if (!alreadyUsed) {
            await db.insert(couponUsagesTable).values({
              couponId: coupon.id,
              userId: confirmedOrder.userId,
              orderId: confirmedOrder.id,
            });
          }
        }
      } catch (e) {
        logger.error({ orderId, couponCode: confirmedOrder.couponCode, err: e }, "confirmOrder: coupon usage tracking failed");
      }
    })();
  }

  // Fire-and-forget fulfillment — must NEVER throw back to the caller.
  // At this point the order IS confirmed in the DB; fulfillment errors (Shiprocket,
  // email, PDF) must not surface as a 4xx/5xx to the client or webhook handler.
  void runFulfillment(updated, userId).catch((e: unknown) =>
    logger.error({ orderId, paymentId, err: e }, "confirmOrder: fulfillment failed after payment confirmed — order remains confirmed"),
  );

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
    paymentMethod: order.paymentMethod,
    paymentId: order.paymentId,
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
  const events  = await db.select().from(orderEventsTable).where(eq(orderEventsTable.orderId, orderId));
  const itemsWithDetails = await Promise.all(items.map(async (it) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
    let customization = null;
    if (it.customizationId) {
      const [c] = await db.select().from(customizationsTable).where(eq(customizationsTable.id, it.customizationId));
      customization = c ?? null;
    }
    return { ...it, product, customization };
  }));
  return { ...order, items: itemsWithDetails, events };
}

export default router;
