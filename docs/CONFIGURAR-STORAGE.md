# 🔧 GUÍA: Configurar Storage de Imágenes de Productos

## ❌ Problema
Las imágenes de productos no cargan y muestran el error:
```
Error: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

Esto significa que el bucket `product-images` **NO existe** o **NO está público**.

---

## ✅ SOLUCIÓN PASO A PASO

### Opción 1: Script SQL Automático (RECOMENDADO) ⚡

1. **Abre Supabase Dashboard**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Abre SQL Editor**
   - Menú lateral → **SQL Editor**
   - Click en **New query**

3. **Copia y pega el script**
   - Abre el archivo: `supabase/storage-setup.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor

4. **Ejecuta el script**
   - Click en **Run** (botón verde)
   - Deberías ver: `Success. No rows returned`

5. **Verifica que funcionó**
   - Al final del script verás una verificación
   - Debe mostrar: `product-images | product-images | true`

---

### Opción 2: Configuración Manual 🛠️

#### Paso 1: Crear el Bucket

1. **Supabase Dashboard** → **Storage** (ícono de carpeta 📁)
2. Click en **New bucket**
3. Datos:
   - **Name**: `product-images`
   - ✅ **Public bucket**: ACTIVAR (muy importante!)
4. Click en **Create bucket**

#### Paso 2: Configurar Políticas (RLS)

1. En el bucket `product-images`, click en **Policies**
2. Click en **New policy**

**Política 1: Lectura Pública** (CRÍTICA)
```sql
Policy name: Public Access
Target roles: public
Allowed operation: SELECT
WITH CHECK expression: bucket_id = 'product-images'
```

**Política 2: Subir Imágenes (Usuarios Autenticados)**
```sql
Policy name: Authenticated Upload
Target roles: authenticated
Allowed operation: INSERT
WITH CHECK expression: bucket_id = 'product-images'
```

**Política 3: Actualizar Imágenes**
```sql
Policy name: Authenticated Update
Target roles: authenticated
Allowed operation: UPDATE
WITH CHECK expression: bucket_id = 'product-images'
```

**Política 4: Eliminar Imágenes**
```sql
Policy name: Authenticated Delete
Target roles: authenticated
Allowed operation: DELETE
WITH CHECK expression: bucket_id = 'product-images'
```

---

## 🧪 VERIFICAR QUE FUNCIONÓ

### 1. En Supabase Dashboard

**Storage** → **product-images**:
- ✅ Debe aparecer el bucket
- ✅ **Public**: `true` (icono de ojo 👁️)
- ✅ **Policies**: 4 políticas activas

### 2. En la App

1. **Recarga la página** (F5)
2. **Ve a Productos** → **Editar producto**
3. **Intenta subir una imagen**

Deberías ver:
- ✅ **Si el bucket NO existe**: `"Storage no configurado"`
- ✅ **Si todo está bien**: `"Imagen subida correctamente"`

### 3. En la Consola (F12)

Al subir una imagen deberías ver:
```
✅ Imagen subida, URL pública: https://...supabase.co/storage/v1/object/public/product-images/...
```

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### Error: "Storage no configurado"
**Causa**: El bucket no existe
**Solución**: Ejecuta el script SQL o crea el bucket manualmente

### Error: "No tienes permisos"
**Causa**: Las políticas RLS no están configuradas
**Solución**: Crea las 4 políticas descritas arriba

### Error: 403 Forbidden
**Causa**: El bucket no es público
**Solución**: 
1. Storage → product-images → Settings
2. **Make public** ✅

### Las imágenes se suben pero no se ven
**Causa**: Política de lectura pública falta
**Solución**: Asegúrate de tener la política "Public Access" para SELECT

---

## 📝 NOTAS IMPORTANTES

1. **¿Por qué público?**
   - Las imágenes deben ser visibles para todos (clientes viendo la tienda)
   - Solo lectura es pública, subir/editar/eliminar requiere autenticación

2. **Seguridad**
   - Solo usuarios autenticados pueden subir imágenes
   - No hay riesgo con bucket público (es solo lectura)

3. **URLs**
   - Formato: `https://[project].supabase.co/storage/v1/object/public/product-images/[filename]`
   - Son permanentes, no expiran

4. **Tamaño límite**
   - La app valida máximo 5MB por imagen
   - Puedes ajustar en `ProductImageUpload.tsx`

---

## ✅ CHECKLIST FINAL

Antes de cerrar este issue, verifica:

- [ ] Bucket `product-images` existe
- [ ] Bucket está marcado como **público** ✅
- [ ] Política "Public Access" (SELECT) existe
- [ ] Política "Authenticated Upload" (INSERT) existe
- [ ] Política "Authenticated Update" (UPDATE) existe
- [ ] Política "Authenticated Delete" (DELETE) existe
- [ ] Puedes subir una imagen desde la app
- [ ] La imagen se muestra correctamente (no "Error al cargar")
- [ ] En consola aparece: `✅ Imagen cargada correctamente`

---

## 🎉 ¡LISTO!

Después de configurar todo, las imágenes deberían funcionar perfectamente.

Si sigues teniendo problemas, revisa la consola del navegador (F12) y busca errores específicos.
