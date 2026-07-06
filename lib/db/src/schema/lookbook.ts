import { pgTable, serial, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// A single garment worn in a saved look. `role` is the VTON garment slot —
// "dress" is mutually exclusive with "top"/"bottom". Only these three roles
// are supported today; outerwear/accessories/shoes/bags are intentionally
// not modeled here yet (see services/vton/types.ts on the API server).
export const lookbookLookItemSchema = z.object({
  productId: z.number(),
  role: z.enum(["top", "bottom", "dress"]),
  name: z.string(),
  thumbnailUrl: z.string(),
});

export type LookbookLookItem = z.infer<typeof lookbookLookItemSchema>;

export const lookbookOutfitsTable = pgTable("lookbook_outfits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  items: jsonb("items").notNull().$type<LookbookLookItem[]>().default([]),
  gender: text("gender").notNull().default("female"),
  resultImageUrl: text("result_image_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("lookbook_outfits_user_id_idx").on(t.userId),
]);

export type LookbookOutfit = typeof lookbookOutfitsTable.$inferSelect;

export const lookbookSavedProductsTable = pgTable("lookbook_saved_products", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: integer("product_id").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("lookbook_saved_user_idx").on(t.userId),
  uniqueIndex("lookbook_saved_unique_idx").on(t.userId, t.productId),
]);

export type LookbookSavedProduct = typeof lookbookSavedProductsTable.$inferSelect;
