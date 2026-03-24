# Milestone 07 — Critical Bug Fixes

**Priority:** P1
**Depends on:** Milestone 06 (reserved_stock column must exist)
**Blocks:** Nothing (these are fixes, not features)

---

## Three Critical Bugs to Fix

1. **Stock not reducing when orders are picked** — The most impactful bug
2. **SKU updates not persisting** — Silent data loss
3. **Product images not persisting** — Broken image upload pipeline

---

## Bug Fix 1: Stock Picking (Atomic Transaction with SELECT FOR UPDATE)

### Root Cause

In `server/routes.ts` (lines ~1514-1593), when an order is marked as `picked`, the code:
1. Calls `storage.updateOrderItem()` to mark items as picked
2. Then calls `storage.updateProduct()` separately to reduce stock
3. These are NOT wrapped in a transaction
4. No locking — concurrent picks can oversell stock

### Fix: Create `server/services/orderPickingService.ts`

```typescript
// server/services/orderPickingService.ts
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import {
  orders,
  orderItems,
  products,
  inventoryChanges,
  unshippedItems,
} from '@shared/schema';

export interface PickItemInput {
  orderItemId: number;
  productId: number;
  requestedQuantity: number;
  actualQuantity: number;  // May be less if partial stock
}

export interface PickOrderResult {
  success: boolean;
  orderId: number;
  stockChanges: {
    productId: number;
    productName: string;
    previousStock: number;
    newStock: number;
    quantityDeducted: number;
  }[];
  unshippedItemsCreated: {
    productId: number;
    quantity: number;
  }[];
}

/**
 * Pick an order atomically.
 *
 * Uses SELECT FOR UPDATE to lock product rows before deducting stock.
 * This prevents race conditions when multiple users pick simultaneously.
 *
 * Flow:
 * 1. Lock all product rows for this order (SELECT FOR UPDATE)
 * 2. Validate sufficient stock for each item
 * 3. Deduct current_stock AND reserved_stock for picked quantity
 * 4. Only release reserved_stock for unshipped quantity
 * 5. Create unshipped_items for any shortfall
 * 6. Update order_items with picked quantities
 * 7. Log inventory_changes for audit trail
 * 8. Update order status to 'picked' or 'partially_shipped'
 * All in one transaction — either all succeeds or all rolls back.
 */
export async function pickOrder(
  orderId: number,
  items: PickItemInput[],
  userId: number
): Promise<PickOrderResult> {
  return await db.transaction(async (tx) => {
    // Step 1: Get and validate the order
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'pending') {
      throw new Error(`Order ${orderId} is not in pending status (current: ${order.status})`);
    }

    const stockChanges: PickOrderResult['stockChanges'] = [];
    const unshippedItemsCreated: PickOrderResult['unshippedItemsCreated'] = [];

    // Step 2: Lock all product rows for this pick (prevent concurrent oversell)
    const productIds = [...new Set(items.map(i => i.productId))];

    for (const productId of productIds) {
      // SELECT FOR UPDATE locks the row until this transaction commits
      const [lockedProduct] = await tx.execute<{
        id: number;
        name: string;
        current_stock: number;
        reserved_stock: number;
      }>(sql`
        SELECT id, name, current_stock, reserved_stock
        FROM products
        WHERE id = ${productId}
        FOR UPDATE
      `);

      if (!lockedProduct) {
        throw new Error(`Product ${productId} not found`);
      }

      // Get items for this product
      const productItems = items.filter(i => i.productId === productId);

      for (const item of productItems) {
        const pickedQty = item.actualQuantity;
        const reservedQty = item.requestedQuantity;
        const unshippedQty = reservedQty - pickedQty;

        // Validate: we need at least pickedQty in stock
        if (lockedProduct.current_stock < pickedQty) {
          throw new Error(
            `Insufficient stock for product "${lockedProduct.name}". ` +
            `Requested: ${pickedQty}, Available: ${lockedProduct.current_stock}`
          );
        }

        // Step 3: Deduct stock
        // current_stock: deduct the actually picked quantity
        // reserved_stock: release the entire reservation (picked + unshipped)
        await tx.execute(sql`
          UPDATE products
          SET
            current_stock = current_stock - ${pickedQty},
            reserved_stock = GREATEST(0, reserved_stock - ${reservedQty}),
            last_stock_update = NOW()
          WHERE id = ${productId}
        `);

        // Step 4: Update order item
        await tx
          .update(orderItems)
          .set({
            picked: true,
            actualQuantity: pickedQty,
            pickedAt: new Date(),
            pickedById: userId,
          })
          .where(eq(orderItems.id, item.orderItemId));

        // Step 5: Create unshipped item for shortfall
        if (unshippedQty > 0) {
          await tx.insert(unshippedItems).values({
            orderId: orderId,
            productId: productId,
            quantity: unshippedQty,
            customerName: order.customerName,
            customerId: String(orderId),
            originalOrderNumber: order.orderNumber,
            notes: `Partial fulfillment: ${pickedQty} of ${reservedQty} picked`,
          });

          unshippedItemsCreated.push({ productId, quantity: unshippedQty });
        }

        // Step 6: Log inventory change
        await tx.insert(inventoryChanges).values({
          productId: productId,
          userId: userId,
          changeType: 'order_fulfillment',
          previousQuantity: lockedProduct.current_stock,
          newQuantity: lockedProduct.current_stock - pickedQty,
          quantityChanged: -pickedQty,
          reference: order.orderNumber,
          notes: `Order picking: ${pickedQty} units picked for ${order.orderNumber}`,
        });

        stockChanges.push({
          productId: productId,
          productName: lockedProduct.name,
          previousStock: lockedProduct.current_stock,
          newStock: lockedProduct.current_stock - pickedQty,
          quantityDeducted: pickedQty,
        });

        // Update our in-memory copy for subsequent items of same product
        lockedProduct.current_stock -= pickedQty;
        lockedProduct.reserved_stock = Math.max(
          0,
          lockedProduct.reserved_stock - reservedQty
        );
      }
    }

    // Step 7: Update order status
    const hasPartial = unshippedItemsCreated.length > 0;
    await tx
      .update(orders)
      .set({
        status: hasPartial ? 'partially_shipped' : 'picked',
        isPartialFulfillment: hasPartial,
        updatedById: userId,
        lastUpdated: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      success: true,
      orderId,
      stockChanges,
      unshippedItemsCreated,
    };
  });
}

/**
 * Reserve stock when an order is created.
 * Increments reserved_stock for each product.
 * Does NOT deduct current_stock.
 */
export async function reserveStockForOrder(
  orderId: number,
  items: { productId: number; quantity: number }[],
  tx?: any
): Promise<void> {
  const executor = tx || db;

  for (const item of items) {
    // Check available stock (current - reserved)
    const [product] = await executor.execute<{
      id: number;
      name: string;
      current_stock: number;
      reserved_stock: number;
    }>(sql`
      SELECT id, name, current_stock, reserved_stock
      FROM products
      WHERE id = ${item.productId}
      FOR UPDATE
    `);

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const available = product.current_stock - product.reserved_stock;

    // Reserve whatever is available (may be less than requested)
    const toReserve = Math.min(item.quantity, available);

    if (toReserve > 0) {
      await executor.execute(sql`
        UPDATE products
        SET reserved_stock = reserved_stock + ${toReserve}
        WHERE id = ${item.productId}
      `);
    }
  }
}

/**
 * Release reserved stock when an order is cancelled.
 */
export async function releaseReservation(
  orderId: number,
  userId: number
): Promise<void> {
  await db.transaction(async (tx) => {
    // Get all order items for this order
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      if (!item.picked) {
        // Release the reservation for unpicked items
        await tx.execute(sql`
          UPDATE products
          SET reserved_stock = GREATEST(0, reserved_stock - ${item.quantity})
          WHERE id = ${item.productId}
        `);

        // Log the cancellation
        await tx.insert(inventoryChanges).values({
          productId: item.productId,
          userId: userId,
          changeType: 'order_cancellation',
          previousQuantity: 0, // Will be filled by trigger or app
          newQuantity: 0,
          quantityChanged: item.quantity,
          reference: `Order cancellation`,
          notes: `Reserved stock released for cancelled order`,
        });
      } else {
        // Item was already picked — restore physical stock
        await tx.execute(sql`
          UPDATE products
          SET
            current_stock = current_stock + ${item.actualQuantity || item.quantity},
            last_stock_update = NOW()
          WHERE id = ${item.productId}
        `);

        await tx.insert(inventoryChanges).values({
          productId: item.productId,
          userId: userId,
          changeType: 'order_cancellation',
          previousQuantity: 0,
          newQuantity: 0,
          quantityChanged: item.actualQuantity || item.quantity,
          reference: `Order cancellation`,
          notes: `Stock restored for picked item in cancelled order`,
        });
      }
    }

    // Update order status to cancelled
    await tx
      .update(orders)
      .set({
        status: 'cancelled',
        updatedById: userId,
        lastUpdated: new Date(),
      })
      .where(eq(orders.id, orderId));
  });
}
```

