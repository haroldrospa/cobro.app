# Ficha de App Store — Cobro POS

Contenido listo para copiar/pegar en App Store Connect al crear la ficha de
la app. Bundle ID: `com.cobro.app` (mismo `applicationId` que Android).

> ⚠️ **Diferencia importante con la versión de Android**: el escáner de
> códigos de barra por cámara y la impresión térmica por Bluetooth están
> implementados como plugins nativos **solo en Kotlin/Android**
> (`android/app/src/main/java/com/cobro/app/plugins/`). Todavía no existe
> el equivalente en Swift para iOS — el código ya lo sabe y oculta esas
> opciones fuera de Android (`src/utils/platform.ts` →
> `isAndroidNative()`), así que la app no se rompe, simplemente no las
> ofrece. La descripción de abajo **no promete** cámara ni impresora
> Bluetooth en iOS a propósito. Si más adelante se implementan en Swift,
> hay que actualizar esta ficha para agregarlas.

## Nombre de la app

**Cobro POS**

## Subtítulo (máx. 30 caracteres)

```
Ventas, inventario y clientes
```

(29 caracteres)

## Palabras clave (máx. 100 caracteres, separadas por comas sin espacios)

```
pos,punto de venta,ventas,inventario,factura,ncf,recibo,caja,tienda,negocio
```

Ajustar con el contador en vivo de App Store Connect al pegarlas.

## Texto promocional (máx. 170 caracteres, editable sin nueva revisión)

```
Cobra, controla tu inventario y factura desde el celular — funciona incluso
sin conexión a internet. Sincroniza todo al reconectar.
```

## Descripción completa

```
Cobro POS es un sistema de Punto de Venta (POS) completo, pensado para
pequeños y medianos negocios: colmados, farmacias, restaurantes, tiendas de
ropa y cualquier negocio que necesite cobrar rápido y llevar su inventario al
día — incluso sin conexión a internet.

🛒 PUNTO DE VENTA
• Cobra en segundos: busca productos, aplica descuentos y calcula el cambio
  automático.
• Acepta efectivo, tarjeta, transferencia y ventas a crédito.
• Genera e imprime el recibo o factura de cada venta.

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

Nota: a diferencia de la ficha de Play Store, aquí se omiten a propósito las
menciones a "escanear con la cámara" e "impresoras térmicas Bluetooth" — ver
advertencia arriba.

## Categoría sugerida

**Negocios** (Business) — igual que en Play Store.

## Clasificación por edad (Age Rating)

El cuestionario de Apple (violencia, contenido para adultos, juego, etc.)
debería resultar en **4+** para esta app — no hay ninguno de esos
contenidos. Confirmar respondiendo el cuestionario real en App Store
Connect.

## Capturas de pantalla requeridas

Desde 2026 Apple solo pide capturas para **un tamaño**, el de iPhone de
pantalla 6.9″ (1320×2868, 1290×2796 o 1260×2736 px — cualquiera de los tres
según el modelo con el que se generen), de 1 a 10 imágenes; Apple las
reescala automáticamente para el resto de tamaños de iPhone.

Si el proyecto sigue con `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad,
ver `ios/App/App.xcodeproj/project.pbxproj`), **también** hará falta al
menos una captura de tamaño iPad. Para simplificar el primer lanzamiento se
puede restringir la app a solo iPhone (quitar el `2`) y evitar por completo
las capturas de iPad — a decidir según si interesa soportar iPad.

Igual que en Play Store: pendientes de tomar, se pueden generar corriendo
`npx cap sync ios` + Xcode/simulador (una vez haya Mac o CI disponible) o
con el propio TestFlight una vez exista un build instalable.

## Icono de la app

1024×1024, sin transparencia ni esquinas redondeadas (Apple las redondea
él mismo). Generar a partir de `build-assets/icons/app-icon.png` igual que
el de Play Store — verificar tamaño exacto antes de subir.

## Enlaces (ya están publicados y en producción)

- URL de soporte: `https://cobroapp.app` (o una página de soporte/contacto
  específica si existe)
- Política de Privacidad: `https://cobroapp.app/privacidad`
- Términos de Uso (EULA): `https://cobroapp.app/terminos`

## Información de inicio de sesión para revisión (App Review)

Igual que Google Play: el login es obligatorio (Supabase Auth). En
**App Store Connect → App Review Information** hay que dejar usuario y
contraseña de una cuenta/tienda de demostración con datos de ejemplo para
que el revisor de Apple pueda entrar y probar el flujo de cobro. Sin esto
es muy probable un rechazo en revisión (motivo típico: "Guideline 2.1 -
Information Needed").

## Privacidad de la app (App Privacy / "nutrition label")

Basado en lo que maneja el sistema vía Supabase (mismo análisis que
`PLAY_STORE_LISTING.md` para Google, adaptado a las categorías de Apple).
Borrador de partida — **confirmar cada respuesta en el cuestionario real**
de App Store Connect, incluyendo si algún dato está "vinculado a la
identidad del usuario" y si se usa para *tracking* (publicidad
cross-app/cross-site — aquí no aplica, no hay SDKs de tracking/ads):

- **Contact Info**: nombre, teléfono, correo (clientes y usuarios) —
  vinculado a identidad, no usado para tracking.
- **Financial Info**: historial de compras/transacciones, créditos —
  vinculado a identidad, no usado para tracking.
- **Identifiers**: ID de usuario/tienda (Supabase) — vinculado a identidad.
- **Location** (solo si se usa la función de GPS para shoppers/repartidores
  — ver `11_CEDULA_GPS_SHOPPERS.sql`): declarar si aplica al build que se
  suba.

## Codemagic (build en la nube, sin Mac)

Ver [`codemagic.yaml`](../codemagic.yaml) en la raíz del repo — workflow
`ios-release` ya configurado para compilar `ios/App` y publicar a
TestFlight automáticamente. Pasos de configuración inicial (una sola vez,
todo en el dashboard de Codemagic, nada se guarda en el repo) están
comentados arriba de ese workflow.
