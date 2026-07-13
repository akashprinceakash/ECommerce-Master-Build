/**
 * Unified Razorpay Webhook Handler
 *
 * Single endpoint handling ALL Razorpay events for both product orders and AI credits.
 * This is the source of truth for payment confirmation — the frontend verify calls are
 * the fast path for immediate UI updates, but this webhook guarantees completion even
 * if the browser closes, times out, or the frontend callback never fires.
 *
 * Setup (one-time, in Razorpay dashboard → Settings → Webhooks):
 *   URL:    https://api.kashaonline.in/api/webhooks/razorpay
 *   Events: payment.authorized, payment.captured, payment.failed,
 *           order.paid, refund.created, refund.processed, refund.failed
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET env var
 *
 * Purpose routing:
 *   Razorpay order notes.purpose = "order_payment"  → product checkout
 *   Razorpay order notes.purpose = "credit_purchase" → AI credits
 *   Fallback: DB lookup (handles legacy orders without a purpose note)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderEventsTable,
  refundsTable,
  pendingCreditPurchasesTable,
  creditPackagesTable,
} from "@workspace/db";
import { confirmOrder } from "./payments";
import { creditAccountAfterPurchase } from "../services/creditService";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

if (!webhookSecret) {
  logger.warn(
    "RAZORPAY_WEBHOOK_SECRET is not set — webhook signature verification is DISABLED. " +
    "Set this env var and configure https://api.kashaonline.in/api/webhooks/razorpay " +
    "in the Razorpay dashboard with events: payment.captured, payment.failed, order.paid, " +
    "payment.authorized, refund.created, refund.processed, refund.failed"
  );
}

/* ── HMAC signature verification ─────────────────────────────────────────────
   Uses the rawBody Buffer captured by express.json's `verify` callback (app.ts).
   This ensures the exact bytes Razorpay signed are what we verify — not a
   re-serialised JSON which may differ in key ordering or whitespace.
   If RAZORPAY_WEBHOOK_SECRET is not set, verification is skipped (dev mode). */
function verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!webhookSecret) return true;
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/* ── Purpose detection ────────────────────────────────────────────────────────
   Determines whether the payment belongs to a product order or a credit purchase.
   Checks notes.purpose first (fast, O(1)). Falls back to DB lookup for legacy
   orders created before the purpose note was added. */
type Purpose = "order_payment" | "credit_purchase" | "unknown";

interface ResolvedContext {
  purpose: Purpose;
  orderId?: number;
  dbUserId?: string;
  pendingPurchaseId?: number;
  packageId?: number;
}

async function detectPurpose(rzpOrderId: string, notes: Record<string, string>): Promise<ResolvedContext> {
  const notePurpose = notes["purpose"] ?? "";

  // Fast path: explicit purpose note
  if (notePurpose === "order_payment") {
    const [order] = await db.select({ id: ordersTable.id, userId: ordersTable.userId })
      .from(ordersTable).where(eq(ordersTable.razorpayOrderId, rzpOrderId));
    if (order) return { purpose: "order_payment", orderId: order.id, dbUserId: order.userId };
  }

  if (notePurpose === "credit_purchase") {
    const [p] = await db.select({ id: pendingCreditPurchasesTable.id, userId: pendingCreditPurchasesTable.userId, packageId: pendingCreditPurchasesTable.packageId })
      .from(pendingCreditPurchasesTable).where(eq(pendingCreditPurchasesTable.razorpayOrderId, rzpOrderId));
    if (p) return { purpose: "credit_purchase", pendingPurchaseId: p.id, dbUserId: p.userId, packageId: p.packageId };
  }

  // Fallback: no purpose note or not found — check both tables (handles legacy orders)
  const [order] = await db.select({ id: ordersTable.id, userId: ordersTable.userId })
    .from(ordersTable).where(eq(ordersTable.razorpayOrderId, rzpOrderId));
  if (order) return { purpose: "order_payment", orderId: order.id, dbUserId: order.userId };

  const [p] = await db.select({ id: pendingCreditPurchasesTable.id, userId: pendingCreditPurchasesTable.userId, packageId: pendingCreditPurchasesTable.packageId })
    .from(pendingCreditPurchasesTable).where(eq(pendingCreditPurchasesTable.razorpayOrderId, rzpOrderId));
  if (p) return { purpose: "credit_purchase", pendingPurchaseId: p.id, dbUserId: p.userId, packageId: p.packageId };

  return { purpose: "unknown" };
}

/* ── Credit purchase completion ───────────────────────────────────────────────
   Grants credits and marks the pending_credit_purchases row as completed.
   Idempotent: creditAccountAfterPurchase deduplicates on razorpayPaymentId. */
