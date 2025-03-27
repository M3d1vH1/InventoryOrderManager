-- Create type enums if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_type') THEN
        CREATE TYPE call_type AS ENUM ('incoming', 'outgoing', 'missed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_purpose') THEN
        CREATE TYPE call_purpose AS ENUM ('sales', 'support', 'followup', 'complaint', 'inquiry', 'other');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_priority') THEN
        CREATE TYPE call_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE call_status AS ENUM ('scheduled', 'completed', 'no_answer', 'needs_followup', 'cancelled');
    END IF;
END
$$;

-- Create call_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS "call_logs" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" INTEGER,
  "contact_name" TEXT NOT NULL,
  "company_name" TEXT,
  "call_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "call_time" TEXT,
  "duration" INTEGER,
  "call_type" call_type NOT NULL DEFAULT 'outgoing',
  "call_purpose" call_purpose NOT NULL DEFAULT 'other',
  "call_status" call_status NOT NULL DEFAULT 'completed',
  "priority" call_priority DEFAULT 'normal',
  "notes" TEXT,
  "user_id" INTEGER NOT NULL,
  "followup_date" TIMESTAMP,
  "followup_time" TEXT,
  "followup_assigned_to" INTEGER,
  "reminder_sent" BOOLEAN DEFAULT FALSE,
  "is_followup" BOOLEAN DEFAULT FALSE,
  "previous_call_id" INTEGER,
  "tags" TEXT[],
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create call_outcomes table if it doesn't exist
CREATE TABLE IF NOT EXISTS "call_outcomes" (
  "id" SERIAL PRIMARY KEY,
  "call_id" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "due_date" TIMESTAMP,
  "assigned_to_id" INTEGER,
  "completed_by_id" INTEGER,
  "completed_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_call_outcomes_call_id FOREIGN KEY ("call_id") REFERENCES "call_logs"("id") ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_id ON "call_logs" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON "call_logs" ("user_id");
CREATE INDEX IF NOT EXISTS idx_call_logs_call_date ON "call_logs" ("call_date");
CREATE INDEX IF NOT EXISTS idx_call_logs_followup_date ON "call_logs" ("followup_date");
CREATE INDEX IF NOT EXISTS idx_call_outcomes_call_id ON "call_outcomes" ("call_id");
CREATE INDEX IF NOT EXISTS idx_call_outcomes_assigned_to_id ON "call_outcomes" ("assigned_to_id");