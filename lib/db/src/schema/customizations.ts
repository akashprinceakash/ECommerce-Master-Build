import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const customizationsTable = pgTable("customizations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("My Design"),
  color: text("color").notNull().default("#FFFFFF"),
  size: text("size").notNull().default("M"),
  partsEnabled: jsonb("parts_enabled").notNull().default({ collar: true, leftSleeve: true, rightSleeve: true }),
  canvasData: text("canvas_data"),
  previewImageUrl: text("preview_image_url"),
  frontImageUrl: text("front_image_url"),
  backImageUrl: text("back_image_url"),
  sideImageUrl: text("side_image_url"),
  customizationChargeInPaise: integer("customization_charge_in_paise").notNull().default(0),
  designSpec: jsonb("design_spec"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("customizations_user_id_idx").on(t.userId),
  index("customizations_product_id_idx").on(t.productId),
]);

export const insertCustomizationSchema = createInsertSchema(customizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomization = z.infer<typeof insertCustomizationSchema>;
export type Customization = typeof customizationsTable.$inferSelect;
