import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, skuAssetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request, Response } from "express";
import { uploadToR2, r2Enabled, keyFromR2Url, deleteFromR2 } from "../lib/r2";

const router = Router();

const SKU_ASSETS_DIR = path.join(process.cwd(), "public", "sku-assets");
if (!fs.existsSync(SKU_ASSETS_DIR)) fs.mkdirSync(SKU_ASSETS_DIR, { recursive: true });

const uploadAsset = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function checkAdmin(req: Request): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth?.userId) return false;
  try {
    const user = await clerkClient.users.getUser(auth.userId);
    if ((user.publicMetadata as any)?.role === "admin") return true;
    const envList = process.env.ADMIN_EMAILS ?? "";
    const adminEmails = envList.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return adminEmails.includes(email);
  } catch { return false; }
}

// GET /api/sku-assets — public (for customizer)
router.get("/api/sku-assets", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.select().from(skuAssetsTable).orderBy(desc(skuAssetsTable.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/sku-assets — admin list
router.get("/api/admin/sku-assets", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await checkAdmin(req))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const rows = await db.select().from(skuAssetsTable).orderBy(desc(skuAssetsTable.createdAt));
    // Map to the shape expected by the admin panel (id, sku, assetType, fileUrl, fileName, createdAt)
    const mapped = rows.map(r => ({
      id: r.id,
      sku: r.sku,
      assetType: r.type,
      fileUrl: r.assetUrl,
      fileName: path.basename(r.assetUrl),
      label: r.label,
      createdAt: r.createdAt,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sku-assets — upload asset
router.post(
  "/api/admin/sku-assets",
  requireAuth,
  uploadAsset.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await checkAdmin(req))) { res.status(403).json({ error: "Forbidden" }); return; }
    try {
      const sku: string = (req.body.sku as string) ?? "";
      const assetType: string = (req.body.assetType as string) ?? "";
      const label: string | undefined = req.body.label;

      if (!sku || !assetType) { res.status(400).json({ error: "sku and assetType are required" }); return; }
      if (!["pattern", "print", "solid_colour"].includes(assetType)) {
        res.status(400).json({ error: "assetType must be pattern, print, or solid_colour" }); return;
      }

      let assetUrl: string;

      if (req.file) {
        if (r2Enabled()) {
          const ext = path.extname(req.file.originalname || ".jpg");
          const key = `sku-assets/${sku.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}${ext}`;
          assetUrl = await uploadToR2(key, req.file.buffer, req.file.mimetype);
        } else {
          const ext = path.extname(req.file.originalname || ".jpg");
          const filename = `${sku.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}${ext}`;
          const filepath = path.join(SKU_ASSETS_DIR, filename);
          fs.writeFileSync(filepath, req.file.buffer);
          assetUrl = `/api/public/sku-assets/${filename}`;
        }
      } else if (req.body.assetUrl) {
        assetUrl = req.body.assetUrl as string;
      } else {
        res.status(400).json({ error: "file or assetUrl is required" }); return;
      }

      // Upsert by SKU
      const existing = await db.select().from(skuAssetsTable).where(eq(skuAssetsTable.sku, sku));
      if (existing.length > 0) {
        const oldUrl = existing[0].assetUrl;
        if (r2Enabled() && oldUrl) {
          const oldKey = keyFromR2Url(oldUrl);
          if (oldKey) { try { await deleteFromR2(oldKey); } catch {} }
        }
        const [updated] = await db.update(skuAssetsTable)
          .set({ type: assetType, assetUrl, label: label ?? null })
          .where(eq(skuAssetsTable.sku, sku))
          .returning();
        res.json(updated); return;
      }

      const [created] = await db.insert(skuAssetsTable)
        .values({ sku, type: assetType, assetUrl, label: label ?? null })
        .returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/admin/sku-assets/:id
router.delete("/api/admin/sku-assets/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await checkAdmin(req))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const existing = await db.select().from(skuAssetsTable).where(eq(skuAssetsTable.id, id));
    if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }
    const oldUrl = existing[0].assetUrl;
    if (r2Enabled() && oldUrl) {
      const oldKey = keyFromR2Url(oldUrl);
      if (oldKey) { try { await deleteFromR2(oldKey); } catch {} }
    }
    await db.delete(skuAssetsTable).where(eq(skuAssetsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve local sku-asset files
router.get("/api/public/sku-assets/:filename", (req: Request, res: Response): void => {
  const filename = path.basename(req.params["filename"] as string);
  const filepath = path.join(SKU_ASSETS_DIR, filename);
  if (!fs.existsSync(filepath)) { res.status(404).end(); return; }
  res.sendFile(filepath);
});

export default router;
