-- Add has_quality_issues column to order_items if it doesn't exist
ALTER TABLE IF EXISTS "order_items" 
ADD COLUMN IF NOT EXISTS "has_quality_issues" BOOLEAN DEFAULT FALSE;