### Wire it into routes.ts

In `server/routes.ts`, replace the picking logic in the `PATCH /api/orders/:id/status` handler:

```typescript
// Replace the existing picking block with:
import { pickOrder } from '../services/orderPickingService';

if (status === 'picked' && itemQuantities && Array.isArray(itemQuantities)) {
  const pickItems = itemQuantities.map(item => ({
    orderItemId: item.orderItemId,
    productId: item.productId,
    requestedQuantity: item.requestedQuantity,
    actualQuantity: item.actualQuantity ?? item.requestedQuantity,
  }));

  const result = await pickOrder(id, pickItems, userId);

  return res.json({
    success: true,
    order: await storage.getOrder(id),
    stockChanges: result.stockChanges,
    unshippedItems: result.unshippedItemsCreated,
  });
}
```

---

## Bug Fix 2: SKU Updates Not Persisting

### Root Cause

In `server/api/products.ts`, the `updateProduct` schema uses `z.preprocess`:

```typescript
sku: z.preprocess(
  (val) => val === null || val === undefined || val === '' ? undefined : val,
  z.string()
    .transform(val => val ? val.toUpperCase() : undefined)  // BUG: can return undefined
    .optional()
),
```

The `transform` can produce `undefined` if `val` is falsy. Also, if the form sends the current SKU value but somehow it's treated as an empty string during re-renders, the entire SKU update silently drops.

