import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import {
  db,
  lookbookOutfitsTable,
  lookbookLookItemSchema,
  lookbookSavedProductsTable,
  productsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import type { LookbookLookItem } from "@workspace/db";
import { classifyProductRole } from "../services/vton/classifier";
import { submitTryOnJob, getTryOnJob } from "../services/vton/jobQueue";
import { AVATAR_IMAGE_URLS } from "../services/vton/humanImages";
import { uploadToR2, r2Enabled } from "../lib/r2";
import type { GarmentRole, TryOnGarment } from "../services/vton/types";

const router: IRouter = Router();

// ── User-uploaded try-on photo ────────────────────────────────────────────────
const LOOKBOOK_PHOTOS_DIR = path.join(process.cwd(), "public", "lookbook-photos");
if (!fs.existsSync(LOOKBOOK_PHOTOS_DIR)) fs.mkdirSync(LOOKBOOK_PHOTOS_DIR, { recursive: true });

const uploadPhotoMem = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const photoDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOOKBOOK_PHOTOS_DIR),
  filename: (_req, file, cb) => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `photo-${s}${path.extname(file.originalname) || ".jpg"}`);
  },
});
const uploadPhotoDisk = multer({
  storage: photoDiskStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/lookbook-photo", requireAuth, (req, res): void => {
  if (r2Enabled()) {
    uploadPhotoMem.single("photo")(req, res, async (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      try {
        const processed = await sharp(req.file.buffer)
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        const key = `lookbook-photos/photo-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
        const url = await uploadToR2(key, processed, "image/jpeg");
        res.json({ url });
      } catch {
        res.status(500).json({ error: "Upload to storage failed" });
      }
    });
  } else {
    uploadPhotoDisk.single("photo")(req, res, (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const apiBase = process.env["API_BASE_URL"] ?? "";
      const url = `${apiBase}/api/public/lookbook-photos/${req.file.filename}`;
      res.json({ url });
    });
  }
});

function parseOutfitBody(body: unknown): { name: string; items: LookbookLookItem[]; gender: "male" | "female"; resultImageUrl: string } | { error: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100) return null;
  if (!Array.isArray(b.items) || b.items.length === 0) return null;
  if (typeof b.resultImageUrl !== "string" || !b.resultImageUrl.trim()) return null;
  const gender = b.gender === "male" ? "male" : "female";
  const items: LookbookLookItem[] = [];
  for (const raw of b.items) {
    const parsed = lookbookLookItemSchema.safeParse(raw);
    if (!parsed.success) return null;
    items.push(parsed.data);
  }

  // Enforce mutual exclusivity: either a single dress OR top/bottom combination
  const roles = items.map(i => i.role);
  const hasDress = roles.includes("dress");
  const hasTopOrBottom = roles.includes("top") || roles.includes("bottom");
  if (hasDress && hasTopOrBottom) {
    return { error: "A dress cannot be combined with a top or bottom" };
  }
  if (hasDress && roles.length > 1) {
    return { error: "Only one dress may be selected" };
  }

  return { name: b.name.trim(), items, gender, resultImageUrl: b.resultImageUrl.trim() };
}

/** Convert a potentially relative URL (e.g. /api/public/thumbnails/...) to an
 *  absolute URL that external services like Replicate can reach.
 *  Uses the first domain from REPLIT_DOMAINS, falling back to the request host. */
function toAbsoluteUrl(url: string, reqHost: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const domains = (process.env["REPLIT_DOMAINS"] ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const host = domains[0] ?? reqHost;
  const scheme = host.includes("localhost") ? "http" : "https";
  const base = `${scheme}://${host}`;
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

// ── Outfit CRUD ──────────────────────────────────────────────────────────────

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
  const parsed = parseOutfitBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [outfit] = await db
    .insert(lookbookOutfitsTable)
    .values({
      userId,
      name: parsed.name,
      items: parsed.items,
      gender: parsed.gender,
      resultImageUrl: parsed.resultImageUrl,
    })
    .returning();
  res.status(201).json(outfit);
});

router.delete("/lookbook-outfits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(String(req.params.id), 10);
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

// ── Saved products (heart icon) ───────────────────────────────────────────────

router.get("/lookbook-saved", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rows = await db
    .select({ productId: lookbookSavedProductsTable.productId })
    .from(lookbookSavedProductsTable)
    .where(eq(lookbookSavedProductsTable.userId, userId));
  res.json(rows.map(r => r.productId));
});

router.post("/lookbook-saved", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const b = req.body as Record<string, unknown>;
  const productId = typeof b.productId === "number" ? b.productId : parseInt(String(b.productId), 10);
  if (isNaN(productId) || productId <= 0) {
    res.status(400).json({ error: "Invalid productId" });
    return;
  }
  await db
    .insert(lookbookSavedProductsTable)
    .values({ userId, productId })
    .onConflictDoNothing();
  res.status(201).json({ productId });
});

router.delete("/lookbook-saved/:productId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const productId = parseInt(String(req.params.productId), 10);
  if (isNaN(productId) || productId <= 0) {
    res.status(400).json({ error: "Invalid productId" });
    return;
  }
  await db
    .delete(lookbookSavedProductsTable)
    .where(
      and(
        eq(lookbookSavedProductsTable.userId, userId),
        eq(lookbookSavedProductsTable.productId, productId),
      ),
    );
  res.status(204).send();
});

// ── AI virtual try-on ─────────────────────────────────────────────────────────

router.post("/lookbook-tryon", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const b = req.body as Record<string, unknown>;

  const gender = b.gender === "male" ? "male" : b.gender === "female" ? "female" : null;
  const productIds = Array.isArray(b.productIds)
    ? b.productIds.filter((v): v is number => typeof v === "number")
    : [];
  const humanImageUrl = typeof b.humanImageUrl === "string" && b.humanImageUrl.trim() ? b.humanImageUrl.trim() : null;

  if (!gender || productIds.length === 0 || productIds.length > 2) {
    res.status(400).json({ error: "Provide a gender and 1-2 product IDs (top+bottom, or a single dress)" });
    return;
  }
  if (humanImageUrl) {
    // Only accept our own uploaded/hosted images — never an arbitrary
    // user-supplied URL, to avoid SSRF via the Replicate fetch.
    const domains = (process.env["REPLIT_DOMAINS"] ?? "").split(",").map(d => d.trim()).filter(Boolean);
    const allowedHosts = [req.hostname, ...domains, "pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev"];
    let isAllowed = humanImageUrl.startsWith("/");
    if (!isAllowed) {
      try {
        isAllowed = allowedHosts.includes(new URL(humanImageUrl).hostname);
      } catch {
        isAllowed = false;
      }
    }
    if (!isAllowed) {
      res.status(400).json({ error: "Invalid photo URL" });
      return;
    }
  }

  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  if (products.length !== productIds.length) {
    res.status(400).json({ error: "One or more products were not found" });
    return;
  }

  const garments: TryOnGarment[] = [];
  const roles = new Set<GarmentRole>();
  for (const product of products) {
    const role = classifyProductRole(product.category);
    if (!role) {
      res.status(400).json({ error: `"${product.name}" is not yet supported for virtual try-on` });
      return;
    }
    if (roles.has("dress") || (role === "dress" && roles.size > 0) || roles.has(role)) {
      res.status(400).json({ error: "Select either a single dress, or a top and/or bottom" });
      return;
    }
    roles.add(role);
    const rawUrl = product.thumbnailUrl || "";
    if (!rawUrl) {
      res.status(400).json({ error: `"${product.name}" has no image available for try-on` });
      return;
    }
    const imageUrl = toAbsoluteUrl(rawUrl, req.hostname);
    garments.push({ productId: product.id, role, name: product.name, imageUrl });
  }

  // Process top before bottom for a stable chaining order (dress is alone).
  garments.sort((a, b2) => (a.role === "top" ? 0 : a.role === "bottom" ? 1 : 2) - (b2.role === "top" ? 0 : b2.role === "bottom" ? 1 : 2));

  const personImageUrl = humanImageUrl ? toAbsoluteUrl(humanImageUrl, req.hostname) : AVATAR_IMAGE_URLS[gender];
  const job = submitTryOnJob(userId, personImageUrl, garments);
  res.status(202).json({ jobId: job.id, status: job.status });
});

router.get("/lookbook-tryon/:jobId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const job = getTryOnJob(String(req.params.jobId), userId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    jobId: job.id,
    status: job.status,
    resultImageUrl: job.resultImageUrl,
    error: job.error,
  });
});

export default router;
