import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Image as ImageIcon,
  ExternalLink,
  Save,
  AlertTriangle,
  RefreshCcw,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  usePromotionalBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  PromotionalBanner
} from '@/hooks/usePromotionalBanners';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/utils/imageCompression';

interface BannerFormData {
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
}

const initialFormData: BannerFormData = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  is_active: true,
};

const BannerSettingsSection: React.FC = () => {
  const { data: banners = [], isLoading } = usePromotionalBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const { data: userStore } = useUserStore();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromotionalBanner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(initialFormData);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Storage check removed as it was causing false positive 400 errors.
  // Upload logic is now robust enough to handle errors directly.


  const handleOpenCreate = () => {
    setEditingBanner(null);
    setFormData(initialFormData);
    setPreviewUrl(null);
    setShowDialog(true);
  };

  const handleOpenEdit = (banner: PromotionalBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      is_active: banner.is_active,
    });
    setPreviewUrl(null);
    setShowDialog(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen es muy grande. Máximo 50MB.",
        variant: "destructive",
      });
      return;
    }

    // Show immediate preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error("No hay sesión activa.");
      }

      let fileToUpload = file;
      try {
        // Compress the image before uploading
        // Max width 1200px as recommended in UI, quality 0.8
        fileToUpload = await compressImage(file, 1200, 0.8);
      } catch (compressionError) {
        console.warn('Image compression failed, falling back to original file:', compressionError);
        // Continue with original file if compression fails
      }

      const fileExt = fileToUpload.name.split('.').pop() || 'png';
      // Ensure we use a unique name, maybe with .jpg if we converted it, but keeping original ext in name is fine for uniqueness
      // actually compressImage returns a file with the original name but jpeg type. 
      // let's force .jpg extension if we compressed it successfully
      const finalExt = fileToUpload.type === 'image/jpeg' ? 'jpg' : fileExt;
      // Ensure we have userStore
      if (!userStore?.id) {
        throw new Error("No se ha podido identificar la tienda activa.");
      }

      const fileName = `${userStore.id}/banners/${Date.now()}.${finalExt}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${fileName}`;

      console.log('[BannerUpload] Uploading raw binary to:', uploadUrl);

      // Direct fetch bypasses the SDK's multipart wrapping bug
      // The SDK was storing the entire FormData body (with headers) as the file content
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': fileToUpload.type || 'image/jpeg',
          'Cache-Control': '3600',
          'x-upsert': 'true',
        },
        body: fileToUpload, // pure binary, NOT FormData
      });

      if (!uploadResponse.ok) {
        let errMsg = `Error al subir (${uploadResponse.status})`;
        try {
          const errJson = await uploadResponse.json();
          errMsg = errJson.message || errMsg;
        } catch (_) { }
        console.error('[BannerUpload] Upload failed:', errMsg);
        throw new Error(errMsg);
      }

      // Build the public URL directly — no getPublicUrl() needed
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`;

      console.log('[BannerUpload] ✅ Raw upload OK! Public URL:', publicUrl);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast({ title: "Imagen subida", description: "La imagen se ha subido correctamente." });
    } catch (error: any) {
      console.error('Upload error:', error);
      setPreviewUrl(null);

      const message = error?.message || "No se pudo subir la imagen.";
      toast({
        title: "Error al subir",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.image_url) {
      toast({
        title: "Error",
        description: "Debes subir una imagen o ingresar una URL válida.",
        variant: "destructive",
      });
      return;
    }

    if (editingBanner) {
      await updateBanner.mutateAsync({
        id: editingBanner.id,
        ...formData,
      });
    } else {
      await createBanner.mutateAsync({
        ...formData,
        sort_order: banners.length,
      });
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este banner?')) {
      await deleteBanner.mutateAsync(id);
    }
  };

  const handleToggleActive = async (banner: PromotionalBanner) => {
    await updateBanner.mutateAsync({
      id: banner.id,
      is_active: !banner.is_active,
    });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="h-24 bg-muted rounded-lg" />
      ))}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banners Promocionales</h3>
          <p className="text-sm text-muted-foreground">
            Configura los banners que aparecerán en la parte superior de tu tienda
          </p>
          <div className="mt-2 text-xs bg-muted/50 p-2 rounded-md border border-border/50 text-muted-foreground">
            <p className="font-semibold mb-1">📏 Medida Única Universal:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Resolución: <strong>1200x400 px</strong> (Proporción 3:1)</li>
              <li>La imagen se adaptará automáticamente a todos los dispositivos sin cortarse.</li>
              <li>Formato: JPG o PNG optimizado (Max 50MB)</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Banner
          </Button>
        </div>

      </div>

      {banners.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No tienes banners configurados
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <Card key={banner.id} className={!banner.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />

                  <div className="h-16 w-28 shrink-0 relative bg-muted rounded-lg overflow-hidden">
                    {banner.image_url ? (
                      <>
                        <img
                          src={banner.image_url}
                          alt={banner.title || 'Banner'}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover z-10 relative"
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                        <div className="absolute inset-0 flex items-center justify-center z-0">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{banner.title || 'Sin título'}</h4>
                    <p className="text-sm text-muted-foreground truncate">{banner.subtitle || 'Sin subtítulo'}</p>
                    {banner.link_url && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate">{banner.link_url}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(banner)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(banner.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? 'Editar Banner' : 'Nuevo Banner'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Imagen del Banner</Label>
              {(formData.image_url || previewUrl) ? (
                <div className="relative">
                  <img
                    src={previewUrl || formData.image_url}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className={`w-full h-32 object-cover rounded-lg ${uploading ? 'opacity-50' : ''}`}
                    onLoad={(e) => console.log('[BannerPreview] ✅ Preview image loaded ok')}
                    onError={(e) => {
                      console.error('[BannerPreview] ❌ Preview image failed, URL:', previewUrl || formData.image_url);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden w-full h-32 rounded-lg bg-muted flex flex-col items-center justify-center gap-1 border-2 border-dashed border-destructive/40">
                    <p className="text-xs text-destructive font-medium">No se puede cargar la imagen</p>
                    <p className="text-[10px] text-muted-foreground text-center px-2 break-all">
                      {(previewUrl || formData.image_url)?.substring(0, 100)}
                    </p>
                    {formData.image_url && !previewUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 h-6 px-2 text-[10px]"
                        onClick={() => window.open(formData.image_url!, '_blank')}
                      >
                        Abrir URL en nueva pestaña
                      </Button>
                    )}
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/80 px-3 py-1 rounded-full text-xs font-medium animate-pulse">
                        Subiendo...
                      </div>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    disabled={uploading}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, image_url: '' }));
                      setPreviewUrl(null);
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="banner-image-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="banner-image-upload"
                    className={`flex flex-col items-center cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Subiendo...' : 'Click para subir imagen'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Recomendado: 1200x400px
                    </span>
                  </label>
                </div>
              )}

              <div className="mt-2 text-xs">
                <p className="text-muted-foreground mb-1">O pega una URL de imagen externa:</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={formData.image_url || ''}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, image_url: e.target.value }));
                      setPreviewUrl(null);
                    }}
                    className="h-8 font-mono text-[10px]"
                  />
                  {formData.image_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs whitespace-nowrap"
                      onClick={() => window.open(formData.image_url!, '_blank')}
                    >
                      Abrir URL
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-title">Título (opcional)</Label>
              <Input
                id="banner-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: ¡Gran Oferta de Verano!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-subtitle">Subtítulo (opcional)</Label>
              <Input
                id="banner-subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Ej: Hasta 50% de descuento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-link">URL de enlace (opcional)</Label>
              <Input
                id="banner-link"
                value={formData.link_url}
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="Ej: https://..."
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Banner activo</p>
                <p className="text-xs text-muted-foreground">Mostrar en la tienda</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createBanner.isPending || updateBanner.isPending || uploading || !formData.image_url}
            >
              {uploading ? (
                <>Subiendo...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BannerSettingsSection;
