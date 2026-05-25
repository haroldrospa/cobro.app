# Sistema de Permisos por Plan de Suscripción

Sistema completo para controlar acceso a funcionalidades basado en el plan de suscripción del usuario.

## Configuración de Planes

### Planes Disponibles

1. **Emprendedor** (basic)
   - 2 empleados máximo
   - 100 productos máximo
   - 50 clientes máximo
   - 100 facturas/mes máximo
   - Reportes básicos
   -Exportación a Excel
   - Dashboard con analytics
   - Sin soporte WhatsApp/Teléfono

2. **Profesional** (pro)
   - 10 empleados máximo
   - 1000 productos máximo
   - 500 clientes máximo
   - 1000 facturas/mes máximo
   - Reportes avanzados
   - Contabilidad
   - Nómina
   - Personalización de marca
   - Email de reportes
   - Pedidos web
   - Promociones
   - Soporte WhatsApp prioritario

3. **Empresarial** (enterprise)
   - **Ilimitado** en todo
   - Todas las funcionalidades
   - API de integración
   - Múltiples tiendas
   - Soporte dedicado (WhatsApp + Teléfono)

## Uso del Sistema

### 1. Hook usePlanFeatures

```typescript
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

function MyComponent() {
  const { 
    planTier,              // 'basic' | 'pro' | 'enterprise'
    features,              // Objeto con todas las características
    canAccess,             // Función para verificar acceso a feature
    hasReachedLimit,       // Verificar si llegó al límite
    getRemainingCount,     // Obtener cuántos quedan disponibles
    getPlanName,           // Nombre del plan en español
  } = usePlanFeatures();

  // Verificar acceso a una funcionalidad
  if (canAccess('canAccessAccounting')) {
    // Mostrar módulo de contabilidad
  }

  // Verificar límite
  if (hasReachedLimit('products', currentProductCount)) {
    // Mostrar mensaje de límite alcanzado
  }
}
```

### 2. Componente WithPlanAccess

Para proteger componentes completos:

```typescript
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';

export default function Accounting() {
  return (
    <WithPlanAccess 
      feature="canAccessAccounting" 
      requiredPlan="pro"
      featureName="Contabilidad"
    >
      {/* Contenido del módulo de contabilidad */}
      <AccountingModule />
    </WithPlanAccess>
  );
}
```

### 3. Componente WithPlanLimit

Para controlar límites de recursos:

```typescript
import { WithPlanLimit } from '@/components/subscription/WithPlanAccess';

function AddProductButton() {
  const productCount = products.length;
  
  return (
    <WithPlanLimit 
      limitType="products" 
      currentCount={productCount}
      showOverlay={false}
    >
      <Button onClick={handleAddProduct}>
        Agregar Producto
      </Button>
    </WithPlanLimit>
  );
}
```

### 4. Mostrar Alertas de Restricción

```typescript
import { PlanRestrictionAlert } from '@/components/subscription/PlanRestrictions';

function MyFeature() {
  const { canAccess } = usePlanFeatures();
  
  if (!canAccess('canAccessAPI')) {
    return (
      <PlanRestrictionAlert 
        feature="API de Integración" 
        requiredPlan="enterprise" 
      />
    );
  }
  
  return <APIConfiguration />;
}
```

### 5. Mostrar Alertas de Límite

```typescript
import { LimitReachedAlert } from '@/components/subscription/PlanRestrictions';

function ProductList() {
  const { hasReachedLimit } = usePlanFeatures();
  const productCount = products.length;
  
  return (
    <div>
      {hasReachedLimit('products', productCount) && (
        <LimitReachedAlert 
          feature="productos" 
          limitType="products"
          currentCount={productCount}
        />
      )}
      {/* Lista de productos */}
    </div>
  );
}
```

### 6. Medidor de Uso

