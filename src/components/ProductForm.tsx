
import React, { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { X, Save } from 'lucide-react';
import { Product, ProductBarcode } from '@/hooks/useProducts';
import { useCreateProductOffline, useUpdateProductOffline } from '@/hooks/useProductsOffline';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { productSchema, ProductFormData } from './product-form/productFormSchema';
import { ProductFormFields } from './product-form/ProductFormFields';
import { ProductFormActions } from './product-form/ProductFormActions';
import { useSyncProductBarcodes } from '@/hooks/useProductBarcodes';

interface ProductFormProps {
  product?: Product;
  prefilledValues?: Partial<Product>;
  onClose: () => void;
  onSuccess: (newProduct?: Product) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, prefilledValues, onClose, onSuccess }) => {
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProductOffline();
  const updateProduct = useUpdateProductOffline();
  const syncBarcodes = useSyncProductBarcodes();
  const { toast } = useToast();

  // Estado para el diálogo de confirmación de salida
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  // Guardamos la submit fn para poder llamarla desde el diálogo
  const pendingSubmitRef = useRef<(() => void) | null>(null);

  // Estado local para los códigos de barra adicionales
  const [extraBarcodes, setExtraBarcodes] = useState<Omit<ProductBarcode, 'id'>[]>(
    product?.barcodes?.map(b => ({ 
      barcode: b.barcode, 
      label: b.label,
      quantity: b.quantity,
      discount_value: b.discount_value,
      discount_type: b.discount_type
    })) ?? []
  );
  // Guardamos los barcodes originales para detectar cambios
  const originalBarcodes = useRef(
    product?.barcodes?.map(b => b.barcode).sort().join(',') ?? ''
  );

  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || prefilledValues?.name || '',
      price: product?.price || prefilledValues?.price || 0,
      cost: product?.cost || prefilledValues?.cost || undefined,
      cost_includes_tax: product ? (product.cost_includes_tax ?? true) : (prefilledValues?.cost_includes_tax ?? true),
      tax_percentage: product?.tax_percentage || prefilledValues?.tax_percentage || 18,
      internal_code: product?.internal_code || prefilledValues?.internal_code || '',
      barcode: product?.barcode || prefilledValues?.barcode || '',
      category_id: product?.category_id || prefilledValues?.category_id || '',
      stock: product?.stock || prefilledValues?.stock || 0,
      min_stock: product?.min_stock || prefilledValues?.min_stock || 0,
      status: (product?.status === 'low_stock' ? 'active' : product?.status) || (prefilledValues?.status === 'low_stock' ? 'active' : prefilledValues?.status) || 'active',
      image_url: product?.image_url || prefilledValues?.image_url || '',
      discount_percentage: product?.discount_percentage || prefilledValues?.discount_percentage || 0,
      discount_start_date: product?.discount_start_date || prefilledValues?.discount_start_date || '',
      discount_end_date: product?.discount_end_date || prefilledValues?.discount_end_date || '',
      is_featured: product?.is_featured || prefilledValues?.is_featured || false,
      is_variable_price: product?.is_variable_price || prefilledValues?.is_variable_price || false,
      is_variable_quantity: (product as any)?.is_variable_quantity || (prefilledValues as any)?.is_variable_quantity || false,
      is_visible_in_store: product?.is_visible_in_store ?? prefilledValues?.is_visible_in_store ?? true,
      track_inventory: product?.track_inventory ?? prefilledValues?.track_inventory ?? true,
    },
  });

  /** Detecta si hay cambios sin guardar (form o barcodes) */
  const hasUnsavedChanges = useCallback(() => {
    if (isDirty) return true;
    const currentBarcodes = extraBarcodes.map(b => b.barcode).sort().join(',');
    return currentBarcodes !== originalBarcodes.current;
  }, [isDirty, extraBarcodes]);

  /** Intento de cierre: si hay cambios sin guardar, mostrar diálogo */
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  /** Clic en el backdrop (fuera del Card) */
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Solo reaccionar si el clic fue exactamente en el backdrop, no en el Card
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const onSubmit = async (data: ProductFormData) => {
    try {
      const productData = {
        name: data.name,
        price: Number(data.price),
        cost: data.cost ? Number(data.cost) : undefined,
        cost_includes_tax: Boolean(data.cost_includes_tax),
        tax_percentage: Number(data.tax_percentage),
        internal_code: data.internal_code || undefined,
        barcode: data.barcode || undefined,
        category_id: data.category_id && data.category_id !== '' ? data.category_id : null,
        stock: Number(data.stock),
        min_stock: Number(data.min_stock),
        status: data.status,
        image_url: data.image_url && data.image_url !== '' ? data.image_url : undefined,
        discount_percentage: Number(data.discount_percentage) || 0,
        discount_start_date: data.discount_start_date && data.discount_start_date !== '' ? data.discount_start_date : null,
        discount_end_date: data.discount_end_date && data.discount_end_date !== '' ? data.discount_end_date : null,
        is_featured: Boolean(data.is_featured),
        is_variable_price: Boolean(data.is_variable_price),
        is_variable_quantity: Boolean(data.is_variable_quantity),
        is_visible_in_store: Boolean(data.is_visible_in_store),
        track_inventory: Boolean(data.track_inventory),
      };

      let savedProductId: string;
      let createdProductObj: Product | undefined = undefined;

      if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...productData });
        savedProductId = product.id;
        toast({ title: "Producto actualizado", description: "El producto se ha actualizado correctamente." });
      } else {
        const created = await createProduct.mutateAsync(productData);
        savedProductId = (created as any).id;
        createdProductObj = created as Product;
        toast({ title: "Producto creado", description: "El producto se ha creado correctamente." });
      }

      if (savedProductId) {
        await syncBarcodes.mutateAsync({ productId: savedProductId, barcodes: extraBarcodes });
      }

      onSuccess(createdProductObj || (product ? { ...product, ...productData } : undefined));
      onClose();
    } catch (error: any) {
      console.error('Error al guardar producto:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar el producto. Inténtalo de nuevo.",
      });
    }
  };

  const isLoading = createProduct.isPending || updateProduct.isPending || syncBarcodes.isPending;

  return (
    <>
      {/* Backdrop — clic afuera cierra (con confirmación si hay cambios) */}
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        {/* Stoppage propagation: clic dentro del Card NO cierra */}
        <Card
          className="w-full max-w-md max-h-[75vh] md:max-h-[90vh] mb-[76px] md:mb-0 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-center justify-between bg-card z-10 border-b flex-shrink-0">
            <CardTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <CardContent className="flex-1 overflow-y-auto pt-4 pb-6">
              <ProductFormFields
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
                categories={categories}
                productId={product?.id}
                extraBarcodes={extraBarcodes}
                onExtraBarcodesChange={setExtraBarcodes}
              />
            </CardContent>
            
            <div className="p-4 border-t bg-card flex-shrink-0 sticky bottom-0 z-10">
              <ProductFormActions
                onClose={handleClose}
                isLoading={isLoading}
              />
            </div>
          </form>
        </Card>
      </div>

      {/* Diálogo de confirmación al salir con cambios sin guardar */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en este producto. ¿Qué deseas hacer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Guardar y cerrar — acción principal */}
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedDialog(false);
                handleSubmit(onSubmit)();
              }}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-4 w-4" />
              Guardar cambios
            </AlertDialogAction>

            {/* Seguir editando */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowUnsavedDialog(false)}
            >
              Seguir editando
            </Button>

            {/* Descartar — acción destructiva, al final */}
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:ring-destructive"
              onClick={() => {
                setShowUnsavedDialog(false);
                onClose();
              }}
            >
              Descartar cambios
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProductForm;
