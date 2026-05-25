# 🎁 SISTEMA DE OFERTAS POR CANTIDAD

## 📋 Qué es esto?

Sistema completo para crear ofertas tipo "2x150" donde al comprar 2 unidades de un producto que normalmente cuesta 100 cada uno (total 200), se aplica automáticamente un precio especial de 150.

---

## 🚀 INSTALACIÓN (1 paso)

### Ejecutar la migración SQL

1. **Abre Supabase Dashboard**: https://supabase.com/dashboard
2. **SQL Editor** (menú lateral)
3. **New query**
4. **Copia y pega** el contenido de `/supabase/migrations/create_product_offers_table.sql`
5. **Run** (botón verde)

Deberías ver: `Success. No rows returned`

✅ ¡Listo! La tabla `product_offers` está creada.

---

## 📝 CÓMO USAR

### 1. **Crear Ofertas en Productos**

1. Ve a **Productos** → **Editar producto**
2. Baja hasta la sección **"Ofertas por Cantidad"**
3. Ingresa:
   - **Cantidad Mínima**: Ej: `2` (para 2x150)
   - **Precio Total**: Ej: `150` (en lugar de 200)
4. Click en **"Agregar Oferta"**

**Vista previa:**
```
2x $100.00 = $200.00
Con oferta: $150.00 (ahorro: $50.00)
```

### Ejemplo Real: Pinchos de Pollo

**Producto:** Pincho de Pollo
- **Precio unitario:** $100
- **Oferta:** 2 unidades por $150

**En el formulario:**
- Cantidad Mínima: `2`
- Precio Total: `150.00`

✅ Ahora cuando alguien agregue 2 pinchos en el POS, pagará $150 en lugar de $200.

---

### 2. **Múltiples Ofertas**

Puedes crear varias ofertas para el mismo producto:

**Ejemplo:**
- 2 unidades → $150 (ahorro 25%)
- 3 unidades → $210 (ahorro 30%)
- 5 unidades → $325 (ahorro 35%)

El sistema **siempre aplicará la mejor oferta** automáticamente.

---

## 🛒 CÓMO FUNCIONA EN EL POS

### Aplicación Automática

El POS detecta automáticamente cuando se cumple una oferta:

**Ejemplo:**

Cliente agrega al carrito:
```
1 Pincho de Pollo → $100.00 (sin oferta)
```

Cliente agrega otro:
```
2 Pinchos de Pollo → $150.00 ✨ (¡Oferta aplicada!)
```

### Combinaciones Inteligentes

Si un cliente compra **5 pinchos** y tienes estas ofertas:
- 2x$150
- 3x$210

El sistema calculará:
- **Opción A**: 2 paquetes de 2 (4 pinchos por $300) + 1 suelto ($100) = **$400**
- **Opción B**: 1 paquete de 3 pr $210 + 1 paquete de 2 ($150) = **$360** ✅ MEJOR

El sistema **siempre elige la opción más económica** para el cliente.

---

## ✨ CARACTERÍSTICAS

### Para el Administrador

✅ Crear múltiples ofertas por producto
✅ Editar/eliminar ofertas fácilmente
✅ Vista previa de ahorros antes de crear
✅ Validación automática (evita ofertas sin descuento)
✅ Advertencias si el precio de oferta es mayor al normal

### Para el Cliente (en POS)

✅ Aplicación **100% automática**
✅ Cálculo de mejor oferta
✅ Indicador visual cuando hay oferta activa
✅ Ahorro mostrado claramente

---

## 🔧 ESTRUCTURA DE DATOS

### Tabla: `product_offers`

```sql
{
  id: UUID,
  product_id: UUID,           -- Producto al que pertenece
  store_id: UUID,             -- Tienda
  quantity: INTEGER,          -- Cantidad mínima (2, 3, 5, etc.)
  offer_price: DECIMAL,       -- Precio total por esa cantidad
  is_active: BOOLEAN,         -- Activa/Inactiva
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Ejemplo de Datos

```json
{
  "product_id": "abc-123",
  "quantity": 2,
  "offer_price": 150.00,
  "is_active": true
}
```

Significa: "2 unidades de este producto cuestan $150 en total"

---

## 📊 CASOS DE USO

### Restaurante

**Pinchos de Pollo** ($100 c/u):
- 2x $150 (ahorro $50)
- 3x $210 (ahorro $90)

**Refrescos** ($50 c/u):
- 3x $120 (ahorro $30)
- 6x $220 (ahorro $80)

### Tienda de Ropa

**Camisetas** ($500 c/u):
- 2x $900 (ahorro $100)
- 3x $1,200 (ahorro $300)

### Farmacia

**Medicamento X** ($200 c/u):
- 2x $350 (ahorro $50)
- 3x $480 (ahorro $120)

---

## 🎯 VENTAJAS

1. **Incrementa las ventas**: Los clientes compran más para aprovechar ofertas
2. **Automático**: No necesitas entrenar al personal, se aplica solo
3. **Flexible**: Puedes crear/modificar ofertas en cualquier momento
4. **Sin errores**: El sistema siempre calcula el mejor precio
5. **Transparente**: El cliente ve claramente cuánto ahorra

---

## ❓ PREGUNTAS FRECUENTES

### ¿Puedo tener varias ofertas activas en un mismo producto?
✅ Sí, el sistema aplicará automáticamente la mejor.

### ¿Qué pasa si el cliente compra 4 unidades y tengo oferta de 2x150?
El sistema aplicará 2 paquetes de la oferta: 2×$150 = $300 total.

### ¿Puedo desactivar una oferta temporalmente sin borrarla?
Sí, puedes marcarla como inactiva (próxima feature).

### ¿Las ofertas se aplican en productos con precio variable?
No, los productos con precio variable no soportan ofertas automáticas.

### ¿Puedo crear ofertas en lote para varios productos?
Por ahora debes crearlas producto por producto (feature futura).

---

## 🧪 PRUEBAS

### Para verificar que funciona:

1. **Crea un producto de prueba**:
   - Nombre: "Producto Test"
   - Precio: $100

2. **Agrega una oferta**:
   - Cantidad: 2
   - Precio: $150

3. **Ve al POS**:
   - Agrega 1 unidad → Debe mostrar $100
   - Agrega otra (total 2) → Debe mostrar $150 total

4. **Verifica el ahorro**:
   - Sin oferta: 2×$100 = $200
   - Con oferta: $150
   - **Ahorro: $50** ✅

---

## 📞 SOPORTE

Si tienes problemas:

1. Verifica que ejecutaste la migración SQL
2. Revisa la consola del navegador (F12) por errores
3. Asegúrate de que la oferta esté activa
4. Verifica que el precio de la oferta sea menor al precio normal

---

## 🎉 ¡Listo para Vender Más!

Ahora puedes crear ofertas atractivas que se aplican automáticamente y aumentan tus ventas. 🚀
