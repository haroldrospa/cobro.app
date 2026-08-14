# Resumen de Cambios Recientes

## 1. Soporte Multi-Formato de Papel Dinámico en POS y Facturas (`generateCleanInvoiceHTML.ts`, `PrintOptionsDialog.tsx`, `InvoicePreviewDialog.tsx`, `Settings.tsx`)
- **Impresoras Térmicas (`80mm` y `58mm`):** Formato continuo compacto optimizado para rollos de papel térmico pequeño (`58mm`) o estándar (`80mm`).
- **Formato Página Completa (`A4` y `Carta`):** Layout elegante de 2 columnas con encabezado institucional, cuadro de datos del cliente, tabla estructurada a todo el ancho con encabezados oscuros, desglose detallado de ITBIS/Subtotal/Total, líneas de firma de conformidad para ventas a crédito y pie de página fiscal autorizado.
- **Sincronización Total con Configuración:** El formato seleccionado en el menú *Configuración ➔ Tamaño de Papel* se aplica automáticamente al cobrar en el POS, en vistas previas y en impresiones.

---

## 📑 Verificación
- **TypeScript Check:** `npx tsc --noEmit` completado exitosamente con **0 errores**.
- **Build de Producción:** `npm run build` generado exitosamente.
- **Git Push:** Subido a GitHub (`main -> main`).
