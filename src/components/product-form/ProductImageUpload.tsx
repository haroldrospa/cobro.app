import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, ImageIcon, Link, Sparkles } from 'lucide-react';
import { removeImageBackgroundCanvas } from '@/utils/removeImageBackground';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface ProductImageUploadProps {
  imageUrl?: string;
  onImageUpload: (url: string) => void;
}

export const ProductImageUpload: React.FC<ProductImageUploadProps> = ({
  imageUrl,
  onImageUpload,
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const activeImageUrl = localPreviewUrl || imageUrl;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Imagen demasiado grande",
          description: "La imagen debe pesar menos de 5MB.",
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Intentar subir. Si el bucket no existe, intentamos crearlo una vez.
      let { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        const errMsg = uploadError.message?.toLowerCase() || '';
        console.warn('[Storage] Error en primer intento:', uploadError.message);

        // Si el bucket no existe, intentar crearlo y reintentar la subida
        if (errMsg.includes('not found') || errMsg.includes('does not exist') || errMsg.includes('bucket')) {
          console.log('[Storage] Intentando crear bucket product-images...');
          const { error: createError } = await supabase.storage.createBucket('product-images', {
            public: true,
            fileSizeLimit: 5242880,
          });

          if (createError && !createError.message?.includes('already exists')) {
            console.error('[Storage] No se pudo crear el bucket:', createError.message);
            throw new Error(`No se pudo crear el storage: ${createError.message}`);
          }

          // Reintentar la subida con contentType explícito
          const { error: retryError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, {
              contentType: file.type || 'image/jpeg',
              upsert: false,
            });

          if (retryError) throw new Error(retryError.message);
          uploadError = null;
        } else {
          throw new Error(uploadError.message);
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      console.log('✅ Imagen subida, URL pública:', publicUrl);

      // Usar URL local para vista previa instantánea (evita bloqueos de red)
      const previewUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(previewUrl);

      onImageUpload(publicUrl);
      setImageError(false);

      toast({
        title: "Imagen subida",
        description: "La imagen se ha subido correctamente.",
      });
    } catch (error: any) {
      const exactError = error?.message || error?.error_description || JSON.stringify(error);
      console.error('[Storage] Error subiendo imagen:', exactError);

      toast({
        variant: "destructive",
        title: "Error al subir imagen",
        description: exactError || "Error desconocido. Revisa la consola del navegador (F12).",
        duration: 10000,
      });
    } finally {
      setUploading(false);
    }
  };

  // Fast & non-blocking AI Background removal function
  const handleAIRemoveBackground = async (imageSource: string | File) => {
    try {
      setIsRemovingBg(true);
      toast({
        title: "Removiendo fondo...",
        description: "Procesando la imagen...",
      });

      // Ejecutar la remoción de fondo instantánea con Canvas
      const blob = await removeImageBackgroundCanvas(imageSource);

      const file = new File([blob], `product-no-bg-${Date.now()}.png`, { type: 'image/png' });
      const filePath = `no-bg-${Math.random().toString(36).substring(2, 9)}.png`;

      // Vista previa instantánea
      const localBlobUrl = URL.createObjectURL(blob);
      setLocalPreviewUrl(localBlobUrl);
      setImageError(false);

      // Subir imagen limpia PNG transparente a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.warn('[Storage] No se pudo guardar en Supabase, se mantendrá preview local:', uploadError.message);
        onImageUpload(localBlobUrl);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        const newPublicUrl = publicUrlData.publicUrl;
        onImageUpload(newPublicUrl);
      }

      toast({
        title: "¡Fondo removido!",
        description: "El fondo de la imagen se ha eliminado correctamente.",
      });
    } catch (error: any) {
      console.error('[AI BgRemoval Error]:', error);
      toast({
        variant: "destructive",
        title: "Error al remover fondo",
        description: error?.message || "No se pudo remover el fondo de esta imagen. Inténtalo con otra fotografía.",
      });
    } finally {
      setIsRemovingBg(false);
    }
  };

  // Intermediate trigger that passes existing state
  const handleRemoveBgFromCurrent = async () => {
    if (!activeImageUrl) return;
    await handleAIRemoveBackground(activeImageUrl);
  };

  const handleRemoveImage = () => {
    onImageUpload('');
    setLocalPreviewUrl(null);
    setImageError(false);
    setExternalUrl('');
  };

  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('❌ Error cargando imagen del producto:', { activeImageUrl });
    
    if (activeImageUrl && activeImageUrl.includes('supabase.co/storage')) {
      // Extraer el path completo después de /object/public/product-images/
      const marker = '/object/public/product-images/';
      const markerIndex = activeImageUrl.indexOf(marker);
      const filePath = markerIndex !== -1
        ? activeImageUrl.substring(markerIndex + marker.length).split('?')[0]
        : activeImageUrl.split('/').pop()?.split('?')[0];

      if (filePath) {
        // Plan B: URL firmada (funciona con buckets privados si el usuario está autenticado)
        try {
          console.log('🔄 Plan B: Generando URL firmada para:', filePath);
          const { data: signedData, error: signedError } = await supabase.storage
            .from('product-images')
            .createSignedUrl(filePath, 3600); // válida por 1 hora

          if (!signedError && signedData?.signedUrl) {
            console.log('✅ Plan B Exitoso: URL firmada generada');
            setLocalPreviewUrl(signedData.signedUrl);
            setImageError(false);
            return;
          }
          console.warn('⚠️ Plan B falló:', signedError?.message);
        } catch (err) {
          console.warn('⚠️ Plan B excepción:', err);
        }

        // Plan C: Descarga directa como blob
        try {
          console.log('🔄 Plan C: Descarga directa del blob...');
          const { data: blob, error: downloadError } = await supabase.storage
            .from('product-images')
            .download(filePath);

          if (!downloadError && blob && blob.size > 0) {
            const blobUrl = URL.createObjectURL(blob);
            console.log('✅ Plan C Exitoso: URL de blob creada');
            setLocalPreviewUrl(blobUrl);
            setImageError(false);
            return;
          }
          console.warn('⚠️ Plan C falló:', downloadError?.message);
        } catch (err) {
          console.warn('⚠️ Plan C excepción:', err);
        }
      }
    }
    
    setImageError(true);
  };


  const handleImageLoad = () => {
    if (activeImageUrl) {
      console.log('✅ Imagen cargada correctamente:', activeImageUrl);
      setImageError(false);
    }
  };

  const handleExternalUrlSubmit = () => {
    if (!externalUrl.trim()) {
      toast({
        variant: "destructive",
        title: "URL vacía",
        description: "Ingresa una URL válida de imagen.",
      });
      return;
    }

    // Validar que sea una URL
    try {
      new URL(externalUrl);
      onImageUpload(externalUrl.trim());
      setImageError(false);
      toast({
        title: "URL guardada",
        description: "La imagen se mostrará desde la URL externa.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "URL inválida",
        description: "Ingresa una URL válida (debe empezar con http:// o https://)",
      });
    }
  };

  return (
    <div>
      <Label>Foto del Producto</Label>
      {activeImageUrl ? (
        <div className="mt-2 relative">
          {imageError ? (
            <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center">
              <div className="text-center p-4">
                <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No se pudo cargar la imagen</p>
                <p className="text-[10px] text-muted-foreground mt-1 break-all line-clamp-2 px-4 italic opacity-70">
                  {activeImageUrl}
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[11px]"
                    onClick={() => {
                        setImageError(false);
                    }}
                  >
                    Reintentar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 text-[11px]"
                    onClick={handleRemoveImage}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <img
              key={activeImageUrl}
              src={activeImageUrl}
              alt="Producto"
              className="w-full h-48 object-cover rounded-md"
              onError={handleImageError}
              onLoad={handleImageLoad}
              loading="lazy"
            />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 shadow-md flex items-center gap-1 border border-emerald-500/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            disabled={isRemovingBg || uploading}
            onClick={handleRemoveBgFromCurrent}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isRemovingBg ? 'animate-pulse text-emerald-400' : 'text-emerald-300'}`} />
            {isRemovingBg ? 'Removiendo...' : 'Remover Fondo (IA)'}
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="mt-2">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Subir
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="h-4 w-4 mr-2" />
              URL Externa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <label htmlFor="image-upload" className="cursor-pointer">
              <div className="border-2 border-dashed border-border rounded-md p-6 hover:border-primary transition-colors flex flex-col items-center justify-center relative">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Subiendo...' : 'Click para subir imagen'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, GIF (max 5MB)
                </span>
                
                <div className="mt-3 flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold gap-1">
                  <Sparkles className="h-3 w-3" />
                  Puedes remover el fondo después de subirla
                </div>
              </div>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || isRemovingBg}
              />
            </label>
          </TabsContent>

          <TabsContent value="url">
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="https://ejemplo.com/imagen.jpg"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              <Button
                onClick={handleExternalUrlSubmit}
                className="w-full"
                type="button"
              >
                Usar esta URL
              </Button>
              <p className="text-xs text-muted-foreground">
                Usa URLs de servicios como Imgur, ImgBB, o Cloudinary
              </p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