```typescript
import { UsageMeter } from '@/components/subscription/PlanRestrictions';

function Dashboard() {
  const employeeCount = employees.length;
  const productCount = products.length;
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <UsageMeter 
        limitType="employees"
        currentCount={employeeCount}
        label="Empleados"
      />
      <UsageMeter 
        limitType="products"
        currentCount={productCount}
        label="Productos"
      />
    </div>
  );
}
```

### 7. Badge de Plan

```typescript
import { PlanBadge } from '@/components/subscription/PlanRestrictions';

function Header() {
  return (
    <div className="flex items-center gap-2">
      <PlanBadge showUpgrade={true} />
    </div>
  );
}
```

### 8. Feature Bloqueada con Overlay

```typescript
import { FeatureLocked } from '@/components/subscription/PlanRestrictions';

function AdvancedReports() {
  const { canAccess } = usePlanFeatures();
  
  if (!canAccess('canAccessAdvancedReports')) {
    return (
      <FeatureLocked 
        featureName="Reportes Avanzados" 
        requiredPlan="pro"
      >
        {/* Contenido deshabilitado con blur */}
        <ReportContent />
      </FeatureLocked>
    );
  }
  
  return <ReportContent />;
}
```

### 9. Hook useLimitState

Para deshabilitar inputs en formularios:

```typescript
import { useLimitState } from '@/components/subscription/WithPlanAccess';

function AddProductForm() {
  const productCount = products.length;
  const { isDisabled, message, remaining } = useLimitState('products', productCount);
  
  return (
    <div>
      <Button disabled={isDisabled}>
        Agregar Producto
      </Button>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
```

## Ejemplos Completos de Implementación

### Proteger Ruta Completa (Layout.tsx)

```typescript
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';

// En tu Route configuración
<Route 
  path="/accounting" 
  element={
    <WithPlanAccess feature="canAccessAccounting" requiredPlan="pro">
      <Accounting />
    </WithPlanAccess>
  } 
/>
```

### Proteger Botón de Acción

```typescript
function Toolbar() {
  const { canAccess, hasReachedLimit } = usePlanFeatures();
  const employeeCount = employees.length;
  
  return (
    <div>
      <Button 
        disabled={
          !canAccess('canAccessPayroll') || 
          hasReachedLimit('employees', employeeCount)
        }
        onClick={handleAddEmployee}
      >
        Agregar Empleado
      </Button>
    </div>
  );
}
```

### Dashboard de Suscripción

```typescript
import { PlanBadge, UsageMeter } from '@/components/subscription/PlanRestrictions';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

function SubscriptionDashboard() {
  const { features, getPlanName } = usePlanFeatures();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2>Plan Actual</h2>
        <PlanBadge showUpgrade={true} />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <UsageMeter limitType="employees" currentCount={employeeCount} label="Empleados" />
        <UsageMeter limitType="products" currentCount={productCount} label="Productos" />
        <UsageMeter limitType="customers" currentCount={customerCount} label="Clientes" />
        <UsageMeter limitType="invoices" currentCount={invoiceCount} label="Facturas este mes" />
      </div>
      
      <div className="space-y-2">
        <h3>Funcionalidades Incluidas</h3>
        {features.canAccessAccounting && <div>✓ Contabilidad</div>}
        {features.canAccessPayroll && <div>✓ Nómina</div>}
        {features.canAccessAdvancedReports && <div>✓ Reportes Avanzados</div>}
      </div>
    </div>
  );
}
```

## Modificar Características del Plan

Para cambiar las características de cada plan, edita:
`/src/hooks/usePlanFeatures.ts`

```typescript
const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  basic: {
    maxEmployees: 2,  // Cambiar aquí
    // ... otras configuraciones
  },
  // ...
};
```

## Testing

Para testear con diferentes planes, cambia temporalmente en la consola del navegador:

```javascript
// Ver plan actual
localStorage.getItem('test_plan')

// Cambiar a Pro
localStorage.setItem('test_plan', 'pro')

// Cambiar a Enterprise  
localStorage.setItem('test_plan', 'enterprise')

// Volver a Basic
localStorage.removeItem('test_plan')
```
