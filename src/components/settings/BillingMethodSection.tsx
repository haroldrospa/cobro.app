import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Save, Server, Link, Key, Hash, FileText, Printer, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
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

  const handleModeSelect = async (mode: 'ncf' | 'e-ncf') => {
    setBillingMode(mode);
    try {
      await updateConfig({ is_active: mode === 'e-ncf' });
      toast({
        title: mode === 'e-ncf' ? 'Facturación Electrónica activada' : 'Facturación Fiscal activada',
        description: 'La configuración se actualizó en Supabase para todas las computadoras del negocio.'
      });
    } catch (e: any) {
      toast({
        title: 'Error al cambiar método',
        description: e?.message || 'No se pudo guardar el método en Supabase.',
        variant: 'destructive'
      });
    }
  };
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    environment: 'PRODUCTION' as 'SANDBOX' | 'PRODUCTION',
    api_token: '',
    base_url: 'https://api.alanube.co',
    rnc_emisor: '',
    razon_social: '',
    company_id: '',
    sequence_due_date: '',
    certificado_digital: '',
    certificado_password: ''
  });

  useEffect(() => {
    if (config) {
      const mode = config.is_active ? 'e-ncf' : 'ncf';
      setBillingMode(mode);

      const oldKnownIds = [
        '01M731VKCJH3NR7XZPAY8725TE',
        '01M0TYPKJ0JGVM53K56D7X9P7Z',
        '01M2RBT1TH2R6NFHSEJH2GB672',
        '01M0TYPKJGJVM53K56D7X9P7Z'
      ];
      const rawCompId = (config.company_id || '').trim();
      const safeCompId = oldKnownIds.includes(rawCompId) ? '' : rawCompId;

      setFormData({
        environment: config.environment || 'PRODUCTION',
        api_token: config.api_token || '',
        base_url: config.base_url || (config.environment === 'PRODUCTION' ? 'https://api.alanube.co' : 'https://sandbox.alanube.co'),
        rnc_emisor: config.rnc_emisor || '',
        razon_social: config.razon_social || '',
        company_id: safeCompId,
        sequence_due_date: config.sequence_due_date || '',
        certificado_digital: config.certificado_digital || '',
        certificado_password: config.certificado_password || ''
      });
    }
  }, [config]);

  useEffect(() => {
    if (onModeChange && config) {
      onModeChange(billingMode);
    }
  }, [billingMode, onModeChange, config]);

  const handleTestConnection = async () => {
    const activeToken = (config?.api_token || formData.api_token || '').trim();

    if (!activeToken) {
      toast({
        title: 'Falta Token Maestro',
        description: 'El Token Maestro de Alanube no ha sido configurado en el Panel Maestro. Por favor configúralo en el Panel Maestro.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.rnc_emisor && !formData.company_id) {
      toast({
        title: 'Faltan datos de la empresa',
        description: 'Ingresa el RNC del Emisor o el ID de Compañía antes de probar la conexión.',
        variant: 'destructive'
      });
      return;
    }

    setIsTesting(true);
    setConnectionStatus(null);

    try {
      const client = new AlanubeClient({
        api_token: activeToken,
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
          // Nota: El company_id se mantiene estrictamente como esté en el formulario y NUNCA se sobreescribe automáticamente
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
        if (!formData.rnc_emisor.trim() || !formData.razon_social.trim()) {
          toast({
            title: 'Faltan datos obligatorios',
            description: 'Por favor completa el RNC del Emisor y la Razón Social.',
            variant: 'destructive'
          });
          return;
        }
      }

      const cleanedCompanyId = (formData.company_id || '').trim();
      const cleanedDueDate = (formData.sequence_due_date || '').trim();

      await updateConfig({
        environment: formData.environment,
        base_url: formData.base_url.trim(),
        rnc_emisor: formData.rnc_emisor.trim(),
        razon_social: formData.razon_social.trim(),
        company_id: cleanedCompanyId,
        sequence_due_date: cleanedDueDate,
        is_active: billingMode === 'e-ncf'
      });

      if (typeof window !== 'undefined') {
        if (cleanedCompanyId) localStorage.setItem('alanube_company_id', cleanedCompanyId);
        else localStorage.removeItem('alanube_company_id');

        if (formData.rnc_emisor.trim()) localStorage.setItem('alanube_rnc_emisor', formData.rnc_emisor.trim());
        else localStorage.removeItem('alanube_rnc_emisor');

        if (formData.razon_social.trim()) localStorage.setItem('alanube_razon_social', formData.razon_social.trim());
        else localStorage.removeItem('alanube_razon_social');

        if (cleanedDueDate) localStorage.setItem('alanube_sequence_due_date', cleanedDueDate);
        else localStorage.removeItem('alanube_sequence_due_date');

        localStorage.setItem('alanube_environment', formData.environment);
      }

      toast({
        title: 'Configuración guardada',
        description: `Método de facturación actualizado y guardado correctamente.`
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
          onValueChange={(val) => handleModeSelect(val as 'ncf' | 'e-ncf')}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div 
            className={`relative flex items-center cursor-pointer rounded-xl border p-4 transition-all ${billingMode === 'ncf' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:bg-muted/40'}`}
            onClick={() => handleModeSelect('ncf')}
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
            onClick={() => handleModeSelect('e-ncf')}
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
              {/* Token Maestro Centralizado Info Banner */}
              <div className="md:col-span-2 flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-xs">Token de Autenticación Maestro Centralizado</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    El token de conexión con Alanube está administrado de forma global y segura desde el Panel Maestro para todos los negocios y sucursales. No necesitas ingresarlo aquí.
                  </p>
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="rnc_emisor">RNC del Emisor</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rnc_emisor"
                    className="pl-9 font-mono"
                    placeholder="Ej. 130000000 o 40200000000"
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
                    placeholder="Ej. Mi Empresa SRL"
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="company_id">ID de Compañía en Alanube (Portal Reseller)</Label>
                  {formData.company_id && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, company_id: '' })}
                      className="text-[11px] text-destructive hover:underline font-medium"
                    >
                      Dejar vacío
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company_id"
                    className="pl-9 pr-9 font-mono"
                    placeholder="Ej. 01M... (dejar vacío si no has colocado uno nuevo)"
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  />
                  {formData.company_id && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, company_id: '' })}
                      className="absolute right-2.5 top-2.5 h-5 w-5 rounded-full flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Borrar ID"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Identificador único (ULID de 26 caracteres) de la empresa en el portal de Alanube. Si no tienes uno asignado todavía, déjalo vacío.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sequence_due_date">Fecha de Vencimiento de Secuencia DGII (e-CF)</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sequence_due_date"
                    className="pl-9 font-mono"
                    placeholder="YYYY-MM-DD (ej: 2026-12-31)"
                    value={formData.sequence_due_date}
                    onChange={(e) => setFormData({ ...formData, sequence_due_date: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Fecha límite autorizada por la DGII para tus secuencias e-CF (Crédito Fiscal E31, etc.) en formato YYYY-MM-DD. Debe coincidir con la autorización oficial para evitar el rechazo con Código 145.</p>
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
              disabled={isTesting}
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