async function completeCreditPurchase(params: {
  pendingPurchaseId: number;
  userId: string;
  packageId: number;
  razorpayPaymentId: string;
  rzpOrderId: string;
}) {
  const { pendingPurchaseId, userId, packageId, razorpayPaymentId, rzpOrderId } = params;

  const [pkg] = await db.select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, packageId));
  if (!pkg) {
    logger.error({ packageId, rzpOrderId }, "webhook: credit package not found — cannot complete purchase");
    return;
  }

  const creditsRemaining = await creditAccountAfterPurchase({
    userId,
    creditsAmount: pkg.creditsAmount,
    bonusCredits: pkg.bonusCredits,
    razorpayPaymentId,
  });

  await db.update(pendingCreditPurchasesTable)
    .set({ status: "completed", razorpayPaymentId, completedAt: new Date() })
    .where(eq(pendingCreditPurchasesTable.id, pendingPurchaseId));

  logger.info({ userId, packageId, razorpayPaymentId, creditsRemaining, rzpOrderId }, "webhook: credit purchase completed and credits granted");
}

/* ── Refund event handler ─────────────────────────────────────────────────────
   Maintains the refunds table and adds order events for audit trail. */
async function handleRefundEvent(event: string, refundEntity: Record<string, any>) {
  const refundId  = String(refundEntity["id"]         ?? "");
  const paymentId = String(refundEntity["payment_id"] ?? "");
  const amount    = Number(refundEntity["amount"]     ?? 0);
  const status    = String(refundEntity["status"]     ?? event.replace("refund.", ""));
  const reason    = String(refundEntity["description"] ?? refundEntity["reason"] ?? "");

  if (!refundId || !paymentId) {
    logger.warn({ event, refundEntity }, "webhook: refund entity missing id or payment_id");
    return;
  }

  logger.info({ event, refundId, paymentId, amount, status }, "webhook: handling refund event");

  if (event === "refund.created") {
    const [order] = await db.select({ id: ordersTable.id })
      .from(ordersTable).where(eq(ordersTable.paymentId, paymentId));
    if (!order) {
      logger.warn({ refundId, paymentId }, "webhook: refund.created — no order found for payment_id");
      return;
    }

    try {
      await db.insert(refundsTable).values({
        orderId: order.id,
        razorpayRefundId: refundId,
        razorpayPaymentId: paymentId,
        amountInPaise: amount,
        status,
        reason: reason || null,
        initiatedBy: "razorpay_webhook",
      });
      void db.insert(orderEventsTable).values({
        orderId: order.id,
        eventType: "refund_created",
        title: "Refund Initiated",
        description: `Refund ID: ${refundId} · ₹${(amount / 100).toFixed(2)}`,
      });
      logger.info({ orderId: order.id, refundId, amountInPaise: amount }, "webhook: refund.created recorded");
    } catch (e: any) {
      if (e?.code === "23505") {
        logger.info({ refundId }, "webhook: refund already recorded — skipping");
      } else {
        logger.error({ e, refundId, paymentId }, "webhook: failed to record refund.created");
      }
    }
    return;
  }

  if (event === "refund.processed" || event === "refund.failed") {
    await db.update(refundsTable)
      .set({ status })
      .where(eq(refundsTable.razorpayRefundId, refundId));

    const [refundRow] = await db.select({ orderId: refundsTable.orderId })
      .from(refundsTable).where(eq(refundsTable.razorpayRefundId, refundId));
    if (refundRow) {
      void db.insert(orderEventsTable).values({
        orderId: refundRow.orderId,
        eventType: event === "refund.processed" ? "refund_processed" : "refund_failed",
        title: event === "refund.processed" ? "Refund Processed" : "Refund Failed",
        description: `Refund ID: ${refundId}`,
      });
    }
    logger.info({ refundId, event, status }, `webhook: ${event} recorded`);
  }
}

/* ── Core event processor ─────────────────────────────────────────────────────
   Called after signature verification. All paths are fully idempotent. */
