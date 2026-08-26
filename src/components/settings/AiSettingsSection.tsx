import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  Key, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Save, 
  ExternalLink, 
  Cpu, 
  ShieldCheck, 
  FileText, 
  Package, 
  Trash2,
  RefreshCw,
  Info
} from 'lucide-react';
import { testGroqApiKey, cleanAiKey, AiApiKeyTestResult } from '@/utils/aiService';

interface AiSettingsSectionProps {
  initialApiKey?: string | null;
  onSaveApiKey: (apiKey: string | null) => Promise<void>;
  isLoading?: boolean;
}

export const AiSettingsSection: React.FC<AiSettingsSectionProps> = ({
  initialApiKey = '',
  onSaveApiKey,
  isLoading = false,
}) => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState(initialApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiApiKeyTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when initialApiKey changes (e.g. on initial data load)
  useEffect(() => {
    setApiKey(initialApiKey || '');
  }, [initialApiKey]);

  const handleTestKey = async () => {
    const cleaned = cleanAiKey(apiKey);
    if (!cleaned) {
      toast({
        title: 'Clave Requerida',
        description: 'Introduce una clave de API de Groq antes de verificar.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testGroqApiKey(cleaned);
      setTestResult(result);

      if (result.success) {
        toast({
          title: '✅ Conexión Exitosa',
          description: result.message,
          className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
        });
      } else {
        toast({
          title: '❌ Error de Verificación',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error?.message || 'Error desconocido al probar la clave',
      });
      toast({
        title: 'Error de Red',
        description: 'No se pudo conectar a los servidores de Groq.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned = cleanAiKey(apiKey);
      await onSaveApiKey(cleaned);
      toast({
        title: 'Configuración Guardada',
        description: cleaned 
          ? 'Tu clave de Inteligencia Artificial se ha guardado correctamente y ya está activa en toda la app.'
          : 'Se ha eliminado la clave de API personalizada.',
      });
    } catch (error: any) {
      toast({
        title: 'Error al Guardar',
        description: error?.message || 'No se pudo guardar la clave de API.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = async () => {
    setApiKey('');
    setTestResult(null);
    setIsSaving(true);
    try {
      await onSaveApiKey(null);
      toast({
        title: 'Clave Eliminada',
        description: 'La clave de IA ha sido removida del sistema.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo limpiar la clave.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasConfiguredKey = !!cleanAiKey(apiKey);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Inteligencia Artificial & Visión
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Configura tu clave de Groq AI para habilitar el reconocimiento óptico (OCR), lectura automática de comprobantes en Contabilidad y carga ultra rápida de facturas en Stock/Inventario.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasConfiguredKey ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                IA Activa en el Sistema
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Sin Clave Configurada
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Clave de API de Groq (Groq API Key)
              </CardTitle>
              <CardDescription>
                Esta clave se utiliza para procesar imágenes con modelos de visión de última generación (Qwen 3.6 Vision / Llama Vision).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="ai-api-key" className="text-sm font-semibold flex items-center justify-between">
                  <span>Groq API Key (gsk_...)</span>
                  {hasConfiguredKey && (
                    <span className="text-xs text-muted-foreground font-normal">
                      Longitud: {apiKey.length} caracteres
                    </span>
                  )}
                </Label>

                <div className="relative flex items-center">
                  <Input
                    id="ai-api-key"
                    type={showKey ? 'text' : 'password'}
                    placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (testResult) setTestResult(null);
                    }}
                    className="pr-20 font-mono text-sm bg-background border-border/80 focus-visible:ring-primary h-11"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Las claves de Groq comienzan por <code className="text-primary font-mono font-semibold">gsk_</code>. Puedes generar una totalmente gratuita en tu panel de desarrollador de Groq.
                </p>
              </div>

              {/* Test Result Indicator */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 text-sm">
                      <p className="font-bold">{testResult.message}</p>
                      {testResult.success && (
                        <p className="text-xs text-muted-foreground">
                          Modelo predeterminado: <span className="font-mono text-primary font-semibold">Qwen 3.6 Vision (27B)</span> • Listo para procesar facturas y stock en milisegundos.
                        </p>
                      )}
                      {!testResult.success && testResult.errorDetails && (
                        <p className="text-xs font-mono opacity-80">
                          Detalle: {testResult.errorDetails}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleTestKey}
                  type="button"
                  variant="outline"
                  disabled={isTesting || !apiKey.trim() || isLoading}
                  className="border-primary/30 hover:bg-primary/10 h-11 px-5"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                      Verificando con Groq...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 text-primary" />
                      Verificar Clave
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="h-11 px-6 font-bold shadow-md shadow-primary/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Configuración de IA
                    </>
                  )}
                </Button>

                {hasConfiguredKey && (
                  <Button
                    onClick={handleClearKey}
                    type="button"
                    variant="ghost"
                    disabled={isSaving || isLoading}
                    className="text-destructive hover:bg-destructive/10 h-11 px-4 ml-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Clave
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Module Integration Status */}
          <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                Módulos que utilizan la Inteligencia Artificial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contabilidad */}
                <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <FileText className="h-4 w-4 text-emerald-500" />
                        Registro de Facturas & Gastos
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Contabilidad</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Extrae automáticamente fecha, NCF, monto, proveedor, concepto y categoría de recibos físicos.
                    </p>
                  </div>
                  <div className="text-[11px] font-semibold flex items-center gap-1 text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {hasConfiguredKey ? 'Conectado y Operativo' : 'Requiere API Key'}
                  </div>
                </div>

                {/* Productos */}
                <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <Package className="h-4 w-4 text-blue-500" />
                        Cargar Stock con IA
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Inventario</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lee facturas de compra/distribuidores e ingresa productos, cantidades, costos e ITBIS directo al stock.
                    </p>
                  </div>
                  <div className="text-[11px] font-semibold flex items-center gap-1 text-blue-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {hasConfiguredKey ? 'Conectado y Operativo' : 'Requiere API Key'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Step by step Guide */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <Info className="h-5 w-5" />
                ¿Cómo obtener tu clave gratis?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <ol className="space-y-3 list-decimal list-inside text-foreground/90 font-medium">
                <li>
                  Ingresa a <span className="font-bold text-primary">console.groq.com</span>
                </li>
                <li>
                  Inicia sesión con tu cuenta de Google o GitHub.
                </li>
                <li>
                  En el menú lateral, haz clic en <span className="font-bold text-primary">API Keys</span>.
                </li>
                <li>
                  Presiona el botón <span className="font-bold text-primary">Create API Key</span>.
                </li>
                <li>
                  Copia el código que inicia con <code className="bg-background px-1.5 py-0.5 rounded border text-primary">gsk_...</code> y pégalo aquí.
                </li>
              </ol>

              <div className="pt-2">
                <Button
                  asChild
                  variant="outline"
                  className="w-full bg-background border-primary/30 hover:bg-primary hover:text-white transition-all text-xs font-bold"
                >
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Abrir Groq Console
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-background/80 border border-border/50 text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground">💡 ¿Por qué Groq?</p>
                <p>
                  Groq ofrece procesamiento de IA de ultra alta velocidad (LPU) con cuotas gratuitas generosas todos los días para analizar cientos de facturas sin costo alguno.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
export default AiSettingsSection;
