-- Update the order_status enum to add 'partially_shipped'
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_shipped';

-- Add shipped_quantity column to order_items to track partial shipments
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipped_quantity INTEGER DEFAULT 0;

-- Add shipping_status column to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'pending';

-- Add percentage_shipped column to orders for display in UI
ALTER TABLE orders ADD COLUMN IF NOT EXISTS percentage_shipped NUMERIC DEFAULT 0;