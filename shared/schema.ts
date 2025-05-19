import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, json, primaryKey, numeric, date, varchar, decimal } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Role Enum
export const userRoleEnum = pgEnum('user_role', [
  'admin',
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
    role: z.enum(['admin', 'front_office', 'warehouse']).default('front_office'),
    email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
    active: z.boolean().default(true),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Categories Schema
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(2, { message: "Category name must be at least 2 characters" }),
    description: z.string().optional(),
    color: z.string().optional(),
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
  lastStockUpdate: timestamp("last_stock_update").default(sql`CURRENT_TIMESTAMP`),
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
    lastStockUpdate: z.date().optional(),
  });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Order Status Enum
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'picked',
  'partially_shipped',
  'shipped',
  'cancelled'
]);

// Order Priority Enum
export const orderPriorityEnum = pgEnum('order_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

// Shipping Documents Schema
export const shippingDocuments = pgTable("shipping_documents", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  documentPath: text("document_path").notNull(),
  documentType: text("document_type").notNull(),
  trackingNumber: text("tracking_number"),
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertShippingDocumentSchema = createInsertSchema(shippingDocuments)
  .omit({ id: true, uploadDate: true })
  .extend({
    orderId: z.number(),
    documentPath: z.string().min(1),
    documentType: z.string().min(1),
    trackingNumber: z.string().optional(),
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
  estimatedShippingDate: timestamp("estimated_shipping_date"), // Required field for shipping date estimation
  actualShippingDate: timestamp("actual_shipping_date"), // When the order was actually shipped
  status: orderStatusEnum("status").notNull().default('pending'),
  priority: orderPriorityEnum("priority").default('medium'), // Add priority field with default value
  area: text("area"), // Customer area/region for delivery
  notes: text("notes"),
  hasShippingDocument: boolean("has_shipping_document").notNull().default(false),
  isPartialFulfillment: boolean("is_partial_fulfillment").notNull().default(false),
  partialFulfillmentApproved: boolean("partial_fulfillment_approved").notNull().default(false),
  partialFulfillmentApprovedById: integer("partial_fulfillment_approved_by_id"), // References the user who approved partial fulfillment
  partialFulfillmentApprovedAt: timestamp("partial_fulfillment_approved_at"), // When partial fulfillment was approved
  percentage_shipped: integer("percentage_shipped").default(0), // Percentage of items that have been shipped
  createdById: integer("created_by_id").notNull(), // References the user who created this order
  updatedById: integer("updated_by_id"), // Last user who updated this order
  lastUpdated: timestamp("last_updated"), // When the order was last updated
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, orderNumber: true, orderDate: true, lastUpdated: true, updatedById: true, actualShippingDate: true })
  .extend({
    customerName: z.string().min(2),
    notes: z.string().optional(),
    area: z.string().optional(),
    orderDate: z.string().optional().transform(val => val ? new Date(val) : new Date()),
    estimatedShippingDate: z.string().min(1, { message: "Estimated shipping date is required" })
      .transform(val => new Date(val)),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
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
  shipped_quantity: integer("shipped_quantity").default(0),
  shipping_status: text("shipping_status").default('pending'),
  hasQualityIssues: boolean("has_quality_issues").default(false),
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true })
  .extend({
    quantity: z.number().min(1, { message: "Quantity must be at least 1" }), // Enforce positive quantities
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
  shippingCompany: text("shipping_company"),
  preferredShippingCompany: shippingCompanyEnum("preferred_shipping_company"),
  billingCompany: text("custom_shipping_company"), // Renamed from customShippingCompany, keeping DB column name for compatibility
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
    email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
    phone: z.string().optional(),
    contactPerson: z.string().optional(),
    shippingCompany: z.string().optional(),
    preferredShippingCompany: z.enum(['dhl', 'fedex', 'ups', 'usps', 'royal_mail', 'other']).optional(),
    billingCompany: z.string().optional(), // Field for tracking which company should be invoiced
    notes: z.string().optional(),
  });

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Action Type Enum for Changelog
export const changelogActionEnum = pgEnum('changelog_action', [
  'create',
  'update',
  'delete',
  'status_change',
  'unshipped_authorization',
  'label_printed',
  'partial_approval',
  'email_sent',
  'error_report'
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
    action: z.enum(['create', 'update', 'delete', 'status_change', 'unshipped_authorization', 'label_printed', 'partial_approval', 'email_sent', 'error_report']),
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
    quantity: z.number().min(0), // Changed from min(1) to min(0) to allow zero-quantity unshipped items
    customerName: z.string(),
    customerId: z.string().optional(),
    originalOrderNumber: z.string(),
    notes: z.string().optional(),
  });

export type InsertUnshippedItem = z.infer<typeof insertUnshippedItemSchema>;
export type UnshippedItem = typeof unshippedItems.$inferSelect;

// Session table for express-session with PostgreSQL store
export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Email settings for notification system
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default('smtp.gmail.com'),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  authUser: text("auth_user").notNull(),
  authPass: text("auth_pass").notNull(),
  fromEmail: text("from_email").notNull(),
  companyName: text("company_name").notNull().default('Warehouse Management System'),
  enableNotifications: boolean("enable_notifications").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// Company Settings schema
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default('Warehouse Systems Inc.'),
  email: text("email").notNull().default('info@warehousesys.com'),
  phone: text("phone").default(''),
  address: text("address").default(''),
  logoPath: text("logo_path").default(''),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Notification Settings schema
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  lowStockAlerts: boolean("low_stock_alerts").notNull().default(true),
  orderConfirmation: boolean("order_confirmation").notNull().default(true),
  shippingUpdates: boolean("shipping_updates").notNull().default(true),
  dailyReports: boolean("daily_reports").notNull().default(false),
  weeklyReports: boolean("weekly_reports").notNull().default(true),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  
  // Slack notification settings
  slackEnabled: boolean("slack_enabled").notNull().default(false),
  slackWebhookUrl: text("slack_webhook_url"),
  slackNotifyNewOrders: boolean("slack_notify_new_orders").notNull().default(true),
  slackNotifyCallLogs: boolean("slack_notify_call_logs").notNull().default(true),
  slackNotifyLowStock: boolean("slack_notify_low_stock").notNull().default(false),
  
  // Slack notification templates
  slackOrderTemplate: text("slack_order_template"),
  slackCallLogTemplate: text("slack_call_log_template"),
  slackLowStockTemplate: text("slack_low_stock_template"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

// Define permission types
export const permissionEnum = pgEnum('permission_type', [
  'view_dashboard',
  'view_products',
  'edit_products',
  'view_customers',
  'edit_customers',
  'view_orders',
  'create_orders',
  'edit_orders',
  'delete_orders',
  'view_reports',
  'order_picking',
  'view_unshipped_items',
  'authorize_unshipped_items',
  'view_settings',
  'edit_settings',
  'view_users',
  'edit_users',
  'view_email_templates',
  'edit_email_templates',
]);

// Role permissions
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: userRoleEnum("role").notNull(),
  permission: permissionEnum("permission").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// Order Quality Types Enum
export const orderQualityTypeEnum = pgEnum('order_error_type', [
  'missing_item',        // Item was recorded as shipped but missing from package
  'wrong_item',          // Wrong item was picked and shipped
  'damaged_item',        // Item was damaged during picking/shipping
  'wrong_quantity',      // Incorrect quantity shipped
  'duplicate_item',      // Duplicate item was shipped
  'wrong_address',       // Package shipped to incorrect address
  'picking_issue',       // Quality issue in picking process
  'packing_issue',       // Quality issue in packing process
  'system_issue',        // Issue caused by system failure/bug
  'other'                // Other unclassified issues
]);

// Shipping Itinerary Schema - For tracking order groups that leave the warehouse together
export const shippingItineraries = pgTable("shipping_itineraries", {
  id: serial("id").primaryKey(),
  itineraryNumber: text("itinerary_number").notNull().unique(),
  departureDate: timestamp("departure_date").notNull(),
  shippingCompany: text("shipping_company"),
  driverName: text("driver_name"),
  vehicleInfo: text("vehicle_info"),
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
  addedById: integer("added_by_id").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertShippingItinerarySchema = createInsertSchema(shippingItineraries)
  .omit({ id: true, createdAt: true })
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

// Order Quality Schema - For tracking order issues
export const orderQuality = pgTable("order_errors", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"), // Now optional - can exist without an order
  orderNumber: text("order_number"), // Now optional
  reportDate: timestamp("report_date").notNull().defaultNow(),
  reportedById: integer("reported_by_id").notNull(),
  errorType: orderQualityTypeEnum("error_type").notNull(),
  description: text("description").notNull(),
  affectedProductIds: text("affected_product_ids").array(),
  correctiveAction: text("corrective_action"),
  inventoryAdjusted: boolean("inventory_adjusted").notNull().default(false),
  resolved: boolean("resolved").notNull().default(false),
  resolvedById: integer("resolved_by_id"),
  resolvedDate: timestamp("resolved_date"),
  rootCause: text("root_cause"),
  preventiveMeasures: text("preventive_measures"),
  // New standalone quality fields
  qualityLabel: text("quality_label"), // Label to identify this quality record
  qualityCategory: text("quality_category"), // Category for organizing quality records
  qualityStatus: text("quality_status"), // Status field independent of resolved
  assignedToId: integer("assigned_to_id"), // Person assigned to handle this quality issue
  dueDate: timestamp("due_date"), // When this issue should be addressed by
  priority: text("priority"), // Priority level (high, medium, low)
  qualityNotes: text("quality_notes"), // Additional notes specific to quality management
});

export const insertOrderQualitySchema = createInsertSchema(orderQuality)
  .omit({ id: true, reportDate: true, resolved: true, resolvedById: true, resolvedDate: true })
  .extend({
    orderId: z.number().optional(), // Now optional
    orderNumber: z.string().optional(), // Now optional
    reportedById: z.number(),
    errorType: z.enum(['missing_item', 'wrong_item', 'damaged_item', 'wrong_quantity', 'duplicate_item', 'wrong_address', 'picking_issue', 'packing_issue', 'system_issue', 'other']),
    description: z.string().min(1),
    affectedProductIds: z.array(z.string()).optional().default([]),
    correctiveAction: z.string().optional(),
    inventoryAdjusted: z.boolean().default(false),
    rootCause: z.string().optional(),
    preventiveMeasures: z.string().optional(),
    // Extend with new fields
    qualityLabel: z.string().optional(),
    qualityCategory: z.string().optional(),
    qualityStatus: z.string().optional(),
    assignedToId: z.number().optional(),
    dueDate: z.string().optional(), // Use string for date in form submission
    priority: z.string().optional(),
    qualityNotes: z.string().optional(),
  });

export type InsertOrderQuality = z.infer<typeof insertOrderQualitySchema>;
export type OrderQuality = typeof orderQuality.$inferSelect;

// Inventory Change Action Enum
export const inventoryChangeTypeEnum = pgEnum('inventory_change_type', [
  'manual_adjustment',  // Manual adjustment of inventory by staff
  'order_fulfillment',  // Inventory decreased due to order fulfillment
  'order_cancellation', // Inventory increased due to order cancellation
  'stock_replenishment', // New stock added to inventory
  'inventory_correction', // Correction after physical inventory count
  'return',            // Product returned to inventory
  'error_adjustment',  // Adjustment due to error report
  'other'              // Other unclassified changes
]);

// Inventory Changes Schema - For tracking inventory modifications
export const inventoryChanges = pgTable("inventory_changes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  changeType: inventoryChangeTypeEnum("change_type").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  quantityChanged: integer("quantity_changed").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  reference: text("reference"), // Could be an order number, error report ID, etc.
  notes: text("notes"),
});

export const insertInventoryChangeSchema = createInsertSchema(inventoryChanges)
  .omit({ id: true, timestamp: true })
  .extend({
    productId: z.number(),
    userId: z.number(),
    changeType: z.enum(['manual_adjustment', 'order_fulfillment', 'order_cancellation', 'stock_replenishment', 'inventory_correction', 'return', 'error_adjustment', 'other']),
    previousQuantity: z.number(),
    newQuantity: z.number(),
    quantityChanged: z.number(),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });

export type InsertInventoryChange = z.infer<typeof insertInventoryChangeSchema>;
export type InventoryChange = typeof inventoryChanges.$inferSelect;

// Call Type Enum
export const callTypeEnum = pgEnum('call_type', [
  'incoming',
  'outgoing',
  'missed'
]);

// Call Purpose Enum
export const callPurposeEnum = pgEnum('call_purpose', [
  'sales',
  'support',
  'followup',
  'complaint',
  'inquiry',
  'other'
]);

// Call Priority Enum
export const callPriorityEnum = pgEnum('call_priority', [
  'low',
  'normal',
  'high',
  'urgent'
]);

// Call Status Enum
export const callStatusEnum = pgEnum('call_status', [
  'scheduled',
  'completed',
  'no_answer',
  'needs_followup',
  'cancelled'
]);

// Call Logs Schema
export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"), // Optional - for tracking non-customer calls
  contactName: text("contact_name").notNull(), // Name of person contacted
  companyName: text("company_name"), // Company name (for non-customers)
  callDate: timestamp("call_date").notNull().defaultNow(),
  callTime: text("call_time"), // Time as string for better display control
  duration: integer("duration"), // Call duration in seconds
  callType: callTypeEnum("call_type").notNull().default('outgoing'),
  callPurpose: callPurposeEnum("call_purpose").notNull().default('other'),
  callStatus: callStatusEnum("call_status").notNull().default('completed'),
  priority: callPriorityEnum("priority").default('normal'),
  notes: text("notes"),
  userId: integer("user_id").notNull(), // User who made/received the call
  followupDate: timestamp("followup_date"), // Date for any needed follow-up
  followupTime: text("followup_time"), // Time for follow-up
  followupAssignedTo: integer("followup_assigned_to"), // User assigned to follow up
  reminderSent: boolean("reminder_sent").default(false),
  isFollowup: boolean("is_followup").default(false), // Whether this call is a follow-up to previous one
  previousCallId: integer("previous_call_id"), // Reference to previous call this follows up on
  tags: text("tags").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertCallLogSchema = createInsertSchema(callLogs)
  .omit({ id: true, createdAt: true, updatedAt: true, reminderSent: true })
  .extend({
    customerId: z.number().optional(), 
    contactName: z.string().min(1, { message: "Contact name is required" }),
    companyName: z.string().optional(),
    callDate: z.string().transform(val => val ? new Date(val) : new Date()),
    callTime: z.string().optional(),
    duration: z.number().min(0).optional(),
    callType: z.enum(['incoming', 'outgoing', 'missed']),
    callPurpose: z.enum(['sales', 'support', 'followup', 'complaint', 'inquiry', 'other']),
    callStatus: z.enum(['scheduled', 'completed', 'no_answer', 'needs_followup', 'cancelled']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    notes: z.string().optional(),
    userId: z.number(),
    followupDate: z.string().optional().transform(val => val ? new Date(val) : null),
    followupTime: z.string().optional(),
    followupAssignedTo: z.number().optional(),
    isFollowup: z.boolean().default(false),
    previousCallId: z.number().optional(),
    tags: z.array(z.string()).optional().default([]),
  });

// Simplified schema for quick call creation from the header/modal
export const quickCallLogSchema = z.object({
  customerId: z.number().optional().nullable(),
  prospectiveCustomerId: z.number().optional().nullable(),
  subject: z.string().min(1, { message: "Subject is required" }),
  callType: z.string(), // Matches frontend form values: 'inbound', 'outbound', 'missed', 'scheduled'
  callDate: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        // Try to safely convert string to Date
        try {
          return new Date(val);
        } catch (e) {
          // If conversion fails, return the current date
          console.error("Date conversion error:", e);
          return new Date();
        }
      }
      return val; // Already a Date object or something else
    },
    z.date()
  ),
  duration: z.number().min(1),
  notes: z.string().optional(),
  priority: z.string(), // Matches frontend form values: 'low', 'medium', 'high', 'urgent'
  needsFollowup: z.boolean().default(false),
  followupDate: z.preprocess(
    (val) => {
      // Allow null/undefined
      if (val === null || val === undefined) return null;
      
      // Try to safely convert string to Date
      if (typeof val === 'string') {
        try {
          return new Date(val);
        } catch (e) {
          console.error("Followup date conversion error:", e);
          return null;
        }
      }
      return val; // Already a Date object or something else
    },
    z.date().nullable().optional()
  ),
});

export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;

// Prospective Customers Schema
export const prospectiveCustomers = pgTable("prospective_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),
  source: text("source"), // How they found out about the company
  notes: text("notes"),
  status: text("status").notNull().default('new'), // new, contacted, qualified, converted, rejected
  assignedToId: integer("assigned_to_id"),
  lastContactDate: timestamp("last_contact_date").defaultNow(),
  nextContactDate: timestamp("next_contact_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertProspectiveCustomerSchema = createInsertSchema(prospectiveCustomers)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1, { message: "Name is required" }),
    companyName: z.string().optional(),
    email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().default('new'),
    assignedToId: z.number().optional(),
    lastContactDate: z.string().optional().transform(val => val ? new Date(val) : new Date()),
    nextContactDate: z.string().optional().transform(val => val ? new Date(val) : null),
  });

export type InsertProspectiveCustomer = z.infer<typeof insertProspectiveCustomerSchema>;
export type ProspectiveCustomer = typeof prospectiveCustomers.$inferSelect;

// Call Outcomes Schema - For tracking action items from calls
export const callOutcomes = pgTable("call_outcomes", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").notNull(),
  outcome: text("outcome").notNull(),
  status: text("status").notNull().default('pending'), // pending, in-progress, completed
  dueDate: timestamp("due_date"),
  assignedToId: integer("assigned_to_id"),
  completedById: integer("completed_by_id"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertCallOutcomeSchema = createInsertSchema(callOutcomes)
  .omit({ id: true, createdAt: true, updatedAt: true, completedById: true, completedAt: true })
  .extend({
    callId: z.number(),
    outcome: z.string().min(1, { message: "Outcome description is required" }),
    status: z.string().default('pending'),
    dueDate: z.string().optional().transform(val => val ? new Date(val) : null),
    assignedToId: z.number().optional(),
    notes: z.string().optional(),
  });

export type InsertCallOutcome = z.infer<typeof insertCallOutcomeSchema>;
export type CallOutcome = typeof callOutcomes.$inferSelect;

// ====== Smart Inventory Prediction Models ======

// Prediction Method Enum
export const predictionMethodEnum = pgEnum('prediction_method', [
  'moving_average',
  'linear_regression',
  'seasonal_adjustment',
  'weighted_average',
  'manual'
]);

// Prediction Accuracy Enum
export const predictionAccuracyEnum = pgEnum('prediction_accuracy', [
  'low',
  'medium',
  'high'
]);

// Historical Inventory Data
export const inventoryHistory = pgTable("inventory_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  recordDate: timestamp("record_date").notNull().defaultNow(),
  quantity: integer("quantity").notNull(),
  stockStatus: text("stock_status").notNull(), // "in_stock", "low_stock", "out_of_stock"
  demandRate: integer("demand_rate"), // Units per week
  weeklySales: integer("weekly_sales").default(0), // Quantity sold that week
  seasonalFactor: integer("seasonal_factor").default(100), // Percentage: 100 = normal, 120 = 20% higher seasonal demand
});

export const insertInventoryHistorySchema = createInsertSchema(inventoryHistory)
  .omit({ id: true })
  .extend({
    productId: z.number(),
    recordDate: z.date().default(new Date()),
    quantity: z.number(),
    stockStatus: z.string(),
    demandRate: z.number().optional(),
    weeklySales: z.number().optional(),
    seasonalFactor: z.number().optional(),
  });

export type InsertInventoryHistory = z.infer<typeof insertInventoryHistorySchema>;
export type InventoryHistory = typeof inventoryHistory.$inferSelect;

// Inventory Predictions
export const inventoryPredictions = pgTable("inventory_predictions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  predictionMethod: predictionMethodEnum("prediction_method").notNull().default('moving_average'),
  predictedDemand: integer("predicted_demand").notNull(), // Predicted units needed
  confidenceLevel: integer("confidence_level").notNull().default(70), // Percentage confidence (0-100)
  accuracy: predictionAccuracyEnum("accuracy").default('medium'),
  predictedStockoutDate: timestamp("predicted_stockout_date"), // When product will run out
  recommendedReorderDate: timestamp("recommended_reorder_date"), // When to reorder
  recommendedQuantity: integer("recommended_quantity"), // How much to order
  notes: text("notes"),
  createdById: integer("created_by_id"),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertInventoryPredictionSchema = createInsertSchema(inventoryPredictions)
  .omit({ id: true, generatedAt: true, updatedAt: true })
  .extend({
    productId: z.number(),
    predictionMethod: z.enum(['moving_average', 'linear_regression', 'seasonal_adjustment', 'weighted_average', 'manual']),
    predictedDemand: z.number(),
    confidenceLevel: z.number().min(0).max(100),
    accuracy: z.enum(['low', 'medium', 'high']).default('medium'),
    predictedStockoutDate: z.date().optional(),
    recommendedReorderDate: z.date().optional(),
    recommendedQuantity: z.number().optional(),
    notes: z.string().optional(),
    createdById: z.number().optional(),
  });

export type InsertInventoryPrediction = z.infer<typeof insertInventoryPredictionSchema>;
export type InventoryPrediction = typeof inventoryPredictions.$inferSelect;

// Seasonal Patterns
export const seasonalPatterns = pgTable("seasonal_patterns", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  month: integer("month").notNull(), // 1-12
  adjustmentFactor: integer("adjustment_factor").notNull().default(100), // Percentage: 100 = normal, 120 = 20% higher
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertSeasonalPatternSchema = createInsertSchema(seasonalPatterns)
  .omit({ id: true, updatedAt: true })
  .extend({
    productId: z.number(),
    month: z.number().min(1).max(12),
    adjustmentFactor: z.number().default(100),
    notes: z.string().optional(),
  });

export type InsertSeasonalPattern = z.infer<typeof insertSeasonalPatternSchema>;
export type SeasonalPattern = typeof seasonalPatterns.$inferSelect;

// Production Module Types

// Raw Material Type Enum
export const materialTypeEnum = pgEnum('material_type', [
  'liquid',
  'packaging',
  'label',
  'cap',
  'box',
  'other'
]);

// Material Units Enum
export const materialUnitEnum = pgEnum('material_unit', [
  'liter',
  'kg',
  'piece'
]);

// Production Status Enum
export const productionStatusEnum = pgEnum('production_status', [
  'planned',
  'in_progress',
  'completed',
  'quality_check',
  'approved',
  'rejected'
]);

// Production Order Status Enum
export const productionOrderStatusEnum = pgEnum('production_order_status', [
  'planned',
  'material_check',
  'in_progress',
  'completed',
  'partially_completed',
  'cancelled'
]);

// Production Event Type Enum
export const productionEventEnum = pgEnum('production_event_type', [
  'start',
  'pause',
  'resume',
  'material_added',
  'completed',
  'quality_check',
  'issue'
]);

// Raw Materials Schema - Track materials like olive oil, bottles, caps, labels
export const rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: materialTypeEnum("type").notNull(),
  sku: text("sku").notNull().unique(),
  currentStock: numeric("current_stock").notNull().default("0"),
  minStockLevel: numeric("min_stock_level").notNull().default("10"),
  unit: materialUnitEnum("unit").notNull(),
  unitCost: numeric("unit_cost"),
  description: text("description"),
  location: text("location"),
  supplierId: integer("supplier_id"),
  lastStockUpdate: timestamp("last_stock_update").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRawMaterialSchema = createInsertSchema(rawMaterials)
  .omit({ id: true, createdAt: true, updatedAt: true, lastStockUpdate: true })
  .extend({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    type: z.enum(['liquid', 'packaging', 'label', 'cap', 'box', 'other']),
    sku: z.string().min(2, { message: "SKU must be at least 2 characters" }),
    currentStock: z.number().or(z.string().transform(val => Number(val))).default(0),
    minStockLevel: z.number().or(z.string().transform(val => Number(val))).default(10),
    unit: z.enum(['liter', 'kg', 'piece']),
    unitCost: z.number().or(z.string().transform(val => Number(val))).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    supplierId: z.number().optional(),
  });

export type InsertRawMaterial = z.infer<typeof insertRawMaterialSchema>;
export type RawMaterial = typeof rawMaterials.$inferSelect;

// Production Batches Schema - Track batches of olive oil production
export const productionBatches = pgTable("production_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: productionStatusEnum("status").notNull().default('planned'),
  quantity: numeric("quantity").notNull(),
  unit: materialUnitEnum("unit").notNull().default('liter'),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionBatchSchema = createInsertSchema(productionBatches)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    batchNumber: z.string().min(1, { message: "Batch number is required" }),
    startDate: z.string().min(1).transform(val => new Date(val)),
    endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    status: z.enum(['planned', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected']).default('planned'),
    quantity: z.number().or(z.string().transform(val => Number(val))),
    unit: z.enum(['liter', 'kg', 'piece']).default('liter'),
    notes: z.string().optional(),
    createdById: z.number().optional(),
  });

export type InsertProductionBatch = z.infer<typeof insertProductionBatchSchema>;
export type ProductionBatch = typeof productionBatches.$inferSelect;

// Production Recipes Schema - Define what raw materials are needed for a product
export const productionRecipes = pgTable("production_recipes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  description: text("description"),
  yield: numeric("yield").notNull().default("1"),
  yieldUnit: text("yield_unit").notNull().default("liter"),
  status: text("status").notNull().default("active"),
  isDefault: boolean("is_default").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionRecipeSchema = createInsertSchema(productionRecipes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    productId: z.number().min(1, { message: "Product is required" }),
    name: z.string().min(1, { message: "Recipe name is required" }),
    sku: z.string().min(1, { message: "Recipe SKU is required" }),
    description: z.string().optional(),
    yield: z.number().min(0.1, { message: "Yield must be greater than 0" }),
    yieldUnit: z.enum(["liter", "kg", "piece"], { message: "Valid unit is required" }),
    status: z.enum(["draft", "active", "discontinued"], { message: "Valid status is required" }),
    isDefault: z.boolean().default(true),
  });

export type InsertProductionRecipe = z.infer<typeof insertProductionRecipeSchema>;
export type ProductionRecipe = typeof productionRecipes.$inferSelect;

// Recipe Ingredients Schema - The raw materials needed for each recipe
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").references(() => productionRecipes.id).notNull(),
  materialId: integer("material_id").references(() => rawMaterials.id).notNull(),
  quantity: numeric("quantity").notNull(),
  unit: materialUnitEnum("unit").notNull(),
  notes: text("notes"),
});

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients)
  .omit({ id: true })
  .extend({
    recipeId: z.number(),
    materialId: z.number(),
    quantity: z.number().or(z.string().transform(val => Number(val))),
    unit: z.enum(['liter', 'kg', 'piece']),
    notes: z.string().optional(),
  });

export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;

// Production Orders Schema - When we want to produce a batch of final products
export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  productId: integer("product_id").references(() => products.id).notNull(),
  recipeId: integer("recipe_id").references(() => productionRecipes.id).notNull(),
  plannedQuantity: integer("planned_quantity").notNull(),
  actualQuantity: integer("actual_quantity"),
  status: productionOrderStatusEnum("status").notNull().default('planned'),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  batchId: integer("batch_id").references(() => productionBatches.id),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionOrderSchema = createInsertSchema(productionOrders)
  .omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true, actualQuantity: true, startDate: true, endDate: true })
  .extend({
    productId: z.number(),
    recipeId: z.number(),
    plannedQuantity: z.number(),
    status: z.enum(['planned', 'material_check', 'in_progress', 'completed', 'partially_completed', 'cancelled']).default('planned'),
    batchId: z.number().optional(),
    notes: z.string().optional(),
    createdById: z.number(),
  });

