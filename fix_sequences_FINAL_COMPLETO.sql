-- ========================================
-- SCRIPT DE CORRECCIÓN COMPLETA
-- Aislamiento de Secuencias de Facturas por Tienda
-- ========================================
-- 
-- Este script garantiza que:
-- 1. Cada tienda tenga sus propias secuencias de facturas independientes
-- 2. Las secuencias existentes se corrijan y asignen correctamente
-- 3. Se creen constraints para prevenir duplicados
-- 4. Se verifique que todo funcione correctamente
--
-- INSTRUCCIONES:
-- 1. Ejecuta este script en el SQL Editor de Supabase
-- 2. Revisa los mensajes de NOTICE para verificar cada paso
-- 3. Revisa la verificación final al terminar
-- ========================================

-- ========================================
-- PASO 0: Eliminar constraint antiguo
-- ========================================
DO $$
BEGIN
    -- Eliminar constraint antiguo si existe
    ALTER TABLE public.invoice_sequences 
    DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;
    
    -- Eliminar constraint único compuesto si ya existe (lo recrearemos después)
    ALTER TABLE public.invoice_sequences 
    DROP CONSTRAINT IF EXISTS invoice_sequences_type_store_unique;
    
    RAISE NOTICE '✅ Paso 0: Constraints antiguos eliminados (para recrear después de limpiar datos)';
END $$;

-- ========================================
-- PASO 1: Eliminar secuencias duplicadas PRIMERO
-- ========================================
DO $$
DECLARE
    total_eliminados INTEGER := 0;
    duplicado RECORD;
    count_eliminados INTEGER;
BEGIN
    RAISE NOTICE 'Iniciando eliminación de duplicados...';
    
    -- Eliminar duplicados donde ambos tienen store_id
    FOR duplicado IN 
        SELECT invoice_type_id, store_id, MAX(current_number) as max_number, 
               ARRAY_AGG(id ORDER BY current_number DESC) as ids
        FROM public.invoice_sequences
        WHERE store_id IS NOT NULL
        GROUP BY invoice_type_id, store_id
        HAVING COUNT(*) > 1
    LOOP
        -- Mantener solo el primero (que tiene el número más alto), eliminar el resto
        DELETE FROM public.invoice_sequences
        WHERE id = ANY(duplicado.ids[2:]);
          
        GET DIAGNOSTICS count_eliminados = ROW_COUNT;
        total_eliminados := total_eliminados + count_eliminados;
        
        RAISE NOTICE '  → Eliminados % duplicados para tipo % en tienda %', 
            count_eliminados, duplicado.invoice_type_id, duplicado.store_id;
    END LOOP;
    
    IF total_eliminados > 0 THEN
        RAISE NOTICE '✅ Paso 1a: % duplicados eliminados correctamente', total_eliminados;
    ELSE
        RAISE NOTICE '✅ Paso 1a: No se encontraron duplicados con store_id';
    END IF;
END $$;

-- ========================================
-- PASO 2: Manejar secuencias huérfanas inteligentemente
-- ========================================
DO $$
DECLARE
    primera_tienda UUID;
    secuencia_huerfana RECORD;
    total_asignadas INTEGER := 0;
    total_eliminadas INTEGER := 0;
    existe_duplicado BOOLEAN;
BEGIN
    -- Obtener la primera tienda
    SELECT id INTO primera_tienda 
    FROM public.stores 
    ORDER BY created_at 
    LIMIT 1;
    
    IF primera_tienda IS NULL THEN
        RAISE WARNING '⚠️  Paso 2: No hay tiendas en el sistema';
        RETURN;
    END IF;
    
    -- Procesar cada secuencia huérfana
    FOR secuencia_huerfana IN 
        SELECT id, invoice_type_id, current_number
        FROM public.invoice_sequences 
        WHERE store_id IS NULL
    LOOP
        -- Verificar si ya existe una secuencia de este tipo para la primera tienda
        SELECT EXISTS(
            SELECT 1 FROM public.invoice_sequences 
            WHERE invoice_type_id = secuencia_huerfana.invoice_type_id 
            AND store_id = primera_tienda
        ) INTO existe_duplicado;
        
        IF existe_duplicado THEN
            -- Ya existe, eliminar la huérfana
            DELETE FROM public.invoice_sequences WHERE id = secuencia_huerfana.id;
            total_eliminadas := total_eliminadas + 1;
            RAISE NOTICE '  → Eliminada secuencia huérfana % (ya existe para primera tienda)', 
                secuencia_huerfana.invoice_type_id;
        ELSE
            -- No existe, asignar a la primera tienda
            UPDATE public.invoice_sequences 
            SET store_id = primera_tienda 
            WHERE id = secuencia_huerfana.id;
            total_asignadas := total_asignadas + 1;
            RAISE NOTICE '  → Asignada secuencia huérfana % a primera tienda', 
                secuencia_huerfana.invoice_type_id;
        END IF;
    END LOOP;
    
    IF total_asignadas > 0 OR total_eliminadas > 0 THEN
        RAISE NOTICE '✅ Paso 2: % secuencias asignadas, % eliminadas (duplicadas)', 
            total_asignadas, total_eliminadas;
    ELSE
        RAISE NOTICE '✅ Paso 2: No hay secuencias huérfanas';
    END IF;
