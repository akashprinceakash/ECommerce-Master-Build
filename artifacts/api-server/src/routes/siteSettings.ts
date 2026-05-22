import { Router, type IRouter } from "express";
import multer from "multer";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import { uploadToR2, r2Enabled } from "../lib/r2";
import sharp from "sharp";
import path from "path";
import type { Request, Response } from "express";

const router: IRouter = Router();

const ADMIN_EMAILS = (process.env["ADMIN_EMAILS"] ?? "").split(",").map(e => e.trim()).filter(Boolean);

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    const email = user.emailAddresses?.[0]?.emailAddress ?? "";
    if (role !== "admin" && !ADMIN_EMAILS.includes(email)) {
      res.status(403).json({ error: "Forbidden" }); return null;
    }
    return userId;
  } catch { res.status(401).json({ error: "Unauthorized" }); return null; }
}

// ── Public: read site settings ────────────────────────────────────────────────
router.get("/site-settings", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value); }
      catch { result[row.key] = row.value; }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// ── Admin: update hero banners ────────────────────────────────────────────────
router.put("/admin/site-settings/hero-banners", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { banners } = req.body as { banners: { slideIndex: number; imageUrl: string }[] };
  if (!Array.isArray(banners)) { res.status(400).json({ error: "banners must be an array" }); return; }

  try {
    await db
      .insert(siteSettingsTable)
      .values({ key: "hero_banners", value: JSON.stringify(banners) })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: JSON.stringify(banners) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// ── Admin: upload + compress hero banner image ────────────────────────────────
const heroUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/admin/upload/hero", requireAuth, (req, res) => {
  requireAdmin(req, res).then(async (adminId) => {
    if (!adminId) return;

    if (!r2Enabled()) { res.status(503).json({ error: "R2 storage not configured" }); return; }

    heroUpload.single("hero")(req, res, async (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

      try {
        const processed = await sharp(req.file.buffer)
          .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        const key = `images/Slide_images/hero-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
        const url = await uploadToR2(key, processed, "image/webp");
        res.json({ url, filename: path.basename(key) });
      } catch (e) {
        res.status(500).json({ error: "Upload to storage failed" });
      }
    });
  });
});

export default router;
