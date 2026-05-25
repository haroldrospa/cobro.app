-- Add business_hours JSONB column to store_settings table
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": { "open": "09:00", "close": "18:00", "closed": false },
  "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
  "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
  "thursday": { "open": "09:00", "close": "18:00", "closed": false },
  "friday": { "open": "09:00", "close": "18:00", "closed": false },
  "saturday": { "open": "09:00", "close": "13:00", "closed": false },
  "sunday": { "closed": true, "open": null, "close": null }
}'::jsonb;

-- Comment on column
COMMENT ON COLUMN store_settings.business_hours IS 'JSON object storing opening and closing hours for each day of the week';