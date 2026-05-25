# Sistema de Notificaciones de Stock Bajo por Correo

## Funcionalidad
Envía correos electrónicos automáticos cuando un producto alcanza el umbral de stock bajo configurado.

## Implementación Necesaria

### 1. Edge Function de Supabase

Crear archivo: `supabase/functions/send-low-stock-email/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

serve(async (req) => {
  try {
    const { productName, currentStock, threshold, storeName, adminEmail } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'alertas@tudominio.com',
        to: [adminEmail],
        subject: `⚠️ Alerta de Stock Bajo - ${productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">⚠️ Alerta de Stock Bajo</h2>
            <p>Se ha detectado que el siguiente producto tiene stock bajo:</p>
            
            <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${productName}</h3>
              <p style="margin: 5px 0;"><strong>Stock Actual:</strong> ${currentStock} unidades</p>
              <p style="margin: 5px 0;"><strong>Umbral Configurado:</strong> ${threshold} unidades</p>
            </div>
            
            <p>Por favor, considera reabastecer este producto lo antes posible.</p>
            
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              Esta notificación fue enviada automáticamente por ${storeName}
            </p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### 2. Database Trigger

Crear una función y trigger en PostgreSQL:

```sql
-- Función que detecta stock bajo y envía notificación
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  store_settings RECORD;
  admin_profile RECORD;
BEGIN
  -- Solo procesar si el stock disminuyó
  IF NEW.stock < OLD.stock THEN
    -- Obtener configuración de la tienda
    SELECT * INTO store_settings 
    FROM store_settings 
    WHERE store_id = NEW.store_id 
    LIMIT 1;
    
    -- Solo continuar si las alertas están activas
    IF store_settings.low_stock_alert = true THEN
      -- Verificar si el stock está bajo
      IF NEW.stock <= store_settings.low_stock_threshold THEN
        -- Obtener email del administrador
        SELECT * INTO admin_profile
        FROM profiles
        WHERE store_id = NEW.store_id 
        AND role = 'admin'
        LIMIT 1;
        
        -- Enviar notificación (esto llamaría a la Edge Function)
        PERFORM net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-low-stock-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
          ),
          body := jsonb_build_object(
            'productName', NEW.name,
            'currentStock', NEW.stock,
            'threshold', store_settings.low_stock_threshold,
            'storeName', (SELECT store_name FROM stores WHERE id = NEW.store_id),
            'adminEmail', admin_profile.email
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS low_stock_notification_trigger ON products;
CREATE TRIGGER low_stock_notification_trigger
  AFTER UPDATE OF stock ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock();
```

### 3. Configuración Requerida

1. **Obtener API Key de Resend.com**:
   - Regístrate en https://resend.com
   - Obtén tu API Key
   - Verifica tu dominio

2. **Configurar en Supabase**:
   ```bash
   # Agregar secret a Supabase
   supabase secrets set RESEND_API_KEY=your_api_key_here
   ```

3. **Desplegar Edge Function**:
   ```bash
   supabase functions deploy send-low-stock-email
   ```

### 4. Alternativa Simple (Sin Edge Function)

Si no quieres configurar todo eso, puedes usar un **webhook** o **cron job** que revise periódicamente:

```typescript
// Hook personalizado para revisar stock bajo
export const useCheckLowStock = () => {
  const { data: userStore } = useUserStore();
  const { data: storeSettings } = useStoreSettings();
  
  useEffect(() => {
    if (!storeSettings?.low_stock_alert) return;
    
    const checkStock = async () => {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', userStore.id)
        .lte('stock', storeSettings.low_stock_threshold);
      
      if (products && products.length > 0) {
        // Llamar a Edge Function para enviar correos
        await supabase.functions.invoke('send-low-stock-email', {
          body: {
            products,
            storeName: userStore.store_name,
            threshold: storeSettings.low_stock_threshold
          }
        });
      }
    };
    
    // Revisar cada hora
    const interval = setInterval(checkStock, 3600000);
    return () => clearInterval(interval);
  }, [storeSettings, userStore]);
};
```

## Pasos para Implementar

1. ✅ Registrarte en Resend.com
2. ✅ Crear la Edge Function
3. ✅ Configurar el API Key
4. ✅ Crear el trigger en la base de datos
5. ✅ Probar con un producto

## Costos

- **Resend.com**: 
  - Gratis: 3,000 correos/mes
  - Perfecto para empezar

¿Quieres que implemente la versión completa o prefieres una versión más simple?
