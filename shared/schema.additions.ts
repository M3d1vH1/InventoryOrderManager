import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, json, primaryKey, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { productionOrders, users } from "./schema";

// Production Quality Checks
export const productionQualityChecks = pgTable("production_quality_checks", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").notNull().references(() => productionOrders.id, { onDelete: 'cascade' }),
  checkType: text("check_type").notNull(), // appearance, odor, taste, etc.
  passed: boolean("passed").notNull().default(false),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionQualityCheckSchema = createInsertSchema(productionQualityChecks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type InsertProductionQualityCheck = z.infer<typeof insertProductionQualityCheckSchema>;
export type ProductionQualityCheck = typeof productionQualityChecks.$inferSelect;