export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;
export type ProductionOrder = typeof productionOrders.$inferSelect;

// Material Consumption Records Schema - Track actual usage of materials
export const materialConsumptions = pgTable("material_consumptions", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").references(() => productionOrders.id).notNull(),
  materialId: integer("material_id").references(() => rawMaterials.id).notNull(),
  quantity: numeric("quantity").notNull(),
  consumedAt: timestamp("consumed_at").defaultNow().notNull(),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
});

export const insertMaterialConsumptionSchema = createInsertSchema(materialConsumptions)
  .omit({ id: true, consumedAt: true })
  .extend({
    productionOrderId: z.number(),
    materialId: z.number(),
    quantity: z.number().or(z.string().transform(val => Number(val))),
    notes: z.string().optional(),
    createdById: z.number(),
    consumedAt: z.string().optional().transform(val => val ? new Date(val) : new Date()),
  });

export type InsertMaterialConsumption = z.infer<typeof insertMaterialConsumptionSchema>;
export type MaterialConsumption = typeof materialConsumptions.$inferSelect;

// Production Logs Schema - Track events during production
export const productionLogs = pgTable("production_logs", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").references(() => productionOrders.id).notNull(),
  eventType: productionEventEnum("event_type").notNull(),
  description: text("description").notNull(),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionLogSchema = createInsertSchema(productionLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    productionOrderId: z.number(),
    eventType: z.enum(['start', 'pause', 'resume', 'material_added', 'completed', 'quality_check', 'issue']),
    description: z.string().min(1, { message: "Description is required" }),
    createdById: z.number().optional(),
  });

