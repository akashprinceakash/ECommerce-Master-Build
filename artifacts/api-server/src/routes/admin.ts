import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, productsTable, customizationsTable } from "@workspace/db";
import { contactEnquiriesTable } from "@workspace/db/schema";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request, Response } from "express";
import { uploadToR2, r2Enabled, keyFromR2Url, deleteFromR2 } from "../lib/r2";
import { optimizeGlb } from "../lib/glbOptimize";
import sharp from "sharp";

const router: IRouter = Router();

// ── Local disk fallback (used when R2 is not configured) ─────────────────────
const MODELS_DIR     = path.join(process.cwd(), "public", "models");
const THUMBNAILS_DIR = path.join(process.cwd(), "public", "thumbnails");

if (!fs.existsSync(MODELS_DIR))     fs.mkdirSync(MODELS_DIR,     { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// ── Multer: memory storage so we can stream to R2 ────────────────────────────
const memStorage = multer.memoryStorage();

const uploadModel = multer({
  storage: memStorage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(glb|gltf)$/i)) cb(null, true);
    else cb(new Error("Only .glb and .gltf files are allowed"));
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const uploadThumb = multer({
  storage: memStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Local disk storage instances (fallback only) ─────────────────────────────
const modelDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MODELS_DIR),
  filename: (_req, file, cb) => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `model-${s}${path.extname(file.originalname)}`);
  },
});
const thumbDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, THUMBNAILS_DIR),
  filename: (_req, file, cb) => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `thumb-${s}${path.extname(file.originalname)}`);
  },
});
const uploadModelDisk = multer({
  storage: modelDiskStorage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(glb|gltf)$/i)) cb(null, true);
    else cb(new Error("Only .glb and .gltf files are allowed"));
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});
const uploadThumbDisk = multer({
  storage: thumbDiskStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    (req as any).log?.warn({ method: req.method, path: req.path }, "Admin: no userId — 401");
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const user       = await clerkClient.users.getUser(userId);
    const role       = (user.publicMetadata as any)?.role;
    const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

    if (role !== "admin" && !adminEmails.includes(primaryEmail ?? "")) {
      (req as any).log?.warn({ userId, method: req.method, path: req.path }, "Admin: insufficient role — 403");
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return null;
    }
    (req as any).log?.info({ adminId: userId, method: req.method, path: req.path }, "Admin action");
    return userId;
  } catch {
    (req as any).log?.warn({ userId, method: req.method, path: req.path }, "Admin: Clerk lookup failed — 401");
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Products CRUD
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/products", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(products);
});

router.post("/admin/products", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { name, description, category, gender, productType, subType, sku, stock, priceInPaise, modelUrl, thumbnailUrl, additionalImages, available, allowCustomization, customizationMode, addOns, sizes, defaultColor, colorLabel } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required and must be a non-empty string" }); return;
  }
  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "description is required and must be a string" }); return;
  }
  if (!category || typeof category !== "string") {
    res.status(400).json({ error: "category is required and must be a string" }); return;
  }
  if (!modelUrl || typeof modelUrl !== "string") {
    res.status(400).json({ error: "modelUrl is required and must be a string" }); return;
  }
  const parsedPrice = Number(priceInPaise);
  if (!priceInPaise || !Number.isInteger(parsedPrice) || parsedPrice <= 0) {
    res.status(400).json({ error: "priceInPaise must be a positive integer" }); return;
  }

  const [product] = await db.insert(productsTable).values({
    name: name.trim(),
    description,
    category,
    gender: gender ?? null,
    productType: productType ?? null,
    subType: subType ?? null,
    sku: sku ?? null,
    stock: stock !== undefined ? Number(stock) : 100,
    priceInPaise: parsedPrice,
    modelUrl,
    thumbnailUrl: thumbnailUrl ?? null,
    additionalImages: additionalImages ?? null,
    available: available ?? true,
    allowCustomization: allowCustomization ?? false,
    customizationMode: customizationMode ?? "zone",
    addOns: addOns ?? null,
    sizes: sizes ?? ["S", "M", "L", "XL"],
    defaultColor: defaultColor ?? "#FFFFFF",
    colorLabel: colorLabel?.trim() || null,
  }).returning();
  res.status(201).json(product);
});

