import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Store, Hash, Globe, Building2, Share2, Copy, ExternalLink, QrCode, Download, Palette, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type BusinessType = 'restaurant' | 'store' | 'supermarket';

const BUSINESS_TYPES: { id: BusinessType; label: string; emoji: string; description: string; color: string }[] = [
  {
    id: 'restaurant',
    label: 'Restaurante',
    emoji: '🍽️',
    description: 'Mesas, pantalla de cocina, pedidos para llevar y delivery',
    color: 'orange'
  },
  {
    id: 'store',
    label: 'Tienda',
    emoji: '🛍️',
    description: 'Venta directa, inventario, clientes y facturas',
    color: 'blue'
  },
  {
    id: 'supermarket',
    label: 'Supermercado',
    emoji: '🛒',
    description: 'Gran inventario, múltiples categorías y cajas rápidas',
    color: 'green'
  },
];


interface SettingsStoreSectionProps {
  storeLoading: boolean;
  userStore: any;
  profile: any;
  storeName: string;
  setStoreName: (name: string) => void;
  creatingStore: boolean;
  handleCreateStore: () => void;
  onUpdateStoreName?: (name: string) => void;
  isMobile?: boolean;
  logoUrl?: string | null;
  shopType: string;
  setShopType: (type: string) => void;
  handleSaveSettings: (section: string) => void;
  onSaveBusinessType?: (type: string) => void;
}

