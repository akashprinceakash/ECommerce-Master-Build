import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skuAssetsTable = pgTable("sku_assets", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  type: text("type").notNull(),
  assetUrl: text("asset_url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("sku_assets_sku_idx").on(t.sku),
]);

export const insertSkuAssetSchema = createInsertSchema(skuAssetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSkuAsset = z.infer<typeof insertSkuAssetSchema>;
export type SkuAsset = typeof skuAssetsTable.$inferSelect;
