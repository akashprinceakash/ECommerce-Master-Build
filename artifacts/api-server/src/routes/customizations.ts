import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

// Note: the 50 MB body-size override for write routes is applied in app.ts
// via path-prefixed middleware BEFORE the global 5 MB parser. No route-level override needed.

const router: IRouter = Router();

router.get("/customizations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const customizations = await db
    .select()
    .from(customizationsTable)
    .where(eq(customizationsTable.userId, userId))
    .orderBy(desc(customizationsTable.updatedAt));
  res.json(customizations);
});

router.post("/customizations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { productId, name, color, size, partsEnabled, canvasData, previewImageUrl, frontImageUrl, backImageUrl, sideImageUrl, customizationCharge, designSpec } = req.body;
  if (!productId || !color || !size) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [customization] = await db
    .insert(customizationsTable)
    .values({
      userId,
      productId,
      name: name ?? "My Design",
      color,
      size,
      partsEnabled: partsEnabled ?? { collar: true, leftSleeve: true, rightSleeve: true },
      canvasData: canvasData ?? null,
      previewImageUrl: previewImageUrl ?? null,
      frontImageUrl: frontImageUrl ?? null,
      backImageUrl: backImageUrl ?? null,
      sideImageUrl: sideImageUrl ?? null,
      customizationChargeInPaise: typeof customizationCharge === "number" ? Math.round(customizationCharge * 100) : 0,
      designSpec: designSpec ?? null,
    })
    .returning();
  res.status(201).json(customization);
});

router.get("/customizations/product/:productId/latest", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(rawId, 10);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }
  const [customization] = await db
    .select()
    .from(customizationsTable)
    .where(and(eq(customizationsTable.userId, userId), eq(customizationsTable.productId, productId)))
    .orderBy(desc(customizationsTable.updatedAt))
    .limit(1);
  res.json(customization ?? null);
});

router.get("/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [customization] = await db
    .select()
    .from(customizationsTable)
    .where(and(eq(customizationsTable.id, id), eq(customizationsTable.userId, userId)));
  if (!customization) {
    res.status(404).json({ error: "Customization not found" });
    return;
  }
  res.json(customization);
});

router.put("/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const { name, color, size, partsEnabled, canvasData, previewImageUrl, frontImageUrl, backImageUrl, sideImageUrl, customizationCharge, designSpec } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (color !== undefined) updateData.color = color;
  if (size !== undefined) updateData.size = size;
  if (partsEnabled !== undefined) updateData.partsEnabled = partsEnabled;
  if (canvasData !== undefined) updateData.canvasData = canvasData;
  if (previewImageUrl !== undefined) updateData.previewImageUrl = previewImageUrl;
  if (frontImageUrl !== undefined) updateData.frontImageUrl = frontImageUrl;
  if (backImageUrl !== undefined) updateData.backImageUrl = backImageUrl;
  if (sideImageUrl !== undefined) updateData.sideImageUrl = sideImageUrl;
  if (typeof customizationCharge === "number") updateData.customizationChargeInPaise = Math.round(customizationCharge * 100);
  if (designSpec !== undefined) updateData.designSpec = designSpec;

  const [updated] = await db
    .update(customizationsTable)
    .set(updateData)
    .where(and(eq(customizationsTable.id, id), eq(customizationsTable.userId, userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Customization not found" });
    return;
  }
  res.json(updated);
});

router.delete("/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await db
    .delete(customizationsTable)
    .where(and(eq(customizationsTable.id, id), eq(customizationsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
