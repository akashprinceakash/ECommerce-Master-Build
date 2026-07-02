import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  minOrderPaise: integer("min_order_paise").notNull().default(0),
  maxUsages: integer("max_usages"),
  maxUsagesPerUser: integer("max_usages_per_user").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  productIds: jsonb("product_ids").$type<number[]>(),
  categoryRestriction: text("category_restriction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const couponUsagesTable = pgTable("coupon_usages", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => couponsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("coupon_usages_coupon_id_idx").on(t.couponId),
  index("coupon_usages_user_id_idx").on(t.userId),
  index("coupon_usages_order_id_idx").on(t.orderId),
  uniqueIndex("coupon_usages_coupon_order_uniq").on(t.couponId, t.orderId),
]);

export const insertCouponSchema = createInsertSchema(couponsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;
export type CouponUsage = typeof couponUsagesTable.$inferSelect;
