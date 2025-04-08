-- Create enums
CREATE TYPE "material_type" AS ENUM ('liquid', 'packaging', 'label', 'cap', 'box', 'other');
CREATE TYPE "material_unit" AS ENUM ('liter', 'kg', 'piece');
CREATE TYPE "production_status" AS ENUM ('planned', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected');
CREATE TYPE "production_order_status" AS ENUM ('planned', 'material_check', 'in_progress', 'completed', 'partially_completed', 'cancelled');
CREATE TYPE "production_event_type" AS ENUM ('start', 'pause', 'resume', 'material_added', 'completed', 'quality_check', 'issue');

-- Create raw materials table
CREATE TABLE IF NOT EXISTS "raw_materials" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "material_type" NOT NULL,
  "sku" TEXT NOT NULL UNIQUE,
  "current_stock" NUMERIC NOT NULL DEFAULT 0,
  "min_stock_level" NUMERIC NOT NULL DEFAULT 10,
  "unit" "material_unit" NOT NULL,
  "unit_cost" NUMERIC,
  "description" TEXT,
  "location" TEXT,
  "supplier_id" INTEGER,
  "last_stock_update" TIMESTAMP DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create production batches table
CREATE TABLE IF NOT EXISTS "production_batches" (
  "id" SERIAL PRIMARY KEY,
  "batch_number" TEXT NOT NULL UNIQUE,
  "start_date" TIMESTAMP NOT NULL,
  "end_date" TIMESTAMP,
  "status" "production_status" NOT NULL DEFAULT 'planned',
  "quantity" NUMERIC NOT NULL,
  "unit" "material_unit" NOT NULL DEFAULT 'liter',
  "notes" TEXT,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create production recipes table
CREATE TABLE IF NOT EXISTS "production_recipes" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create recipe ingredients table
CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
  "id" SERIAL PRIMARY KEY,
  "recipe_id" INTEGER NOT NULL REFERENCES "production_recipes"("id"),
  "material_id" INTEGER NOT NULL REFERENCES "raw_materials"("id"),
  "quantity" NUMERIC NOT NULL,
  "unit" "material_unit" NOT NULL,
  "notes" TEXT
);

-- Create production orders table
CREATE TABLE IF NOT EXISTS "production_orders" (
  "id" SERIAL PRIMARY KEY,
  "order_number" TEXT NOT NULL UNIQUE,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "recipe_id" INTEGER NOT NULL REFERENCES "production_recipes"("id"),
  "planned_quantity" INTEGER NOT NULL,
  "actual_quantity" INTEGER,
  "status" "production_order_status" NOT NULL DEFAULT 'planned',
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "batch_id" INTEGER REFERENCES "production_batches"("id"),
  "notes" TEXT,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create material consumption records table
CREATE TABLE IF NOT EXISTS "material_consumptions" (
  "id" SERIAL PRIMARY KEY,
  "production_order_id" INTEGER NOT NULL REFERENCES "production_orders"("id"),
  "material_id" INTEGER NOT NULL REFERENCES "raw_materials"("id"),
  "quantity" NUMERIC NOT NULL,
  "consumed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "notes" TEXT,
  "created_by_id" INTEGER REFERENCES "users"("id")
);

-- Create production logs table
CREATE TABLE IF NOT EXISTS "production_logs" (
  "id" SERIAL PRIMARY KEY,
  "production_order_id" INTEGER NOT NULL REFERENCES "production_orders"("id"),
  "event_type" "production_event_type" NOT NULL,
  "description" TEXT NOT NULL,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create material inventory changes table
CREATE TABLE IF NOT EXISTS "material_inventory_changes" (
  "id" SERIAL PRIMARY KEY,
  "material_id" INTEGER NOT NULL REFERENCES "raw_materials"("id"),
  "change_type" "inventory_change_type" NOT NULL,
  "previous_quantity" NUMERIC NOT NULL,
  "new_quantity" NUMERIC NOT NULL,
  "change_amount" NUMERIC NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_raw_materials_type" ON "raw_materials"("type");
CREATE INDEX IF NOT EXISTS "idx_production_batches_status" ON "production_batches"("status");
CREATE INDEX IF NOT EXISTS "idx_production_orders_status" ON "production_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_production_orders_product_id" ON "production_orders"("product_id");
CREATE INDEX IF NOT EXISTS "idx_recipe_ingredients_recipe_id" ON "recipe_ingredients"("recipe_id");
CREATE INDEX IF NOT EXISTS "idx_recipe_ingredients_material_id" ON "recipe_ingredients"("material_id");
CREATE INDEX IF NOT EXISTS "idx_material_consumptions_production_order_id" ON "material_consumptions"("production_order_id");
CREATE INDEX IF NOT EXISTS "idx_material_consumptions_material_id" ON "material_consumptions"("material_id");
CREATE INDEX IF NOT EXISTS "idx_production_logs_production_order_id" ON "production_logs"("production_order_id");
CREATE INDEX IF NOT EXISTS "idx_material_inventory_changes_material_id" ON "material_inventory_changes"("material_id");