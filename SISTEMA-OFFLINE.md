# Sistema de Facturación Offline

Este sistema permite a tu aplicación de facturación funcionar **completamente sin conexión a internet**. Todas las operaciones se guardan localmente y se sincronizan automáticamente cuando la conexión se restablece.

## 🎯 Características Principales

### ✅ Funciona Sin Internet
- **Productos**: Se almacenan en IndexedDB y están disponibles offline
- **Clientes**: Acceso completo a la lista de clientes sin conexión
- **Ventas**: Puedes facturar y todas las ventas se guardan localmente
- **Sincronización Automática**: Cuando vuelve la conexión, todo se sincroniza automáticamente

### 🔄 Sincronización Inteligente
- **Detección Automática**: El sistema detecta cuando pierdes/recuperas la conexión
- **Cola de Sincronización**: Las operaciones offline se guardan en una cola
- **Sincronización en Segundo Plano**: Se sincroniza cada 30 segundos cuando hay internet
- **Indicador Visual**: Siempre sabes si estás online u offline

## 📦 Arquitectura

### 1. IndexedDB (Base de Datos Local)
```
lib/offlineDB.ts
```
- Almacena productos, clientes, ventas y categorías localmente
- Permite trabajar completamente offline
- Rápido acceso a los datos sin internet

### 2. Sincronización Automática
```
lib/offlineSync.ts
```
- Sincroniza datos desde Supabase a IndexedDB
- Envía operaciones offline cuando vuelve la conexión
- Maneja conflictos y errores automáticamente

### 3. Hooks con Soporte Offline
```
hooks/useProductsOffline.ts
hooks/useSalesOffline.ts
```
- Compatible con los hooks existentes
- Detecta automáticamente si hay o no conexión
- Usa IndexedDB cuando no hay internet
- Se sincroniza con Supabase cuando hay conexión

### 4. Indicador Visual
```
components/OfflineIndicator.tsx
```
- Muestra estado de conexión (🟢 Online / 🟠 Offline)
- Indica operaciones pendientes de sincronizar
- Permite sincronización manual con un clic

## 🚀 Cómo Usar

### Facturar Sin Internet

El sistema funciona automáticamente. Simplemente usa la aplicación normalmente:

1. **Abre el POS** incluso sin internet
2. **Busca productos** (se cargan desde IndexedDB)
3. **Crea una factura** normalmente
4. **La factura se guarda localmente** con un número temporal
5. **Cuando vuelva internet**, se sincroniza automáticamente con Supabase

### En el Código

Para usar las ventas offline, en lugar de `useCreateSale`, usa:

```typescript
import { useCreateSaleOffline } from '@/hooks/useSalesOffline';

const { mutate: createSale } = useCreateSaleOffline();

// Usar exactamente igual que antes
createSale(saleData);
```

Para productos offline:

```typescript
import { useProductsOffline } from '@/hooks/useProductsOffline';

const { data: products } = useProductsOffline();
```

## 📊 Indicador de Estado

En la esquina inferior derecha verás:

- **🟢 En línea** - Conectado a internet, todo sincronizado
- **🟠 Modo Offline** - Sin internet, guardando localmente
- **⚠️ Con número** - Cantidad de operaciones pendientes de sincronizar
- **☁️ Girando** - Sincronizando en este momento

## 🔧 Configuración

El sistema se inicializa automáticamente al cargar la aplicación. No requiere configuración adicional.

```typescript
// En App.tsx ya está incluido
<OfflineIndicator />
```

## 📝 Notas Importantes

### Numeración de Facturas Offline

Cuando estás offline, las facturas se crean con un número temporal en el formato:
```
OFFLINE-{timestamp}
```

Cuando se sincronizan con Supabase, reciben el número de factura correcto del sistema de secuencias.

### Límites de Almacenamiento

IndexedDB puede almacenar grandes cantidades de datos (típicamente 50MB+), pero ten en cuenta:
- **Productos**: Sin límite práctico (miles de productos)
- **Ventas**: Se recomienda sincronizar regularmente para liberar espacio
- **Imágenes**: Las URLs se almacenan, no las imágenes completas

### Limpieza Automática

El sistema limpia automáticamente:
- Operaciones sincronizadas hace más de 7 días
- Datos obsoletos en sincronización regular

## 🛠️ Troubleshooting

### ¿No se sincroniza?

1. Verifica que tengas conexión a internet
2. Revisa la consola del navegador para errores
3. Haz clic en el indicador offline para forzar sincronización

### ¿Datos duplicados?

El sistema previene duplicados usando UUIDs únicos. Si ves duplicados:
1. Limpia el cache del navegador
2. Reinicia la aplicación

### ¿Perdí datos?

No. Los datos offline se guardan en IndexedDB que persiste incluso al recargar la página o cerrar el navegador. Solo se pierden si:
- Limpias el almacenamiento del navegador manualmente
- Desinstalas la aplicación (en móviles)

## 🎓 Para Desarrolladores

### Agregar Más Entidades Offline

Para agregar soporte offline a otras entidades (ej: proveedores):

1. **Actualiza offlineDB.ts**:
```typescript
export enum OfflineStore {
  // ... existentes
  SUPPLIERS = 'suppliers',
}
```

2. **Actualiza offlineSync.ts**:
```typescript
private async syncFromSupabase(): Promise<void> {
  // Agregar sincronización de suppliers
  const { data: suppliers } = await supabase.from('suppliers').select('*');
  // ...
}
```

3. **Crea el hook**:
```typescript
export const useSuppliersOffline = () => {
  // Similar a useProductsOffline
};
```

## ✨ Beneficios

- ✅ **Confiabilidad**: Nunca pierdas una venta por falta de internet
- ✅ **Velocidad**: Acceso instantáneo a productos sin esperar red
- ✅ **Flexibilidad**: Trabaja en cualquier lugar, incluso sin señal
- ✅ **Automático**: No requiere intervención manual
- ✅ **Transparente**: La UX es idéntica online y offline

---

**¡Tu sistema POS ahora funciona 24/7, con o sin internet!** 🚀
