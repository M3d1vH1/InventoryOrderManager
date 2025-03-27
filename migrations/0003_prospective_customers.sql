-- Create prospective_customers table
CREATE TABLE IF NOT EXISTS prospective_customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  source TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to_id INTEGER,
  last_contact_date TIMESTAMP DEFAULT NOW(),
  next_contact_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create foreign key constraint for assigned_to_id to users table
ALTER TABLE prospective_customers 
  ADD CONSTRAINT fk_prospective_customers_assigned_to 
  FOREIGN KEY (assigned_to_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Create index on name for faster searches
CREATE INDEX idx_prospective_customers_name ON prospective_customers(name);

-- Create index on status for filtering
CREATE INDEX idx_prospective_customers_status ON prospective_customers(status);

-- Create index on company_name for searches
CREATE INDEX idx_prospective_customers_company ON prospective_customers(company_name);