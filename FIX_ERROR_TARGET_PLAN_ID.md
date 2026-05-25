# 🚨 ERROR: "column target_plan_id does not exist"

## Problema
Tu tabla `payment_reports` no tiene todas las columnas necesarias. Está faltando `target_plan_id` (y probablemente otras columnas también).

## ✅ SOLUCIÓN DEFINITIVA (1 paso)

### Copia y ejecuta este SQL en Supabase:

**Ve a:** https://supabase.com/dashboard → SQL Editor → New query

**Copia y pega TODO esto:**

```sql
-- Agregar TODAS las columnas faltantes

-- 1. currency
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'currency') THEN
        ALTER TABLE public.payment_reports ADD COLUMN currency text DEFAULT 'USD';
    END IF;
END $$;

-- 2. target_plan_id (ESTA ES LA QUE FALTA AHORA)
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'target_plan_id') THEN
        ALTER TABLE public.payment_reports ADD COLUMN target_plan_id text;
    END IF;
END $$;

-- 3. bank_name
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'bank_name') THEN
        ALTER TABLE public.payment_reports ADD COLUMN bank_name text;
    END IF;
END $$;

-- 4. proof_url
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'proof_url') THEN
        ALTER TABLE public.payment_reports ADD COLUMN proof_url text;
    END IF;
END $$;

-- 5. status
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'status') THEN
        ALTER TABLE public.payment_reports ADD COLUMN status text DEFAULT 'pending';
    END IF;
END $$;

-- 6. admin_note
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_reports' AND column_name = 'admin_note') THEN
        ALTER TABLE public.payment_reports ADD COLUMN admin_note text;
    END IF;
END $$;

-- Verificación
SELECT '✅ TODAS LAS COLUMNAS AGREGADAS CORRECTAMENTE' as resultado;
```

### Luego haz clic en **RUN**

---

## 📁 Archivos disponibles

He creado varios archivos SQL para ti:

1. **`6_AGREGAR_TODAS_COLUMNAS.sql`** ← Usa este (más detallado)
2. **`5_INSTALACION_COMPLETA_SUSCRIPCIONES.sql`** ← Instalación desde cero

---

## 🤔 ¿Por qué sigue fallando?

Parece que tu tabla `payment_reports` se creó sin todas las columnas necesarias. Probablemente:
1. Solo ejecutaste parte del script original
2. O la tabla ya existía con una estructura diferente

Este nuevo script agregará TODAS las columnas que faltan sin importar cuáles ya existan.

---

## 🔄 Después de ejecutar el SQL

1. ✅ Ejecuta el SQL en Supabase
2. 🔄 Recarga la página de tu app (http://localhost:8080/subscription)
3. 🎯 Intenta activar el plan de nuevo
4. ✨ Debería funcionar correctamente ahora

---

## 🆘 Si sigue fallando

Si después de ejecutar este script sigues viendo errores:
1. Abre la consola del navegador (F12)
2. Busca los mensajes de error con 🔍 o ❌
3. Muéstrame el error completo
4. Te ayudaré a diagnosticar
