import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Role Enum
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'front_office',
  'warehouse'
]);

// User schema with roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default('front_office'),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
  active: boolean("active").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, lastLogin: true })
  .extend({
    username: z.string().min(3, { message: "Username must be at least 3 characters" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    fullName: z.string().min(2, { message: "Full name is required" }),
    role: z.enum(['admin', 'manager', 'front_office', 'warehouse']).default('front_office'),
    email: z.string().email({ message: "Invalid email address" }).optional(),
    active: z.boolean().default(true),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Categories Schema
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(2, { message: "Category name must be at least 2 characters" }),
    description: z.string().optional(),
  });

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Tags Schema
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTagSchema = createInsertSchema(tags)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, { message: "Tag name is required" }),
    description: z.string().optional(),
    color: z.string().optional(),
  });

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

// Product Tags (Many-to-Many)
export const productTags = pgTable("product_tags", {
  productId: integer("product_id").notNull(),
  tagId: integer("tag_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.tagId] })
}));

export type ProductTag = typeof productTags.$inferSelect;

// Products Schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  categoryId: integer("category_id").notNull(),
  description: text("description"),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  currentStock: integer("current_stock").notNull().default(0),
  location: text("location"),
  unitsPerBox: integer("units_per_box"),
  imagePath: text("image_path"),
  tags: text("tags").array(),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true })
  .extend({
    categoryId: z.number(),
    minStockLevel: z.number().min(0),
    currentStock: z.number().min(0),
    imagePath: z.string().optional(),
    barcode: z.string().optional(),
    location: z.string().optional(),
    unitsPerBox: z.number().optional(),
    tags: z.array(z.string()).optional().default([]),
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
  hasShippingDocument: boolean("has_shipping_document").notNull().default(false),
  createdById: integer("created_by_id").notNull(), // References the user who created this order
  updatedById: integer("updated_by_id"), // Last user who updated this order
  lastUpdated: timestamp("last_updated"), // When the order was last updated
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, orderNumber: true, orderDate: true, lastUpdated: true, updatedById: true })
  .extend({
    customerName: z.string().min(2),
    notes: z.string().optional(),
    orderDate: z.string().optional().transform(val => val ? new Date(val) : new Date()),
    createdById: z.number(),
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

// Action Type Enum for Changelog
export const changelogActionEnum = pgEnum('changelog_action', [
  'create',
  'update',
  'delete',
  'status_change'
]);

// Changelog Schema for Orders
export const orderChangelogs = pgTable("order_changelogs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  userId: integer("user_id").notNull(),
  action: changelogActionEnum("action").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  changes: json("changes"), // Stores the changes made in JSON format
  previousValues: json("previous_values"), // Stores the previous values in JSON format
  notes: text("notes"),
});

export const insertOrderChangelogSchema = createInsertSchema(orderChangelogs)
  .omit({ id: true, timestamp: true })
  .extend({
    orderId: z.number(),
    userId: z.number(),
    action: z.enum(['create', 'update', 'delete', 'status_change']),
    changes: z.record(z.any()).optional(),
    previousValues: z.record(z.any()).optional(),
    notes: z.string().optional(),
  });

export type InsertOrderChangelog = z.infer<typeof insertOrderChangelogSchema>;
export type OrderChangelog = typeof orderChangelogs.$inferSelect;

// Unshipped Items Schema - Items that were part of an order but weren't picked
export const unshippedItems = pgTable("unshipped_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  customerName: text("customer_name").notNull(),
  customerId: text("customer_id"),
  originalOrderNumber: text("original_order_number").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  shipped: boolean("shipped").notNull().default(false),
  shippedInOrderId: integer("shipped_in_order_id"),
  shippedAt: timestamp("shipped_at"),
  authorized: boolean("authorized").notNull().default(false),
  authorizedById: integer("authorized_by_id"),
  authorizedAt: timestamp("authorized_at"),
  notes: text("notes"),
});

export const insertUnshippedItemSchema = createInsertSchema(unshippedItems)
  .omit({ id: true, date: true, shipped: true, shippedInOrderId: true, shippedAt: true, authorized: true, authorizedById: true, authorizedAt: true })
  .extend({
    orderId: z.number(),
    productId: z.number(),
    quantity: z.number().min(1),
    customerName: z.string(),
    customerId: z.string().optional(),
    originalOrderNumber: z.string(),
    notes: z.string().optional(),
  });

export type InsertUnshippedItem = z.infer<typeof insertUnshippedItemSchema>;
export type UnshippedItem = typeof unshippedItems.$inferSelect;