router.put("/admin/products/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // ── Step 1: read current row so we know what R2 objects might be replaced ──
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

  const { name, description, priceInPaise, category, modelUrl, thumbnailUrl, available, allowCustomization, customizationMode, addOns, gender, productType, subType, sku, stock, additionalImages, sizes, defaultColor, colorLabel } = req.body;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (priceInPaise !== undefined) updateData.priceInPaise = Number(priceInPaise);
  if (category !== undefined) updateData.category = category;
  if (modelUrl !== undefined) updateData.modelUrl = modelUrl;
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
  if (available !== undefined) updateData.available = available;
  if (allowCustomization !== undefined) updateData.allowCustomization = allowCustomization;
  if (customizationMode !== undefined) updateData.customizationMode = customizationMode;
  if (addOns !== undefined) updateData.addOns = addOns;
  if (gender !== undefined) updateData.gender = gender || null;
  if (productType !== undefined) updateData.productType = productType || null;
  if (subType !== undefined) updateData.subType = subType || null;
  if (sku !== undefined) updateData.sku = sku || null;
  if (stock !== undefined) updateData.stock = Number(stock);
  if (additionalImages !== undefined) updateData.additionalImages = additionalImages || null;
  if (sizes !== undefined) updateData.sizes = sizes;
  if (defaultColor !== undefined) updateData.defaultColor = defaultColor;
  if (colorLabel !== undefined) updateData.colorLabel = colorLabel?.trim() || null;

  // ── Step 2: persist the update ─────────────────────────────────────────────
  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // ── Step 3: respond immediately so the admin UI is unblocked ───────────────
  res.json(product);

  // ── Step 4: best-effort R2 cleanup — runs after the response is sent ───────
  // Only delete if the URL actually changed and the old one was an R2 object.
  // Failures are logged but never surface as errors to the caller.
  const cleanupOldAsset = async (oldUrl: string | null | undefined, newUrl: string | null | undefined, label: string) => {
    if (!oldUrl || !newUrl || oldUrl === newUrl) return;
    const oldKey = keyFromR2Url(oldUrl);
    if (!oldKey) return; // not an R2 asset (e.g. legacy local-disk URL)
    try {
      await deleteFromR2(oldKey);
      req.log.info({ key: oldKey, label }, "admin/products: cleaned up replaced R2 asset");
    } catch (e) {
      req.log.warn({ e, key: oldKey, label }, "admin/products: R2 cleanup failed — orphan may remain, but product update succeeded");
    }
  };

  await Promise.allSettled([
    cleanupOldAsset(existing.modelUrl, product.modelUrl, "model"),
    cleanupOldAsset(existing.thumbnailUrl, product.thumbnailUrl, "thumbnail"),
  ]);
});

router.delete("/admin/products/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Clean up R2 assets if present
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (product) {
    const thumbKey = keyFromR2Url(product.thumbnailUrl);
    const modelKey = keyFromR2Url(product.modelUrl);
    if (thumbKey) await deleteFromR2(thumbKey);
    if (modelKey) await deleteFromR2(modelKey);
  }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.delete("/admin/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await db.delete(customizationsTable).where(eq(customizationsTable.id, id)).returning({ id: customizationsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Design not found" }); return; }
  res.sendStatus(204);
});

// ─────────────────────────────────────────────────────────────────────────────
// File uploads — R2 first, disk fallback
// ─────────────────────────────────────────────────────────────────────────────

