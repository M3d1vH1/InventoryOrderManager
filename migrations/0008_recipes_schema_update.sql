-- Add new columns to production_recipes table
ALTER TABLE production_recipes
ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT 'SKU_DEFAULT',
ADD COLUMN IF NOT EXISTS yield NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS yield_unit TEXT NOT NULL DEFAULT 'liter',
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Update existing recipes to use default status and yield
UPDATE production_recipes
SET status = 'active', yield = 1, yield_unit = 'liter'
WHERE status IS NULL;