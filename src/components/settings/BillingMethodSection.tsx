import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Save, Server, Link, Key, Hash, FileText, Printer } from 'lucide-react';
import { useAlanubeConfig } from '@/hooks/useAlanubeConfig';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useStoreSettings } from '@/hooks/useStoreSettings';

export default function BillingMethodSection({ onModeChange }: { onModeChange?: (mode: 'ncf' | 'e-ncf') => void }) {
  const { config, isLoading, isUpdating, updateConfig } = useAlanubeConfig();
  const { toast } = useToast();
  const { settings: storeSettings } = useStoreSettings();

  const [billingMode, setBillingMode] = useState<'ncf' | 'e-ncf'>('ncf');
  const [formData, setFormData] = useState({
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    api_token: '',
    base_url: 'https://sandbox.alanube.co',
    rnc_emisor: '',
    razon_social: '',
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
    <Card className="mb-6 border-blue-500/20 shadow-md">
      <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b">
        <CardTitle className="flex items-center text-blue-700 dark:text-blue-400">
          <Server className="mr-2 h-5 w-5" />
          Método de Facturación (DGII)
        </CardTitle>
        <CardDescription>
          Elige cómo deseas reportar tus facturas a la DGII
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <RadioGroup 
          value={billingMode} 
          onValueChange={(val) => setBillingMode(val as 'ncf' | 'e-ncf')}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div 
            className={`relative flex cursor-pointer rounded-lg border bg-white dark:bg-gray-950 p-4 shadow-sm focus:outline-none ${billingMode === 'ncf' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-800'}`}
            onClick={() => setBillingMode('ncf')}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <div className="text-sm">
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <RadioGroupItem value="ncf" id="ncf" className="sr-only" />
                    <FileText className="h-5 w-5 text-gray-500" />
                    Facturación Fiscal (NCF)
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    <p className="mt-1">Gestión tradicional con talonarios asignados por la DGII.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`relative flex cursor-pointer rounded-lg border bg-white dark:bg-gray-950 p-4 shadow-sm focus:outline-none ${billingMode === 'e-ncf' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-800'}`}
            onClick={() => setBillingMode('e-ncf')}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <div className="text-sm">
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <RadioGroupItem value="e-ncf" id="e-ncf" className="sr-only" />
                    <Globe className="h-5 w-5 text-blue-500" />
                    Facturación Electrónica (e-CF)
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    <p className="mt-1">Integración automatizada con Alanube para comprobantes electrónicos.</p>
                  </div>
                </div>
              </div>
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
                    placeholder="Mi Empresa SRL"
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  />
                </div>
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
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {isUpdating ? 'Guardando...' : 'Guardar Método de Facturación'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
