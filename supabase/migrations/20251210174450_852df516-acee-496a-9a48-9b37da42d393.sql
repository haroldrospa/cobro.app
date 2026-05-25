-- Actualizar las secuencias para que reflejen el número más alto usado
UPDATE invoice_sequences 
SET current_number = 12, updated_at = now()
WHERE invoice_type_id = 'B01';

UPDATE invoice_sequences 
SET current_number = 43, updated_at = now()
WHERE invoice_type_id = 'B02';