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
  imagePath: text("image_path"),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true })
  .extend({
    minStockLevel: z.number().min(0),
    currentStock: z.number().min(0),
    imagePath: z.string().optional(),
    barcode: z.string().optional(),
    location: z.string().optional(),
    unitsPerBox: z.number().optional(),
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

// Shipping Documents Schema
export const shippingDocuments = pgTable("shipping_documents", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  documentPath: text("document_path").notNull(),
  documentType: text("document_type").notNull(),
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertShippingDocumentSchema = createInsertSchema(shippingDocuments)
  .omit({ id: true, uploadDate: true })
  .extend({
    orderId: z.number(),
    documentPath: z.string().min(1),
    documentType: z.string().min(1),
    notes: z.string().optional(),
  });

export type InsertShippingDocument = z.infer<typeof insertShippingDocumentSchema>;
export type ShippingDocument = typeof shippingDocuments.$inferSelect;

// Orders Schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  status: orderStatusEnum("status").notNull().default('pending'),
  notes: text("notes"),
  hasShippingDocument: boolean("has_shipping_document").default(false),
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

// Shipping Companies Enum
export const shippingCompanyEnum = pgEnum('shipping_company', [
  'dhl',
  'fedex',
  'ups',
  'usps',
  'royal_mail',
  'other'
]);

// Customer Schema (enhanced)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),
  email: text("email"),
  phone: text("phone"),
  contactPerson: text("contact_person"),
  preferredShippingCompany: shippingCompanyEnum("preferred_shipping_company"),
  customShippingCompany: text("custom_shipping_company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    vatNumber: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    email: z.string().email({ message: "Invalid email address" }).optional(),
    phone: z.string().optional(),
    contactPerson: z.string().optional(),
    preferredShippingCompany: z.enum(['dhl', 'fedex', 'ups', 'usps', 'royal_mail', 'other']).optional(),
    customShippingCompany: z.string().nullish(),
    notes: z.string().optional(),
  });

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
