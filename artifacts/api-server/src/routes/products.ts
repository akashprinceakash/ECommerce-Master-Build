import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const { category } = req.query;
  let products;
  if (category && typeof category === "string") {
    products = await db.select().from(productsTable).where(eq(productsTable.category, category));
  } else {
    products = await db.select().from(productsTable).where(eq(productsTable.available, true));
  }
  res.json(products.map(formatProduct));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(formatProduct(product));
});

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    sizes: p.sizes ?? ["S", "M", "L", "XL"],
  };
}

export default router;
