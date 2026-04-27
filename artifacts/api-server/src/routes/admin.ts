import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, productsTable, customizationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request, Response } from "express";

const router: IRouter = Router();

const MODELS_DIR = path.join(process.cwd(), "public", "models");
const THUMBNAILS_DIR = path.join(process.cwd(), "public", "thumbnails");

if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const modelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MODELS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `model-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const thumbStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, THUMBNAILS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `thumb-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const uploadModel = multer({
  storage: modelStorage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(glb|gltf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only .glb and .gltf files are allowed"));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const uploadThumb = multer({
  storage: thumbStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

    if (role !== "admin" && !adminEmails.includes(primaryEmail ?? "")) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return null;
    }
    return userId;
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}

router.get("/admin/products", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const products = await db.select().from(productsTable).orderBy(productsTable.id);
  res.json(products);
});

router.post("/admin/products", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { name, description, category, priceInPaise, modelUrl, thumbnailUrl, available, sizes, defaultColor } = req.body;
  if (!name || !description || !category || !priceInPaise || !modelUrl) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    name,
    description,
    category,
    priceInPaise: Number(priceInPaise),
    modelUrl,
    thumbnailUrl: thumbnailUrl ?? null,
    available: available ?? true,
    sizes: sizes ?? ["S", "M", "L", "XL"],
    defaultColor: defaultColor ?? "#FFFFFF",
  }).returning();

  res.status(201).json(product);
});

router.put("/admin/products/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, description, category, priceInPaise, modelUrl, thumbnailUrl, available, sizes, defaultColor } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (category !== undefined) updateData.category = category;
  if (priceInPaise !== undefined) updateData.priceInPaise = Number(priceInPaise);
  if (modelUrl !== undefined) updateData.modelUrl = modelUrl;
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
  if (available !== undefined) updateData.available = available;
  if (sizes !== undefined) updateData.sizes = sizes;
  if (defaultColor !== undefined) updateData.defaultColor = defaultColor;

  const [updated] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(updated);
});

router.delete("/admin/products/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

// Delete any user's design (admin override). Regular users can only delete
// their own designs via DELETE /api/customizations/:id; this endpoint lets
// the admin remove any customer design from the Designs admin tab.
router.delete("/admin/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await db
    .delete(customizationsTable)
    .where(eq(customizationsTable.id, id))
    .returning({ id: customizationsTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Design not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/upload/model", requireAuth, (req, res, next) => {
  requireAdmin(req, res).then(adminId => {
    if (!adminId) return;
    uploadModel.single("model")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const apiBase = process.env["API_BASE_URL"] ?? "";
      const url = `${apiBase}/api/public/models/${req.file.filename}`;
      res.json({ url, filename: req.file.filename });
    });
  });
});

router.post("/admin/upload/thumbnail", requireAuth, (req, res, next) => {
  requireAdmin(req, res).then(adminId => {
    if (!adminId) return;
    uploadThumb.single("thumbnail")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const apiBase = process.env["API_BASE_URL"] ?? "";
      const url = `${apiBase}/api/public/thumbnails/${req.file.filename}`;
      res.json({ url, filename: req.file.filename });
    });
  });
});

router.get("/admin/customizations", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const customizations = await db
    .select({
      id: customizationsTable.id,
      userId: customizationsTable.userId,
      productId: customizationsTable.productId,
      name: customizationsTable.name,
      color: customizationsTable.color,
      size: customizationsTable.size,
      partsEnabled: customizationsTable.partsEnabled,
      canvasData: customizationsTable.canvasData,
      previewImageUrl: customizationsTable.previewImageUrl,
      createdAt: customizationsTable.createdAt,
      updatedAt: customizationsTable.updatedAt,
      productName: productsTable.name,
      productModelUrl: productsTable.modelUrl,
      productThumbnailUrl: productsTable.thumbnailUrl,
    })
    .from(customizationsTable)
    .leftJoin(productsTable, eq(customizationsTable.productId, productsTable.id))
    .orderBy(desc(customizationsTable.updatedAt));

  const userIds = [...new Set(customizations.map(c => c.userId))];
  const userMap: Record<string, { email: string; name: string }> = {};

  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const user = await clerkClient.users.getUser(uid);
        const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? uid;
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
        userMap[uid] = { email, name };
      } catch {
        userMap[uid] = { email: uid, name: uid };
      }
    })
  );

  const result = customizations.map(c => ({
    ...c,
    userEmail: userMap[c.userId]?.email ?? c.userId,
    userName: userMap[c.userId]?.name ?? c.userId,
  }));

  res.json(result);
});

router.get("/admin/check", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  res.json({ isAdmin: true });
});

export default router;
