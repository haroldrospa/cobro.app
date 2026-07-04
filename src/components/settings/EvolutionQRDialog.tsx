import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EvolutionQRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export const EvolutionQRDialog: React.FC<EvolutionQRDialogProps> = ({
  isOpen,
  onClose,
  apiUrl,
  apiKey,
  instanceName
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qr_ready' | 'connected' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchQR = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      setStatus('error');
      setErrorMessage('Faltan datos de configuración (URL, Instancia o API Key).');
      return;
    }

    setStatus('loading');
    setQrCode(null);
    setErrorMessage('');

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

    // We make sure the URL has http/https
    const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

    try {
      // 1. Try to fetch existing connection status
      const connectResponse = await fetch(`${formattedUrl}/instance/connectionState/${instanceName}`, {
        headers: {
          'apikey': apiKey
        }
      });

      if (connectResponse.ok) {
        const stateData = await connectResponse.json();
        const state = stateData?.instance?.state || stateData?.state;
        
        if (state === 'open') {
          setStatus('connected');
          return;
        }
      }

      // 2. Fetch or generate QR
      // Try connect endpoint first
      let qrResponse = await fetch(`${formattedUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });

      // If instance doesn't exist, create it
      if (!qrResponse.ok || qrResponse.status === 404) {
        qrResponse = await fetch(`${formattedUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });
      }

      if (!qrResponse.ok) {
        throw new Error('No se pudo obtener el código QR de la API.');
      }

      const data = await qrResponse.json();
      
      if (data?.base64 || data?.qrcode?.base64) {
        setQrCode(data.base64 || data.qrcode.base64);
        setStatus('qr_ready');
      } else if (data?.instance?.state === 'open' || data?.state === 'open') {
        setStatus('connected');
      } else {
        throw new Error('No se recibió un código QR válido.');
      }

    } catch (error: any) {
      console.error('Error fetching QR:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Error de conexión con Evolution API.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQR();
    }
  }, [isOpen]);

  // Polling para verificar si se conectó después de escanear el QR
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isOpen && status === 'qr_ready') {
      intervalId = setInterval(async () => {
        try {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
          const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
          
          const connectResponse = await fetch(`${formattedUrl}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': apiKey }
          });

          if (connectResponse.ok) {
            const stateData = await connectResponse.json();
            const state = stateData?.instance?.state || stateData?.state;
            
            if (state === 'open') {
              setStatus('connected');
              toast({
                title: 'Conexión Exitosa',
                description: 'WhatsApp se ha conectado correctamente.',
              });
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          // Ignorar errores de red temporales durante el polling
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, status, apiUrl, apiKey, instanceName]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-500" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Escanea este código QR desde la opción "Dispositivos Vinculados" en tu WhatsApp para activar los envíos automáticos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[250px] p-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-zinc-400">Obteniendo código QR...</p>
            </div>
          )}

          {status === 'connected' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">¡WhatsApp Conectado!</h3>
              <p className="text-sm text-zinc-400">
                Tu instancia <span className="font-mono text-emerald-400">{instanceName}</span> está lista para enviar mensajes automáticamente.
              </p>
              <Button onClick={onClose} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white">
                Cerrar y Continuar
              </Button>
            </div>
          )}

          {status === 'qr_ready' && qrCode && (
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="bg-white p-4 rounded-3xl shadow-xl">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
              </div>
              
              <div className="w-full space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-100"
                  onClick={fetchQR}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Generar Nuevo QR
                </Button>
                <p className="text-[10px] text-center text-zinc-500 font-medium px-4">
                  Si el código expira o no funciona, genera uno nuevo.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-sm font-bold text-red-400">{errorMessage}</p>
              <Button onClick={fetchQR} className="mt-4 bg-zinc-800 hover:bg-zinc-700 text-white">
                Intentar de nuevo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
