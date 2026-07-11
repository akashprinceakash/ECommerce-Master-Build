import { Router, type IRouter } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { eq } from "drizzle-orm";
import { db, creditPackagesTable } from "@workspace/db";
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

const keyId     = process.env["RAZORPAY_KEY_ID"]     ?? "";
const keySecret = process.env["RAZORPAY_KEY_SECRET"]  ?? "";
const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

const rzp = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

/* ── GET /credits/balance ────────────────────────────────────────────────── */
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

/* ── POST /credits/ensure-welcome ────────────────────────────────────────── */
// Called on first Lookbook/Bespoke visit to auto-grant 2 free credits.
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

/* ── POST /credits/purchase ──────────────────────────────────────────────── */
// Step 1: create Razorpay order for the chosen credit package.
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
      notes: { userId, packageId: String(pkg.id), creditsAmount: String(pkg.creditsAmount) },
    } as any);
  } catch (e: any) {
    res.status(500).json({ error: e?.error?.description || e?.message || "Failed to create payment order" });
    return;
  }

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

/* ── POST /credits/verify ────────────────────────────────────────────────── */
// Step 2: verify Razorpay signature, then credit the account.
router.post("/credits/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const {
    razorpayOrderId, razorpayPaymentId, razorpaySignature, packageId: rawPackageId,
  } = req.body ?? {};

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !rawPackageId) {
    res.status(400).json({ error: "Missing required payment verification fields" });
    return;
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expectedSig !== razorpaySignature) {
    logger.warn({ userId, razorpayOrderId }, "credits/verify: invalid signature");
    res.status(400).json({ error: "Payment verification failed — invalid signature" });
    return;
  }

  const packageId = parseInt(String(rawPackageId), 10);
  const [pkg] = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, packageId));
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

  const creditsRemaining = await creditAccountAfterPurchase({
    userId,
    creditsAmount: pkg.creditsAmount,
    bonusCredits: pkg.bonusCredits,
    razorpayPaymentId,
  });

  logger.info({ userId, packageId, creditsRemaining }, "credits: purchase verified and credited");
  res.json({ success: true, creditsRemaining });
});

/* ── Razorpay webhook (payment.captured) ─────────────────────────────────── */
// Fallback for cases where the frontend /verify call doesn't complete.
router.post("/credits/webhook", async (req, res): Promise<void> => {
  if (!webhookSecret) { res.status(200).json({}); return; }

  const sig = req.headers["x-razorpay-signature"] as string;
  const rawBody = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  if (sig !== expected) { res.status(400).json({ error: "Invalid signature" }); return; }

  const event = req.body?.event;
  if (event !== "payment.captured") { res.status(200).json({}); return; }

  const payment = req.body?.payload?.payment?.entity;
  const notes   = payment?.notes ?? {};
  const userId       = String(notes.userId        ?? "");
  const packageId    = parseInt(String(notes.packageId  ?? "0"), 10);
  const paymentId    = String(payment?.id ?? "");

  if (!userId || !packageId || !paymentId) { res.status(200).json({}); return; }

  const [pkg] = await db
    .select()
    .from(creditPackagesTable)
    .where(eq(creditPackagesTable.id, packageId));
  if (!pkg) { res.status(200).json({}); return; }

  await creditAccountAfterPurchase({
    userId,
    creditsAmount: pkg.creditsAmount,
    bonusCredits: pkg.bonusCredits,
    razorpayPaymentId: paymentId,
  });
  logger.info({ userId, packageId, paymentId }, "credits: webhook credited account");
  res.status(200).json({});
});

export default router;
