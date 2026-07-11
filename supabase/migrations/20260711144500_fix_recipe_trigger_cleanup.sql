-- Migration to clean up database triggers/functions referencing non-existent public.recipe_ingredients

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop triggers using functions referencing 'recipe_ingredients'
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
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;

    -- 2. Drop functions referencing 'recipe_ingredients'
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosrc ILIKE '%recipe_ingredients%' AND n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;
