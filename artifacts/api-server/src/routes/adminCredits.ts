import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, userCreditsTable, creditTransactionsTable, generationLogsTable, replicateTopupsTable, creditPackagesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import type { Request, Response } from "express";
import {
  adminGrantCredits,
  logReplicateTopup,
  getEstimatedReplicateBalance,
  BALANCE_THRESHOLD_WARN,
  BALANCE_THRESHOLD_RED,
  BALANCE_THRESHOLD_PAUSE,
} from "../services/creditService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" }); return null;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];
    const primaryEmail = user.emailAddresses.find(
      e => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
    if (role !== "admin" && !adminEmails.includes(primaryEmail ?? "")) {
      res.status(403).json({ error: "Forbidden" }); return null;
    }
    return userId;
  } catch {
    res.status(401).json({ error: "Unauthorized" }); return null;
  }
}

/* ── GET /admin/credits/packages ────────────────────────────────────────── */
router.get("/admin/credits/packages", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const rows = await db.select().from(creditPackagesTable).orderBy(creditPackagesTable.creditsAmount);
  res.json(rows);
});

/* ── GET /admin/credits/replicate-balance ───────────────────────────────── */
router.get("/admin/credits/replicate-balance", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const balance = await getEstimatedReplicateBalance();
  const { estimatedBalanceUsd } = balance;

  const alertLevel =
    estimatedBalanceUsd < BALANCE_THRESHOLD_PAUSE ? "critical" :
    estimatedBalanceUsd < BALANCE_THRESHOLD_RED   ? "danger"   :
    estimatedBalanceUsd < BALANCE_THRESHOLD_WARN  ? "warning"  :
    "ok";

  // Recent generation stats
  const [genStats] = await db
    .select({
      total:     sql<string>`COUNT(*)`,
      succeeded: sql<string>`COUNT(*) FILTER (WHERE ${generationLogsTable.replicateStatus} = 'succeeded')`,
      failed:    sql<string>`COUNT(*) FILTER (WHERE ${generationLogsTable.replicateStatus} = 'failed')`,
    })
    .from(generationLogsTable);

  // Recent topups
  const topups = await db
    .select()
    .from(replicateTopupsTable)
    .orderBy(desc(replicateTopupsTable.toppedUpAt))
    .limit(10);

  res.json({
    estimatedBalanceUsd: estimatedBalanceUsd.toFixed(4),
    totalTopupsUsd:      balance.totalTopupsUsd.toFixed(4),
    totalCostUsd:        balance.totalCostUsd.toFixed(4),
    alertLevel,
    thresholds: {
      warn:  BALANCE_THRESHOLD_WARN,
      red:   BALANCE_THRESHOLD_RED,
      pause: BALANCE_THRESHOLD_PAUSE,
    },
    generationStats: {
      total:     parseInt(genStats?.total ?? "0"),
      succeeded: parseInt(genStats?.succeeded ?? "0"),
      failed:    parseInt(genStats?.failed ?? "0"),
    },
    recentTopups: topups.map(t => ({
      id: t.id,
      amountUsd: t.amountUsd,
      toppedUpAt: t.toppedUpAt,
      addedByAdminId: t.addedByAdminId,
      notes: t.notes,
    })),
  });
});

/* ── POST /admin/credits/topup ──────────────────────────────────────────── */
router.post("/admin/credits/topup", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const amountUsd = parseFloat(String(req.body?.amountUsd ?? "0"));
  if (!amountUsd || amountUsd <= 0) {
    res.status(400).json({ error: "amountUsd must be a positive number" }); return;
  }
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : undefined;

  await logReplicateTopup({ amountUsd, adminId, notes });

  const balance = await getEstimatedReplicateBalance();
  logger.info({ adminId, amountUsd, estimatedBalance: balance.estimatedBalanceUsd.toFixed(4) }, "admin: Replicate topup logged");
  res.json({ success: true, estimatedBalanceUsd: balance.estimatedBalanceUsd.toFixed(4) });
});

/* ── POST /admin/credits/grant ──────────────────────────────────────────── */
router.post("/admin/credits/grant", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const targetUserId = String(req.body?.userId ?? "").trim();
  const amount       = parseInt(String(req.body?.amount ?? "0"), 10);

  if (!targetUserId) {
    res.status(400).json({ error: "userId is required" }); return;
  }
  if (!amount || amount <= 0 || amount > 1000) {
    res.status(400).json({ error: "amount must be between 1 and 1000" }); return;
  }

  const creditsRemaining = await adminGrantCredits({ targetUserId, amount });
  logger.info({ adminId, targetUserId, amount, creditsRemaining }, "admin: free credits granted");
  res.json({ success: true, creditsRemaining });
});

/* ── GET /admin/credits/users ────────────────────────────────────────────── */
// Paginated list of users with their credit balances.
router.get("/admin/credits/users", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit  = Math.min(parseInt(String(req.query["limit"]  ?? "50"), 10), 200);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"),  10), 0);

  const rows = await db
    .select()
    .from(userCreditsTable)
    .orderBy(desc(userCreditsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  res.json({ users: rows, limit, offset });
});

/* ── GET /admin/credits/transactions ─────────────────────────────────────── */
router.get("/admin/credits/transactions", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit  = Math.min(parseInt(String(req.query["limit"]  ?? "100"), 10), 500);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"),   10), 0);

  const rows = await db
    .select()
    .from(creditTransactionsTable)
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ transactions: rows, limit, offset });
});

/* ── GET /admin/credits/generations ─────────────────────────────────────── */
router.get("/admin/credits/generations", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit  = Math.min(parseInt(String(req.query["limit"]  ?? "100"), 10), 500);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"),   10), 0);

  const rows = await db
    .select()
    .from(generationLogsTable)
    .orderBy(desc(generationLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ generations: rows, limit, offset });
});

/* ── PATCH /admin/credits/packages/:id ──────────────────────────────────── */
router.patch("/admin/credits/packages/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid package ID" }); return; }

  const { name, creditsAmount, priceInPaise, bonusCredits, active } = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (typeof name          === "string")  update["name"]          = name.trim();
  if (typeof creditsAmount === "number")  update["creditsAmount"] = creditsAmount;
  if (typeof priceInPaise  === "number")  update["priceInPaise"]  = priceInPaise;
  if (typeof bonusCredits  === "number")  update["bonusCredits"]  = bonusCredits;
  if (typeof active        === "boolean") update["active"]        = active;

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  await db.update(creditPackagesTable).set(update).where(eq(creditPackagesTable.id, id));
  const [updated] = await db.select().from(creditPackagesTable).where(eq(creditPackagesTable.id, id));
  res.json(updated);
});

export default router;
