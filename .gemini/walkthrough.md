# Resumen de Cambios Recientes

## 1. Control de Versiones (GitHub Sync)
- **Commit y Push a `main`:** Todos los cambios recientes han sido confirmados y subidos exitosamente a la rama `main` en GitHub (`haroldrospa/cobro.app`).

## 2. Rediseño y Reorganización de la Tabla de Tiendas en Panel Maestro (`SuperAdmin.tsx`)
- **6 Columnas Estructuradas:** Separación clara con encabezados definidos (Nombre Tienda, Dueño Email, Plan, Vence, Cambiar Plan / Renovar, Estado).

## 3. Banner de Vencimiento a 5 Días y Flujo Adhesivo (`Layout.tsx` & `SubscriptionWarningBanner.tsx`)
- **Aviso Adosado sin Solapamientos:** Colocado en la cabecera adhesiva (`sticky top-0`) directamente debajo de la barra del menú, con botón de descarte (`X`) e inicio dinámico del contenido del sistema sin tapar nada.

## 4. Corrección de Pasarela de Pago (`UserSubscription.tsx`)
- **Cálculo de Monto Seguro (`displayAmount`):** Eliminación completa del error `RD$NaN`.
- **Manejo de Errores Paddle:** Captura de eventos y orientación para configuración de dominios/URL por defecto en el Dashboard de Paddle.

---

## 📑 Verificación
- **TypeScript Check:** `npx tsc --noEmit` completado exitosamente con **0 errores**.
- **Build de Producción:** `npm run build` generado exitosamente.
- **Git Push:** Subido a GitHub (`main -> main`).
