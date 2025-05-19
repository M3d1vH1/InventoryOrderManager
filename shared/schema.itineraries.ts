import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { orders } from "./schema";

// Shipping itinerary status enum
export const itineraryStatusEnum = pgEnum('itinerary_status', [
  'active',     // Scheduled for delivery
  'completed',  // All orders delivered successfully
  'cancelled'   // Itinerary cancelled
]);

// Shipping Itinerary Schema - For tracking order groups that leave the warehouse together
export const shippingItineraries = pgTable("shipping_itineraries", {
  id: serial("id").primaryKey(),
  itineraryNumber: text("itinerary_number").notNull().unique(),
  departureDate: timestamp("departure_date").notNull(),
  shippingCompany: text("shipping_company"),
  driverName: text("driver_name"),
  vehicleInfo: text("vehicle_info"),
  totalBoxes: integer("total_boxes").notNull().default(0),
  notes: text("notes"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull().default('active'),
});

// Itinerary-Order relationship table (many-to-many)
export const itineraryOrders = pgTable("itinerary_orders", {
  id: serial("id").primaryKey(),
  itineraryId: integer("itinerary_id").notNull().references(() => shippingItineraries.id, { onDelete: 'cascade' }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  boxCount: integer("box_count").notNull().default(1),
  addedById: integer("added_by_id").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertShippingItinerarySchema = createInsertSchema(shippingItineraries)
  .omit({ id: true, createdAt: true, totalBoxes: true })
  .extend({
    itineraryNumber: z.string().min(1),
    departureDate: z.date(),
    shippingCompany: z.string().optional(),
    driverName: z.string().optional(),
    vehicleInfo: z.string().optional(),
    notes: z.string().optional(),
  });

export const insertItineraryOrderSchema = createInsertSchema(itineraryOrders)
  .omit({ id: true, addedAt: true });

export type InsertShippingItinerary = z.infer<typeof insertShippingItinerarySchema>;
export type ShippingItinerary = typeof shippingItineraries.$inferSelect;
export type ItineraryOrder = typeof itineraryOrders.$inferSelect;