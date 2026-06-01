import React from 'react';
import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Category } from '@/hooks/useCategories';
import { ProductFormData } from './productFormSchema';
import { ProductImageUpload } from './ProductImageUpload';
import { ProductOffersManager } from './ProductOffersManager';
import { Separator } from '@/components/ui/separator';
import { ManageCategoriesDialog } from './ManageCategoriesDialog';
import { Percent, Star, Calendar as CalendarIcon, Eye, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import BarcodesManager from './BarcodesManager';
import { ProductBarcode } from '@/hooks/useProducts';

interface ProductFormFieldsProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  categories: Category[];
  productId?: string;
  /** Códigos de barra adicionales (no incluye el principal) */
  extraBarcodes: Omit<ProductBarcode, 'id'>[];
  onExtraBarcodesChange: (barcodes: Omit<ProductBarcode, 'id'>[]) => void;
}

export const ProductFormFields: React.FC<ProductFormFieldsProps> = ({
  register,
  errors,
  setValue,
  watch,
  categories,
  productId,
  extraBarcodes,
  onExtraBarcodesChange,
}) => {
  const selectedCategoryId = watch('category_id');
  const costIncludesTax = watch('cost_includes_tax');
  const isFeatured = watch('is_featured');
  const trackInventory = watch('track_inventory');
  const price = watch('price');
  const cost = watch('cost');
  const discountPercentage = watch('discount_percentage') || 0;

  const startDate = watch('discount_start_date');
  const endDate = watch('discount_end_date');
  const [isOffersOpen, setIsOffersOpen] = React.useState(false);

  // Helper to safely parse YYYY-MM-DD string to Date
  const parseDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return undefined;
    // Append T12:00:00 to avoid timezone shifts when just using 'YYYY-MM-DD'
    return new Date(dateStr + 'T12:00:00');
  };

  // Helper to update end date based on duration
  const setDuration = (days: number) => {
    const start = startDate ? parseDate(startDate) : new Date();
    if (start) {
      const end = addDays(start, days);
      setValue('discount_end_date', format(end, 'yyyy-MM-dd'));
      if (!startDate) {
        setValue('discount_start_date', format(new Date(), 'yyyy-MM-dd'));
      }
    }
  };

  // Calculate Profit
  const profitPercentage = React.useMemo(() => {
    if (!cost || cost === 0 || !price) return 0;

    // Si el precio incluye impuesto, debemos usar los valores netos para la ganancia real
    const taxRate = (watch('tax_percentage') || 18) / 100;
    const netPrice = costIncludesTax ? price / (1 + taxRate) : price;
    const netCost = costIncludesTax ? cost / (1 + taxRate) : cost;

    return ((netPrice - netCost) / netCost * 100).toFixed(2);
  }, [price, cost, costIncludesTax, watch('tax_percentage')]);

  // Calculate Discounted Price
  const discountedPrice = React.useMemo(() => {
    if (!price || discountPercentage <= 0) return null;
    return price * (1 - discountPercentage / 100);
  }, [price, discountPercentage]);

  return (
    <>
      {/* Campos más comunes - Arriba */}
      <ProductImageUpload
        imageUrl={watch('image_url')}
        onImageUpload={(url) => setValue('image_url', url)}
      />

      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Nombre del producto"
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="is_variable_price"
            checked={watch('is_variable_price')}
            onCheckedChange={(checked) => {
              setValue('is_variable_price', !!checked);
              if (checked) {
                setValue('price', 0); // Reset price to 0 to avoid validation errors
              }
            }}
          />
          <Label htmlFor="is_variable_price" className="text-sm font-medium cursor-pointer">
            Precio Variado (Se define al momento de vender)
          </Label>
        </div>

        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="is_variable_quantity"
            checked={watch('is_variable_quantity')}
            onCheckedChange={(checked) => {
              setValue('is_variable_quantity', !!checked);
            }}
          />
          <Label htmlFor="is_variable_quantity" className="text-sm font-medium cursor-pointer">
            Cantidad Variada / Pesar (Preguntar cantidad al vender)
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 1. COSTO o GANANCIA (Dependiendo del modo) */}
          <div className={watch('is_variable_price') ? "col-span-2" : ""}>
            <Label htmlFor="cost" className={watch('is_variable_price') ? "text-emerald-600 font-medium" : ""}>
              {watch('is_variable_price') ? "Porcentaje de Ganancia Deseada" : "Costo ($)"}
            </Label>

            {watch('is_variable_price') ? (
              // MODO PRECIO VARIADO: Input Controlado para GANANCIA (Invierte el costo)
              <div className="relative mt-1.5">
                <Input
                  id="profit_input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="pr-8 font-medium text-emerald-700"
                  // Calculamos la ganancia visual basada en el costo guardado (100 - costo)
                  value={cost !== undefined ? (100 - cost).toString() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const profit = parseFloat(val);
                    // Si es válido, actualizamos el costo inverso (100 - ganancia)
                    if (!isNaN(profit) && profit >= 0 && profit <= 100) {
                      setValue('cost', 100 - profit, { shouldValidate: true });
                    } else if (val === '') {
                      // Si borra, dejamos el costo en 100 (ganancia 0) para evitar NaN
                      setValue('cost', 100, { shouldValidate: true });
                    }
                  }}
                  placeholder="Ej: 40"
                />
                <div className="absolute right-3 top-2.5 text-emerald-600 font-bold">%</div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Si vendes a $100, tu ganancia será <strong>${100 - (cost || 0)}</strong>.
                </p>
              </div>
            ) : (
              // MODO PRECIO FIJO: Input Normal de Costo
              <div className="relative mt-1.5">
                <div className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</div>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  {...register('cost', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>
            )}

            {errors.cost && (
              <p className="text-sm text-red-500 mt-1">{errors.cost.message}</p>
            )}

            {watch('is_variable_price') && (
              <p className="hidden">
                {/* Input oculto para mantener registro si es necesario */}
              </p>
            )}
          </div>

          {/* 2. PRECIO (Oculto si es precio variado) */}
          <div className={watch('is_variable_price') ? "hidden" : ""}>
            <Label htmlFor="price">
              Precio Venta *
            </Label>
            <div className="relative mt-1.5">
              <div className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</div>
              <Input
                id="price"
                type="number"
                step="0.01"
                className="pl-7"
                {...register('price', { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
            {errors.price && (
              <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>
            )}
          </div>
        </div>

        {/* Paneles de Información de Margen */}
        {cost && (price || watch('is_variable_price')) && (
          <div className="mt-2 bg-muted/50 rounded-md p-3 border border-border/50">
            {!watch('is_variable_price') ? (
              // Modo Normal: Precio Fijo
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Margen de Ganancia</p>
                  <p className="text-lg font-bold text-emerald-600">
                    ${(price - cost).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Markup / Ganancia %</p>
                  <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                    <Percent className="h-3 w-3" />
                    <span>{profitPercentage}%</span>
                  </div>
                </div>
              </div>
            ) : (
              // Modo Precio Variado
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Margen Configurado</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {Math.max(0, 100 - (cost || 0)).toFixed(2)}%
                  </p>
                </div>
                <div className="text-xs text-muted-foreground text-right max-w-[180px]">
                  Por cada $100 de venta, tu ganancia será aprox. <span className="text-emerald-600 font-bold">${Math.max(0, 100 - (cost || 0))}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="category_id">Categoría</Label>
        <div className="flex items-center gap-2 mt-1.5">
          <Select
            onValueChange={(value) => setValue('category_id', value === 'no-category' ? null : value)}
            defaultValue={selectedCategoryId || 'no-category'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-category">Sin categoría</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ManageCategoriesDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="internal_code">Código Interno</Label>
          <Input
            id="internal_code"
            {...register('internal_code')}
            placeholder="Código interno del producto"
          />
        </div>

        <BarcodesManager
          primaryBarcode={watch('barcode') || ''}
          onPrimaryBarcodeChange={(value) => setValue('barcode', value)}
          extraBarcodes={extraBarcodes}
          onExtraBarcodesChange={onExtraBarcodesChange}
        />
      </div>

      {/* Controlar inventario (Stock) */}
      <div className="space-y-4 border rounded-lg p-4 bg-card/30">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track_inventory"
            checked={trackInventory}
            onCheckedChange={(checked) => setValue('track_inventory', !!checked)}
          />
          <Label htmlFor="track_inventory" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
            <Package className="h-4 w-4 text-emerald-600" />
            Controlar inventario (stock)
          </Label>
        </div>

        {trackInventory && (
          <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
            <div>
              <Label htmlFor="stock">Stock Actual *</Label>
              <Input
                id="stock"
                type="number"
                step="any"
                className="mt-1.5"
                {...register('stock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.stock && (
                <p className="text-sm text-red-500 mt-1">{errors.stock.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="min_stock">Stock Mínimo *</Label>
              <Input
                id="min_stock"
                type="number"
                step="any"
                className="mt-1.5"
                {...register('min_stock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.min_stock && (
                <p className="text-sm text-red-500 mt-1">{errors.min_stock.message}</p>
              )}
            </div>
          </div>
        )}

        {!trackInventory && (
          <div className="p-3 bg-amber-500/5 dark:bg-amber-950/10 rounded-lg border border-amber-500/10 mt-2">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ℹ️ Este producto no controla inventario. Ideal para servicios o productos digitales.
            </p>
          </div>
        )}
      </div>

      {/* Sección de Descuentos y Ofertas */}
      <Separator className="my-4" />
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setIsOffersOpen(!isOffersOpen)}
          className="flex items-center w-full justify-between focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-destructive" />
            <Label className="text-base font-semibold cursor-pointer">Descuentos y Configuración de Visibilidad</Label>
          </div>
          {isOffersOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </button>

        {isOffersOpen && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_featured"
                checked={isFeatured}
                onCheckedChange={(checked) => setValue('is_featured', !!checked)}
              />
              <Label htmlFor="is_featured" className="text-sm font-normal flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Producto destacado (aparece en ofertas)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_visible_in_store"
                checked={watch('is_visible_in_store')}
                onCheckedChange={(checked) => setValue('is_visible_in_store', !!checked)}
              />
              <Label htmlFor="is_visible_in_store" className="text-sm font-normal flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Mostrar en Mi Tienda (Visible al público)
              </Label>
            </div>



            <div>
              <Label htmlFor="discount_percentage">Porcentaje de Descuento (%)</Label>
              <Input
                id="discount_percentage"
                type="number"
                step="1"
                min="0"
                max="100"
                {...register('discount_percentage', { valueAsNumber: true })}
                placeholder="0"
              />
              {discountedPrice && (
                <div className="mt-2 p-2 bg-destructive/10 rounded-md flex items-center justify-between">
                  <span className="text-sm">Precio con descuento:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through text-muted-foreground">${price?.toFixed(2)}</span>
                    <span className="text-lg font-bold text-destructive">${discountedPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Pickers with Shortcuts */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(parseDate(startDate)!, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDate(startDate)}
                        onSelect={(date) => date && setValue('discount_start_date', format(date, 'yyyy-MM-dd'))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label>Fecha Fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(parseDate(endDate)!, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDate(endDate)}
                        onSelect={(date) => date && setValue('discount_end_date', format(date, 'yyyy-MM-dd'))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Quick Duration Buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duración de la oferta:</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(3)} className="h-8">3 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(7)} className="h-8">7 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(15)} className="h-8">15 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(30)} className="h-8">30 Días</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* Campos menos comunes - Abajo */}


      <div>
        <Label htmlFor="tax_percentage">Porcentaje de Impuesto (%)</Label>
        <Input
          id="tax_percentage"
          type="number"
          step="0.01"
          {...register('tax_percentage', { valueAsNumber: true })}
          placeholder="18"
        />
        {errors.tax_percentage && (
          <p className="text-sm text-red-500 mt-1">{errors.tax_percentage.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="cost_includes_tax"
          checked={costIncludesTax}
          onCheckedChange={(checked) => setValue('cost_includes_tax', !!checked)}
        />
        <Label htmlFor="cost_includes_tax" className="text-sm font-normal">
          El costo y precio incluyen impuesto (ITBIS/Tax incluido)
        </Label>
      </div>



      {/* Ofertas por Cantidad */}
      <Separator className="my-4" />
      <ProductOffersManager
        productId={productId}
        productPrice={price || 0}
      />

      <Separator className="my-4" />
      <div>
        <Label htmlFor="status">Estado</Label>
        <Select value={watch('status')} onValueChange={(value: 'active' | 'inactive') => setValue('status', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
};
