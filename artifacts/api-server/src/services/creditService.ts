import { eq, and, sql, sum, count } from "drizzle-orm";
import {
  db,
  userCreditsTable,
  creditTransactionsTable,
  generationLogsTable,
  creditPackagesTable,
  replicateTopupsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

/** Published IDM-VTON per-second billing rate (USD). Update if Replicate changes pricing. */
export const IDM_VTON_COST_PER_SECOND_USD = 0.000225;

/** Alert thresholds for estimated Replicate balance (USD). */
export const BALANCE_THRESHOLD_WARN  = 20;
export const BALANCE_THRESHOLD_RED   = 10;
export const BALANCE_THRESHOLD_PAUSE = 5;

// ── Internal config ──────────────────────────────────────────────────────────

/** Set to true by the hourly cron when balance < BALANCE_THRESHOLD_PAUSE. */
let _generationsDisabled = false;

export function areGenerationsDisabled(): boolean {
  return _generationsDisabled;
}
export function setGenerationsDisabled(v: boolean): void {
  _generationsDisabled = v;
}

// ── Credit ledger ────────────────────────────────────────────────────────────

export async function getUserCredits(userId: string) {
  const [row] = await db
    .select()
    .from(userCreditsTable)
    .where(eq(userCreditsTable.userId, userId));
  return row ?? null;
}

export async function ensureUserCredits(userId: string) {
  const existing = await getUserCredits(userId);
  if (existing) return existing;
  const [row] = await db
    .insert(userCreditsTable)
    .values({ userId })
    .returning();
  return row!;
}

export async function hasReceivedFreeGrant(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: creditTransactionsTable.id })
    .from(creditTransactionsTable)
    .where(
      and(
        eq(creditTransactionsTable.userId, userId),
        eq(creditTransactionsTable.type, "free_grant"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Grant free credits to a user. Idempotent for the `welcome` grant
 * (caller should check `hasReceivedFreeGrant` first for that).
 */
export async function grantFreeCredits(userId: string, amount: number): Promise<number> {
  return await db.transaction(async (tx) => {
    await tx
      .insert(userCreditsTable)
      .values({ userId, creditsRemaining: amount })
      .onConflictDoUpdate({
        target: userCreditsTable.userId,
        set: {
          creditsRemaining: sql`${userCreditsTable.creditsRemaining} + ${amount}`,
          updatedAt: new Date(),
        },
      });
    await tx.insert(creditTransactionsTable).values({
      userId,
      type: "free_grant",
      creditsDelta: amount,
    });
    const [row] = await tx
      .select({ r: userCreditsTable.creditsRemaining })
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId));
    return row?.r ?? 0;
  });
}

// ── Generation log helpers ───────────────────────────────────────────────────

export async function insertGenerationLog(params: {
  userId: string;
  generationType: string;
  replicatePredictionId: string;
}): Promise<number> {
  const [row] = await db
    .insert(generationLogsTable)
    .values({
      userId: params.userId,
      generationType: params.generationType,
      replicatePredictionId: params.replicatePredictionId,
      replicateStatus: "pending",
    })
    .returning({ id: generationLogsTable.id });
  return row!.id;
}

export async function insertFailedGenerationLog(params: {
  userId: string;
  generationType: string;
  errorMessage: string;
}): Promise<void> {
  await db.insert(generationLogsTable).values({
    userId: params.userId,
    generationType: params.generationType,
    replicatePredictionId: "failed-before-start",
    replicateStatus: "failed",
    errorMessage: params.errorMessage,
    completedAt: new Date(),
  });
}

export async function updateGenerationLog(
  id: number,
  params: {
    replicateStatus: "succeeded" | "failed";
    predictTimeSeconds?: number;
    replicateCostUsd?: number;
    errorMessage?: string;
  },
): Promise<void> {
  await db
    .update(generationLogsTable)
    .set({
      replicateStatus: params.replicateStatus,
      predictTimeSeconds:
        params.predictTimeSeconds != null
          ? params.predictTimeSeconds.toString()
          : undefined,
      replicateCostUsd:
        params.replicateCostUsd != null
          ? params.replicateCostUsd.toString()
          : undefined,
      errorMessage: params.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(generationLogsTable.id, id));
}

// ── Atomic credit deduction ──────────────────────────────────────────────────

/**
 * Atomically deduct 1 credit and mark the generation log as deducted.
 * Must only be called AFTER Replicate has accepted the prediction.
 */
export async function deductCreditForGeneration(params: {
  userId: string;
  generationLogId: number;
}): Promise<void> {
  const { userId, generationLogId } = params;
  await db.transaction(async (tx) => {
    await tx
      .update(userCreditsTable)
      .set({
        creditsRemaining: sql`GREATEST(${userCreditsTable.creditsRemaining} - 1, 0)`,
        totalCreditsUsed: sql`${userCreditsTable.totalCreditsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userCreditsTable.userId, userId));

    await tx.insert(creditTransactionsTable).values({
      userId,
      type: "generation_deduct",
      creditsDelta: -1,
      relatedGenerationId: generationLogId,
    });

    await tx
      .update(generationLogsTable)
      .set({ creditDeducted: true })
      .where(eq(generationLogsTable.id, generationLogId));
  });
}

// ── Credit purchase (Razorpay) ───────────────────────────────────────────────

/**
 * Credit the user's account after a verified Razorpay payment.
 * Idempotent on razorpayPaymentId — a duplicate payment ID is silently skipped.
 */
export async function creditAccountAfterPurchase(params: {
  userId: string;
  creditsAmount: number;
  bonusCredits: number;
  razorpayPaymentId: string;
}): Promise<number> {
  const { userId, creditsAmount, bonusCredits, razorpayPaymentId } = params;
  const total = creditsAmount + bonusCredits;

  // Idempotency: skip if this paymentId was already processed
  const [existing] = await db
    .select({ id: creditTransactionsTable.id })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.razorpayPaymentId, razorpayPaymentId))
    .limit(1);
  if (existing) {
    logger.warn({ razorpayPaymentId, userId }, "creditAccountAfterPurchase: duplicate payment ID — skipping");
    const [row] = await db
      .select({ r: userCreditsTable.creditsRemaining })
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId));
    return row?.r ?? 0;
  }

  return await db.transaction(async (tx) => {
    await tx
      .insert(userCreditsTable)
      .values({ userId, creditsRemaining: total, totalCreditsPurchased: creditsAmount })
      .onConflictDoUpdate({
        target: userCreditsTable.userId,
        set: {
          creditsRemaining: sql`${userCreditsTable.creditsRemaining} + ${total}`,
          totalCreditsPurchased: sql`${userCreditsTable.totalCreditsPurchased} + ${creditsAmount}`,
          updatedAt: new Date(),
        },
      });

    await tx.insert(creditTransactionsTable).values({
      userId,
      type: "purchase",
      creditsDelta: creditsAmount,
      razorpayPaymentId,
    });

    if (bonusCredits > 0) {
      await tx.insert(creditTransactionsTable).values({
        userId,
        type: "purchase_bonus",
        creditsDelta: bonusCredits,
        razorpayPaymentId,
      });
    }

    const [row] = await tx
      .select({ r: userCreditsTable.creditsRemaining })
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId));
    return row?.r ?? 0;
  });
}

// ── Replicate balance estimate ───────────────────────────────────────────────

export async function getEstimatedReplicateBalance(): Promise<{
  totalTopupsUsd: number;
  totalCostUsd: number;
  estimatedBalanceUsd: number;
}> {
  const [topupRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${replicateTopupsTable.amountUsd}), 0)` })
    .from(replicateTopupsTable);

  const [costRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${generationLogsTable.replicateCostUsd}), 0)`,
    })
    .from(generationLogsTable)
    .where(eq(generationLogsTable.replicateStatus, "succeeded"));

  const totalTopupsUsd   = parseFloat(topupRow?.total ?? "0");
  const totalCostUsd     = parseFloat(costRow?.total  ?? "0");
  const estimatedBalanceUsd = totalTopupsUsd - totalCostUsd;

  return { totalTopupsUsd, totalCostUsd, estimatedBalanceUsd };
}

// ── Admin: log a Replicate top-up ────────────────────────────────────────────

export async function logReplicateTopup(params: {
  amountUsd: number;
  adminId: string;
  notes?: string;
}): Promise<void> {
  await db.insert(replicateTopupsTable).values({
    amountUsd: params.amountUsd.toFixed(2),
    addedByAdminId: params.adminId,
    notes: params.notes ?? null,
  });
}

// ── Admin: grant credits to any user ────────────────────────────────────────

export async function adminGrantCredits(params: {
  targetUserId: string;
  amount: number;
}): Promise<number> {
  const { targetUserId, amount } = params;
  if (amount <= 0) throw new Error("Amount must be a positive integer");
  return grantFreeCredits(targetUserId, amount);
}

// ── Seed default credit packages (called once on startup) ───────────────────

export async function seedDefaultPackages(): Promise<void> {
  const existing = await db.select({ id: creditPackagesTable.id }).from(creditPackagesTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(creditPackagesTable).values([
    { name: "1 Credit",   creditsAmount: 1,  priceInPaise: 4900,  bonusCredits: 0 },
    { name: "3 Credits",  creditsAmount: 3,  priceInPaise: 12900, bonusCredits: 0 },
    { name: "5 Credits",  creditsAmount: 5,  priceInPaise: 19900, bonusCredits: 0 },
    { name: "10 Credits", creditsAmount: 10, priceInPaise: 34900, bonusCredits: 0 },
  ]);
  logger.info("creditService: seeded default credit packages");
}
