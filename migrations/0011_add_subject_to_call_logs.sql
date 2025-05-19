-- Add subject column to call_logs table
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "subject" TEXT;

-- Update existing records to have a subject based on call_purpose if empty
UPDATE "call_logs" SET "subject" = call_purpose WHERE "subject" IS NULL;