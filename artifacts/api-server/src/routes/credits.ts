import { Router, type IRouter } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { eq, and } from "drizzle-orm";
import {
  db,
  creditPackagesTable,
  pendingCreditPurchasesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  getUserCredits,
  ensureUserCredits,
  hasReceivedFreeGrant,
  grantFreeCredits,
  creditAccountAfterPurchase,
} from "../services/creditService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const keyId        = process.env["RAZORPAY_KEY_ID"]        ?? "";
const keySecret    = process.env["RAZORPAY_KEY_SECRET"]     ?? "";
const webhookSecret= process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

if (!keyId || !keySecret) {
  logger.warn("Razorpay not configured — RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing");
}
if (!webhookSecret) {
  logger.warn(
    "RAZORPAY_WEBHOOK_SECRET is not set — webhook endpoint is disabled. " +
    "Set it and configure https://<your-domain>/api/credits/webhook in the Razorpay dashboard " +
    "with event 'payment.captured' to enable reliable payment confirmation."
  );
}

const rzp = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Complete a pending purchase: grant credits + mark row completed. */
async function completePendingPurchase(params: {
  pendingId:         number;
  userId:            string;
  creditsAmount:     number;
  bonusCredits:      number;
  razorpayPaymentId: string;
  orderId:           string;
}) {
  const { pendingId, userId, creditsAmount, bonusCredits, razorpayPaymentId, orderId } = params;
  const creditsRemaining = await creditAccountAfterPurchase({
    userId, creditsAmount, bonusCredits, razorpayPaymentId,
  });
  await db
    .update(pendingCreditPurchasesTable)
    .set({ status: "completed", razorpayPaymentId, completedAt: new Date() })
    .where(eq(pendingCreditPurchasesTable.id, pendingId));
  logger.info({ userId, orderId, razorpayPaymentId, creditsRemaining }, "credits: purchase completed");
  return creditsRemaining;
}

/* ─── GET /credits/balance ────────────────────────────────────────────────── */
router.get("/credits/balance", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const credits = await ensureUserCredits(userId);
  const packages = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.active, true));

  res.json({
    creditsRemaining: credits.creditsRemaining,
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      creditsAmount: p.creditsAmount,
      priceInPaise: p.priceInPaise,
      bonusCredits: p.bonusCredits,
    })),
  });
});

/* ─── POST /credits/ensure-welcome ───────────────────────────────────────── */
router.post("/credits/ensure-welcome", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const alreadyGranted = await hasReceivedFreeGrant(userId);
  if (alreadyGranted) {
    const credits = await getUserCredits(userId);
    res.json({ granted: false, creditsRemaining: credits?.creditsRemaining ?? 0 });
    return;
  }
  const creditsRemaining = await grantFreeCredits(userId, 2);
  logger.info({ userId }, "credits: welcome free grant of 2 credits issued");
  res.json({ granted: true, creditsRemaining });
});

/* ─── POST /credits/purchase ──────────────────────────────────────────────── */
// Step 1: create a Razorpay order and insert a pending_credit_purchases row.
// The pending row is the source of truth — it gets completed by webhook or polling.
router.post("/credits/purchase", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const packageId = parseInt(String(req.body?.packageId ?? "0"), 10);
  if (!packageId) { res.status(400).json({ error: "packageId is required" }); return; }

  const [pkg] = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, packageId));
  if (!pkg || !pkg.active) { res.status(404).json({ error: "Package not found or inactive" }); return; }

  let rzpOrder: any;
  try {
    rzpOrder = await rzp.orders.create({
      amount: pkg.priceInPaise,
      currency: "INR",
      receipt: `cr_${userId.slice(-8)}_${Date.now()}`,
      notes: { userId, purpose: "credit_purchase", packageId: String(pkg.id), creditsAmount: String(pkg.creditsAmount) },
    } as any);
  } catch (e: any) {
    logger.error({ e, userId, packageId }, "credits/purchase: Razorpay order creation failed");
    res.status(500).json({ error: e?.error?.description || e?.message || "Failed to create payment order" });
    return;
  }

  // Insert pending purchase record — this is our source of truth for this payment.
  await db.insert(pendingCreditPurchasesTable).values({
    userId,
    razorpayOrderId: rzpOrder.id,
    packageId: pkg.id,
    amountInPaise: pkg.priceInPaise,
    status: "pending",
  });

  logger.info(
    { userId, orderId: rzpOrder.id, packageId, amountInPaise: pkg.priceInPaise },
    "credits/purchase: Razorpay order created and pending record inserted"
  );

  res.json({
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    keyId,
    package: {
      id: pkg.id,
      name: pkg.name,
      creditsAmount: pkg.creditsAmount,
      bonusCredits: pkg.bonusCredits,
    },
  });
});

