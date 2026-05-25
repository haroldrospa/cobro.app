# 💰 Cobro.App - Sistema POS Moderno

<div align="center">

![Cobro.App](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4.1-646CFF?logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-2.50.2-3ECF8E?logo=supabase)

**Sistema de Punto de Venta (POS) moderno, completo y multiplataforma**

[Demo](#) • [Documentación](#características) • [Instalación](#instalación)

</div>

---

## 📋 Descripción

**Cobro.App** es un sistema POS (Point of Sale) completo y moderno diseñado para pequeñas y medianas empresas. Ofrece gestión integral de ventas, inventario, clientes, facturación y reportes, con soporte para múltiples dispositivos y modo offline.

### ✨ Características Principales

- 🛒 **Punto de Venta Completo**: Interfaz intuitiva para procesar ventas rápidamente
- 📦 **Gestión de Inventario**: Control total de productos, stock, categorías y proveedores
- 👥 **Sistema de Clientes**: Gestión de clientes con créditos y historial de compras
- 📊 **Reportes Avanzados**: Análisis de ventas, inventario y rendimiento en tiempo real
- 💳 **Múltiples Métodos de Pago**: Efectivo, tarjeta, transferencia y crédito
- 🧾 **Facturación NCF**: Soporte para comprobantes fiscales dominicanos
- 📱 **Multiplataforma**: Web, Desktop (Electron) y PWA
- 🔄 **Modo Offline**: Funciona sin conexión a internet
- 🖨️ **Impresión Flexible**: Diferentes formatos de ticket (58mm, 80mm, A4)
- 🤖 **AI Integration**: Escaneo de facturas con IA usando Tesseract.js y Google Generative AI
- 🎨 **Interfaz Moderna**: Diseño limpio con soporte para modo oscuro
- 🔐 **Multi-tienda**: Soporte para múltiples tiendas y usuarios

---

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 18.3** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool ultrarrápido
- **TailwindCSS** - Framework CSS utility-first
- **shadcn/ui** - Componentes UI de alta calidad
- **Framer Motion** - Animaciones fluidas

### Backend & Database
- **Supabase** - Backend as a Service (PostgreSQL)
- **React Query** - Gestión de estado del servidor
- **Supabase Auth** - Autenticación y autorización

### Librerías Destacadas
- **jsPDF** - Generación de PDFs
- **Recharts** - Gráficos y visualizaciones
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas
- **Tesseract.js** - OCR para escaneo de facturas
- **QRCode.react** - Generación de códigos QR
- **JSBarcode** - Generación de códigos de barras
- **XLSX** - Exportación a Excel

### Empaquetado Multiplataforma
- **Electron** - Aplicación de escritorio
- **Capacitor** - Apps móviles (iOS/Android)
- **PWA** - Progressive Web App

---

## 📥 Instalación

### Prerrequisitos

- **Node.js** 18+ 
- **npm** o **yarn**
- Cuenta de **Supabase** (para la base de datos)

### Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/haroldrospa/cobro.app.git
cd cobro.app
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

> **Nota**: Obtén estas credenciales desde tu proyecto en [Supabase](https://supabase.com/)

4. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

---

## 🎯 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia el servidor de desarrollo

# Producción
npm run build           # Crea build de producción para web
npm run preview         # Vista previa del build de producción

# Electron (Desktop)
npm run electron:build  # Crea aplicación de escritorio

# Otros
npm run lint            # Ejecuta el linter
```

---

## 📱 Distribución Multiplataforma

### Web (PWA)
La aplicación se puede instalar como PWA directamente desde el navegador.

### Desktop (Electron)
```bash
npm run electron:build
```
Genera instaladores para:
- **Windows**: `.exe` (NSIS)
- **macOS**: `.dmg`

### Móvil (iOS/Android)
Utiliza Capacitor para crear aplicaciones nativas:
```bash
npx cap sync
npx cap open android  # Para Android
npx cap open ios      # Para iOS
```

---

## 🏗️ Estructura del Proyecto

```
cobro.app/
├── src/
│   ├── components/      # Componentes reutilizables
│   ├── pages/          # Páginas principales
│   │   ├── Auth.tsx           # Autenticación
│   │   ├── Tienda.tsx         # POS principal
│   │   ├── MiTienda.tsx       # Gestión de tienda
│   │   └── admin/             # Panel de administración
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Utilidades y helpers
│   ├── types/          # Definiciones de TypeScript
│   ├── integrations/   # Integraciones (Supabase, etc.)
│   └── lib/            # Configuraciones de librerías
├── public/             # Archivos estáticos
├── dist/               # Build de producción
└── package.json        # Dependencias y scripts
```

---

## 🔑 Funcionalidades Detalladas

### 1. Punto de Venta (POS)
- Búsqueda rápida de productos
- Escaneo de códigos de barras
- Múltiples métodos de pago
- Cálculo automático de cambio
- Aplicación de descuentos
- Ventas a crédito
- Impresión de tickets

### 2. Gestión de Inventario
- CRUD de productos
- Control de stock con alertas
- Categorías y subcategorías
- Importación masiva (Excel)
- Gestión de proveedores
- Historial de movimientos

### 3. Clientes
- Registro de clientes
- Gestión de créditos
- Historial de compras
- Estado de cuenta
- Pagos parciales

### 4. Reportes
- Ventas diarias, semanales, mensuales
- Productos más vendidos
- Análisis de inventario
- Reportes de créditos
- Exportación a PDF y Excel
- Gráficos interactivos

### 5. Administración
- Panel de super admin
- Gestión de usuarios y roles
- Configuración de tienda
- Sistema de suscripciones
- Configuración de impresión
- Temas y personalización

---

## 🎨 Capturas de Pantalla

> *Próximamente: Agrega aquí capturas de pantalla de tu aplicación*

---

## 🔐 Seguridad

- Autenticación mediante Supabase Auth
- Row Level Security (RLS) en la base de datos
- Variables de entorno para credenciales sensibles
- Validación de datos con Zod
- Roles y permisos por usuario

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz un Fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: Amazing Feature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado y todos los derechos están reservados.

---

## 👨‍💻 Autor

**Harold Rosado**

- GitHub: [@haroldrospa](https://github.com/haroldrospa)
- Repositorio: [cobro.app](https://github.com/haroldrospa/cobro.app)

---

## 📞 Soporte

Si tienes alguna pregunta o problema, por favor:

1. Revisa la [documentación](#características)
2. Abre un [issue](https://github.com/haroldrospa/cobro.app/issues)
3. Contacta al desarrollador

---

## 🎯 Roadmap

- [ ] Integración con pasarelas de pago
- [ ] App móvil nativa
- [ ] Sistema de delivery
- [ ] Integración con WhatsApp
- [ ] Multi-moneda
- [ ] Facturación electrónica avanzada
- [ ] Integraciones con marketplaces

---

<div align="center">

**Hecho con ❤️ por Harold Rosado**

⭐ Si te gusta este proyecto, dale una estrella en GitHub!

</div>
