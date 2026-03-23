// src/server/db/schema.ts
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
  check,
  primaryKey,
  real,
  numeric,
  uuid,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "front_office",
  "warehouse",
  "viewer",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "picking",
  "picked",
  "partially_shipped",
  "shipped",
  "delivered",
  "cancelled",
  "on_hold",
]);

export const orderPriorityEnum = pgEnum("order_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const shippingCompanyEnum = pgEnum("shipping_company", [
  "brt",
  "dhl",
  "gls",
  "sda",
  "tnt",
  "ups",
  "fedex",
  "poste_italiane",
  "other",
  "pickup",
]);

export const changelogActionEnum = pgEnum("changelog_action", [
  "created",
  "status_changed",
  "items_modified",
  "priority_changed",
  "assigned",
  "shipping_updated",
  "note_added",
  "partial_fulfillment_approved",
  "quality_issue_reported",
  "cancelled",
  "restored",
]);

export const orderQualityTypeEnum = pgEnum("order_quality_type", [
  "wrong_item",
  "wrong_quantity",
  "damaged",
  "missing_item",
  "labeling_error",
  "packaging_error",
  "other",
]);

export const inventoryChangeTypeEnum = pgEnum("inventory_change_type", [
  "manual_adjustment",
  "order_shipped",
  "order_cancelled",
  "return_received",
  "stock_received",
  "damaged",
  "cycle_count",
  "reservation",
  "reservation_released",
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: text("password").notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("warehouse"),
  email: varchar("email", { length: 255 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

// ─── Sessions (Lucia) ────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});



// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Tags ────────────────────────────────────────────────────────────────────

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Products ────────────────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 50 }).notNull().unique(),
    barcode: varchar("barcode", { length: 100 }),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    minStockLevel: integer("min_stock_level").notNull().default(0),
    currentStock: integer("current_stock").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    location: varchar("location", { length: 100 }),
    unitsPerBox: integer("units_per_box"),
    imagePath: text("image_path"),
    lastStockUpdate: timestamp("last_stock_update", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_products_sku").on(table.sku),
    index("idx_products_category_id").on(table.categoryId),
    index("idx_products_barcode").on(table.barcode),
    index("idx_products_name_trgm").using("gin", sql`${table.name} gin_trgm_ops`),
    check("chk_current_stock_non_negative", sql`${table.currentStock} >= 0`),
    check("chk_reserved_stock_non_negative", sql`${table.reservedStock} >= 0`),
    check(
      "chk_reserved_lte_current",
      sql`${table.reservedStock} <= ${table.currentStock}`
    ),
  ]
);

// ─── Product Tags (junction) ─────────────────────────────────────────────────

export const productTags = pgTable(
  "product_tags",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.tagId] })]
);

// ─── Customers ───────────────────────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  vatNumber: varchar("vat_number", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("IT"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  shippingCompany: varchar("shipping_company", { length: 255 }),
  preferredShippingCompany: varchar("preferred_shipping_company", { length: 255 }),
  billingCompany: varchar("billing_company", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_customers_name_trgm").using("gin", sql`${table.name} gin_trgm_ops`),
]);

// ─── Orders ──────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    orderDate: timestamp("order_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    estimatedShippingDate: timestamp("estimated_shipping_date", {
      withTimezone: true,
    }),
    actualShippingDate: timestamp("actual_shipping_date", {
      withTimezone: true,
    }),
    status: orderStatusEnum("status").notNull().default("pending"),
    priority: orderPriorityEnum("priority").notNull().default("normal"),
    area: varchar("area", { length: 100 }),
    shippingCompany: varchar("shipping_company", { length: 255 }),
    notes: text("notes"),
    hasShippingDocument: boolean("has_shipping_document")
      .notNull()
      .default(false),
    isPartialFulfillment: boolean("is_partial_fulfillment")
      .notNull()
      .default(false),
    partialFulfillmentApproved: boolean("partial_fulfillment_approved")
      .notNull()
      .default(false),
    partialFulfillmentApprovedById: integer(
      "partial_fulfillment_approved_by_id"
    ).references(() => users.id),
    partialFulfillmentApprovedAt: timestamp(
      "partial_fulfillment_approved_at",
      { withTimezone: true }
    ),
    percentageShipped: real("percentage_shipped").default(0),
    createdById: integer("created_by_id").references(() => users.id),
    updatedById: integer("updated_by_id").references(() => users.id),
    lastUpdated: timestamp("last_updated", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_orders_status").on(table.status),
    index("idx_orders_customer_id").on(table.customerId),
    uniqueIndex("idx_orders_order_number").on(table.orderNumber),
  ]
);

