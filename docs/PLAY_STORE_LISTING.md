# Ficha de Play Store — Cobro POS

Contenido listo para copiar/pegar en Play Console al crear la ficha de la
app. `applicationId`: `com.cobro.app`.

## Nombre de la app

**Cobro POS**

## Descripción corta (máx. 80 caracteres)

```
Sistema POS: ventas, inventario, clientes y facturación. Funciona sin internet
```

(78 caracteres)

## Descripción completa

```
Cobro POS es un sistema de Punto de Venta (POS) completo, pensado para
pequeños y medianos negocios: colmados, farmacias, restaurantes, tiendas de
ropa y cualquier negocio que necesite cobrar rápido y llevar su inventario al
día — incluso sin conexión a internet.

🛒 PUNTO DE VENTA
• Cobra en segundos: busca productos, escanea códigos de barra con la cámara
  o con un lector físico, aplica descuentos y calcula el cambio automático.
• Acepta efectivo, tarjeta, transferencia y ventas a crédito.
• Imprime tickets en impresoras térmicas Bluetooth (58mm, 80mm) o factura en
  A4/Carta.

📦 INVENTARIO
• Control de stock con alertas de productos por agotarse.
• Categorías, proveedores e importación masiva desde Excel.
• Historial completo de movimientos de inventario.

👥 CLIENTES Y CRÉDITO
• Ficha de cliente con historial de compras.
• Ventas a crédito con estado de cuenta y pagos parciales.
• Sistema de puntos de lealtad.

🧾 FACTURACIÓN FISCAL (NCF)
• Soporte para comprobantes fiscales de República Dominicana.

📊 REPORTES
• Ventas diarias, semanales y mensuales.
• Productos más vendidos y análisis de inventario.
• Exportación a PDF y Excel, con gráficos interactivos.

🔌 FUNCIONA SIN INTERNET
El modo offline permite seguir cobrando aunque se caiga la conexión; todo se
sincroniza automáticamente al reconectar.

🔐 MULTI-TIENDA
Administra varias tiendas y usuarios con roles y permisos, todo desde una
sola cuenta.

Cobro POS también está disponible en cobroapp.app para usarlo desde
computadoras y como app web instalable (PWA).
```

## Categoría sugerida

**Negocios** (Business)

## Gráficos requeridos por Play Console

- Icono de app 512×512: usar `build-assets/icons/app-icon.png` (verificar que
  cumpla el tamaño exacto exigido; si no, exportarlo a 512×512 sin
  transparencia).
- Feature graphic 1024×500: **pendiente de crear**, no existe todavía en el
  repo.
- Al menos 2 capturas de pantalla de teléfono (recomendado 4–8): **pendiente
  de tomar** — se pueden generar corriendo la app (`npm run dev` o el APK) y
  capturando el POS, el listado de productos, un reporte y el checkout.

## Enlaces legales (ya están publicados y en producción)

- Política de Privacidad: `https://cobroapp.app/privacidad`
- Términos y Condiciones: `https://cobroapp.app/terminos`
- Política de Reembolsos: `https://cobroapp.app/reembolsos`

## Acceso para la revisión de Google (App access)

Play Console va a pedir explicar cómo iniciar sesión en la app. Como el login
es obligatorio (Supabase Auth), hay que **crear una cuenta/tienda de
demostración** con datos de ejemplo y dejar usuario + contraseña en el
formulario de "App access" para que el equipo de revisión pueda entrar y
probar el flujo de cobro. Sin esto, es muy probable que rechacen la app en
revisión.

## Cuestionario de seguridad de datos (Data safety)

Antes de publicar, Play Console pide declarar qué datos recolecta la app.
Según lo que maneja el sistema (vía Supabase), como mínimo hay que declarar:

- Información personal: nombre, teléfono, correo (clientes y usuarios).
- Información financiera: historial de compras/transacciones, créditos.
- Ubicación (si se usa la función de GPS para shoppers/repartidores —
  ver `11_CEDULA_GPS_SHOPPERS.sql`).

Confirma en el propio formulario de Play Console si cada dato se comparte con
terceros, si es opcional, y si los usuarios pueden pedir que se borre — todo
eso solo lo puedes responder tú desde la consola.

## Tipo de cuenta: Personal vs. Organización

Al registrarte en Play Console eligiendo **Organización** piden un número
**D-U-N-S** (identificador de negocio de Dun & Bradstreet) — gratis pero
puede tardar días/semanas en asignarse.

Si el registro es a tu nombre (no a nombre de una empresa constituida), usa
**Personal** en su lugar: no pide D-U-N-S, solo verificación de identidad
(cédula/pasaporte). El nombre público que ven los usuarios en la ficha
("Developer name") se configura aparte y no tiene que ser tu nombre legal.

Contrapartida de elegir Personal: si la cuenta se creó a partir del 13 de
noviembre de 2023 (aplica a cualquier cuenta nueva), Google exige completar
una prueba cerrada (*closed testing*) con **al menos 12 testers** que
acepten la invitación y mantengan la app instalada de forma continua
durante **14 días** antes de poder pasar la app a producción/público. Desde
2026 Google también verifica que esos testers realmente usen la app, no
solo que la instalen. Las cuentas de Organización están exentas de este
requisito.

Con un negocio pequeño/solo, conviene arrancar **ya** con la cuenta
Personal y la prueba cerrada de 12 testers — ese es el paso que más tiempo
de calendario consume (14 días mínimo), y corre en paralelo mientras se
resuelve todo lo demás de esta lista (capturas, cuenta demo, cuestionario
de datos).
