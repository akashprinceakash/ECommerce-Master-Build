import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const lookbookOutfitItemSchema = z.object({
  productId: z.number(),
  name: z.string(),
  thumbnailUrl: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
});

export type LookbookOutfitItem = z.infer<typeof lookbookOutfitItemSchema>;

export const lookbookOutfitsTable = pgTable("lookbook_outfits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  items: jsonb("items").notNull().$type<LookbookOutfitItem[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("lookbook_outfits_user_id_idx").on(t.userId),
]);

export type LookbookOutfit = typeof lookbookOutfitsTable.$inferSelect;
