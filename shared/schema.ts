import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema (already present)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Product Category Enum
export const categoryEnum = pgEnum('category', [
  'widgets',
  'connectors',
  'brackets',
  'mounts',
  'other'
]);

// Products Schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  category: categoryEnum("category").notNull(),
  description: text("description"),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  currentStock: integer("current_stock").notNull().default(0),
  location: text("location"),
  unitsPerBox: integer("units_per_box"),
  imageUrl: text("image_url"),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true })
  .extend({
    minStockLevel: z.number().min(0),
    currentStock: z.number().min(0),
  });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Order Status Enum
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'picked',
  'shipped',
  'cancelled'
]);

// Orders Schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  status: orderStatusEnum("status").notNull().default('pending'),
  notes: text("notes"),
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, orderNumber: true, orderDate: true })
  .extend({
    customerName: z.string().min(2),
    notes: z.string().optional(),
    orderDate: z.string().optional().transform(val => val ? new Date(val) : new Date()),
  });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items Schema
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true })
  .extend({
    quantity: z.number().min(1),
  });

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Customer Schema (simplified)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers)
  .omit({ id: true });

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
