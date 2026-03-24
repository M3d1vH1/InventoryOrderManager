// src/shared/types.ts
import type {
  users,
  sessions,
  categories,
  tags,
  products,
  productTags,
  customers,
  orders,
  orderItems,
  orderChangelogs,
  unshippedItems,
  shippingDocuments,
  orderQuality,
  inventoryChanges,
  barcodeScanLogs,
} from "../server/db/schema.js";

// ─── Select types (read from DB) ────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductTag = typeof productTags.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderChangelog = typeof orderChangelogs.$inferSelect;
export type UnshippedItem = typeof unshippedItems.$inferSelect;
export type ShippingDocument = typeof shippingDocuments.$inferSelect;
export type OrderQualityReport = typeof orderQuality.$inferSelect;
export type InventoryChange = typeof inventoryChanges.$inferSelect;
export type BarcodeScanLog = typeof barcodeScanLogs.$inferSelect;

// ─── Insert types (write to DB) ─────────────────────────────────────────────

export type NewUser = typeof users.$inferInsert;
export type NewSession = typeof sessions.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;
export type NewTag = typeof tags.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type NewProductTag = typeof productTags.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewOrder = typeof orders.$inferInsert;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type NewOrderChangelog = typeof orderChangelogs.$inferInsert;
export type NewUnshippedItem = typeof unshippedItems.$inferInsert;
export type NewShippingDocument = typeof shippingDocuments.$inferInsert;
export type NewOrderQualityReport = typeof orderQuality.$inferInsert;
export type NewInventoryChange = typeof inventoryChanges.$inferInsert;
export type NewBarcodeScanLog = typeof barcodeScanLogs.$inferInsert;

// ─── Enum value types ────────────────────────────────────────────────────────

export type UserRole = User["role"];
export type OrderStatus = Order["status"];
export type OrderPriority = Order["priority"];
export type ShippingCompany = NonNullable<Customer["shippingCompany"]>;
export type ChangelogAction = OrderChangelog["action"];
export type OrderQualityType = OrderQualityReport["errorType"];
export type InventoryChangeType = InventoryChange["changeType"];

// ─── Utility types ──────────────────────────────────────────────────────────

/** User without password hash — safe to send to the client */
export type SafeUser = Omit<User, "password">;
