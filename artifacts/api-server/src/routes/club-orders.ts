import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, clubOrdersTable, CLUB_GARMENT_TYPES } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const GARMENT_SET = new Set<string>(CLUB_GARMENT_TYPES);

function isValidMeasurements(m: unknown): m is Record<string, string> {
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  for (const v of Object.values(m as Record<string, unknown>)) {
    if (typeof v !== "string") return false;
  }
  return true;
}

router.get("/club-orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const orders = await db
    .select()
    .from(clubOrdersTable)
    .where(eq(clubOrdersTable.userId, userId))
    .orderBy(desc(clubOrdersTable.createdAt));
  res.json(orders);
});

router.post("/club-orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const b = req.body as Record<string, unknown>;

  const clubName   = typeof b.clubName === "string" && b.clubName.trim() ? b.clubName.trim() : "Q Club";
  const garmentType = typeof b.garmentType === "string" ? b.garmentType : "";
  const notes      = typeof b.notes === "string" ? b.notes.slice(0, 1000) : undefined;

  if (!GARMENT_SET.has(garmentType)) {
    res.status(400).json({ error: `Invalid garmentType. Must be one of: ${CLUB_GARMENT_TYPES.join(", ")}` });
    return;
  }
  if (!isValidMeasurements(b.measurements)) {
    res.status(400).json({ error: "measurements must be an object of string values" });
    return;
  }

  const [order] = await db
    .insert(clubOrdersTable)
    .values({ userId, clubName, garmentType, measurements: b.measurements, notes })
    .returning();
  res.status(201).json(order);
});

export default router;