export type InsertProductionLog = z.infer<typeof insertProductionLogSchema>;
export type ProductionLog = typeof productionLogs.$inferSelect;

// Material Inventory Changes Schema - Track changes in raw material inventory
export const materialInventoryChanges = pgTable("material_inventory_changes", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").references(() => rawMaterials.id).notNull(),
  changeType: inventoryChangeTypeEnum("change_type").notNull(),
  previousQuantity: numeric("previous_quantity").notNull(),
  newQuantity: numeric("new_quantity").notNull(),
  changeAmount: numeric("change_amount").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const insertMaterialInventoryChangeSchema = createInsertSchema(materialInventoryChanges)
  .omit({ id: true, createdAt: true })
  .extend({
    materialId: z.number(),
    changeType: z.enum([
      'manualAdjustment', 
      'productionConsumption', 
      'stockReplenishment', 
      'inventoryCorrection', 
      'return', 
      'errorAdjustment', 
      'other'
    ]),
    previousQuantity: z.number().or(z.string().transform(val => Number(val))),
    newQuantity: z.number().or(z.string().transform(val => Number(val))),
    changeAmount: z.number().or(z.string().transform(val => Number(val))),
    reference: z.string().optional(),
    notes: z.string().optional(),
    createdById: z.number().optional(),
  });

export const insertProductionQualityCheckSchema = createInsertSchema(productionQualityChecks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    productionOrderId: z.number(),
    checkType: z.string().min(1, { message: "Check type is required" }),
    passed: z.boolean(),
    notes: z.string().optional(),
    createdById: z.number().optional(),
  });

