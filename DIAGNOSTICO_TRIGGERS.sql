-- ============================================================
-- DIAGNÓSTICO COMPLETO + FIX DEFINITIVO
-- Ejecuta este SQL en el Supabase SQL Editor
-- ============================================================

-- PASO 1: Ver TODOS los triggers que existen en la tabla profiles
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    p.prosrc as function_body
FROM information_schema.triggers t
JOIN pg_proc p ON p.proname = t.action_statement::text
WHERE t.event_object_table = 'profiles'
ORDER BY t.trigger_name, t.event_manipulation;
