# Solución para Checkboxes de Productos

## ❌ Problema Identificado

Los checkboxes **"Mostrar en Mi Tienda (Visible al público)"** y **"Controlar inventario (stock)"** no funcionaban porque los campos `is_visible_in_store` y `track_inventory` **NO EXISTEN** en la tabla `products` de la base de datos.

Aunque el código frontend intentaba guardar estos valores, se estaban ignorando silenciosamente.

## ✅ Solución: Agregar Columnas a la Base de Datos

### Paso 1: Ejecutar Migración SQL en Supabase

1. Ve a tu proyecto en **Supabase Dashboard**: https://app.supabase.com
2. Ve a la sección **SQL Editor** (en el menú lateral izquierdo)
3. Copia y pega el contenido del archivo `database-migration-add-product-fields.sql`
4. Haz clic en **Run** para ejecutar la migración

El script SQL agregará dos nuevas columnas a la tabla `products`:
- `is_visible_in_store` (BOOLEAN) - Control de visibilidad en la tienda pública
- `track_inventory` (BOOLEAN) - Control de tracking de inventario

### Paso 2: Actualizar el código en GitHub

Los cambios en el código TypeScript ya están listos. Solo necesitas ejecutar:

```bash
git add .
git commit -m "Agregar soporte para is_visible_in_store y track_inventory en tipos de Supabase"
git push origin main
```

### Paso 3: Reiniciar la aplicación

Después de ejecutar la migración SQL y actualizar el código, reinicia tu aplicación para que reconozca los nuevos campos.

## 📋 Qué hace la migración

1. **Agrega `is_visible_in_store`**:
   - Default: `TRUE` (todos los productos existentes serán visibles por defecto)
   - Permite ocultar productos específicos de la tienda pública

2. **Agrega `track_inventory`**:
   - Default: `NULL` inicialmente
   - Se actualiza automáticamente a `TRUE` para productos con stock definido
   - Se actualiza a `FALSE` para productos sin información de stock
   - Ideal para servicios o productos digitales que no requieren control de inventario

## ✨ Después de la migración

Una vez completada la migración:

✅ El checkbox "Mostrar en Mi Tienda" funcionará correctamente
✅ El checkbox "Controlar inventario (stock)" funcionará correctamente
✅ Los productos configurados para NO controlar inventario:
   - No mostrarán alertas de "stock bajo"
   - No requerirán valores de stock/min_stock
   - Ideales para servicios y productos digitales

✅ Los productos configurados como NO visibles:
   - No aparecerán en la tienda pública
   - Seguirán disponibles en el POS

## 🔍 Verificación

Para verificar que todo funciona:

1. Edita un producto existente
2. Desmarca "Controlar inventario (stock)"
3. Guarda el producto
4. Verifica que NO aparezca el mensaje de "stock bajo"
5. Desmarca "Mostrar en Mi Tienda"
6. Guarda y verifica que el producto NO aparezca en tu tienda pública

---

**Fecha:** 2026-02-10
**Archivos modificados:**
- `database-migration-add-product-fields.sql` (nuevo)
- `src/integrations/supabase/types.ts` (actualizado)
