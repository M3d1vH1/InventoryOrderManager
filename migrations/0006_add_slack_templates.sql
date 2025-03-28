-- Add slack template columns to notification_settings table
ALTER TABLE notification_settings 
ADD COLUMN slack_order_template TEXT DEFAULT '',
ADD COLUMN slack_call_log_template TEXT DEFAULT '',
ADD COLUMN slack_low_stock_template TEXT DEFAULT '';

-- Update any existing rows to have default templates
UPDATE notification_settings 
SET 
  slack_order_template = 'New order #{orderNumber} from {customer} for ${total}',
  slack_call_log_template = 'New call with {customer} regarding {callPurpose}',
  slack_low_stock_template = 'Low stock alert: {productName} is down to {quantity} units'
WHERE id IS NOT NULL;