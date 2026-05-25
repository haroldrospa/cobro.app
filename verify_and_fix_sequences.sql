-- ========================================
-- VERIFICACIÓN Y CORRECCIÓN DE SECUENCIAS POR TIENDA
-- ========================================
-- Este script verifica y corrige el estado de las secuencias de facturas

-- 1. Ver estado actual de secuencias
SELECT 
    'ESTADO ACTUAL DE SECUENCIAS' as info,
    COUNT(*) as total_secuencias,
    COUNT(DISTINCT store_id) as tiendas_con_secuencias,
    COUNT(CASE WHEN store_id IS NULL THEN 1 END) as secuencias_huerfanas
FROM public.invoice_sequences;

-- 2. Ver detalle de secuencias por tienda
SELECT 
    s.name as tienda,
    iseq.invoice_type_id as tipo_factura,
    iseq.current_number as ultimo_numero,
    iseq.store_id
FROM public.invoice_sequences iseq
LEFT JOIN public.stores s ON s.id = iseq.store_id
ORDER BY s.name, iseq.invoice_type_id;

-- 3. Ver si hay ventas duplicadas entre tiendas
SELECT 
    invoice_type_id,
    invoice_number,
    COUNT(*) as veces_usado,
    array_agg(DISTINCT store_id) as tiendas_que_lo_usan
FROM public.sales
WHERE invoice_number IS NOT NULL
GROUP BY invoice_type_id, invoice_number
HAVING COUNT(*) > 1
ORDER BY invoice_number;

-- 4. CORRECCIÓN: Asignar store_id a secuencias huérfanas (si existen)
DO $$
DECLARE
    default_store_id UUID;
    orphan_count INTEGER;
BEGIN
    -- Contar huérfanos
    SELECT COUNT(*) INTO orphan_count 
    FROM public.invoice_sequences 
    WHERE store_id IS NULL;
    
    IF orphan_count > 0 THEN
        -- Obtener la primera tienda
        SELECT id INTO default_store_id 
        FROM public.stores 
        ORDER BY created_at 
        LIMIT 1;
        
        IF default_store_id IS NOT NULL THEN
            -- Actualizar secuencias huérfanas
            UPDATE public.invoice_sequences 
            SET store_id = default_store_id 
            WHERE store_id IS NULL;
            
            RAISE NOTICE '✅ Se asignaron % secuencias huérfanas a la tienda: %', orphan_count, default_store_id;
        END IF;
    ELSE
        RAISE NOTICE '✅ No hay secuencias huérfanas';
    END IF;
END $$;

-- 5. CORRECCIÓN: Crear secuencias faltantes para todas las tiendas
DO $$
DECLARE
    store_record RECORD;
    type_code TEXT;
    type_codes TEXT[] := ARRAY['B01', 'B02', 'B03', 'B14', 'B15', 'B16'];
    sequences_created INTEGER := 0;
BEGIN
    FOR store_record IN SELECT id, name FROM public.stores LOOP
        FOREACH type_code IN ARRAY type_codes LOOP
            -- Insertar solo si no existe
            INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
            VALUES (type_code, 0, store_record.id)
            ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
            
            IF FOUND THEN
                sequences_created := sequences_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    IF sequences_created > 0 THEN
        RAISE NOTICE '✅ Se crearon % secuencias nuevas', sequences_created;
    ELSE
        RAISE NOTICE '✅ Todas las tiendas ya tienen sus secuencias';
    END IF;
END $$;

-- 6. CORRECCIÓN: Ajustar el current_number basado en facturas existentes
DO $$
DECLARE
    seq_record RECORD;
    max_num INTEGER;
BEGIN
    FOR seq_record IN 
        SELECT id, invoice_type_id, store_id, current_number 
        FROM public.invoice_sequences 
        WHERE store_id IS NOT NULL
    LOOP
        -- Buscar el número máximo usado en ventas para este tipo y tienda
        SELECT COALESCE(MAX(
            CAST(
                SUBSTRING(invoice_number FROM '\-(\d+)$') 
                AS INTEGER
            )
        ), 0) INTO max_num
        FROM public.sales
        WHERE invoice_type_id = seq_record.invoice_type_id
          AND store_id = seq_record.store_id
          AND invoice_number ~ (seq_record.invoice_type_id || '-\d+');
        
        -- Si el máximo usado es mayor que current_number, actualizar
        IF max_num > seq_record.current_number THEN
            UPDATE public.invoice_sequences
            SET current_number = max_num
            WHERE id = seq_record.id;
            
            RAISE NOTICE 'Secuencia % tienda % actualizada de % a %', 
                seq_record.invoice_type_id, 
                seq_record.store_id, 
                seq_record.current_number, 
                max_num;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Sincronización de secuencias completada';
END $$;

-- 7. Verificación final
SELECT 
    'VERIFICACIÓN FINAL' as info,
    s.name as tienda,
    iseq.invoice_type_id as tipo,
    iseq.current_number as ultimo_numero,
    (
        SELECT COUNT(*) 
        FROM public.sales 
        WHERE store_id = s.id 
          AND invoice_type_id = iseq.invoice_type_id
    ) as total_facturas_emitidas
FROM public.invoice_sequences iseq
JOIN public.stores s ON s.id = iseq.store_id
ORDER BY s.name, iseq.invoice_type_id;

-- 8. Prueba: Generar siguiente número para cada tipo
DO $$
DECLARE
    store_record RECORD;
    type_code TEXT;
    next_num TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PRUEBA: Generar próximo número de factura';
    RAISE NOTICE '========================================';
    
    FOR store_record IN SELECT id, name FROM public.stores LIMIT 3 LOOP
        RAISE NOTICE '';
        RAISE NOTICE 'Tienda: % (ID: %)', store_record.name, store_record.id;
        
        FOR type_code IN SELECT DISTINCT invoice_type_id FROM public.invoice_sequences WHERE store_id = store_record.id ORDER BY invoice_type_id LOOP
            -- Obtener el próximo número (sin incrementar)
            SELECT invoice_type_id || '-' || LPAD((current_number + 1)::text, 8, '0')
            INTO next_num
            FROM public.invoice_sequences
            WHERE invoice_type_id = type_code 
              AND store_id = store_record.id;
            
            RAISE NOTICE '  Tipo %: Próximo número será: %', type_code, next_num;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
