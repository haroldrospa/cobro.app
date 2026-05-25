-- ========================================
-- SCRIPT CORRECCIÓN DEFINITIVA: Secuencias por Tienda
-- ========================================

-- PASO 0: Preparar constraints
DO $$
BEGIN
    -- Intentar eliminar constraint antiguo si existe
    BEGIN
        ALTER TABLE public.invoice_sequences 
        DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignorar si no existe
    END;
    
    -- Crear constraint único compuesto si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'invoice_sequences_type_store_unique'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ADD CONSTRAINT invoice_sequences_type_store_unique 
        UNIQUE (invoice_type_id, store_id);
        
        RAISE NOTICE '✅ Paso 0: Constraint único creado';
    ELSE
        RAISE NOTICE '✅ Paso 0: Constraint único ya existe';
    END IF;
END $$;

-- PASO 1: Asignar store_id a secuencias huérfanas
DO $$
DECLARE
    primera_tienda UUID;
    secuencias_actualizadas INTEGER;
BEGIN
    -- Contar secuencias sin tienda
    SELECT COUNT(*) INTO secuencias_actualizadas
    FROM public.invoice_sequences 
    WHERE store_id IS NULL;
    
    IF secuencias_actualizadas > 0 THEN
        -- Obtener la primera tienda
        SELECT id INTO primera_tienda 
        FROM public.stores 
        ORDER BY created_at 
        LIMIT 1;
        
        IF primera_tienda IS NOT NULL THEN
            -- Asignar tienda a secuencias huérfanas
            UPDATE public.invoice_sequences 
            SET store_id = primera_tienda 
            WHERE store_id IS NULL;
            
            RAISE NOTICE '✅ Paso 1: % secuencias asignadas a tienda', secuencias_actualizadas;
        ELSE
            RAISE NOTICE '⚠️  Paso 1: No hay tiendas en el sistema';
        END IF;
    ELSE
        RAISE NOTICE '✅ Paso 1: No hay secuencias huérfanas';
    END IF;
END $$;

-- PASO 2: Eliminar duplicados antes de crear nuevas
DO $$
DECLARE
    duplicado RECORD;
BEGIN
    -- Eliminar duplicados manteniendo solo el más reciente
    FOR duplicado IN 
        SELECT invoice_type_id, store_id, MIN(id) as keeper_id
        FROM public.invoice_sequences
        WHERE store_id IS NOT NULL
        GROUP BY invoice_type_id, store_id
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM public.invoice_sequences
        WHERE invoice_type_id = duplicado.invoice_type_id
          AND store_id = duplicado.store_id
          AND id != duplicado.keeper_id;
          
        RAISE NOTICE 'Eliminado duplicado: % para tienda %', 
            duplicado.invoice_type_id, duplicado.store_id;
    END LOOP;
    
    RAISE NOTICE '✅ Paso 2a: Duplicados eliminados';
END $$;

-- PASO 3: Crear secuencias faltantes para todas las tiendas
DO $$
DECLARE
    tienda RECORD;
    tipo TEXT;
    tipos_factura TEXT[] := ARRAY['B01', 'B02', 'B03', 'B14', 'B15', 'B16'];
    total_creadas INTEGER := 0;
    existe BOOLEAN;
BEGIN
    FOR tienda IN SELECT id, name FROM public.stores LOOP
        FOREACH tipo IN ARRAY tipos_factura LOOP
            -- Verificar si ya existe
            SELECT EXISTS(
                SELECT 1 FROM public.invoice_sequences 
                WHERE invoice_type_id = tipo AND store_id = tienda.id
            ) INTO existe;
            
            -- Crear solo si no existe
            IF NOT existe THEN
                INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
                VALUES (tipo, 0, tienda.id);
                total_creadas := total_creadas + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    IF total_creadas > 0 THEN
        RAISE NOTICE '✅ Paso 3: % secuencias nuevas creadas', total_creadas;
    ELSE
        RAISE NOTICE '✅ Paso 3: Todas las tiendas tienen sus secuencias';
    END IF;
END $$;

-- PASO 4: Sincronizar con facturas existentes
DO $$
DECLARE
    seq RECORD;
    numero_maximo INTEGER;
    actualizadas INTEGER := 0;
BEGIN
    FOR seq IN 
        SELECT id, invoice_type_id, store_id, current_number 
        FROM public.invoice_sequences 
        WHERE store_id IS NOT NULL
    LOOP
        -- Buscar el número más alto usado en ventas
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(invoice_number FROM '-(\d+)$') AS INTEGER)), 
            0
        ) INTO numero_maximo
        FROM public.sales
        WHERE invoice_type_id = seq.invoice_type_id
          AND store_id = seq.store_id
          AND invoice_number IS NOT NULL
          AND invoice_number ~ '^[A-Z0-9]+-\d+$';
        
        -- Actualizar si el máximo es mayor
        IF numero_maximo > seq.current_number THEN
            UPDATE public.invoice_sequences
            SET current_number = numero_maximo,
                updated_at = NOW()
            WHERE id = seq.id;
            
            actualizadas := actualizadas + 1;
        END IF;
    END LOOP;
    
    IF actualizadas > 0 THEN
        RAISE NOTICE '✅ Paso 4: % secuencias sincronizadas', actualizadas;
    ELSE
        RAISE NOTICE '✅ Paso 4: Secuencias ya están sincronizadas';
    END IF;
END $$;

-- VERIFICACIÓN FINAL
SELECT 
    s.name as "Tienda",
    iseq.invoice_type_id as "Tipo",
    iseq.current_number as "Último #",
    iseq.invoice_type_id || '-' || LPAD((iseq.current_number + 1)::text, 8, '0') as "Próximo Número",
    (SELECT COUNT(*) 
     FROM public.sales 
     WHERE store_id = s.id AND invoice_type_id = iseq.invoice_type_id
    ) as "Facturas"
FROM public.invoice_sequences iseq
JOIN public.stores s ON s.id = iseq.store_id
ORDER BY s.name, iseq.invoice_type_id;