/* ─── POST /credits/verify ────────────────────────────────────────────────── */
// Called by the Razorpay checkout.js handler callback (in-browser payment path).
// Verifies the HMAC signature, then completes the pending purchase.
router.post("/credits/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const {
    razorpayOrderId, razorpayPaymentId, razorpaySignature, packageId: rawPackageId,
  } = req.body ?? {};

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !rawPackageId) {
    logger.warn({ userId, razorpayOrderId }, "credits/verify: missing fields in request body");
    res.status(400).json({ error: "Missing required payment verification fields" });
    return;
  }

  // Verify HMAC signature — rejects any tampered response.
  const expectedSig = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSig !== razorpaySignature) {
    logger.error(
      { userId, razorpayOrderId, razorpayPaymentId, expectedSig, receivedSig: razorpaySignature },
      "credits/verify: HMAC signature mismatch — possible tampering or key mode mismatch (test vs live)"
    );
    res.status(400).json({ error: "Payment verification failed — invalid signature" });
    return;
  }

  // Find the pending purchase record for this order.
  const [pending] = await db
    .select()
    .from(pendingCreditPurchasesTable)
    .where(eq(pendingCreditPurchasesTable.razorpayOrderId, razorpayOrderId));

  if (!pending) {
    logger.warn({ userId, razorpayOrderId }, "credits/verify: no pending purchase found for order");
    // Fallback: look up the package from the request body.
  }

  const packageId = pending?.packageId ?? parseInt(String(rawPackageId), 10);
  const [pkg] = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, packageId));
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

  // If already completed (e.g. webhook got here first), just return current balance.
  if (pending?.status === "completed") {
    const credits = await getUserCredits(userId);
    logger.info({ userId, razorpayOrderId }, "credits/verify: already completed (webhook was faster)");
    res.json({ success: true, creditsRemaining: credits?.creditsRemaining ?? 0 });
    return;
  }

  const creditsRemaining = pending
    ? await completePendingPurchase({
        pendingId: pending.id,
        userId,
        creditsAmount: pkg.creditsAmount,
        bonusCredits: pkg.bonusCredits,
        razorpayPaymentId,
        orderId: razorpayOrderId,
      })
    : await creditAccountAfterPurchase({
        userId,
        creditsAmount: pkg.creditsAmount,
        bonusCredits: pkg.bonusCredits,
        razorpayPaymentId,
      });

  logger.info({ userId, packageId, razorpayOrderId, razorpayPaymentId, creditsRemaining }, "credits/verify: success");
  res.json({ success: true, creditsRemaining });
});

