import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Check,
  Server
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export const AlanubeMasterSettings: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Obtener el Token Maestro de Alanube desde admin_global_settings
  const { data: masterTokenData, isLoading, refetch } = useQuery({
    queryKey: ['alanube-master-token'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_global_settings')
        .select('value')
        .eq('id', 'alanube_master_token')
        .maybeSingle();

      if (error) {
        console.warn('Error fetching alanube_master_token:', error);
        return '';
      }
      return data?.value || '';
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (masterTokenData !== undefined) {
      setToken(masterTokenData);
    }
  }, [masterTokenData]);

  const handleSave = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      toast({
        title: 'Token requerido',
        description: 'Ingresa un token de autenticación de Alanube válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setTestResult(null);

    try {
      // 1. Guardar en admin_global_settings
      const { error: settingsError } = await supabase
        .from('admin_global_settings')
        .upsert({
          id: 'alanube_master_token',
          value: cleanToken,
          updated_at: new Date().toISOString(),
        });

      if (settingsError) throw settingsError;

      // 2. Propagar el token maestro a las configuraciones existentes de alanube_config
      const { error: configError } = await supabase
        .from('alanube_config')
        .update({
          api_token: cleanToken,
          updated_at: new Date().toISOString(),
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (configError) {
        console.warn('Advertencia al propagar token a alanube_config:', configError);
      }

      toast({
        title: 'Token Maestro Guardado',
        description: 'El token de Alanube se actualizó para todos los negocios y sucursales.',
      });

      refetch();
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err?.message || 'No se pudo guardar el token maestro.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestToken = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      toast({
        title: 'Falta Token',
        description: 'Ingresa un token antes de realizar la prueba de conexión.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      let rawToken = cleanToken;
      if (rawToken.toLowerCase().startsWith('bearer ')) {
        rawToken = rawToken.substring(7).trim();
      }

      // En web deployment usamos el proxy /api-alanube-prod para evitar bloqueos de CORS
      const isBrowser = typeof window !== 'undefined';
      const isWebDeployment = isBrowser && !window.location.protocol.startsWith('file:') && !window.location.protocol.startsWith('app:');
      const testUrl = isBrowser && isWebDeployment
        ? `${window.location.origin}/api-alanube-prod/dom/v1/invoices`
        : 'https://api.alanube.co/dom/v1/invoices';

      const res = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${rawToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setTestResult({
          success: false,
          message: 'Token inválido o expirado. Alanube denegó la autenticación (HTTP ' + res.status + ').',
        });
      } else {
        setTestResult({
          success: true,
          message: '¡Conexión Exitosa con Alanube! El token maestro es válido y está listo para operar.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error al conectar con los servidores de Alanube.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl max-w-2xl">
      <CardHeader className="p-5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-emerald-500" />
            Token Maestro de Alanube (Facturación Electrónica e-CF)
          </CardTitle>
          {token ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px] font-bold">
              Sin Configurar
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Token de autenticación centralizado (Bearer) de Alanube. Es general para toda la plataforma y todos los negocios emiten sus facturas electrónicas a través de él.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="master-token" className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>Token de Autenticación (Bearer) General</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              Modificable únicamente desde este Panel Maestro
            </span>
          </Label>

          <div className="relative">
            <Input
              id="master-token"
              type={showToken ? 'text' : 'password'}
              placeholder="eyJh..."
              className="h-10 text-xs rounded-xl bg-background/80 border-border/60 pr-10 font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              title={showToken ? 'Ocultar token' : 'Mostrar token'}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Al guardar este token, se aplicará automáticamente a todas las cuentas y sucursales. Los clientes individuales ya no tienen acceso ni necesidad de ingresar este token.
          </p>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              testResult.success
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-destructive/10 text-destructive border-destructive/30'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Guardar Token Maestro
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleTestToken}
            disabled={isTesting || !token}
            className="h-10 px-4 text-xs font-bold border-border/60 hover:bg-muted/40 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Verificando con Alanube...' : 'Probar Token con Alanube'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
