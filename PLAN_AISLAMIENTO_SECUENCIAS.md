# 🔒 Plan Completo: Aislamiento de Secuencias de Facturas por Tienda

## 📋 Resumen

Este plan garantiza que **cada tienda tenga sus propias secuencias de facturas independientes**, evitando que los números de factura se mezclen entre diferentes tiendas.

## ✅ Estado Actual del Sistema

### Ya Implementado:
1. ✅ La tabla `invoice_sequences` tiene columna `store_id`
2. ✅ La función `handle_new_user()` crea automáticamente:
   - Una tienda nueva al registrarse cada usuario
   - Secuencias de facturas para esa tienda (B01, B02, B03, B14, B15, B16)
   - Categorías predeterminadas para esa tienda
3. ✅ La función `get_next_invoice_number()` está diseñada para ser store-aware

### ⚠️ Problemas a Corregir:
1. ❌ Datos existentes pueden tener secuencias sin `store_id` o duplicadas
2. ❌ Falta constraint único compuesto `(invoice_type_id, store_id)`
3. ❌ La columna `store_id` no es obligatoria (NOT NULL)

---

## 🎯 Solución: 3 Componentes

### **1️⃣ Corrección de Datos Existentes** 
📄 Archivo: `fix_sequences_FINAL_COMPLETO.sql`

**Este script realiza:**
1. Crea constraint único `(invoice_type_id, store_id)`
2. Asigna store_id a secuencias huérfanas
3. Elimina duplicados manteniendo el número más alto
4. Crea secuencias faltantes para todas las tiendas
5. Sincroniza con facturas existentes
6. Hace `store_id` obligatorio (NOT NULL)
7. Actualiza la función `get_next_invoice_number()`
8. Configura políticas RLS correctamente
9. Muestra verificación completa

**📌 ACCIÓN REQUERIDA:**
```
1. Ve al SQL Editor de Supabase
2. Copia y pega el contenido de: fix_sequences_FINAL_COMPLETO.sql
3. Ejecuta el script completo
4. Revisa los mensajes ✅ para confirmar que todo funcionó
5. Revisa la tabla de verificación final
```

### **2️⃣ Flujo de Registro Mejorado**
El flujo actual ya funciona correctamente:

```
Usuario se registra
    ↓
Trigger: handle_new_user() ejecuta automáticamente:
    ↓
1. Crea una nueva tienda
    ↓
2. Asigna el usuario como owner de esa tienda
    ↓
3. Crea perfil del usuario vinculado a la tienda
    ↓
4. Inicializa 6 secuencias de facturas (B01-B16) para esa tienda
    ↓
5. Crea categorías predeterminadas para esa tienda
```

**NO SE REQUIERE CAMBIO** - Ya está implementado correctamente.

### **3️⃣ Validación en el Frontend** (Opcional pero Recomendado)

Aunque el backend ya maneja todo, puedes agregar validación adicional en el frontend para mejorar la experiencia del usuario.

---

## 🔐 Cómo Funciona el Aislamiento

### Arquitectura de Datos:

```
Tienda A (store_id: xxx-aaa)
├─ Secuencias:
│  ├─ B01: 00000125 → Próximo: B01-00000126
│  ├─ B02: 00000045 → Próximo: B02-00000046
│  └─ B03: 00000089 → Próximo: B03-00000090
│
└─ Facturas:
   ├─ B01-00000001
   ├─ B01-00000002
   └─ ...hasta B01-00000125

Tienda B (store_id: yyy-bbb)  ← COMPLETAMENTE INDEPENDIENTE
├─ Secuencias:
│  ├─ B01: 00000001 → Próximo: B01-00000002  ← Empieza desde 1
│  ├─ B02: 00000000 → Próximo: B02-00000001
│  └─ B03: 00000000 → Próximo: B03-00000001
│
└─ Facturas:
   └─ B01-00000001  ← NO interfiere con Tienda A
```

### Función de Generación de Números:

```sql
-- Esta función SIEMPRE usa el store_id del usuario actual
get_next_invoice_number('B01')
  ↓
1. Obtiene store_id del usuario autenticado
  ↓
2. Busca la secuencia donde:
   - invoice_type_id = 'B01'
   - store_id = [tienda del usuario]
  ↓
3. Incrementa SOLO esa secuencia
  ↓
4. Retorna: 'B01-00000126'
```

### Constraint Único:

```sql
UNIQUE (invoice_type_id, store_id)
```

Esto GARANTIZA que:
- ✅ Cada tienda puede tener su propia secuencia B01
- ✅ Cada tienda puede tener su propia secuencia B02
- ❌ Una tienda NO puede tener DOS secuencias B01 (error de duplicado)

---

## 📦 Row Level Security (RLS)

Las políticas RLS aseguran que:

```sql
Política: "Users can manage own store sequences"
```