### Fix

Replace the SKU validator in `updateProduct` schema:

```typescript
// server/api/products.ts — updateProduct schema
// BEFORE (broken):
sku: z.preprocess(
  (val) => val === null || val === undefined || val === '' ? undefined : val,
  z.string()
    .min(3)
    .max(50)
    .regex(/^[A-Z0-9\-_.]+$/i)
    .trim()
    .transform(val => val ? val.toUpperCase() : undefined)
    .optional()
),

// AFTER (fixed):
// If sku is provided in the request body, it must be a valid non-empty string.
// If sku is NOT in the request body (undefined), skip the field entirely.
sku: z.string()
  .min(3, 'SKU must be at least 3 characters')
  .max(50, 'SKU must not exceed 50 characters')
  .regex(/^[A-Z0-9\-_.]+$/i, 'SKU can only contain letters, numbers, hyphens, underscores, and periods')
  .trim()
  .transform(val => val.toUpperCase())
  .optional(),
// Note: No z.preprocess. If frontend sends sku: "NEW-SKU", it validates.
// If frontend omits sku entirely, this field is undefined and skipped in the update.
```

### Also Fix Frontend Form

In the product edit form component (likely `client/src/components/products/ProductEditForm.tsx` or similar):

```typescript
// When loading the form with existing product data, always pass the current SKU:
const form = useForm({
  defaultValues: async () => {
    const product = await fetchProduct(productId);
    return {
      sku: product.sku,        // ALWAYS populate with current value
      name: product.name,
      categoryId: product.categoryId,
      // ... etc
    };
  },
});

// When submitting, only include fields that were actually changed:
const onSubmit = (data: FormData) => {
  // If SKU wasn't changed, don't include it in the PATCH body
  // OR always include it since we have the current value
  updateProduct({ id: productId, ...data });
};
```

---

## Bug Fix 3: Product Images Not Persisting

### Root Cause

1. Images are saved to `PRODUCTS_UPLOAD_PATH` but also need to be accessible at `/uploads/products/filename`
2. The symlink approach fails on Docker (different filesystem semantics)
3. The DB is updated with the path before file save is confirmed

### Fix: Unified Storage Service

Create `server/services/storageService.ts`:

