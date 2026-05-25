# Solución: Aislamiento de Secuencias de Facturas por Tienda

## 📋 Resumen del Problema

Actualmente, todas las tiendas comparten la misma secuencia de números de factura para cada tipo de comprobante (B01, B02, etc.). Esto significa que si:
- Tienda A crea factura B02-00000001
- Tienda B crea factura B02-00000002

Cuando lo correcto debería ser que cada tienda tenga su propia numeración:
- Tienda A: B02-00000001, B02-00000002, B02-00000003...
- Tienda B: B02-00000001, B02-00000002, B02-00000003...

## ✅ Estado Actual

La migración `20260110041000_isolate_sequences_and_categories.sql` **YA ESTÁ APLICADA** en tu base de datos de producción. Esto significa que:

1. ✅ La tabla `invoice_sequences` ya tiene la columna `store_id`
2. ✅ La función `get_next_invoice_number` ya filtra por tienda
3. ✅ Las policies RLS están configuradas correctamente

## 🔧 Pasos para Completar la Corrección

### Opción 1: Ejecutar Script SQL Completo (RECOMENDADO)

1. **Abre el Dashboard de Supabase**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto: `hkzgxdmnvyoviwketxva`

2. **Ve al SQL Editor**
   - En el menú lateral, click en "SQL Editor"

3. **Ejecuta el script de verificación y corrección**
   - Abre el archivo: `verify_and_fix_sequences.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor
   - Click en "RUN" o presiona Cmd+Enter

Este script hará:
- ✅ Mostrar el estado actual de las secuencias
- ✅ Asignar `store_id` a secuencias huérfanas (si existen)
- ✅ Crear secuencias faltantes para todas las tiendas
- ✅ Sincronizar los números con las facturas ya emitidas
- ✅ Verificar que todo esté correcto

### Opción 2: Ejecutar Solo la Corrección Básica

Si prefieres un script más simple, ejecuta el archivo `fix_invoice_sequences_by_store.sql` siguiendo los mismos pasos.

## 🧪 Verificación

### Desde la Consola del Navegador

1. Abre la aplicación en tu navegador
2. Abre las DevTools (F12 o Cmd+Option+I)
3. Ve a la pestaña "Console"
4. Ejecuta este código:

```javascript
// Copiar y pegar en la consola
const verifySequences = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user.id)
    .single();

  const { data: sequences } = await supabase
    .from('invoice_sequences')
    .select('*')
    .eq('store_id', profile.store_id);

  console.table(sequences);
};

verifySequences();
```

Deberías ver todas las secuencias de TU tienda específicamente.

### Prueba Real

1. **Crea una venta de prueba** en tu tienda
2. **Verifica el número de factura** generado
3. **Si tienes acceso a otra tienda**, crea otra venta y verifica que el número empiece desde 00000001 para esa tienda

## 📊 ¿Qué Cambió en el Código?

### Antes (Compartido)
```sql
-- Incrementaba para TODAS las tiendas
UPDATE invoice_sequences 
SET current_number = current_number + 1
WHERE invoice_type_id = 'B01'
```

### Ahora (Aislado)
```sql
-- Incrementa SOLO para la tienda del usuario
UPDATE invoice_sequences 
SET current_number = current_number + 1
WHERE invoice_type_id = 'B01' 
  AND store_id = user_store_id  -- ← FILTRO POR TIENDA
```

## 🚨 Puntos Importantes

1. **Datos Existentes**: Las facturas ya emitidas NO cambiarán. El script sincronizará las secuencias con el número más alto ya usado.

2. **Nuevas Tiendas**: Cuando se cree una nueva tienda, automáticamente recibirá sus propias secuencias empezando desde 0.

3. **Función RPC**: La función `get_next_invoice_number` automáticamente detecta la tienda del usuario autenticado, no necesitas cambiar código en el frontend.

## 📁 Archivos Creados

1. **fix_invoice_sequences_by_store.sql**: Script de corrección completo
2. **verify_and_fix_sequences.sql**: Script de verificación y corrección con diagnóstico detallado
3. **src/utils/verifySequences.ts**: Herramienta de diagnóstico desde TypeScript

## 🆘 Resolución de Problemas

### Si después de ejecutar el script sigues viendo números compartidos:

1. **Verifica que el script se ejecutó sin errores**
   - El SQL Editor te mostrará mensajes como "✅ Migración completada"

2. **Limpia el caché de la aplicación**
   - Recarga la página con Cmd+Shift+R (o Ctrl+Shift+R)

3. **Verifica la columna store_id en invoice_sequences**
   ```sql
   SELECT * FROM invoice_sequences;
   ```
   Todas las filas deben tener un `store_id` (no NULL)

4. **Verifica que las policies RLS están activas**
   ```sql
   SELECT tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'invoice_sequences';
   ```

### Si necesitas resetear las secuencias de una tienda:

```sql
-- Resetear secuencias de una tienda específica
UPDATE invoice_sequences
SET current_number = 0
WHERE store_id = 'ID_DE_TU_TIENDA';
```

## ✨ Resultado Esperado

Después de aplicar la corrección:

- ✅ Cada tienda tiene sus propias secuencias independientes
- ✅ Tienda A: B01-00000001, B01-00000002, B01-00000003...
- ✅ Tienda B: B01-00000001, B01-00000002, B01-00000003...
- ✅ No hay conflictos ni números duplicados
- ✅ Las secuencias están sincronizadas con las facturas existentes

## 📞 Próximos Pasos

1. [ ] Ejecutar `verify_and_fix_sequences.sql` en Supabase Dashboard
2. [ ] Verificar que no hay errores en la ejecución
3. [ ] Crear una venta de prueba
4. [ ] Confirmar que el número de factura es correcto
5. [ ] Si tienes múltiples tiendas, verificar que cada una tiene su propia secuencia

---

**Nota**: Si encuentras algún problema después de ejecutar estos scripts, por favor comparte el mensaje de error completo para poder ayudarte mejor.
