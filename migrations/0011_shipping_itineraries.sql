-- Create shipping itineraries table
CREATE TABLE IF NOT EXISTS shipping_itineraries (
  id SERIAL PRIMARY KEY,
  itinerary_number TEXT NOT NULL UNIQUE,
  departure_date TIMESTAMP NOT NULL,
  shipping_company TEXT,
  driver_name TEXT,
  vehicle_info TEXT,
  notes TEXT,
  created_by_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
);

-- Create itinerary-order relationship table
CREATE TABLE IF NOT EXISTS itinerary_orders (
  id SERIAL PRIMARY KEY,
  itinerary_id INTEGER NOT NULL REFERENCES shipping_itineraries(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  added_by_id INTEGER NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(itinerary_id, order_id)
);

-- Create index for faster lookups
CREATE INDEX idx_itinerary_orders_itinerary_id ON itinerary_orders(itinerary_id);
CREATE INDEX idx_itinerary_orders_order_id ON itinerary_orders(order_id);