// ─── Order Items ─────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    shippedQuantity: integer("shipped_quantity").notNull().default(0),
    shippingStatus: varchar("shipping_status", { length: 50 }),
    hasQualityIssues: boolean("has_quality_issues").notNull().default(false),
    picked: boolean("picked").notNull().default(false),
    actualQuantity: integer("actual_quantity"),
    pickedAt: timestamp("picked_at", { withTimezone: true }),
    pickedById: integer("picked_by_id").references(() => users.id),
  },
  (table) => [
    index("idx_order_items_order_id").on(table.orderId),
    index("idx_order_items_product_id").on(table.productId),
    check("chk_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "chk_shipped_quantity_non_negative",
      sql`${table.shippedQuantity} >= 0`
    ),
  ]
);

// ─── Order Changelogs ────────────────────────────────────────────────────────

export const orderChangelogs = pgTable("order_changelogs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  action: changelogActionEnum("action").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  changes: jsonb("changes"),
  previousValues: jsonb("previous_values"),
  notes: text("notes"),
});

// ─── Unshipped Items ─────────────────────────────────────────────────────────

export const unshippedItems = pgTable("unshipped_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  originalOrderNumber: varchar("original_order_number", { length: 50 }),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  shipped: boolean("shipped").notNull().default(false),
  shippedInOrderId: integer("shipped_in_order_id").references(() => orders.id),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  authorized: boolean("authorized").notNull().default(false),
  authorizedById: integer("authorized_by_id").references(() => users.id),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  notes: text("notes"),
});

// ─── Shipping Documents ──────────────────────────────────────────────────────

export const shippingDocuments = pgTable("shipping_documents", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  documentPath: text("document_path").notNull(),
  documentType: varchar("document_type", { length: 50 }),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  uploadDate: timestamp("upload_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

// ─── Order Quality ───────────────────────────────────────────────────────────

export const orderQuality = pgTable("order_quality", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  orderNumber: varchar("order_number", { length: 50 }),
  reportDate: timestamp("report_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reportedById: integer("reported_by_id").references(() => users.id),
  errorType: orderQualityTypeEnum("error_type").notNull(),
  description: text("description"),
  affectedProductIds: jsonb("affected_product_ids").$type<number[]>(),
  correctiveAction: text("corrective_action"),
  inventoryAdjusted: boolean("inventory_adjusted").notNull().default(false),
  resolved: boolean("resolved").notNull().default(false),
  resolvedById: integer("resolved_by_id").references(() => users.id),
  resolvedDate: timestamp("resolved_date", { withTimezone: true }),
  rootCause: text("root_cause"),
  preventiveMeasures: text("preventive_measures"),
});

// ─── Inventory Changes ──────────────────────────────────────────────────────

export const inventoryChanges = pgTable(
  "inventory_changes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    userId: integer("user_id").references(() => users.id),
    changeType: inventoryChangeTypeEnum("change_type").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    quantityChanged: integer("quantity_changed").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reference: varchar("reference", { length: 255 }),
    notes: text("notes"),
  },
  (table) => [
    index("idx_inventory_changes_product_id").on(table.productId),
    index("idx_inventory_changes_timestamp").on(table.timestamp),
  ]
);

// ─── Barcode Scan Logs ───────────────────────────────────────────────────────

export const barcodeScanLogs = pgTable("barcode_scan_logs", {
  id: serial("id").primaryKey(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  scanType: varchar("scan_type", { length: 50 }),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  notes: text("notes"),
  quantity: integer("quantity"),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  productTags: many(productTags),
  orderItems: many(orderItems),
  inventoryChanges: many(inventoryChanges),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, {
    fields: [productTags.tagId],
    references: [tags.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [orders.createdById],
    references: [users.id],
  }),
  items: many(orderItems),
  changelogs: many(orderChangelogs),
  shippingDocument: one(shippingDocuments, {
    fields: [orders.id],
    references: [shippingDocuments.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  pickedBy: one(users, {
    fields: [orderItems.pickedById],
    references: [users.id],
  }),
}));

export const orderChangelogsRelations = relations(
  orderChangelogs,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderChangelogs.orderId],
      references: [orders.id],
    }),
    user: one(users, {
      fields: [orderChangelogs.userId],
      references: [users.id],
    }),
  })
);

export const inventoryChangesRelations = relations(
  inventoryChanges,
  ({ one }) => ({
    product: one(products, {
      fields: [inventoryChanges.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [inventoryChanges.userId],
      references: [users.id],
    }),
  })
);

export const barcodeScanLogsRelations = relations(
  barcodeScanLogs,
  ({ one }) => ({
    user: one(users, {
      fields: [barcodeScanLogs.userId],
      references: [users.id],
    }),
    product: one(products, {
      fields: [barcodeScanLogs.productId],
      references: [products.id],
    }),
  })
);

// ─── Supplier Enums ──────────────────────────────────────────────────────────

export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
]);