/* ─── GET /credits/purchase-status/:orderId ──────────────────────────────── */
// Frontend polls this every 3 s after creating an order.
// Returns { status: "pending"|"completed", creditsRemaining? }.
// Does NOT call Razorpay — it reads our own DB, so it's fast and free.
router.get("/credits/purchase-status/:orderId", requireAuth, async (req, res): Promise<void> => {
  const userId  = (req as AuthenticatedRequest).userId;
  const orderId = String(req.params["orderId"] ?? "");

  const [pending] = await db
    .select()
    .from(pendingCreditPurchasesTable)
    .where(
      and(
        eq(pendingCreditPurchasesTable.razorpayOrderId, orderId),
        eq(pendingCreditPurchasesTable.userId, userId),
      )
    );

  if (!pending) {
    res.status(404).json({ error: "Order not found" }); return;
  }

  if (pending.status === "completed") {
    const credits = await getUserCredits(userId);
    res.json({ status: "completed", creditsRemaining: credits?.creditsRemaining ?? 0 });
    return;
  }

  res.json({ status: "pending" });
});

/* ─── POST /credits/check-order ──────────────────────────────────────────── */
// Called by the "I've already paid" button and background polling fallback.
// Queries Razorpay directly for the order status; if paid, completes the purchase.
router.post("/credits/check-order", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!rzp) { res.status(500).json({ error: "Razorpay not configured" }); return; }

  const { orderId } = req.body ?? {};
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  // Look up our pending record first.
  const [pending] = await db
    .select()
    .from(pendingCreditPurchasesTable)
    .where(
      and(
        eq(pendingCreditPurchasesTable.razorpayOrderId, orderId),
        eq(pendingCreditPurchasesTable.userId, userId),
      )
    );

  if (!pending) {
    res.status(404).json({ error: "Order not found" }); return;
  }

  // Already completed (e.g. webhook fired while user was waiting).
  if (pending.status === "completed") {
    const credits = await getUserCredits(userId);
    res.json({ paid: true, creditsRemaining: credits?.creditsRemaining ?? 0, source: "already_completed" });
    return;
  }

  const [pkg] = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, pending.packageId));
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

  // Fetch the Razorpay order to check its top-level status.
  let rzpOrder: any;
  try {
    rzpOrder = await rzp.orders.fetch(orderId);
  } catch (e: any) {
    logger.error({ e, orderId, userId }, "credits/check-order: Razorpay order fetch failed");
    res.status(502).json({ error: "Could not reach Razorpay" }); return;
  }

  logger.info(
    { orderId, userId, orderStatus: rzpOrder?.status, amountPaid: rzpOrder?.amount_paid, amountDue: rzpOrder?.amount_due },
    "credits/check-order: Razorpay order status"
  );

  // Order not paid yet.
  if (rzpOrder?.status !== "paid") {
    res.json({ paid: false, razorpayOrderStatus: rzpOrder?.status }); return;
  }

  // Order is paid — get the payment ID.
  let paymentId: string | undefined;
  try {
    const orderPayments: any = await (rzp.orders as any).fetchPayments(orderId);
    const items: any[] = orderPayments?.items ?? [];
    logger.info(
      { orderId, paymentCount: items.length, payments: items.map((p: any) => ({ id: p.id, status: p.status, method: p.method })) },
      "credits/check-order: order payments"
    );
    const hit = items.find((p: any) => p.status === "captured" || p.status === "authorized");
    paymentId = hit?.id;
  } catch (e: any) {
    logger.warn({ e, orderId }, "credits/check-order: fetchPayments failed — using synthetic ID");
  }

  // Fallback: use a synthetic ID if payment list is unavailable.
  const effectivePaymentId = paymentId ?? `rzp_order_paid_${orderId}`;

  const creditsRemaining = await completePendingPurchase({
    pendingId: pending.id,
    userId,
    creditsAmount: pkg.creditsAmount,
    bonusCredits: pkg.bonusCredits,
    razorpayPaymentId: effectivePaymentId,
    orderId,
  });

  res.json({ paid: true, creditsRemaining, source: "check_order" });
});

// Webhook routes are handled by the unified razorpayWebhook router (routes/razorpayWebhook.ts).
// The old /credits/webhook path is aliased there so existing Razorpay dashboard configs keep working.


export default router;
