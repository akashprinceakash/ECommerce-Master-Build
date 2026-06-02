import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { customizationsTable } from "./customizations";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("confirmed"),
  totalInPaise: integer("total_in_paise").notNull(),
  shippingName: text("shipping_name").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingState: text("shipping_state").notNull(),
  shippingPostalCode: text("shipping_postal_code").notNull(),
  shippingPhone: text("shipping_phone").notNull(),
  paymentId: text("payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpaySignature: text("razorpay_signature"),
  shippingChargeInPaise: integer("shipping_charge_in_paise").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("online"),
  shiprocketOrderId: text("shiprocket_order_id"),
  shiprocketAwb: text("shiprocket_awb"),
  trackingUrl: text("tracking_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("orders_user_id_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
  index("orders_created_at_idx").on(t.createdAt),
]);

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  customizationId: integer("customization_id").references(() => customizationsTable.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  size: text("size").notNull(),
  priceInPaise: integer("price_in_paise").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("order_items_order_id_idx").on(t.orderId),
  index("order_items_product_id_idx").on(t.productId),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
