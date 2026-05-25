# Guía de Migración al Sistema Offline

Esta guía te ayuda a migrar el código existente para usar el sistema offline.

## 📋 Paso 1: Actualizar el Componente POS

Modifica el archivo `src/components/POS.tsx` para usar los hooks offline:

### Antes:
```typescript
import { useCreateSale } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
```

### Después:
```typescript
import { useCreateSaleOffline } from '@/hooks/useSalesOffline';
import { useProductsOffline } from '@/hooks/useProductsOffline';
```

## 📋 Paso 2: Reemplazar los Hooks

### Productos

**Antes:**
```typescript
const { data: products, isLoading } = useProducts();
```

**Después:**
```typescript
const { data: products, isLoading } = useProductsOffline();
```

### Crear Venta

**Antes:**
```typescript
const { mutate: createSale } = useCreateSale();
```

**Después:**
```typescript
const { mutate: createSale } = useCreateSaleOffline();
```

## 📋 Paso 3: (Opcional) Mostrar Estado de Conexión

Si quieres mostrar el estado de conexión en algún lugar específico:

```typescript
import { useOnlineStatus } from '@/hooks/useProductsOffline';

function MyComponent() {
  const isOnline = useOnlineStatus();
  
  return (
    <div>
      {!isOnline && (
        <div className="bg-orange-100 p-2 text-center">
          ⚠️ Modo Offline - Las ventas se sincronizarán cuando vuelva la conexión
        </div>
      )}
    </div>
  );
}
```

## 🎯 Cambios Mínimos Requeridos

### Solo necesitas cambiar 2 líneas en POS.tsx:

1. **Importaciones** (línea ~8-15):
```typescript
// Cambiar esto:
import { useCreateSale } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';

// Por esto:
import { useCreateSaleOffline } from '@/hooks/useSalesOffline';
import { useProductsOffline } from '@/hooks/useProductsOffline';
```

2. **Uso de hooks** (línea ~50-80):
```typescript
// Cambiar esto:
const { data: products } = useProducts();
const { mutate: createSale } = useCreateSale();

// Por esto:
const { data: products } = useProductsOffline();
const { mutate: createSale } = useCreateSaleOffline();
```

¡Eso es todo! El resto del código sigue funcionando exactamente igual.

## ✅ Ventajas de Esta Migración

- ✅ **Compatibilidad Total**: La API es idéntica, no necesitas cambiar la lógica
- ✅ **Cero Configuración**: El sistema offline se activa automáticamente
- ✅ **Sin Riesgos**: Si falla offline, usa el comportamiento online normal
- ✅ **Gradual**: Puedes migrar componente por componente

## 🔄 Rollback

Si necesitas volver al sistema anterior, simplemente revierte los cambios en las importaciones:

```typescript
// Volver a:
import { useCreateSale } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
```

## 📝 Notas

- **Los hooks offline son drop-in replacements**: Usan exactamente la misma interfaz
- **Fallback automático**: Si algo falla offline, intenta online
- **Sin cambios en la UI**: La experiencia del usuario es transparente
- **Funciona en móvil y desktop**: Compatible con todas las plataformas