const SettingsStoreSection: React.FC<SettingsStoreSectionProps> = ({
  storeLoading,
  userStore,
  profile,
  storeName,
  setStoreName,
  creatingStore,
  handleCreateStore,
  onUpdateStoreName,
  isMobile = false,
  logoUrl,
  shopType,
  setShopType,
  handleSaveSettings,
  onSaveBusinessType,
}) => {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [newStoreName, setNewStoreName] = React.useState('');

  // Initialize newStoreName when userStore loads
  React.useEffect(() => {
    if (userStore?.store_name) {
      setNewStoreName(userStore.store_name);
    }
  }, [userStore]);

  const storeLookupCode = userStore?.store_code || profile?.user_number || '';
  const storeUrl = userStore ? `${window.location.origin}/tienda/${userStore.slug}` : '';

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    try {
      // Clone the SVG to avoid modifying the original
      const svgClone = svg.cloneNode(true) as SVGElement;

      // Find all image elements in the SVG
      const images = svgClone.querySelectorAll('image');

      // Convert each image to base64
      for (const imgElement of Array.from(images)) {
        const href = imgElement.getAttribute('href') || imgElement.getAttribute('xlink:href');
        if (!href || href.startsWith('data:')) {
          // Already a data URL, skip
          continue;
        }

        try {
          // Load the image and convert to base64
          const response = await fetch(href);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // Update the href to use base64
          imgElement.setAttribute('href', base64);
          imgElement.removeAttribute('xlink:href');
        } catch (error) {
          console.warn('Failed to convert image to base64:', error);
          // Continue with other images even if one fails
        }
      }

      // Wait a bit to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Serialize the SVG with embedded base64 images
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const img = new Image();

      img.onload = () => {
        canvas.width = 300;
        canvas.height = 300;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);

        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-tienda-${userStore?.store_code || 'mi-tienda'}.png`;
        link.href = pngUrl;
        link.click();

        toast({
          title: "QR Descargado",
          description: "El código QR se ha descargado correctamente con tu logo.",
        });
      };

      img.onerror = () => {
        toast({
          title: "Error al generar QR",
          description: "No se pudo generar la imagen. Intenta de nuevo.",
          variant: "destructive"
        });
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error downloading QR:', error);
      toast({
        title: "Error al descargar QR",
        description: "Ocurrió un error al generar la descarga.",
        variant: "destructive"
      });
    }
  };

  const handleSaveName = () => {
    if (onUpdateStoreName && newStoreName.trim()) {
      onUpdateStoreName(newStoreName);
      setIsEditingName(false);
    }
  };

  const content = (
    <div className="space-y-8">
      {storeLoading ? (
        <div className="text-center py-12 text-zinc-500 animate-pulse font-bold uppercase tracking-widest text-xs">
          Sincronizando información...
        </div>
      ) : !userStore ? (
        <div className="p-8 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2.5rem] space-y-6 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Store className="h-10 w-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-zinc-100 uppercase tracking-tight">Crea tu Tienda</h3>
            <p className="text-sm text-zinc-500 font-medium">
              Vende online de forma profesional y recibe pedidos directamente.
            </p>
          </div>
          <div className="space-y-4 pt-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="store-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Nombre de tu Tienda</Label>
              <Input
                id="store-name"
                className="bg-zinc-950/50 border-zinc-900 rounded-2xl h-12 text-lg focus:border-emerald-500/50 transition-all"
                placeholder="Ej: Boutique Elegancia"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={creatingStore}
              />
            </div>
            <Button
              onClick={handleCreateStore}
              disabled={creatingStore || !storeName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-14 font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.2)] transition-all"
            >
              {creatingStore ? 'Procesando...' : 'Activar Mi Tienda'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Store Name Edit Section */}
          <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/20 rounded-[2rem] space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              <Store className="h-4 w-4" />
              Identidad de Marca
            </div>
            {isEditingName ? (
              <div className="flex flex-col gap-3">
                <Input
                  className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Nombre de la tienda"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveName} disabled={!newStoreName.trim()} className="flex-1 bg-emerald-600 rounded-xl">
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditingName(false)} className="rounded-xl text-zinc-500">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-black text-2xl text-zinc-100 tracking-tighter">{userStore.store_name}</span>
                <Button variant="outline" size="sm" onClick={() => setIsEditingName(true)} className="rounded-full border-zinc-800 bg-zinc-900/50 text-emerald-500 h-8 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/10">
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          {/* Shop Theme Grid Section */}
          <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/20 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              <Palette className="h-4 w-4" />
              Especialización del Negocio
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {BUSINESS_TYPES.map((type) => {
                const normalizedType = shopType === 'store' ? 'store' : shopType === 'supermarket' ? 'supermarket' : 'restaurant';
                const isSelected = normalizedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setShopType(type.id);
                      if (onSaveBusinessType) onSaveBusinessType(type.id);
                      handleSaveSettings('tienda');
                    }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden group",
                      isSelected 
                        ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                        : "bg-zinc-950/40 border-zinc-800/50 hover:border-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-500 group-hover:scale-110",
                      isSelected ? "bg-emerald-500 text-white" : "bg-zinc-900 text-zinc-400"
                    )}>
                      {type.emoji}
                    </div>
                    <div className="flex-1">
                      <h4 className={cn(
                        "font-bold text-sm uppercase tracking-tight",
                        isSelected ? "text-emerald-500" : "text-zinc-100"
                      )}>
                        {type.label}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-medium leading-snug mt-0.5">
                        {type.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in duration-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* QR Code Section - IMPACTFUL PRESENTATION */}
          <div className="relative p-8 bg-zinc-100 rounded-[2.5rem] shadow-2xl overflow-hidden group">
            <div className="absolute top-0 right-0 p-4">
              <QrCode className="h-10 w-10 text-zinc-200" />
            </div>
            
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-1">
                <h3 className="text-zinc-950 font-black text-xl uppercase tracking-tighter leading-none">Acceso Directo</h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Escanea para comprar</p>
              </div>

              <div ref={qrRef} className="p-4 bg-white rounded-3xl shadow-inner border-4 border-zinc-50 transition-transform duration-500 group-hover:scale-105">
                <QRCodeSVG
                  value={storeUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                  imageSettings={logoUrl ? {
                    src: logoUrl,
                    x: undefined,
                    y: undefined,
                    height: 36,
                    width: 36,
                    excavate: true,
                  } : undefined}
                />
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950 rounded-2xl shadow-xl">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">TiendaID:</span>
                <span className="text-xs font-mono font-bold text-white tracking-widest">
                  {userStore?.store_code}
                </span>
              </div>

              <Button
                variant="ghost"
                className="w-full h-12 rounded-2xl bg-zinc-200 text-zinc-950 font-bold hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                onClick={handleDownloadQR}
              >
                <Download className="h-5 w-5 mr-2" />
                Descargar QR
              </Button>
            </div>
          </div>

          {/* Links & Sharing Section */}
          <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/20 rounded-[2rem] space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                <Globe className="h-4 w-4" />
                Presencia Digital
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/50">
                  <p className="flex-1 font-mono text-[10px] text-zinc-500 truncate lowercase">
                    {storeUrl.replace('https://', '')}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                    onClick={() => {
                      navigator.clipboard.writeText(storeUrl);
                      toast({ title: "Copiado", description: "Enlace listo para compartir" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="rounded-xl border-zinc-800 bg-zinc-900/50 text-zinc-100 hover:bg-emerald-500/10 h-11 text-xs font-bold"
                    onClick={() => window.open(storeUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir
                  </Button>
                  <Button
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white h-11 text-xs font-bold shadow-lg shadow-emerald-500/10"
                    onClick={() => {
                      const text = `¡Visita mi tienda online! ${storeUrl}`;
                      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );

  if (isMobile) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Store className="mr-2 h-5 w-5" />
          Mi Tienda Online
        </CardTitle>
        <CardDescription>
          Comparte tu tienda con tus clientes para que puedan hacer pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default SettingsStoreSection;