export type InsertMaterialInventoryChange = z.infer<typeof insertMaterialInventoryChangeSchema>;
export type MaterialInventoryChange = typeof materialInventoryChanges.$inferSelect;
export type InsertProductionQualityCheck = z.infer<typeof insertProductionQualityCheckSchema>;
export type ProductionQualityCheck = typeof productionQualityChecks.$inferSelect;

// Supplier Payment Tracking Schemas

// Suppliers Schema
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),
  vatNumber: text("vat_number"),
  paymentTerms: text("payment_terms"), // e.g., "Net 30", "Net 60"
  bankAccount: text("bank_account"), // Changed to match database column name
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliers)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    contactPerson: z.string().optional(),
    email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    vatNumber: z.string().optional(),
    paymentTerms: z.string().optional(),
    bankAccount: z.string().optional(), // Changed to match database column name
    notes: z.string().optional(),
    isActive: z.boolean().default(true),
  });

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Invoice Status Enum
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'pending',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled'
]);

// Supplier Invoices Schema
export const supplierInvoices = pgTable("supplier_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  issueDate: date("issue_date").notNull(),  // Changed to match database column name
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }),
  status: invoiceStatusEnum("status").notNull().default('pending'),
  description: text("description"),
  notes: text("notes"),
  reference: text("reference"),  // General reference field
  rfNumber: text("rf_number"),   // Specific RF number field for payments
  attachmentPath: text("attachment_path"),
  attachment: text("attachment"),
  attachmentUrl: text("attachment_url"),  // Added to match database column
  invoiceDate: date("invoice_date"), // Optional column in the database
  company: text("company"),         // Company name the invoice is billed to
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const insertSupplierInvoiceSchema = createInsertSchema(supplierInvoices)
  .omit({ id: true, createdAt: true })
  .extend({
    invoiceNumber: z.string().min(1, { message: "Invoice number is required" }),
    // Use preprocess to handle supplier ID transformation consistently
    supplierId: z.preprocess(
      (val) => {
        // Handle string conversion
        if (typeof val === 'string') return parseInt(val);
        // Keep as number if already a number
        return val;
      },
      z.number().int().positive()
    ),
    // Accept both object dates and ISO strings for issueDate - using union
    issueDate: z.union([
      z.date(),
      z.string().transform(val => new Date(val)),
      z.number().transform(val => new Date(val))
    ]),
    // Accept both object dates and ISO strings for dueDate - using union
    dueDate: z.union([
      z.date(),
      z.string().transform(val => new Date(val)),
      z.number().transform(val => new Date(val))
    ]),
    // Handle invoiceDate (mapping from form field name to DB field name)
    invoiceDate: z.union([
      z.date(),
      z.string().transform(val => new Date(val)),
      z.number().transform(val => new Date(val)),
      z.undefined()
    ]).optional(),
    // Use preprocess for consistent amount handling
    amount: z.preprocess(
      (val) => {
        // Handle string conversion
        if (typeof val === 'string') return parseFloat(val);
        // Keep as number if already a number
        return val;
      },
      z.number().min(0.01, { message: "Amount must be greater than 0" })
    ),
    // Allow paidAmount to be number, string, or undefined
    // Fixed to correctly handle the type transformation required by database
    paidAmount: z.preprocess(
      (val) => {
        // Handle empty string, null, or undefined
        if (val === "" || val === null || val === undefined) return null;
        // Convert string to number if it's a string
        if (typeof val === 'string') return parseFloat(val);
        // Keep it as is if it's already a number
        return val;
      },
      z.number().min(0).nullable().optional()
    ),
    status: z.enum(['pending', 'paid', 'partially_paid', 'overdue', 'cancelled']).default('pending'),
    description: z.string().optional(),
    notes: z.string().optional(),
    reference: z.string().optional(), // General reference field
    rfNumber: z.string().optional(),  // Specific RF number field for payments
    attachmentPath: z.string().optional(),
    attachment: z.string().optional(),
    attachmentUrl: z.string().optional(),
    company: z.string().optional() // For UI purposes only, not stored in DB
  });

