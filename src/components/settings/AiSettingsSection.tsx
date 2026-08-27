import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  Loader2, 
  Eye, 
  EyeOff, 
  Save, 
  ExternalLink, 
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle
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

  useEffect(() => {
    setApiKey(initialApiKey || '');
  }, [initialApiKey]);

  const handleTestKey = async () => {
    const cleaned = cleanAiKey(apiKey);
    if (!cleaned) {
      toast({
        title: 'Clave Requerida',
        description: 'Introduce una clave de API antes de verificar.',
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
        message: error?.message || 'Error al conectar con Groq',
      });
      toast({
        title: 'Error de Red',
        description: 'No se pudo verificar la clave.',
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
        title: 'Guardado',
        description: cleaned 
          ? 'Clave de IA configurada correctamente.'
          : 'Clave de IA eliminada.',
      });
    } catch (error: any) {
      toast({
        title: 'Error al Guardar',
        description: error?.message || 'No se pudo guardar la clave.',
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
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Inteligencia Artificial
            </CardTitle>

            {hasConfiguredKey ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Activa
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground px-2.5 py-0.5 text-xs font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                Sin configurar
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-api-key" className="text-sm font-medium">
                Groq API Key
              </Label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Obtener clave gratis
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="relative flex items-center">
              <Input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (testResult) setTestResult(null);
                }}
                className="pr-10 font-mono text-sm h-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>

            <Button
              onClick={handleTestKey}
              type="button"
              variant="outline"
              disabled={isTesting || !apiKey.trim() || isLoading}
              className="gap-2"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar
            </Button>

            {hasConfiguredKey && (
              <Button
                onClick={handleClearKey}
                type="button"
                variant="ghost"
                disabled={isSaving || isLoading}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiSettingsSection;