async function processWebhookEvent(body: any) {
  const event          = String(body?.event ?? "");
  const paymentEntity  = body?.payload?.payment?.entity  ?? {};
  const orderEntity    = body?.payload?.order?.entity    ?? {};
  const refundEntity   = body?.payload?.refund?.entity   ?? {};

  const paymentId  = String(paymentEntity["id"]       ?? "");
  const rzpOrderId = String(paymentEntity["order_id"] ?? orderEntity["id"] ?? "");
  const amount     = Number(paymentEntity["amount"]   ?? 0);
  const notes: Record<string, string> = { ...(orderEntity["notes"] ?? {}), ...(paymentEntity["notes"] ?? {}) };
  const userId     = String(notes["userId"] ?? notes["user_id"] ?? "");

  logger.info({ event, paymentId, rzpOrderId, userId, amount }, "webhook: processing event");

  /* ── Refund events ── */
  if (event.startsWith("refund.")) {
    await handleRefundEvent(event, refundEntity);
    return;
  }

  /* ── All other events need a Razorpay order ID ── */
  if (!rzpOrderId) {
    logger.warn({ event, paymentId }, "webhook: missing rzpOrderId — skipping");
    return;
  }

  const ctx = await detectPurpose(rzpOrderId, notes);
  logger.info({ event, rzpOrderId, ...ctx }, "webhook: context resolved");

  /* ════════════════════════════════════════════════
     payment.captured — primary success event
     Both order_payment and credit_purchase handled.
  ════════════════════════════════════════════════ */
  if (event === "payment.captured") {
    if (paymentEntity["status"] !== "captured") {
      logger.warn({ paymentId, status: paymentEntity["status"] }, "webhook: payment.captured but status != captured");
      return;
    }

    /* Order payment */
    if (ctx.purpose === "order_payment" && ctx.orderId) {
      const [dbOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, ctx.orderId));
      if (!dbOrder) { logger.warn({ orderId: ctx.orderId }, "webhook: order not found"); return; }

      void db.insert(orderEventsTable).values({
        orderId: ctx.orderId,
        eventType: "webhook_received",
        title: "Webhook: Payment Captured",
        description: `Payment ID: ${paymentId} · Razorpay Order: ${rzpOrderId}`,
      });

      if (["confirmed", "processing", "shipped", "delivered"].includes(dbOrder.status)) {
        logger.info({ orderId: ctx.orderId, status: dbOrder.status }, "webhook: order already confirmed — idempotent skip");
        return;
      }
      if (dbOrder.status === "cancelled" && !dbOrder.paymentId) {
        logger.warn({ orderId: ctx.orderId }, "webhook: race-cancelled order (no paymentId) — recovering");
        // fall through to confirmOrder
      } else if (!["pending", "payment_failed"].includes(dbOrder.status)) {
        logger.warn({ orderId: ctx.orderId, status: dbOrder.status }, "webhook: cannot confirm from current state");
        return;
      }
      if (amount > 0 && Number(amount) !== Number(dbOrder.totalInPaise)) {
        logger.error({ orderId: ctx.orderId, got: amount, expected: dbOrder.totalInPaise }, "webhook: amount mismatch — not confirming");
        return;
      }

      await confirmOrder(ctx.orderId, paymentId, "", ctx.dbUserId ?? dbOrder.userId);
      logger.info({ orderId: ctx.orderId, paymentId }, "webhook: order confirmed via payment.captured ✓");
      return;
    }

    /* Credit purchase */
    if (ctx.purpose === "credit_purchase" && ctx.pendingPurchaseId && ctx.packageId) {
      const [pending] = await db.select()
        .from(pendingCreditPurchasesTable)
        .where(eq(pendingCreditPurchasesTable.id, ctx.pendingPurchaseId));
      if (!pending) { logger.warn({ pendingPurchaseId: ctx.pendingPurchaseId }, "webhook: pending purchase not found"); return; }
      if (pending.status === "completed") {
        logger.info({ pendingPurchaseId: ctx.pendingPurchaseId }, "webhook: credit purchase already completed — idempotent skip");
        return;
      }

      await completeCreditPurchase({
        pendingPurchaseId: ctx.pendingPurchaseId,
        userId: pending.userId,
        packageId: ctx.packageId,
        razorpayPaymentId: paymentId,
        rzpOrderId,
      });
      return;
    }

    logger.warn({ rzpOrderId, purpose: ctx.purpose, paymentId }, "webhook: payment.captured — no handler found for purpose");
    return;
  }

  /* ════════════════════════════════════════════════
     order.paid — fires when Razorpay order is fully paid.
     Useful as a secondary trigger (payment.captured should
     already have fired, but this acts as a belt-and-suspenders).
  ════════════════════════════════════════════════ */
  if (event === "order.paid") {
    if (ctx.purpose === "order_payment" && ctx.orderId) {
      const [dbOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, ctx.orderId));
      if (!dbOrder) { logger.warn({ orderId: ctx.orderId }, "webhook: order.paid — order not found"); return; }

      if (["confirmed", "processing", "shipped", "delivered"].includes(dbOrder.status)) {
        logger.info({ orderId: ctx.orderId, status: dbOrder.status }, "webhook: order.paid — already confirmed");
        return;
      }

      if (!paymentId) { logger.warn({ orderId: ctx.orderId }, "webhook: order.paid without payment ID"); return; }

      await confirmOrder(ctx.orderId, paymentId, "", ctx.dbUserId ?? dbOrder.userId);
      logger.info({ orderId: ctx.orderId, paymentId }, "webhook: order confirmed via order.paid ✓");
    }

    if (ctx.purpose === "credit_purchase" && ctx.pendingPurchaseId && ctx.packageId) {
      const [pending] = await db.select().from(pendingCreditPurchasesTable)
        .where(eq(pendingCreditPurchasesTable.id, ctx.pendingPurchaseId));
      if (pending && pending.status !== "completed" && paymentId) {
        await completeCreditPurchase({
          pendingPurchaseId: ctx.pendingPurchaseId,
          userId: pending.userId,
          packageId: ctx.packageId,
          razorpayPaymentId: paymentId,
          rzpOrderId,
        });
      }
    }
    return;
  }

  /* ════════════════════════════════════════════════
     payment.authorized — payment held, capture pending.
     With payment_capture:1 on the order, Razorpay auto-captures
     shortly after and fires payment.captured. Just log it.
  ════════════════════════════════════════════════ */
  if (event === "payment.authorized") {
    if (ctx.purpose === "order_payment" && ctx.orderId) {
      void db.insert(orderEventsTable).values({
        orderId: ctx.orderId,
        eventType: "payment_authorized",
        title: "Payment Authorized",
        description: `Payment ID: ${paymentId} · awaiting capture`,
      });
      logger.info({ orderId: ctx.orderId, paymentId }, "webhook: payment.authorized — awaiting capture");
    }
    if (ctx.purpose === "credit_purchase") {
      logger.info({ pendingPurchaseId: ctx.pendingPurchaseId, paymentId }, "webhook: credit payment authorized — awaiting capture");
    }
    return;
  }

  /* ════════════════════════════════════════════════
     payment.failed — mark order as payment_failed.
  ════════════════════════════════════════════════ */
  if (event === "payment.failed") {
    logger.info({ paymentId, rzpOrderId, purpose: ctx.purpose }, "webhook: payment.failed");

    if (ctx.purpose === "order_payment" && ctx.orderId) {
      const [dbOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, ctx.orderId));
      if (!dbOrder) return;

      void db.insert(orderEventsTable).values({
        orderId: ctx.orderId,
        eventType: "webhook_received",
        title: "Webhook: Payment Failed",
        description: `Payment ID: ${paymentId}`,
      });

      if (dbOrder.status !== "pending") {
        logger.info({ orderId: ctx.orderId, status: dbOrder.status }, "webhook: payment.failed — order not pending, skipping");
        return;
      }

      await db.update(ordersTable)
        .set({ status: "payment_failed" })
        .where(and(eq(ordersTable.id, ctx.orderId), eq(ordersTable.status, "pending")));
      void db.insert(orderEventsTable).values({
        orderId: ctx.orderId,
        eventType: "payment_failed",
        title: "Payment Failed",
        description: `Payment ID: ${paymentId}`,
      });
      logger.info({ orderId: ctx.orderId, paymentId }, "webhook: order marked payment_failed");
    }

    if (ctx.purpose === "credit_purchase" && ctx.pendingPurchaseId) {
      await db.update(pendingCreditPurchasesTable)
        .set({ status: "failed" })
        .where(and(eq(pendingCreditPurchasesTable.id, ctx.pendingPurchaseId), eq(pendingCreditPurchasesTable.status, "pending")));
      logger.info({ pendingPurchaseId: ctx.pendingPurchaseId, paymentId }, "webhook: credit purchase marked failed");
    }
    return;
  }

  logger.info({ event }, "webhook: unhandled event type — ignoring");
}