export const supplierPaymentMethodEnum = pgEnum("supplier_payment_method", [
  "bank_transfer",
  "cash",
  "check",
  "other",
]);

// ─── Suppliers ───────────────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierInvoices = pgTable("supplier_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  status: supplierInvoiceStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplierPayments = pgTable("supplier_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => supplierInvoices.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: supplierPaymentMethodEnum("payment_method").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierInvoiceChangelogs = pgTable("supplier_invoice_changelogs", {
  id: serial("id").primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => supplierInvoices.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  changedById: integer("changed_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Supplier Relations ──────────────────────────────────────────────────────

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  invoices: many(supplierInvoices),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [supplierInvoices.supplierId], references: [suppliers.id] }),
  payments: many(supplierPayments),
  changelogs: many(supplierInvoiceChangelogs),
  createdBy: one(users, { fields: [supplierInvoices.createdById], references: [users.id] }),
}));

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  invoice: one(supplierInvoices, { fields: [supplierPayments.invoiceId], references: [supplierInvoices.id] }),
  createdBy: one(users, { fields: [supplierPayments.createdById], references: [users.id] }),
}));

export const supplierInvoiceChangelogsRelations = relations(supplierInvoiceChangelogs, ({ one }) => ({
  invoice: one(supplierInvoices, { fields: [supplierInvoiceChangelogs.invoiceId], references: [supplierInvoices.id] }),
  changedBy: one(users, { fields: [supplierInvoiceChangelogs.changedById], references: [users.id] }),
}));

// ─── Production Enums ────────────────────────────────────────────────────────

export const rawMaterialUnitEnum = pgEnum("raw_material_unit", [
  "kg",
  "liters",
  "pieces",
  "bottles",
  "cans",
]);

export const productionBatchStatusEnum = pgEnum("production_batch_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const materialInventoryReasonEnum = pgEnum("material_inventory_reason", [
  "received",
  "damaged",
  "correction",
  "consumed",
  "other",
]);

export const qualityCheckTypeEnum = pgEnum("quality_check_type", [
  "visual",
  "chemical",
  "taste",
  "weight",
]);

export const qualityCheckResultEnum = pgEnum("quality_check_result", [
  "pass",
  "fail",
  "warning",
]);

// ─── Production Tables ───────────────────────────────────────────────────────

export const rawMaterials = pgTable("raw_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  unit: rawMaterialUnitEnum("unit").notNull(),
  currentStock: real("current_stock").notNull().default(0),
  minStockLevel: real("min_stock_level").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productionRecipes = pgTable("production_recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  yieldQuantity: integer("yield_quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id").notNull().references(() => productionRecipes.id, { onDelete: "cascade" }),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id, { onDelete: "cascade" }),
  quantity: real("quantity").notNull(),
  unit: rawMaterialUnitEnum("unit").notNull(), // to confirm matching material
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productionBatches = pgTable("production_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id").notNull().references(() => productionRecipes.id),
  batchNumber: varchar("batch_number", { length: 100 }).notNull().unique(),
  status: productionBatchStatusEnum("status").notNull().default("planned"),
  plannedQuantity: integer("planned_quantity").notNull(),
  actualQuantity: integer("actual_quantity"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdById: integer("created_by_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const materialConsumptions = pgTable("material_consumptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => productionBatches.id, { onDelete: "cascade" }),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id),
  plannedQuantity: real("planned_quantity").notNull(),
  actualQuantity: real("actual_quantity").notNull(),
  consumedAt: timestamp("consumed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productionQualityChecks = pgTable("production_quality_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => productionBatches.id, { onDelete: "cascade" }),
  checkType: qualityCheckTypeEnum("check_type").notNull(),
  result: qualityCheckResultEnum("result").notNull(),
  value: varchar("value", { length: 100 }),
  notes: text("notes"),
  checkedById: integer("checked_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialInventoryChanges = pgTable("material_inventory_changes", {
  id: serial("id").primaryKey(),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id, { onDelete: "cascade" }),
  quantityChange: real("quantity_change").notNull(),
  newQuantity: real("new_quantity").notNull(),
  reason: materialInventoryReasonEnum("reason").notNull(),
  notes: text("notes"),
  changedById: integer("changed_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Production Relations ────────────────────────────────────────────────────

export const rawMaterialsRelations = relations(rawMaterials, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [rawMaterials.supplierId], references: [suppliers.id] }),
  ingredients: many(recipeIngredients),
  consumptions: many(materialConsumptions),
  inventoryChanges: many(materialInventoryChanges),
}));

