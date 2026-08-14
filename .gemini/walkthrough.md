# Resumen de Cambios Recientes

## 1. Visualización del RNC del Cliente en Facturas
- **Plantilla de Factura Térmica e Impresión HTML (`generateCleanInvoiceHTML.ts`):** Se agregó la etiqueta `RNC CLIENTE:` justo debajo del nombre del cliente para mostrar su número de RNC o Cédula en los tiques e impresiones de factura.
- **Modal de Opciones de Impresión (`PrintOptionsDialog.tsx`):** Se incluyó la visualización de `RNC/CÉDULA:` en las plantillas de comprobantes y vistas previas.

## 2. Corrección de Búsqueda y Filtros de Facturas / NCF (`useSalesManagement.ts`)
- **Detección Ampliada de NCF:** Ahora reconoce búsquedas por comprobantes fiscales NCF (`B14`, `B01`, `B02`, `B15`, `B16`), comprobantes electrónicos e-NCF (`E31`, `E32`, `E44`, `E45`), referencias `INV` y números de secuencia directa (ej. `00000046` o `B14-00000046`).
- **Búsqueda Multi-Variación Inteligente:** La consulta genera automáticamente comparaciones flexibles (`B14-00000046`, `B1400000046`, `B14%00000046` y por dígitos numéricos) además de incluir resultados coincidentes por Nombre, RNC o Teléfono del cliente.
- **Bypass de Rango de Fechas en Búsqueda Especifica:** Al buscar un NCF específico (como `B14-00000046`), el sistema ignora la restricción del filtro por rango de fechas del mes para consultar todo el historial de la base de datos.
- **Resolución de `invoiceTypeId` (UUID vs Código):** Al filtrar por tipos de factura como `B14` o `B01`, se mapea dinámicamente el código al UUID de la tabla `invoice_types` para evitar discrepancias de tipos.
- **Integración con `useUserStore`:** Se vinculó el hook `useUserStore()` para asegurar que las ventas pertenezcan a la tienda activa seleccionada en el sistema.

## 3. Ocultación del Aviso "Tamaño de papel"
- **Modal de Post-Venta (`PrintOptionsDialog.tsx`):** Se eliminó el recuadro informativo *"Tamaño de papel: 80mm - Para cambiar, ve a Settings -> Impresión"*.

## 4. Eliminación de Impresión con RawBT
- **Modal de Post-Venta (`PrintOptionsDialog.tsx`):** Se removió la tarjeta y la función de impresión con RawBT.
- **Selección de Impresoras (`PrinterSelectionDialog.tsx`):** Se eliminó la opción de RawBT del listado de impresoras.
- **Ajustes (`Settings.tsx`):** Se retiró el botón de prueba de RawBT.

---

## 📑 Verificación
- **TypeScript Check:** `npx tsc --noEmit` completado exitosamente con **0 errores**.
- **Build de Producción:** `npm run build` generado exitosamente.
- **Servidor Dev Activo:** Listo en [http://localhost:8080/](http://localhost:8080/).
- **Regla Git Push:** No se han subido cambios a GitHub (cumpliendo la indicación expresa del usuario).
