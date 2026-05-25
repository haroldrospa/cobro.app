# 🚨 SOLUCIÓN AL ERROR: "column currency does not exist"

## 📋 Resumen del Problema

Cuando intentas activar el plan, aparece este error:
```
Error al activar
column "currency" of relation "payment_reports" does not exist
```

**Causa:** La tabla `payment_reports` en tu base de datos no tiene la columna `currency`.

---

## ✅ SOLUCIÓN RÁPIDA (3 minutos)

### Paso 1: Ir a Supabase
1. Abre: https://supabase.com/dashboard
2. Haz clic en tu proyecto
3. En el menú lateral, haz clic en **"SQL Editor"**
4. Haz clic en **"New query"**

### Paso 2: Copiar y Ejecutar este SQL

Copia TODO este código y pégalo en el editor de Supabase:

```sql
-- Agregar la columna currency que falta
ALTER TABLE public.payment_reports 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

-- Verificar que se agregó
SELECT '✅ Columna currency agregada correctamente' as resultado;
```

### Paso 3: Ejecutar
1. Haz clic en el botón **"RUN"** (verde, abajo a la derecha)
2. Deberías ver: "✅ Columna currency agregada correctamente"

### Paso 4: Probar de nuevo
1. Ve a http://localhost:8080/subscription
2. Intenta activar el plan Profesional de nuevo
3. **Ahora debería funcionar sin errores** ✅

---

## 🔧 INSTALACIÓN COMPLETA (Recomendado)

Si prefieres correr un script completo que verifique TODA la estructura, usa este:

**Archivo:** `5_INSTALACION_COMPLETA_SUSCRIPCIONES.sql`

Este script:
- ✅ Crea las tablas si no existen
- ✅ Agrega la columna `currency` si falta
- ✅ Crea todas las políticas de seguridad
- ✅ Actualiza la función de activación
- ✅ Crea el bucket de storage
- ✅ Configura los permisos

**Cómo usarlo:**
1. Abre el archivo `5_INSTALACION_COMPLETA_SUSCRIPCIONES.sql`
2. Copia TODO el contenido
3. Pégalo en Supabase SQL Editor
4. Haz clic en RUN

---

## 🐛 Debugging

Si después de ejecutar el SQL sigues viendo errores, abre la **Consola del Navegador** (F12) y busca mensajes que empiecen con 🔍 o ❌.

Luego muéstrame los errores para ayudarte a diagnosticar.

---

## ✨ ¿Por qué pasó esto?

El archivo `2_SOLUCION_PAGOS.sql` que usaste originalmente SÍ tenía la columna `currency` definida, pero probablemente:
1. No se ejecutó completamente en Supabase, O
2. La tabla ya existía sin esa columna y el script no la actualizó

El nuevo script que creé (`5_INSTALACION_COMPLETA_SUSCRIPCIONES.sql`) resuelve este problema porque:
- Usa `IF NOT EXISTS` para verificar si la columna existe antes de agregarla
- Es idempotente (lo puedes ejecutar múltiples veces sin problemas)
