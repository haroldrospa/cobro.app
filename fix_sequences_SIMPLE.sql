-- ========================================
-- SCRIPT SIMPLE: Corrección de Secuencias por Tienda
-- ========================================

-- PASO 1: Asignar store_id a secuencias sin tienda
DO $$
DECLARE
    primera_tienda UUID;
BEGIN
    -- Obtener la primera tienda
    SELECT id INTO primera_tienda FROM public.stores ORDER BY created_at LIMIT 1;
    
    -- Asignar a secuencias huérfanas
    UPDATE public.invoice_sequences 
    SET store_id = primera_tienda 
    WHERE store_id IS NULL;
    
    RAISE NOTICE '✅ Paso 1 completado: Secuencias huérfanas asignadas';
END $$;

-- PASO 2: Crear secuencias para todas las tiendas
DO $$
DECLARE
    tienda RECORD;
BEGIN
    FOR tienda IN SELECT id FROM public.stores LOOP
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES 
            ('B01', 0, tienda.id),
            ('B02', 0, tienda.id),
            ('B03', 0, tienda.id),
            ('B14', 0, tienda.id),
            ('B15', 0, tienda.id),
            ('B16', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ Paso 2 completado: Secuencias creadas para todas las tiendas';
END $$;

-- PASO 3: Sincronizar números con facturas existentes
DO $$
DECLARE
    seq RECORD;
    numero_maximo INTEGER;
BEGIN
    FOR seq IN 
        SELECT id, invoice_type_id, store_id, current_number 
        FROM public.invoice_sequences 
        WHERE store_id IS NOT NULL
    LOOP
        -- Buscar el número más alto usado
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(invoice_number FROM '-(\d+)$') AS INTEGER)), 
            0
        ) INTO numero_maximo
        FROM public.sales
        WHERE invoice_type_id = seq.invoice_type_id
          AND store_id = seq.store_id
          AND invoice_number IS NOT NULL;
        
        -- Actualizar si es necesario
        IF numero_maximo > seq.current_number THEN
            UPDATE public.invoice_sequences
            SET current_number = numero_maximo
            WHERE id = seq.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Paso 3 completado: Secuencias sincronizadas';
END $$;

-- VERIFICACIÓN: Ver estado final
SELECT 
    s.name as "Tienda",
    iseq.invoice_type_id as "Tipo",
    iseq.current_number as "Último Número",
    iseq.invoice_type_id || '-' || LPAD((iseq.current_number + 1)::text, 8, '0') as "Próximo Número"
FROM public.invoice_sequences iseq
JOIN public.stores s ON s.id = iseq.store_id
ORDER BY s.name, iseq.invoice_type_id;
