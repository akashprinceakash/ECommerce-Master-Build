import { pgTable, serial, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CLUB_GARMENT_TYPES = ["men_polo", "women_polo", "boys_polo", "girls_polo"] as const;
export type ClubGarmentType = typeof CLUB_GARMENT_TYPES[number];

export const clubMeasurementsSchema = z.object({
  height:         z.string().optional(),
  weight:         z.string().optional(),
  chest:          z.string().optional(),
  waist:          z.string().optional(),
  hip:            z.string().optional(),
  shoulder:       z.string().optional(),
  sleeveLength:   z.string().optional(),
  neck:           z.string().optional(),
  torsoLength:    z.string().optional(),
  inseam:         z.string().optional(),
});

export type ClubMeasurements = z.infer<typeof clubMeasurementsSchema>;

export const clubOrdersTable = pgTable("club_orders", {
  id:           serial("id").primaryKey(),
  userId:       text("user_id").notNull(),
  clubName:     text("club_name").notNull().default("Q Club"),
  garmentType:  text("garment_type").notNull(),
  measurements: jsonb("measurements").notNull().$type<ClubMeasurements>(),
  status:       text("status").notNull().default("pending"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("club_orders_user_id_idx").on(t.userId),
  index("club_orders_club_name_idx").on(t.clubName),
  index("club_orders_status_idx").on(t.status),
]);

export const insertClubOrderSchema = createInsertSchema(clubOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClubOrder = z.infer<typeof insertClubOrderSchema>;
export type ClubOrder = typeof clubOrdersTable.$inferSelect;