export const productionRecipesRelations = relations(productionRecipes, ({ one, many }) => ({
  product: one(products, { fields: [productionRecipes.productId], references: [products.id] }),
  ingredients: many(recipeIngredients),
  batches: many(productionBatches),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(productionRecipes, { fields: [recipeIngredients.recipeId], references: [productionRecipes.id] }),
  rawMaterial: one(rawMaterials, { fields: [recipeIngredients.rawMaterialId], references: [rawMaterials.id] }),
}));

export const productionBatchesRelations = relations(productionBatches, ({ one, many }) => ({
  recipe: one(productionRecipes, { fields: [productionBatches.recipeId], references: [productionRecipes.id] }),
  createdBy: one(users, { fields: [productionBatches.createdById], references: [users.id] }),
  consumptions: many(materialConsumptions),
  qualityChecks: many(productionQualityChecks),
}));

export const materialConsumptionsRelations = relations(materialConsumptions, ({ one }) => ({
  batch: one(productionBatches, { fields: [materialConsumptions.batchId], references: [productionBatches.id] }),
  rawMaterial: one(rawMaterials, { fields: [materialConsumptions.rawMaterialId], references: [rawMaterials.id] }),
}));

export const productionQualityChecksRelations = relations(productionQualityChecks, ({ one }) => ({
  batch: one(productionBatches, { fields: [productionQualityChecks.batchId], references: [productionBatches.id] }),
  checkedBy: one(users, { fields: [productionQualityChecks.checkedById], references: [users.id] }),
}));

export const materialInventoryChangesRelations = relations(materialInventoryChanges, ({ one }) => ({
  rawMaterial: one(rawMaterials, { fields: [materialInventoryChanges.rawMaterialId], references: [rawMaterials.id] }),
  changedBy: one(users, { fields: [materialInventoryChanges.changedById], references: [users.id] }),
}));

// ─── Inventory Predictions ───────────────────────────────────────────────────

export const inventoryPredictions = pgTable("inventory_predictions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  predictedDailyDemand: real("predicted_daily_demand").notNull(),
  daysUntilStockout: integer("days_until_stockout").notNull(),
  suggestedReorderQuantity: integer("suggested_reorder_quantity").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasonalPatterns = pgTable("seasonal_patterns", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  avgDailyDemand: real("avg_daily_demand").notNull(),
  demandMultiplier: real("demand_multiplier").notNull(),
  sampleSize: integer("sample_size").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryPredictionsRelations = relations(inventoryPredictions, ({ one }) => ({
  product: one(products, { fields: [inventoryPredictions.productId], references: [products.id] }),
}));

export const seasonalPatternsRelations = relations(seasonalPatterns, ({ one }) => ({
  product: one(products, { fields: [seasonalPatterns.productId], references: [products.id] }),
}));

// ─── Calendar Events ─────────────────────────────────────────────────────────

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "custom",
  "shipping",
  "production",
  "follow_up",
  "invoice_due",
]);

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  eventType: calendarEventTypeEnum("event_type").notNull().default("custom"),
  referenceId: varchar("reference_id", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  color: varchar("color", { length: 20 }),
  allDay: boolean("all_day").notNull().default(false),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  createdBy: one(users, { fields: [calendarEvents.createdById], references: [users.id] }),
}));

// ─── In-App Notifications ───────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("info"),
  referenceId: varchar("reference_id", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// ─── Settings & Configuration ───────────────────────────────────────────────

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 50 }),
  country: varchar("country", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logo_url"),
  website: text("website"),
  defaultCurrency: varchar("default_currency", { length: 10 }).default("EUR").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("Europe/Athens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: text("smtp_pass"),
  fromName: varchar("from_name", { length: 255 }),
  fromEmail: varchar("from_email", { length: 255 }),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  slackWebhookUrl: text("slack_webhook_url"),
  slackEnabled: boolean("slack_enabled").default(false).notNull(),
  emailEnabled: boolean("email_enabled").default(false).notNull(),
  notifyNewOrder: boolean("notify_new_order").default(true).notNull(),
  notifyShipped: boolean("notify_shipped").default(true).notNull(),
  notifyLowStock: boolean("notify_low_stock").default(true).notNull(),
  dailySummaryEnabled: boolean("daily_summary_enabled").default(true).notNull(),
  dailySummaryTime: varchar("daily_summary_time", { length: 10 }).default("18:00").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: userRoleEnum("role").notNull(),
  permission: varchar("permission", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_role_permission").on(table.role, table.permission),
]);
