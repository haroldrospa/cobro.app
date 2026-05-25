# 📅 ACTUALIZACIÓN: FECHAS EN OFERTAS

Has solicitado agregar **fechas de expiración** a las ofertas y un **botón para ver ofertas activas**.

---

## ⚠️ PASO OBLIGATORIO: MIGRACIÓN SQL

Para que las fechas funcionen, debes ejecutar este nuevo script SQL.

1. **Ve a Supabase SQL Editor**: https://supabase.com/dashboard
2. **Copia y Pega** el contenido de: `/supabase/migrations/add_expiration_dates.sql`
3. **Ejecuta (Run)**

Si no haces esto, al intentar guardar una oferta con fecha, podrías recibir un error.

---

## 🚀 NUEVAS FUNCIONALIDADES

### 1. Botón "Ofertas" en Productos
En la página de gestión de productos, ahora verás un botón **"Ofertas"** (icono de etiqueta) en la parte superior derecha.
- Al hacer clic, se abre un **panel lateral** con TODAS las ofertas activas de tu tienda.
- Puedes ver rápidamente qué productos tienen oferta y cuándo expiran.

### 2. Fechas de Expiración
Al crear una oferta en un producto:
- Ahora verás un campo **"Fecha de Expiración (Opcional)"**.
- Si seleccionas una fecha, la oferta dejará de aplicarse automáticamente después de ese día.
- Si lo dejas vacío, la oferta será permanente.

### 3. Visualización
- Las ofertas próximas a vencer (menos de 3 días) se marcarán en **color ámbar**.
- Las ofertas activas se muestran en **verde**.

---

## 📋 CHECKLIST

- [ ] Ejecutar `/supabase/migrations/create_product_offers_table.sql` (si no lo hiciste antes)
- [ ] Ejecutar `/supabase/migrations/add_expiration_dates.sql` (NUEVO)
- [ ] Probar crear una oferta con fecha de expiración
- [ ] Probar el botón "Ofertas" en la lista de productos

¡Todo listo! 🚀