```typescript
// server/services/storageService.ts
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config';

// Single source of truth for where files live
const STORAGE_BASE = config.app.storagePath;
const PRODUCTS_IMAGE_DIR = path.join(STORAGE_BASE, 'uploads', 'products');

// Ensure directory exists at startup
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

ensureDir(PRODUCTS_IMAGE_DIR);

export async function saveProductImage(
  productId: number,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: jpeg, png, webp, gif`);
  }

  // Generate unique filename
  const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
  const filename = `${productId}_${Date.now()}${ext}`;
  const filePath = path.join(PRODUCTS_IMAGE_DIR, filename);

  // Write file FIRST
  await fs.writeFile(filePath, fileBuffer);

  // Verify the file was written correctly
  const stats = await fs.stat(filePath);
  if (stats.size === 0) {
    await fs.unlink(filePath).catch(() => {}); // cleanup
    throw new Error('File write failed — empty file');
  }

  // Return the URL path (served by Express static or API route)
  // This is stored in the DB
  return `/api/files/products/${filename}`;
}

export async function deleteProductImage(imagePath: string): Promise<void> {
  if (!imagePath) return;

  try {
    // Extract filename from the URL path
    const filename = path.basename(imagePath);
    const filePath = path.join(PRODUCTS_IMAGE_DIR, filename);

    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (err) {
    console.error('Failed to delete image file:', err);
    // Don't throw — deletion failures shouldn't break the update
  }
}

export function getProductImagePath(filename: string): string {
  return path.join(PRODUCTS_IMAGE_DIR, filename);
}
```

### Add Image Serving Route to `server/index.ts`

```typescript
// Serve uploaded files via API route (NOT via public/ directory)
// This avoids the symlink problem entirely
import path from 'path';
import { config } from './config';

app.get('/api/files/products/:filename', (req, res) => {
  const { filename } = req.params;

  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(config.app.storagePath, 'uploads', 'products', filename);

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
});
```

### Update `server/api/products.ts` Image Upload

Replace the dual-path image save with the new storage service:

```typescript
// In createProduct and updateProduct handlers:
import { saveProductImage, deleteProductImage } from '../services/storageService';

// When handling image upload:
if (req.files && req.files.image) {
  const imageFile = req.files.image as UploadedFile;

  // Save file first — get back URL path
  const imagePath = await saveProductImage(
    productId,
    imageFile.data,           // Buffer
    imageFile.name,           // Original filename
    imageFile.mimetype        // MIME type for validation
  );

  // Delete old image if updating
  if (existingProduct?.imagePath) {
    await deleteProductImage(existingProduct.imagePath);
  }

  // NOW update the DB with the confirmed path
  updateData.imagePath = imagePath;
}
```

---

## Verification Checklist

### Stock Picking Fix
```bash
# Create test: order 5 units of a product with 10 in stock
# After picking: product.current_stock should be 5

curl -X PATCH /api/orders/123/status \
  -d '{"status":"picked","itemQuantities":[{"orderItemId":1,"productId":1,"requestedQuantity":5,"actualQuantity":5}]}'

# Check stock was deducted:
curl /api/products/1
# Expected: currentStock reduced by 5
# Expected: inventory_changes has a new 'order_fulfillment' record
```

### SKU Fix
```bash
# Update a product's SKU:
curl -X PATCH /api/products/1 \
  -d '{"sku":"NEW-SKU-123"}'

# Fetch the product:
curl /api/products/1
# Expected: sku === "NEW-SKU-123"

# Try updating with same data but OMIT sku:
curl -X PATCH /api/products/1 \
  -d '{"name":"New Name"}'

# Expected: sku remains "NEW-SKU-123" (not cleared)
```

### Image Upload Fix
```bash
# Upload image:
curl -X POST /api/products/1/image \
  -F "image=@test.jpg"
# Expected: {"imagePath":"/api/files/products/1_12345.jpg"}

# Fetch the image:
curl /api/files/products/1_12345.jpg
# Expected: JPEG binary data (not 404)

# Check database:
curl /api/products/1
# Expected: imagePath is "/api/files/products/1_12345.jpg"
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
└── server/
    ├── services/
    │   ├── orderPickingService.ts   ← NEW: Atomic picking with transactions
    │   └── storageService.ts        ← NEW: Unified file storage
    ├── api/
    │   └── products.ts              ← MODIFIED: Fix SKU schema + use storageService
    ├── routes.ts                    ← MODIFIED: Wire orderPickingService
    └── index.ts                     ← MODIFIED: Add /api/files/products/:filename route
```

---

## Next Milestone

→ [MILESTONE_08_ROUTES_SPLIT.md](./MILESTONE_08_ROUTES_SPLIT.md) — Split monolithic routes.ts