END $$;

-- ========================================
-- PASO 3: Crear constraint único compuesto AHORA
-- ========================================
DO $$
BEGIN
    -- Verificar que no hay duplicados antes de crear el constraint
    IF EXISTS (
        SELECT invoice_type_id, store_id, COUNT(*)
        FROM public.invoice_sequences
        WHERE store_id IS NOT NULL
        GROUP BY invoice_type_id, store_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'ERROR: Aún existen duplicados. No se puede crear el constraint único.';
    END IF;
    
    -- Crear constraint único compuesto
    ALTER TABLE public.invoice_sequences 
    ADD CONSTRAINT invoice_sequences_type_store_unique 
    UNIQUE (invoice_type_id, store_id);
    
    RAISE NOTICE '✅ Paso 3: Constraint único (invoice_type_id, store_id) creado exitosamente';
END $$;


-- ========================================
-- PASO 4: Crear secuencias faltantes para todas las tiendas
-- ========================================
DO $$
DECLARE
    tienda RECORD;
    tipo TEXT;
    tipos_factura TEXT[] := ARRAY['B01', 'B02', 'B03', 'B14', 'B15', 'B16'];
    total_creadas INTEGER := 0;
    existe BOOLEAN;
BEGIN
    FOR tienda IN SELECT id, store_name FROM public.stores LOOP
        FOREACH tipo IN ARRAY tipos_factura LOOP
            -- Verificar si ya existe esta combinación
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
        
        IF total_creadas > 0 THEN
            RAISE NOTICE '  → Creadas % secuencias para tienda: %', total_creadas, tienda.store_name;
        END IF;
    END LOOP;
    
    IF total_creadas > 0 THEN
        RAISE NOTICE '✅ Paso 4: % secuencias nuevas creadas en total', total_creadas;
    ELSE
        RAISE NOTICE '✅ Paso 4: Todas las tiendas ya tienen sus secuencias completas';
    END IF;
END $$;

-- ========================================
-- PASO 5: Sincronizar secuencias con facturas existentes
-- ========================================
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
        -- Buscar el número más alto usado en ventas para esta tienda y tipo
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(invoice_number FROM '-(\d+)$') AS INTEGER)), 
            0
        ) INTO numero_maximo
        FROM public.sales
        WHERE invoice_type_id = seq.invoice_type_id
          AND store_id = seq.store_id
          AND invoice_number IS NOT NULL
          AND invoice_number ~ '^[A-Z0-9]+-\d+$';
        
        -- Actualizar si el máximo encontrado es mayor que el actual
        IF numero_maximo > seq.current_number THEN
            UPDATE public.invoice_sequences
            SET current_number = numero_maximo,
                updated_at = NOW()
            WHERE id = seq.id;
            
            actualizadas := actualizadas + 1;
            
            RAISE NOTICE '  → Secuencia % en tienda % actualizada de % a %', 
                seq.invoice_type_id, seq.store_id, seq.current_number, numero_maximo;
        END IF;
    END LOOP;
    
    IF actualizadas > 0 THEN
        RAISE NOTICE '✅ Paso 5: % secuencias sincronizadas con facturas existentes', actualizadas;
    ELSE
        RAISE NOTICE '✅ Paso 5: Todas las secuencias ya estaban sincronizadas';
    END IF;
END $$;

-- ========================================
-- PASO 6: Hacer store_id obligatorio (NOT NULL)
-- ========================================
DO $$
BEGIN
    -- Verificar que no hay valores NULL antes de aplicar NOT NULL
    IF EXISTS (SELECT 1 FROM public.invoice_sequences WHERE store_id IS NULL) THEN
        RAISE EXCEPTION 'ERROR: Aún existen secuencias sin store_id. Revisa los pasos anteriores.';
    END IF;
    
    -- Aplicar NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_sequences' 
        AND column_name = 'store_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ALTER COLUMN store_id SET NOT NULL;
        
        RAISE NOTICE '✅ Paso 6: store_id ahora es obligatorio (NOT NULL)';
    ELSE
        RAISE NOTICE '✅ Paso 6: store_id ya era obligatorio';
    END IF;