router.post("/admin/upload/model", requireAuth, (req, res) => {
  requireAdmin(req, res).then(async (adminId) => {
    if (!adminId) return;

    if (r2Enabled()) {
      // ── Write to disk first to avoid buffering the whole file in RAM ────────
      // memoryStorage() would load 90 MB into the Node.js heap before we can
      // check the size, easily OOM-ing a small Render instance.  diskStorage()
      // lets the OS handle the bytes; we read the (already size-checked) file
      // into RAM only after confirming it is small enough to optimise safely.
      uploadModelDisk.single("model")(req, res, async (err) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

        const filePath = req.file.path;
        const fileSize = req.file.size;

        // ── Pre-optimisation size gate (50 MB) ───────────────────────────────
        // The Draco optimiser parses the whole document into memory and can use
        // 3–5× the raw file size during processing.  90 MB → ~300 MB peak RAM,
        // which crashes a 512 MB instance.  Reject large files early so the
        // server stays alive and the admin gets a useful error message.
        const MAX_INPUT_BYTES = 50 * 1024 * 1024;
        if (fileSize > MAX_INPUT_BYTES) {
          fs.unlink(filePath, () => {});
          res.status(400).json({
            error:
              `File too large: ${(fileSize / 1024 / 1024).toFixed(1)} MB (limit 50 MB before optimisation). ` +
              `Please reduce the model first — open it in Blender and use File → Export → glTF 2.0 ` +
              `with "Apply Modifiers" and "Draco Mesh Compression" enabled, or run it through ` +
              `https://gltf.report to identify and strip heavy geometry / unused textures.`,
          });
          return;
        }

        // ── Read from disk into buffer, then delete the temp file ─────────────
        let fileBuffer: Buffer;
        try {
          fileBuffer = await fs.promises.readFile(filePath);
        } catch {
          fs.unlink(filePath, () => {});
          res.status(500).json({ error: "Failed to read uploaded file from disk" });
          return;
        }
        fs.unlink(filePath, () => {});

        // ── Optimise: prune → dedup → weld → Draco compression ───────────────
        const optimization = await optimizeGlb(fileBuffer);

        // Reject if the model is still too large after optimisation (25 MB).
        const MAX_STORED_BYTES = 25 * 1024 * 1024;
        if (optimization.optimizedBytes > MAX_STORED_BYTES) {
          res.status(400).json({
            error:
              `Model is too large even after optimisation (${(optimization.optimizedBytes / 1024 / 1024).toFixed(1)} MB). ` +
              `Maximum stored size is 25 MB. Reduce polygon count or remove unused geometry before uploading.`,
          });
          return;
        }

        // Always store as .glb (Draco-compressed output is binary glTF)
        const key = `models/model-${Date.now()}-${Math.round(Math.random() * 1e9)}.glb`;
        try {
          const url = await uploadToR2(key, optimization.buffer, "model/gltf-binary");
          res.json({
            url,
            filename: path.basename(key),
            optimization: {
              originalBytes: optimization.originalBytes,
              optimizedBytes: optimization.optimizedBytes,
              reductionPct: optimization.reductionPct,
            },
          });
        } catch {
          res.status(500).json({ error: "Upload to R2 storage failed — check R2 credentials and bucket permissions." });
        }
      });
    } else {
      // Disk fallback (no R2 configured)
      uploadModelDisk.single("model")(req, res, (err) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
        const apiBase = process.env["API_BASE_URL"] ?? "";
        const url = `${apiBase}/api/public/models/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
      });
    }
  });
});

// ── Server-side image processing: resize + WebP conversion via sharp ──────────
async function processImageBuffer(
  buf: Buffer,
  originalMime: string,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  try {
    const processed = await sharp(buf)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer: processed, mime: "image/webp", ext: ".webp" };
  } catch {
    return { buffer: buf, mime: originalMime, ext: path.extname("x" + originalMime.replace("image/", ".")) || ".jpg" };
  }
}

router.post("/admin/upload/thumbnail", requireAuth, (req, res) => {
  requireAdmin(req, res).then(async (adminId) => {
    if (!adminId) return;

    if (r2Enabled()) {
      // R2 path — compress via sharp before uploading
      uploadThumb.single("thumbnail")(req, res, async (err) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

        try {
          const { buffer: imgBuf, mime: imgMime, ext: imgExt } =
            await processImageBuffer(req.file.buffer, req.file.mimetype);
          const key = `thumbnails/thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}${imgExt}`;
          const url = await uploadToR2(key, imgBuf, imgMime);
          res.json({ url, filename: path.basename(key) });
        } catch (e) {
          res.status(500).json({ error: "Upload to storage failed" });
        }
      });
    } else {
      // Disk fallback
      uploadThumbDisk.single("thumbnail")(req, res, (err) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
        const apiBase = process.env["API_BASE_URL"] ?? "";
        const url = `${apiBase}/api/public/thumbnails/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Customizations
// ─────────────────────────────────────────────────────────────────────────────

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
      previewImageUrl: customizationsTable.previewImageUrl,
      frontImageUrl: customizationsTable.frontImageUrl,
      backImageUrl: customizationsTable.backImageUrl,
      sideImageUrl: customizationsTable.sideImageUrl,
      customizationChargeInPaise: customizationsTable.customizationChargeInPaise,
      designSpec: customizationsTable.designSpec,
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
        const user  = await clerkClient.users.getUser(uid);
        const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? uid;
        const name  = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
        userMap[uid] = { email, name };
      } catch { userMap[uid] = { email: uid, name: uid }; }
    })
  );

  res.json(customizations.map(c => ({
    ...c,
    userEmail: userMap[c.userId]?.email ?? c.userId,
    userName:  userMap[c.userId]?.name  ?? c.userId,
  })));
});

