import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  gender: text("gender"),
  productType: text("product_type"),
  subType: text("sub_type"),
  sku: text("sku"),
  stock: integer("stock").notNull().default(100),
  priceInPaise: integer("price_in_paise").notNull(),
  modelUrl: text("model_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  additionalImages: text("additional_images"),
  available: boolean("available").notNull().default(true),
  allowCustomization: boolean("allow_customization").notNull().default(false),
  sizes: text("sizes").array().notNull().default(["S", "M", "L", "XL"]),
  defaultColor: text("default_color").notNull().default("#FFFFFF"),
  colorLabel: text("color_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("products_available_idx").on(t.available),
  index("products_gender_idx").on(t.gender),
  index("products_category_idx").on(t.category),
  index("products_gender_available_idx").on(t.gender, t.available),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