END $$;

-- ========================================
-- PASO 7: Actualizar la función get_next_invoice_number
-- ========================================
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(invoice_type_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  formatted_number text;
  user_store_id uuid;
BEGIN
  -- Obtener la tienda del usuario actual
  SELECT store_id INTO user_store_id 
  FROM public.profiles 
  WHERE id = auth.uid();

  IF user_store_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene tienda asignada';
  END IF;

  -- Obtener e incrementar el número actual SOLO PARA ESTA TIENDA
  UPDATE public.invoice_sequences 
  SET current_number = current_number + 1,
      updated_at = now()
  WHERE invoice_type_id = invoice_type_code 
    AND store_id = user_store_id
  RETURNING current_number INTO next_number;
  
  -- Si no existe secuencia para esta tienda, crearla empezando en 1
  IF next_number IS NULL THEN
      INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
      VALUES (invoice_type_code, 1, user_store_id)
      RETURNING current_number INTO next_number;
  END IF;
  
  -- Formatear como tipo + número con padding (ej: B01-00000001)
  formatted_number := invoice_type_code || '-' || LPAD(next_number::text, 8, '0');
  
  RETURN formatted_number;
END;
$$;

-- ========================================
-- PASO 8: Actualizar políticas RLS
-- ========================================
DO $$
BEGIN
    -- Habilitar RLS si no está habilitado
    ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
    
    -- Eliminar políticas antiguas
    DROP POLICY IF EXISTS "Allow public access to invoice sequences" ON public.invoice_sequences;
    DROP POLICY IF EXISTS "Users can view own store sequences" ON public.invoice_sequences;
    DROP POLICY IF EXISTS "Users can manage own store sequences" ON public.invoice_sequences;
    
    -- Crear política de acceso basada en tienda
    CREATE POLICY "Users can manage own store sequences" 
    ON public.invoice_sequences
    FOR ALL 
    USING (
        store_id IN (
            SELECT store_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
    
    RAISE NOTICE '✅ Paso 8: Políticas RLS actualizadas';
END $$;


-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================
-- Esta consulta muestra el estado actual de todas las secuencias por tienda
SELECT 
    s.store_name as "🏪 Tienda",
    s.store_code as "Código",
    iseq.invoice_type_id as "Tipo NCF",
    iseq.current_number as "Último #",
    iseq.invoice_type_id || '-' || LPAD((iseq.current_number + 1)::text, 8, '0') as "Próximo Número",
    (SELECT COUNT(*) 
     FROM public.sales 
     WHERE store_id = s.id 
     AND invoice_type_id = iseq.invoice_type_id
    ) as "Total Facturas",
    CASE 
        WHEN iseq.store_id IS NULL THEN '❌ SIN TIENDA'
        ELSE '✅ OK'
    END as "Estado"
FROM public.invoice_sequences iseq
LEFT JOIN public.stores s ON s.id = iseq.store_id
ORDER BY s.store_name, iseq.invoice_type_id;

-- ========================================
-- RESUMEN ESTADÍSTICO
-- ========================================
DO $$
DECLARE
    total_tiendas INTEGER;
    total_secuencias INTEGER;
    secuencias_huerfanas INTEGER;
    secuencias_esperadas INTEGER;
BEGIN
    SELECT COUNT(DISTINCT id) INTO total_tiendas FROM public.stores;
    SELECT COUNT(*) INTO total_secuencias FROM public.invoice_sequences;
    SELECT COUNT(*) INTO secuencias_huerfanas FROM public.invoice_sequences WHERE store_id IS NULL;
    
    -- Cada tienda debe tener 6 tipos de NCF (B01, B02, B03, B14, B15, B16)
    secuencias_esperadas := total_tiendas * 6;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '                 📊 RESUMEN FINAL';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '  Total de tiendas: %', total_tiendas;
    RAISE NOTICE '  Secuencias esperadas: % (% tiendas × 6 tipos NCF)', secuencias_esperadas, total_tiendas;
    RAISE NOTICE '  Secuencias actuales: %', total_secuencias;
    RAISE NOTICE '  Secuencias huérfanas: %', secuencias_huerfanas;
    RAISE NOTICE '';
    
    IF secuencias_huerfanas > 0 THEN
        RAISE WARNING '  ⚠️  HAY SECUENCIAS SIN TIENDA - REVISAR';
    ELSIF total_secuencias = secuencias_esperadas THEN
        RAISE NOTICE '  ✅ TODO CORRECTO - Aislamiento completado exitosamente';
    ELSE
        RAISE NOTICE '  ℹ️  Diferencia en secuencias (puede ser normal si hay tiendas con configuración personalizada)';
    END IF;
    
    RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
