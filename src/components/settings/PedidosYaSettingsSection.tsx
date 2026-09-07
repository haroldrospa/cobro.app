import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Check,
  ExternalLink,
  Store,
  Bike,
  Sparkles,
  Info,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';

interface PedidosYaSettingsSectionProps {
  userStore: any;
}

export const PedidosYaSettingsSection: React.FC<PedidosYaSettingsSectionProps> = ({ userStore }) => {
  const { toast } = useToast();
  const { settings, updateSettings, isUpdating } = useStoreSettings();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Local form states
  const [enabled, setEnabled] = useState(Boolean(settings?.pedidosya_enabled));
  const [storeId, setStoreId] = useState(settings?.pedidosya_store_id || '');
  const [clientId, setClientId] = useState(settings?.pedidosya_client_id || '');
  const [clientSecret, setClientSecret] = useState(settings?.pedidosya_client_secret || '');
  const [webhookSecret, setWebhookSecret] = useState(settings?.pedidosya_webhook_secret || '');
  const [autoAccept, setAutoAccept] = useState(Boolean(settings?.pedidosya_auto_accept));

  // Build Supabase Edge Function Webhook URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
  const webhookUrl = `${supabaseUrl}/functions/v1/pedidosya-webhook?store_id=${userStore?.id || ''}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast({
      title: 'URL copiada al portapapeles',
      description: 'Pega esta URL en el portal de partners de PedidosYa o entrégasela a tu soporte técnico.',
    });
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleSave = async () => {
    try {
      await updateSettings({
        pedidosya_enabled: enabled,
        pedidosya_store_id: storeId.trim(),
        pedidosya_client_id: clientId.trim(),
        pedidosya_client_secret: clientSecret.trim(),
        pedidosya_webhook_secret: webhookSecret.trim(),
        pedidosya_auto_accept: autoAccept,
      });

      toast({
        title: 'Ajustes de PedidosYa guardados',
        description: 'La configuración de integración ha sido actualizada con éxito.',
      });
    } catch (err) {
      console.error('Error saving PedidosYa settings:', err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: 'No se pudieron guardar los ajustes de PedidosYa.',
      });
    }
  };

  const handleSendTestOrder = async () => {
    if (!userStore?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se detectó el identificador de tu tienda.',
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const testOrderNumber = `PY-${Math.floor(100000 + Math.random() * 900000)}`;
      const testPayload = {
        store_id: userStore.id,
        order: {
          id: testOrderNumber,
          customer: {
            name: 'Juan Pérez (Prueba PedidosYa)',
            phone: '8095551234',
            address: {
              street: 'Av. Winston Churchill',
              number: '1099',
              notes: 'Edificio BlueMall, Apto 4B',
            },
          },
          notes: 'Por favor incluir cubiertos y servilletas.',
          total: 450.00,
          subtotal: 450.00,
          payment: {
            method: 'ONLINE',
            status: 'PAID',
          },
          items: [
            {
              name: 'Hamburguesa Especial PedidosYa',
              quantity: 2,
              unitPrice: 175.00,
              total: 350.00,
              modifiers: [{ name: 'Extra Queso' }, { name: 'Papas Fritas' }],
            },
            {
              name: 'Bebida Refrescante 500ml',
              quantity: 1,
              unitPrice: 100.00,
              total: 100.00,
            },
          ],
        },
      };

      const response = await fetch(`${supabaseUrl}/functions/v1/pedidosya-webhook?store_id=${userStore.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        throw new Error(`Respuesta no exitosa (${response.status})`);
      }

      toast({
        title: '¡Pedido de prueba enviado con éxito!',
        description: `Se ha registrado el pedido ${testOrderNumber}. Revisa la ventana de Pedidos Web en el POS.`,
      });
    } catch (err: any) {
      console.error('Error enviando pedido de prueba:', err);
      toast({
        variant: 'destructive',
        title: 'Error en la prueba',
        description: 'No se pudo simular el pedido. Verifica que la Edge Function esté disponible.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛵</span>
              <h2 className="text-xl font-bold tracking-tight">Integración Oficial con PedidosYa</h2>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-semibold text-xs backdrop-blur-sm">
                En Tiempo Real
              </Badge>
            </div>
            <p className="text-sm text-red-50 max-w-xl">
              Recibe automáticamente todos los pedidos que tus clientes hagan en la app de <strong>PedidosYa</strong> directo a tu POS, pantalla de cocina y facturación.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl backdrop-blur-sm">
            <div className="text-right">
              <span className="text-xs font-medium text-red-100 block">Recepción de pedidos</span>
              <span className="text-xs font-bold text-white">
                {enabled ? 'ACTIVADA' : 'DESACTIVADA'}
              </span>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Webhook Connection Card */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">1. Conexión de Webhook (Recepción en Vivo)</CardTitle>
              <CardDescription className="text-xs">
                Esta es la dirección única donde PedidosYa enviará las notificaciones de nuevos pedidos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              URL del Webhook para PedidosYa:
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-xs bg-muted/50 select-all"
              />
              <Button
                type="button"
                variant={copiedUrl ? 'default' : 'outline'}
                onClick={handleCopyWebhook}
                className="h-10 px-4 text-xs gap-1.5 shrink-0"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copiedUrl ? 'Copiada' : 'Copiar URL'}
              </Button>
            </div>
          </div>

          <div className="bg-muted/40 p-3.5 rounded-xl text-xs space-y-1.5 border border-border/40">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>¿Cómo vincularlo con tu cuenta de PedidosYa?</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
              <li>Copia la URL del Webhook de arriba.</li>
              <li>Inicia sesión en tu <strong>Portal de Partners de PedidosYa</strong> (o contacta a tu ejecutivo/soporte de integración).</li>
              <li>Pega la URL en la sección de <strong>Webhooks / Integración POS</strong> y selecciona eventos de <em>Nuevos Pedidos</em>.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* API Credentials & Partner Options */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">2. Identificación del Comercio</CardTitle>
              <CardDescription className="text-xs">
                Datos opcionales para vincular la sucursal de PedidosYa con Cobro App.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="py_store_id" className="text-xs font-semibold">
                ID de Restaurante / Sucursal en PedidosYa:
              </Label>
              <Input
                id="py_store_id"
                placeholder="Ej: 198472 o REST-01"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                El identificador numérico de tu local en PedidosYa.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="py_webhook_secret" className="text-xs font-semibold">
                Token Secreto de Firma (Opcional):
              </Label>
              <Input
                id="py_webhook_secret"
                type="password"
                placeholder="Token de validación de firma"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Para validar la autenticidad de los paquetes recibidos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="py_client_id" className="text-xs font-semibold">
                Client ID de la API (Opcional):
              </Label>
              <Input
                id="py_client_id"
                placeholder="Client ID para confirmaciones API"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="py_client_secret" className="text-xs font-semibold">
                Client Secret de la API (Opcional):
              </Label>
              <Input
                id="py_client_secret"
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">
                Aceptar pedidos automáticamente
              </Label>
              <p className="text-xs text-muted-foreground">
                Pasa los pedidos entrantes de PedidosYa directamente a preparación / cocina sin esperar confirmación manual del cajero.
              </p>
            </div>
            <Switch
              checked={autoAccept}
              onCheckedChange={setAutoAccept}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Footer & Simulation Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-muted/30 rounded-2xl border border-border/50">
        <Button
          type="button"
          variant="outline"
          onClick={handleSendTestOrder}
          disabled={isSendingTest}
          className="w-full sm:w-auto text-xs h-9 gap-1.5 font-semibold text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
        >
          {isSendingTest ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSendingTest ? 'Enviando prueba...' : 'Simular Pedido de Prueba en mi POS'}
        </Button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isUpdating}
          className="w-full sm:w-auto text-xs h-9 px-6 gap-1.5 font-bold"
        >
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
