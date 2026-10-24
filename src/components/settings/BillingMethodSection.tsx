import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Save, Server, Link, Key, Hash, FileText, Printer, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAlanubeConfig } from '@/hooks/useAlanubeConfig';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { AlanubeClient } from '@/services/alanube/client';

export default function BillingMethodSection({ onModeChange }: { onModeChange?: (mode: 'ncf' | 'e-ncf') => void }) {
  const { config, isLoading, isUpdating, updateConfig } = useAlanubeConfig();
  const { toast } = useToast();
  const { settings: storeSettings } = useStoreSettings();

  const [billingMode, setBillingMode] = useState<'ncf' | 'e-ncf'>('ncf');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    api_token: '',
    base_url: 'https://sandbox.alanube.co',
    rnc_emisor: '',
    razon_social: '',
    company_id: '01M0TYPKJGJVM53K56D7X9P7Z',
    certificado_digital: '',
    certificado_password: ''
  });

  useEffect(() => {
    if (config) {
      setBillingMode(config.is_active ? 'e-ncf' : 'ncf');
      setFormData({
        environment: config.environment || 'SANDBOX',
        api_token: config.api_token || '',
        base_url: config.base_url || (config.environment === 'PRODUCTION' ? 'https://api.alanube.co' : 'https://sandbox.alanube.co'),
        rnc_emisor: config.rnc_emisor || '',
        razon_social: config.razon_social || '',
        company_id: config.company_id || (typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : '') || '01M0TYPKJGJVM53K56D7X9P7Z',
        certificado_digital: config.certificado_digital || '',
        certificado_password: config.certificado_password || ''
      });
    }
  }, [config]);

  useEffect(() => {
    if (onModeChange) {
      onModeChange(billingMode);
    }
  }, [billingMode, onModeChange]);

  const handleTestConnection = async () => {
    if (!formData.api_token) {
      toast({
        title: 'Falta Token',
        description: 'Ingresa tu Token de Alanube antes de probar la conexión.',
        variant: 'destructive'
      });
      return;
    }

    setIsTesting(true);
    setConnectionStatus(null);

    try {
      const client = new AlanubeClient({
        api_token: formData.api_token,
        environment: formData.environment,
        base_url: formData.base_url,
        rnc_emisor: formData.rnc_emisor,
        razon_social: formData.razon_social,
        company_id: formData.company_id
      });

      const result = await client.testConnection();
      setConnectionStatus(result);

      if (result.success) {
        if (result.data) {
          const updateFields: any = {};
          if (result.data.name && result.data.name !== formData.razon_social) {
            updateFields.razon_social = result.data.name;
          }
          if (result.data.identification && result.data.identification !== formData.rnc_emisor) {
            updateFields.rnc_emisor = result.data.identification;
          }
          if (result.data.id && result.data.id !== formData.company_id) {
            updateFields.company_id = result.data.id;
          }
          if (Object.keys(updateFields).length > 0) {
            setFormData(prev => ({ ...prev, ...updateFields }));
          }
        }

        toast({
          title: 'Conexión Exitosa',
          description: result.message
        });
      } else {
        toast({
          title: 'Respuesta de Alanube',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      setConnectionStatus({ success: false, message: err?.message || 'Error al conectar' });
      toast({
        title: 'Error de Conexión',
        description: err?.message || 'No se pudo conectar con Alanube.',
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      if (billingMode === 'e-ncf') {
        if (!formData.api_token || !formData.rnc_emisor || !formData.razon_social) {
          toast({
            title: 'Faltan datos',
            description: 'Por favor completa el Token, RNC y Razón Social.',
            variant: 'destructive'
          });
          return;
        }
      }

      await updateConfig({
        ...formData,
        is_active: billingMode === 'e-ncf'
      });

      toast({
        title: 'Configuración guardada',
        description: `Método de facturación actualizado a ${billingMode === 'e-ncf' ? 'Electrónica (e-CF)' : 'Fiscal Tradicional (NCF)'}.`
      });
    } catch (error) {
      toast({
        title: 'Error al guardar',
        description: 'No se pudo guardar la configuración.',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Cargando configuración fiscal...</div>;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Server className="mr-2 h-5 w-5 text-primary" />
          Método de Facturación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={billingMode} 
          onValueChange={(val) => setBillingMode(val as 'ncf' | 'e-ncf')}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div 
            className={`relative flex items-center cursor-pointer rounded-xl border p-4 transition-all ${billingMode === 'ncf' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:bg-muted/40'}`}
            onClick={() => setBillingMode('ncf')}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="ncf" id="ncf" className="sr-only" />
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">Facturación Fiscal (NCF)</span>
              </div>
              {billingMode === 'ncf' && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          </div>

          <div 
            className={`relative flex items-center cursor-pointer rounded-xl border p-4 transition-all ${billingMode === 'e-ncf' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:bg-muted/40'}`}
            onClick={() => setBillingMode('e-ncf')}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="e-ncf" id="e-ncf" className="sr-only" />
                <Globe className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">Facturación Electrónica (e-CF)</span>
              </div>
              {billingMode === 'e-ncf' && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          </div>
        </RadioGroup>

        {billingMode === 'e-ncf' && (
          <div className="mt-6 space-y-4 rounded-md bg-muted/50 p-6 border">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Key className="h-5 w-5" />
              Credenciales de Alanube
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Entorno</Label>
                <Select
                  value={formData.environment}
                  onValueChange={(val: 'SANDBOX' | 'PRODUCTION') => setFormData({ 
                    ...formData, 
                    environment: val,
                    base_url: val === 'PRODUCTION' ? 'https://api.alanube.co' : 'https://sandbox.alanube.co'
                  })}
                >
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SANDBOX">Pruebas (Sandbox)</SelectItem>
                    <SelectItem value="PRODUCTION">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_url">URL de la API</Label>
                <div className="relative">
                  <Link className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="base_url"
                    className="pl-9"
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="api_token">Token de Autenticación (Bearer)</Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="api_token"
                    type="password"
                    className="pl-9"
                    placeholder="eyJh..."
                    value={formData.api_token}
                    onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rnc_emisor">RNC del Emisor</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rnc_emisor"
                    className="pl-9"
                    placeholder="130000000"
                    value={formData.rnc_emisor}
                    onChange={(e) => setFormData({ ...formData, rnc_emisor: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="razon_social">Razón Social</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="razon_social"
                    className="pl-9"
                    placeholder="Mi Empresa SRL o Harold Rosado Pacheco"
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="company_id">ID de Compañía en Alanube (Portal Reseller)</Label>
                <div className="relative">
                  <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company_id"
                    className="pl-9"
                    placeholder="01M0TYPKJGJVM53K56D7X9P7Z"
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Identificador único (ULID) de tu empresa en el portal de Alanube (ej: 01M0TYPKJGJVM53K56D7X9P7Z). Necesario para enrutar los e-CF de cuentas Reseller.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="certificado_digital">Certificado Digital (Opcional - Firma Delegada)</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="certificado_digital"
                    type="password"
                    className="pl-9"
                    placeholder="Contenido del certificado (.p12 / .pfx) en base64..."
                    value={formData.certificado_digital}
                    onChange={(e) => setFormData({ ...formData, certificado_digital: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Opcional. Alanube realiza la firma delegada en la nube utilizando el Token de Autenticación. Déjalo en blanco a menos que requieras firmar localmente.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="certificado_password">Contraseña del Certificado (Opcional)</Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="certificado_password"
                    type="password"
                    className="pl-9"
                    placeholder="••••••••"
                    value={formData.certificado_password}
                    onChange={(e) => setFormData({ ...formData, certificado_password: e.target.value })}
                  />
                </div>
              </div>

              {connectionStatus && (
                <div className={`md:col-span-2 p-3 rounded-lg border flex items-center gap-2 text-sm ${connectionStatus.success ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                  {connectionStatus.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{connectionStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {isUpdating ? 'Guardando...' : 'Guardar Método de Facturación'}
          </Button>

          {billingMode === 'e-ncf' && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={isTesting || !formData.api_token}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Verificando con Alanube...' : 'Probar Conexión con Alanube'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
