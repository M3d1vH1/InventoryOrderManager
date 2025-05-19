-- Create shipping itineraries table for tracking grouped orders
CREATE TABLE IF NOT EXISTS shipping_itineraries (
  id SERIAL PRIMARY KEY,
  itinerary_number TEXT NOT NULL UNIQUE,
  departure_date TIMESTAMP NOT NULL,
  shipping_company TEXT,
  driver_name TEXT,
  vehicle_info TEXT,
  total_boxes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
);

-- Create itinerary-order relationship table (for many-to-many relationship)
CREATE TABLE IF NOT EXISTS itinerary_orders (
  id SERIAL PRIMARY KEY,
  itinerary_id INTEGER NOT NULL REFERENCES shipping_itineraries(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  box_count INTEGER NOT NULL DEFAULT 1,
  added_by_id INTEGER NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(itinerary_id, order_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_itinerary_orders_itinerary_id ON itinerary_orders(itinerary_id);
CREATE INDEX idx_itinerary_orders_order_id ON itinerary_orders(order_id);

-- Create status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itinerary_status') THEN
        CREATE TYPE itinerary_status AS ENUM ('active', 'completed', 'cancelled');
    END IF;
END$$;

-- Updating existing orders table to add a reference to itinerary (optional)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS itinerary_id INTEGER REFERENCES shipping_itineraries(id) ON DELETE SET NULL;