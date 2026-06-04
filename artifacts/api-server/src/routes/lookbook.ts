import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, lookbookOutfitsTable, lookbookOutfitItemSchema } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import type { LookbookOutfitItem } from "@workspace/db";

const router: IRouter = Router();

function parseBody(body: unknown): { name: string; items: LookbookOutfitItem[] } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100) return null;
  if (!Array.isArray(b.items)) return null;
  const items: LookbookOutfitItem[] = [];
  for (const raw of b.items) {
    const parsed = lookbookOutfitItemSchema.safeParse(raw);
    if (!parsed.success) return null;
    items.push(parsed.data);
  }
  return { name: b.name.trim(), items };
}

router.get("/lookbook-outfits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const outfits = await db
    .select()
    .from(lookbookOutfitsTable)
    .where(eq(lookbookOutfitsTable.userId, userId))
    .orderBy(desc(lookbookOutfitsTable.createdAt));
  res.json(outfits);
});

router.post("/lookbook-outfits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = parseBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [outfit] = await db
    .insert(lookbookOutfitsTable)
    .values({ userId, name: parsed.name, items: parsed.items })
    .returning();
  res.status(201).json(outfit);
});

router.delete("/lookbook-outfits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(lookbookOutfitsTable)
    .where(and(eq(lookbookOutfitsTable.id, id), eq(lookbookOutfitsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Outfit not found" });
    return;
  }
  res.status(204).send();
});

export default router;
