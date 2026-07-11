-- =========================================================================
-- SOLUCIÓN: Eliminar triggers o funciones rotas que hacen referencia a "recipe_ingredients"
-- Ejecuta este script en el editor de SQL de Supabase (https://supabase.com)
-- =========================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Buscando triggers y funciones que hagan referencia a recipe_ingredients...';

    -- 1. Buscar y eliminar triggers que usen funciones con la palabra 'recipe_ingredients'
    FOR r IN (
        SELECT DISTINCT t.tgname, c.relname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE p.prosrc ILIKE '%recipe_ingredients%' AND n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.' || quote_ident(r.relname) || ' CASCADE;';
            RAISE NOTICE 'Trigger eliminado: % en la tabla %', r.tgname, r.relname;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'No se pudo eliminar el trigger % en la tabla %: %', r.tgname, r.relname, SQLERRM;
        END;
    END LOOP;

    -- 2. Buscar y eliminar funciones que contengan la palabra 'recipe_ingredients' en su código
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosrc ILIKE '%recipe_ingredients%' AND n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE;';
            RAISE NOTICE 'Función eliminada: % (%)', r.proname, r.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'No se pudo eliminar la función %: %', r.proname, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Limpieza completada con éxito. Los triggers rotos han sido eliminados.';
END $$;

-- Recargar PostgREST cache
NOTIFY pgrst, 'reload schema';
