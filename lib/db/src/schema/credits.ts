import {
  pgTable, pgEnum, text, serial, timestamp, integer,
  boolean, numeric, index,
} from "drizzle-orm/pg-core";

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "purchase", "generation_deduct", "free_grant", "purchase_bonus", "refund",
]);

export const userCreditsTable = pgTable("user_credits", {
  id:                    serial("id").primaryKey(),
  userId:                text("user_id").notNull().unique(),
  creditsRemaining:      integer("credits_remaining").notNull().default(0),
  totalCreditsPurchased: integer("total_credits_purchased").notNull().default(0),
  totalCreditsUsed:      integer("total_credits_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const generationLogsTable = pgTable("generation_logs", {
  id:                      serial("id").primaryKey(),
  userId:                  text("user_id").notNull(),
  generationType:          text("generation_type").notNull(),
  replicatePredictionId:   text("replicate_prediction_id").notNull(),
  replicateStatus:         text("replicate_status").notNull().default("pending"),
  predictTimeSeconds:      numeric("predict_time_seconds", { precision: 10, scale: 3 }),
  replicateCostUsd:        numeric("replicate_cost_usd",   { precision: 10, scale: 6 }),
  creditDeducted:          boolean("credit_deducted").notNull().default(false),
  errorMessage:            text("error_message"),
  createdAt:               timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  completedAt:             timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("gen_logs_user_id_idx").on(t.userId),
  index("gen_logs_status_idx").on(t.replicateStatus),
  index("gen_logs_created_at_idx").on(t.createdAt),
]);

export const creditTransactionsTable = pgTable("credit_transactions", {
  id:                  serial("id").primaryKey(),
  userId:              text("user_id").notNull(),
  type:                creditTransactionTypeEnum("type").notNull(),
  creditsDelta:        integer("credits_delta").notNull(),
  razorpayPaymentId:   text("razorpay_payment_id"),
  relatedGenerationId: integer("related_generation_id").references(() => generationLogsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("credit_tx_user_id_idx").on(t.userId),
  index("credit_tx_type_idx").on(t.type),
]);

export const creditPackagesTable = pgTable("credit_packages", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull(),
  creditsAmount: integer("credits_amount").notNull(),
  priceInPaise:  integer("price_in_paise").notNull(),
  bonusCredits:  integer("bonus_credits").notNull().default(0),
  active:        boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const replicateTopupsTable = pgTable("replicate_topups", {
  id:              serial("id").primaryKey(),
  amountUsd:       numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  toppedUpAt:      timestamp("topped_up_at", { withTimezone: true }).notNull().defaultNow(),
  addedByAdminId:  text("added_by_admin_id").notNull(),
  notes:           text("notes"),
});

/* ── Pending credit purchases ─────────────────────────────────────────────── */
// Created when a Razorpay order is created; completed when payment is confirmed
// via webhook or polling. This is the source of truth for in-flight purchases.
export const pendingCreditPurchasesTable = pgTable("pending_credit_purchases", {
  id:                serial("id").primaryKey(),
  userId:            text("user_id").notNull(),
  razorpayOrderId:   text("razorpay_order_id").notNull().unique(),
  packageId:         integer("package_id").notNull(),
  amountInPaise:     integer("amount_in_paise").notNull(),
  status:            text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  razorpayPaymentId: text("razorpay_payment_id"),
  completedAt:       timestamp("completed_at", { withTimezone: true }),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pending_purchases_user_idx").on(t.userId),
  index("pending_purchases_order_idx").on(t.razorpayOrderId),
  index("pending_purchases_status_idx").on(t.status),
]);

export type UserCredits                = typeof userCreditsTable.$inferSelect;
export type GenerationLog              = typeof generationLogsTable.$inferSelect;
export type CreditTransaction          = typeof creditTransactionsTable.$inferSelect;
export type CreditPackage              = typeof creditPackagesTable.$inferSelect;
export type ReplicateTopup             = typeof replicateTopupsTable.$inferSelect;
export type PendingCreditPurchase      = typeof pendingCreditPurchasesTable.$inferSelect;
