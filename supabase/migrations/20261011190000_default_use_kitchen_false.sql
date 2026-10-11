-- Set default of use_kitchen to false in store_settings table
ALTER TABLE store_settings 
ALTER COLUMN use_kitchen SET DEFAULT false;
