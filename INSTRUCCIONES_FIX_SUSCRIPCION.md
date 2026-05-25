# 🔧 SOLUCIÓN: Activación Automática de Plan al Subir Comprobante

## 🔍 Problema Identificado

Cuando subes el comprobante de pago para el plan Profesional, el sistema muestra "¡Pago Confirmado!" pero al recargar la página sigues viendo el plan "Emprendedor" activo.

**Causa raíz:** La función `submit_payment_and_activate` en tu base de datos de Supabase NO está actualizada con la lógica de activación automática.

---

## ✅ SOLUCIÓN (Sigue estos pasos)

### Paso 1: Abrir Supabase SQL Editor

1. Ve a tu dashboard de Supabase: **https://supabase.com/dashboard**
2. Selecciona tu proyecto: **hkzgxdmnvyoviwketxva**
3. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
4. Haz clic en **"New query"** (Nueva consulta)

---

### Paso 2: Copiar y Pegar este SQL COMPLETO

⚠️ **IMPORTANTE:** Usa este script completo que crea TODA la estructura necesaria (incluyendo la columna `currency` que faltaba).

Copia TODO el siguiente código SQL y pégalo en el editor:

```sql
-- =========================================================
-- INSTALACIÓN COMPLETA: Sistema de Suscripciones
-- =========================================================

-- 1. CREAR/VERIFICAR TABLAS
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    plan_id text NOT NULL,
    status text DEFAULT 'active',
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD',
    bank_name text,
    proof_url text,
    target_plan_id text,
    status text DEFAULT 'pending',
    admin_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. AGREGAR COLUMNA currency SI NO EXISTE (FIX DEL ERROR)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.payment_reports 
        ADD COLUMN currency text DEFAULT 'USD';
        RAISE NOTICE '✅ Columna currency agregada';
    END IF;
END $$;

-- 3. HABILITAR RLS
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'company_subscriptions' AND policyname = 'Permitir lectura a todos') THEN
        CREATE POLICY "Permitir lectura a todos" ON public.company_subscriptions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'company_subscriptions' AND policyname = 'Permitir todo a autenticados') THEN
        CREATE POLICY "Permitir todo a autenticados" ON public.company_subscriptions FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir lectura a todos reportes') THEN
        CREATE POLICY "Permitir lectura a todos reportes" ON public.payment_reports FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir insert a autenticados') THEN
        CREATE POLICY "Permitir insert a autenticados" ON public.payment_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir update a admins') THEN
        CREATE POLICY "Permitir update a admins" ON public.payment_reports FOR UPDATE USING (true);
    END IF;
END $$;

-- 5. FUNCIÓN DE ACTIVACIÓN AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.submit_payment_and_activate(
    p_company_id uuid,
    p_amount numeric,
    p_currency text,
    p_bank_name text,
    p_proof_url text,
    p_target_plan_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_days_to_add int := 30;
BEGIN
    INSERT INTO public.payment_reports (
        company_id, amount, currency, bank_name, proof_url, target_plan_id, status
    ) VALUES (
        p_company_id, p_amount, p_currency, p_bank_name, p_proof_url, p_target_plan_id, 'pending'
    );

    UPDATE public.company_subscriptions 
    SET status = 'expired' 
    WHERE company_id = p_company_id AND status = 'active';

    INSERT INTO public.company_subscriptions (
        company_id, plan_id, status, start_date, end_date
    ) VALUES (
        p_company_id, p_target_plan_id, 'active', now(), now() + (v_days_to_add || ' days')::interval
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
    RETURN false;
END;
$$;

-- 6. CREAR STORAGE BUCKET
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE name = 'payment-proofs') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);
    END IF;
END $$;

-- 7. POLÍTICA DE STORAGE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Permitir subida de comprobantes'
    ) THEN
        CREATE POLICY "Permitir subida de comprobantes"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'payment-proofs');
    END IF;
END $$;

-- Mensaje de confirmación
SELECT '✅ Sistema instalado correctamente. Puedes probar el pago ahora.' as resultado;
```


---

### Paso 3: Ejecutar el Script

1. Después de pegar el código, haz clic en el botón **"RUN"** (Ejecutar) en la esquina inferior derecha
2. Deberías ver un mensaje de confirmación: **"✅ Sistema instalado correctamente. Puedes probar el pago ahora."**

---

### Paso 4: Verificar que Funciona

1. Ve a tu aplicación: **http://localhost:8080/subscription**
2. Haz clic en **"Seleccionar Plan"** para el plan Profesional
3. Sube un comprobante de prueba con monto $3000
4. Haz clic en **"Confirmar y Activar Plan"**
5. Espera el mensaje de éxito y la recarga automática
6. **Verifica que ahora el plan "Profesional" aparece como "Plan Actual"**

---

## 🎯 ¿Qué hace esta corrección?

Antes, la función solo guardaba el comprobante de pago como "pendiente" y **esperaba que un administrador lo aprobara manualmente**.

Ahora, la función:
1. ✅ Guarda el comprobante de pago (para auditoría)
2. ✅ **Desactiva cualquier plan anterior**
3. ✅ **Activa inmediatamente el nuevo plan por 30 días**

---

## 🆘 Si tienes problemas

Si después de ejecutar el SQL sigues teniendo problemas:

1. Verifica que las tablas `company_subscriptions` y `payment_reports` existen
2. Verifica que tienes permisos de administrador en Supabase
3. Revisa la consola del navegador (F12) para ver si hay errores JavaScript
4. Avísame y te ayudo a diagnosticar el problema

---

**Importante:** Esta corrección da **acceso inmediato** a los usuarios cuando suben su comprobante. El comprobante se guarda como "pending" para que tú puedas verificarlo después en el panel de administración, pero el usuario ya tiene acceso al plan.