router.get("/admin/customizations/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select({
      id: customizationsTable.id,
      userId: customizationsTable.userId,
      canvasData: customizationsTable.canvasData,
      designSpec: customizationsTable.designSpec,
      customizationChargeInPaise: customizationsTable.customizationChargeInPaise,
    })
    .from(customizationsTable)
    .where(eq(customizationsTable.id, id))
    .limit(1);

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const row = rows[0];

  let userEmail = row.userId;
  let userName  = row.userId;
  try {
    const u = await clerkClient.users.getUser(row.userId);
    userEmail = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? row.userId;
    userName  = [u.firstName, u.lastName].filter(Boolean).join(" ") || userEmail;
  } catch {}

  res.json({ ...row, userEmail, userName });
});

// Returns 200 for both admins and non-admins — the caller reads the boolean.
// Using 403 here caused red console errors for every logged-in customer.
router.get("/admin/check", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string | undefined;
  if (!userId) { res.json({ isAdmin: false }); return; }
  try {
    const user        = await clerkClient.users.getUser(userId);
    const role        = (user.publicMetadata as any)?.role;
    const adminEmails = process.env["ADMIN_EMAILS"]?.split(",").map(e => e.trim()) ?? [];
    const primary     = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isAdmin     = role === "admin" || adminEmails.includes(primary ?? "");
    res.json({ isAdmin });
  } catch {
    res.json({ isAdmin: false });
  }
});

router.post("/admin/customizations/backfill-spec", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const rows = await db
    .select({ id: customizationsTable.id, canvasData: customizationsTable.canvasData, designSpec: customizationsTable.designSpec })
    .from(customizationsTable);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.designSpec !== null && row.designSpec !== undefined) { skipped++; continue; }
    if (!row.canvasData) { skipped++; continue; }
    try {
      const cd = JSON.parse(row.canvasData as string);
      const spec: Record<string, unknown> = {
        baseColor: cd.primaryColor ?? null,
        zoneColors: cd.zoneColors ?? {},
        kashaDesignId: cd.kdDesignId || null,
        kashaDesignLabel: null,
        printId: cd.activePrintId ?? cd.allOverPrintId ?? null,
        printLabel: null,
        patColorA: cd.patColorA ?? null,
        patColorB: cd.patColorB ?? null,
        sleeveLength: cd.sleeveLength ?? null,
        hasLogo: false,
        logoUrl: null,
        logoPosition: null,
        logoSize: null,
        textContent: null,
        fontFamily: null,
        fontSize: null,
        textColor: null,
        textBold: null,
        textItalic: null,
      };
      if (cd.canvasJSON) {
        try {
          const parsed = JSON.parse(cd.canvasJSON);
          const objects: Array<Record<string, unknown>> = Array.isArray(parsed?.objects) ? parsed.objects : [];
          for (const obj of objects) {
            if (obj["type"] === "i-text" || obj["type"] === "text") {
              spec["textContent"] = typeof obj["text"] === "string" ? obj["text"] : null;
              spec["fontFamily"]  = typeof obj["fontFamily"] === "string" ? obj["fontFamily"] : null;
              spec["fontSize"]    = typeof obj["fontSize"] === "number" ? obj["fontSize"] : null;
              spec["textColor"]   = typeof obj["fill"] === "string" ? obj["fill"] : null;
              spec["textBold"]    = obj["fontWeight"] === "700" || obj["fontWeight"] === "bold";
              spec["textItalic"]  = obj["fontStyle"] === "italic";
              break;
            }
            if (obj["type"] === "image" && obj["data"] && typeof (obj["data"] as any)["role"] === "string" && (obj["data"] as any)["role"] === "logo") {
              spec["hasLogo"] = true;
            }
          }
        } catch { /* canvasJSON parse failure — leave text/logo as null */ }
      }
      await db.update(customizationsTable).set({ designSpec: spec }).where(eq(customizationsTable.id, row.id));
      updated++;
    } catch {
      skipped++;
    }
  }

  res.json({ updated, skipped, total: rows.length });
});

// ── Contact Enquiries ─────────────────────────────────────────────────────────
router.get("/admin/enquiries", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const rows = await db.select().from(contactEnquiriesTable).orderBy(desc(contactEnquiriesTable.createdAt));
  res.json(rows);
});

router.delete("/admin/enquiries/:id", requireAuth, async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(contactEnquiriesTable).where(eq(contactEnquiriesTable.id, id));
  res.json({ ok: true });
});

export default router;
