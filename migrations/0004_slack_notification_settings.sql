-- Add Slack notification fields to notification_settings table
ALTER TABLE "notification_settings" 
  ADD COLUMN "slack_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "slack_webhook_url" text,
  ADD COLUMN "slack_notify_new_orders" boolean NOT NULL DEFAULT true,
  ADD COLUMN "slack_notify_call_logs" boolean NOT NULL DEFAULT true,
  ADD COLUMN "slack_notify_low_stock" boolean NOT NULL DEFAULT false;