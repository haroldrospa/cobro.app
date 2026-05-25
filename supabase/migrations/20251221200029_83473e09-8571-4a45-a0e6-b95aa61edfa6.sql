-- Update products without store_id to assign them to the store: rico-to-000003
UPDATE products 
SET store_id = '15a17d93-04f0-48ad-a20b-6e27e0123484' 
WHERE store_id IS NULL;