export type InsertSupplierInvoice = z.infer<typeof insertSupplierInvoiceSchema>;
export type SupplierInvoice = typeof supplierInvoices.$inferSelect;

// Payment Methods Enum
export const paymentMethodEnum = pgEnum('payment_method', [
  'bank_transfer',
  'check',
  'credit_card',
  'cash',
  'other'
]);

// Supplier Payments Schema
export const supplierPayments = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => supplierInvoices.id),
  paymentDate: date("payment_date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  referenceNumber: text("reference_number"),
  reference: text("reference"),
  notes: text("notes"),
  receiptPath: text("receipt_path"),
  callbackRequired: boolean("callback_required").default(false),
  callbackDate: date("callback_date"),
  callbackNotes: text("callback_notes"),
  callbackCompleted: boolean("callback_completed").default(false),
  company: text("company"), // Company information for the payment
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupplierPaymentSchema = createInsertSchema(supplierPayments)
  .omit({ id: true, createdAt: true })
  .extend({
    // Use preprocess for consistent invoiceId handling
    invoiceId: z.preprocess(
      (val) => {
        // Handle string conversion
        if (typeof val === 'string') return parseInt(val);
        // Keep as number if already a number
        return val;
      },
      z.number().int().positive()
    ),
    // Accept multiple date formats
    paymentDate: z.union([
      z.date(),
      z.string().min(1).transform(val => new Date(val)),
      z.number().transform(val => new Date(val))
    ]),
    // Use preprocess for consistent amount handling in payments
    amount: z.preprocess(
      (val) => {
        // Handle string conversion
        if (typeof val === 'string') return parseFloat(val);
        // Keep as number if already a number
        return val;
      },
      z.number().min(0.01, { message: "Amount must be greater than 0" })
    ),
    paymentMethod: z.enum(['bank_transfer', 'check', 'credit_card', 'cash', 'other']),
    referenceNumber: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    receiptPath: z.string().optional(),
    callbackRequired: z.boolean().default(false),
    // Accept multiple date formats for callbackDate
    callbackDate: z.union([
      z.date(),
      z.string().transform(val => val ? new Date(val) : undefined),
      z.number().transform(val => new Date(val)),
      z.undefined()
    ]).optional(),
    callbackNotes: z.string().optional(),
    callbackCompleted: z.boolean().default(false),
    company: z.string().optional() // Company information for the payment
  });

export type InsertSupplierPayment = z.infer<typeof insertSupplierPaymentSchema>;
export type SupplierPayment = typeof supplierPayments.$inferSelect;
