-- Corregir B01: si el próximo número debe ser 12, current_number debe ser 11
UPDATE invoice_sequences
SET current_number = 11, updated_at = now()
WHERE invoice_type_id = 'B01';

-- Corregir B02: si el próximo número debe ser 12, current_number debe ser 11  
UPDATE invoice_sequences
SET current_number = 11, updated_at = now()
WHERE invoice_type_id = 'B02';