- ✅ Los usuarios SOLO ven las secuencias de SU tienda
- ✅ Los usuarios SOLO pueden modificar las secuencias de SU tienda
- ❌ Los usuarios NO pueden ver ni modificar secuencias de otras tiendas

---

## 🧪 Verificación

### Después de ejecutar el script, verifica:

**1. Consulta las secuencias:**
```sql
SELECT 
    s.store_name,
    iseq.invoice_type_id,
    iseq.current_number,
    iseq.invoice_type_id || '-' || LPAD((iseq.current_number + 1)::text, 8, '0') as next_number
FROM invoice_sequences iseq
JOIN stores s ON s.id = iseq.store_id
ORDER BY s.store_name, iseq.invoice_type_id;
```

**2. Cuenta las secuencias:**
```sql
SELECT 
    store_name,
    COUNT(*) as total_sequences
FROM invoice_sequences iseq
JOIN stores s ON s.id = iseq.store_id
GROUP BY store_name;
```

Cada tienda debe tener exactamente **6 secuencias** (una por cada tipo de NCF).

**3. Verifica el constraint:**
```sql
SELECT conname, contype 
FROM pg_constraint 
WHERE conname = 'invoice_sequences_type_store_unique';
```

Debe retornar una fila indicando que existe.

---

## 🎬 Pasos de Implementación

### Paso 1: Ejecutar Script SQL ⭐
```
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Pega el contenido de: fix_sequences_FINAL_COMPLETO.sql
4. Ejecuta el script
5. Revisa los mensajes ✅ en los resultados
```

### Paso 2: Verificar Resultados
```
1. Revisa la tabla de verificación que aparece al final
2. Confirma que todas las tiendas tienen 6 secuencias
3. Confirma que no hay secuencias huérfanas (sin store_id)
```

### Paso 3: Probar Creación de Facturas
```
1. Login como usuario de Tienda A
2. Crea una factura tipo B01
3. Anota el número generado (ej: B01-00000126)

4. Login como usuario de Tienda B
5. Crea una factura tipo B01  
6. Confirma que empiece desde B01-00000001 (independiente de Tienda A)
```

### Paso 4: Probar Registro de Nuevo Usuario
```
1. Registra un usuario completamente nuevo
2. Verifica que automáticamente:
   - Se cree una tienda nueva
   - Se creen 6 secuencias para esa tienda (todas en 0)
   - Se creen categorías predeterminadas
```

---

## 🚨 Preguntas Frecuentes

### ¿Qué pasa si tengo datos existentes?
El script `fix_sequences_FINAL_COMPLETO.sql` está diseñado para manejar datos existentes:
- Asigna tiendas a secuencias huérfanas
- Sincroniza números con facturas ya emitidas
- No pierde datos

### ¿Puedo ejecutar el script múltiples veces?
Sí, el script es **idempotente** - puedes ejecutarlo múltiples veces sin problemas. Detecta qué ya está hecho y salta esos pasos.

### ¿Qué pasa si un usuario no tiene tienda?
El sistema NO permite esto:
- Al registrarse, se crea automáticamente una tienda
- Si intentas generar factura sin tienda, la función `get_next_invoice_number()` lanzará un error

### ¿Cómo manejar múltiples sucursales?
Cada sucursal debe ser una "tienda" separada en el sistema, con sus propias secuencias independientes.

---

## 📊 Diagrama del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    USUARIO SE REGISTRA                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│        Trigger: handle_new_user() (AUTOMÁTICO)          │
├─────────────────────────────────────────────────────────┤
│  1. Genera código único de tienda                       │
│  2. Crea registro en tabla 'stores'                     │
│  3. Crea perfil vinculado a la tienda                   │
│  4. Crea 6 secuencias (B01-B16) para esa tienda        │
│  5. Crea categorías predeterminadas                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              USUARIO LISTO PARA FACTURAR                │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Usuario crea factura → get_next_invoice_number()      │
├─────────────────────────────────────────────────────────┤
│  1. Obtiene store_id del usuario                        │
│  2. Busca secuencia [tipo + store_id]                   │
│  3. Incrementa SOLO esa secuencia                       │
│  4. Retorna número formateado: B01-00000001             │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Resultado Final

Después de implementar esta solución:

✅ Cada tienda tiene secuencias completamente independientes
✅ No hay interferencia entre tiendas
✅ Los números de factura inician desde 1 para cada tienda nueva
✅ El sistema previene duplicados con constraints
✅ RLS protege el acceso a las secuencias
✅ El registro de usuarios es automático y sin errores

---

## 📞 Soporte

Si encuentras algún problema durante la implementación:

1. **Revisa los mensajes de NOTICE** del script SQL
2. **Ejecuta las consultas de verificación** incluidas en este documento
3. **Busca errores** en los logs de Supabase
4. **Verifica que no haya políticas RLS** bloqueando el acceso

---

**Autor:** Sistema de Gestión Cobro  
**Fecha:** 2026-01-13  
**Versión:** 1.0 - Aislamiento Completo de Secuencias