/* ── Route handler ────────────────────────────────────────────────────────────
   ACK with 200 immediately, then process async.
   Razorpay retries on non-200 up to ~15 times over 24 hours. */
async function razorpayWebhookHandler(req: Request, res: Response): Promise<void> {
  // Always ACK immediately so Razorpay doesn't retry unnecessarily.
  res.status(200).json({ ok: true });

  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody   = (req as any).rawBody as Buffer | undefined;

  logger.info(
    { event: req.body?.event, hasSig: !!signature, hasRawBody: !!rawBody },
    "webhook: received"
  );

  if (!verifySignature(rawBody, signature)) {
    logger.error(
      { sig: signature, hasRawBody: !!rawBody, event: req.body?.event },
      "webhook: HMAC signature mismatch — rejecting"
    );
    return;
  }

  try {
    await processWebhookEvent(req.body);
  } catch (e) {
    logger.error({ e, event: req.body?.event }, "webhook: unhandled error in processWebhookEvent");
  }
}

/* ── Routes ───────────────────────────────────────────────────────────────────
   Primary:  POST /api/webhooks/razorpay  ← new canonical URL
   Aliases:  POST /api/payment/webhook   ← legacy (keep working during transition)
             POST /api/credits/webhook   ← legacy (keep working during transition) */
router.post("/webhooks/razorpay", razorpayWebhookHandler);
router.post("/payment/webhook",   razorpayWebhookHandler);
router.post("/credits/webhook",   razorpayWebhookHandler);

export default router;
