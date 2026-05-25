-- ========================================
-- FIX: Aislar secuencias de facturas por tienda
-- ========================================
-- Este script asegura que cada tienda tenga su propia secuencia de facturas

-- 1. Añadir store_id a invoice_sequences si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_sequences' AND column_name = 'store_id'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ADD COLUMN store_id UUID REFERENCES public.stores(id);
        
        RAISE NOTICE 'Columna store_id añadida a invoice_sequences';
    ELSE
        RAISE NOTICE 'Columna store_id ya existe en invoice_sequences';
    END IF;
END $$;

-- 2. Eliminar constraint único en invoice_type_id (ahora es único por tienda)
ALTER TABLE public.invoice_sequences 
DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;

-- 3. Crear constraint único compuesto (invoice_type_id + store_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoice_sequences_type_store_unique'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ADD CONSTRAINT invoice_sequences_type_store_unique 
        UNIQUE (invoice_type_id, store_id);
        
        RAISE NOTICE 'Constraint único compuesto creado';
    ELSE
        RAISE NOTICE 'Constraint único compuesto ya existe';
    END IF;
END $$;

-- 4. Migrar datos existentes: asignar store_id a secuencias huérfanas
-- Esto asignará todas las secuencias sin store_id a la primera tienda encontrada
DO $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Obtener la primera tienda
    SELECT id INTO default_store_id FROM public.stores ORDER BY created_at LIMIT 1;
    
    IF default_store_id IS NOT NULL THEN
        -- Actualizar secuencias sin store_id
        UPDATE public.invoice_sequences 
        SET store_id = default_store_id 
        WHERE store_id IS NULL;
        
        RAISE NOTICE 'Secuencias huérfanas asignadas a tienda: %', default_store_id;
    END IF;
END $$;

-- 5. Crear secuencias faltantes para todas las tiendas existentes
DO $$
DECLARE
    store_record RECORD;
    type_code TEXT;
    type_codes TEXT[] := ARRAY['B01', 'B02', 'B03', 'B14', 'B15', 'B16'];
BEGIN
    FOR store_record IN SELECT id FROM public.stores LOOP
        FOREACH type_code IN ARRAY type_codes LOOP
            -- Insertar solo si no existe
            INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
            VALUES (type_code, 0, store_record.id)
            ON CONFLICT (invoice_type_id, store_id) DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'Secuencias inicializadas para tienda: %', store_record.id;
    END LOOP;
END $$;

-- 6. Actualizar políticas RLS para invoice_sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to invoice sequences" ON public.invoice_sequences;
DROP POLICY IF EXISTS "Users can view own store sequences" ON public.invoice_sequences;

CREATE POLICY "Users can view own store sequences" 
ON public.invoice_sequences
FOR ALL 
USING (
    store_id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- 7. Actualizar la función get_next_invoice_number para filtrar por tienda
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

-- 8. Verificación final
DO $$
DECLARE
    seq_count INTEGER;
    store_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO seq_count FROM public.invoice_sequences;
    SELECT COUNT(DISTINCT store_id) INTO store_count FROM public.invoice_sequences;
    
    RAISE NOTICE '✅ Migración completada:';
    RAISE NOTICE '   - Total de secuencias: %', seq_count;
    RAISE NOTICE '   - Tiendas con secuencias: %', store_count;
END $$;
