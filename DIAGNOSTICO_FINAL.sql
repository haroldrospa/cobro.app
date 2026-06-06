-- ============================================================
-- DIAGNÓSTICO: Encuentra la función trigger exacta con el bug
-- Ejecuta esto en Supabase SQL Editor y muéstrame el resultado
-- ============================================================

-- 1. Ver el código ACTUAL de TODAS las funciones trigger en profiles
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS full_function_body
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
