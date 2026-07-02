import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const refundsTable = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  razorpayRefundId: text("razorpay_refund_id").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id").notNull(),
  amountInPaise: integer("amount_in_paise").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  initiatedBy: text("initiated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("refunds_order_id_idx").on(t.orderId),
  index("refunds_created_at_idx").on(t.createdAt),
]);

export type Refund = typeof refundsTable.$inferSelect;
