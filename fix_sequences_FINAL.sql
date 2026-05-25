-- ========================================
-- SCRIPT FINAL: Corrección de Secuencias por Tienda
-- ========================================

-- PASO 0: Crear constraint único si no existe
DO $$
BEGIN
    -- Eliminar constraint antiguo si existe
    ALTER TABLE public.invoice_sequences 
    DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;
    
    -- Crear nuevo constraint único compuesto
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoice_sequences_type_store_unique'
        AND table_name = 'invoice_sequences'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ADD CONSTRAINT invoice_sequences_type_store_unique 
        UNIQUE (invoice_type_id, store_id);
        
        RAISE NOTICE '✅ Paso 0 completado: Constraint único creado';
    ELSE
        RAISE NOTICE '✅ Paso 0: Constraint único ya existe';
    END IF;
END $$;

-- PASO 1: Asignar store_id a secuencias sin tienda
DO $$
DECLARE
    primera_tienda UUID;
    secuencias_actualizadas INTEGER;
BEGIN
    -- Contar secuencias huérfanas
    SELECT COUNT(*) INTO secuencias_actualizadas
    FROM public.invoice_sequences 
    WHERE store_id IS NULL;
    
    IF secuencias_actualizadas > 0 THEN
        -- Obtener la primera tienda
        SELECT id INTO primera_tienda FROM public.stores ORDER BY created_at LIMIT 1;
        
        -- Asignar a secuencias huérfanas
        UPDATE public.invoice_sequences 
        SET store_id = primera_tienda 
        WHERE store_id IS NULL;
        
        RAISE NOTICE '✅ Paso 1 completado: % secuencias huérfanas asignadas a tienda %', 
            secuencias_actualizadas, primera_tienda;
    ELSE
        RAISE NOTICE '✅ Paso 1: No hay secuencias huérfanas';
    END IF;
END $$;

-- PASO 2: Crear secuencias para todas las tiendas
DO $$
DECLARE
    tienda RECORD;
    secuencias_creadas INTEGER := 0;
BEGIN
    FOR tienda IN SELECT id, name FROM public.stores LOOP
        -- Insertar cada tipo individualmente para mejor control
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B01', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
        
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B02', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
        
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B03', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
        
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B14', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
        
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B15', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
        
        INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
        VALUES ('B16', 0, tienda.id)
        ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        IF FOUND THEN secuencias_creadas := secuencias_creadas + 1; END IF;
    END LOOP;
    
    IF secuencias_creadas > 0 THEN
        RAISE NOTICE '✅ Paso 2 completado: % secuencias nuevas creadas', secuencias_creadas;
    ELSE
        RAISE NOTICE '✅ Paso 2: Todas las tiendas ya tienen sus secuencias';
    END IF;
END $$;

-- PASO 3: Sincronizar números con facturas existentes
DO $$
DECLARE
    seq RECORD;
    numero_maximo INTEGER;
    secuencias_actualizadas INTEGER := 0;
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
            
            secuencias_actualizadas := secuencias_actualizadas + 1;
        END IF;
    END LOOP;
    
    IF secuencias_actualizadas > 0 THEN
        RAISE NOTICE '✅ Paso 3 completado: % secuencias sincronizadas con facturas existentes', 
            secuencias_actualizadas;
    ELSE
        RAISE NOTICE '✅ Paso 3: Todas las secuencias ya están sincronizadas';
    END IF;
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
