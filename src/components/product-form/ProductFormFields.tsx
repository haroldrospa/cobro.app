import React, { useState, useMemo } from 'react';
import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Percent,
  Star,
  Calendar as CalendarIcon,
  Eye,
  Package,
  ChevronDown,
  ChevronRight,
  Camera,
  Tag,
  Receipt,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Barcode,
  Layers,
} from 'lucide-react';
import { Category } from '@/hooks/useCategories';
import { ProductFormData } from './productFormSchema';
import { ProductImageUpload } from './ProductImageUpload';
import { ProductOffersManager } from './ProductOffersManager';
import { ManageCategoriesDialog } from './ManageCategoriesDialog';
import BarcodesManager, { generateUniqueBarcodeFromProducts } from './BarcodesManager';
import { ProductBarcode } from '@/hooks/useProducts';
import { useBusinessType } from '@/hooks/useBusinessType';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProductsOffline } from '@/hooks/useProductsOffline';

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
  const { isStore } = useBusinessType();
  const { suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProductsOffline();

  // Watchers de campos clave
  const selectedCategoryId = watch('category_id');
  const selectedSupplierId = watch('supplier_id');
  const costIncludesTax = watch('cost_includes_tax');
  const isFeatured = watch('is_featured');
  const isVisibleInStore = watch('is_visible_in_store');
  const trackInventory = watch('track_inventory');
  const isVariablePrice = watch('is_variable_price');
  const isVariableQuantity = watch('is_variable_quantity');
  const price = watch('price');
  const cost = watch('cost');
  const barcode = watch('barcode');
  const imageUrl = watch('image_url');
  const taxPercentage = watch('tax_percentage') ?? 18;
  const discountPercentage = watch('discount_percentage') || 0;
  const startDate = watch('discount_start_date');
  const endDate = watch('discount_end_date');
  const status = watch('status');

  // Estado para controlar qué secciones avanzadas están abiertas
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    photo: false,
    supplierAndCodes: false,
    taxes: false,
    variableMode: Boolean(isVariablePrice || isVariableQuantity),
    inventory: false,
    discounts: Boolean(discountPercentage > 0 || isFeatured),
    wholesale: false,
    status: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Generar código de barras único para el campo principal
  const handleGenerateBarcode = () => {
    const code = generateUniqueBarcodeFromProducts(products, extraBarcodes);
    setValue('barcode', code, { shouldDirty: true, shouldValidate: true });
  };

  // Helper para parsear fecha YYYY-MM-DD
  const parseDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return undefined;
    return new Date(dateStr + 'T12:00:00');
  };

  // Atajos de duración de oferta
  const setDuration = (days: number) => {
    const start = startDate ? parseDate(startDate) : new Date();
    if (start) {
      const end = addDays(start, days);
      setValue('discount_end_date', format(end, 'yyyy-MM-dd'), { shouldDirty: true });
      if (!startDate) {
        setValue('discount_start_date', format(new Date(), 'yyyy-MM-dd'), { shouldDirty: true });
      }
    }
  };

  // Cálculo de margen y porcentaje de ganancia
  const profitPercentage = useMemo(() => {
    if (!cost || cost === 0 || !price) return 0;
    const taxRate = (taxPercentage || 18) / 100;
    const netPrice = costIncludesTax ? price / (1 + taxRate) : price;
    const netCost = costIncludesTax ? cost / (1 + taxRate) : cost;
    return ((netPrice - netCost) / netCost * 100).toFixed(1);
  }, [price, cost, costIncludesTax, taxPercentage]);

  // Precio con descuento calculado
  const discountedPrice = useMemo(() => {
    if (!price || discountPercentage <= 0) return null;
    return price * (1 - discountPercentage / 100);
  }, [price, discountPercentage]);

  // Nombre del proveedor seleccionado para el badge
  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECCIÓN PRINCIPAL: DATOS ESENCIALES (Siempre visibles de primero) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3.5 bg-muted/20 p-3.5 rounded-xl border border-border/60">
        {/* 1. Nombre del Producto */}
        <div>
          <Label htmlFor="name" className="text-xs font-semibold text-foreground">
            Nombre del Producto <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Ej: Leche Entera 1L, Arroz Supremo, etc."
            className="mt-1 h-10 text-sm font-medium"
            autoFocus={!productId}
          />
          {errors.name && (
            <p className="text-xs text-destructive mt-1 font-medium">{errors.name.message}</p>
          )}
        </div>

        {/* 2. Precio de Venta y Costo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="price" className="text-xs font-semibold text-foreground">
              Precio Venta <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">$</span>
              <Input
                id="price"
                type="number"
                step="0.01"
                disabled={isVariablePrice}
                className={cn(
                  "pl-7 h-10 font-bold text-base text-foreground",
                  isVariablePrice && "bg-muted text-muted-foreground italic font-normal text-xs"
                )}
                {...register('price', { valueAsNumber: true })}
                placeholder={isVariablePrice ? "Abierto en caja" : "0.00"}
              />
            </div>
            {errors.price && !isVariablePrice && (
              <p className="text-xs text-destructive mt-1 font-medium">{errors.price.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="cost" className="text-xs font-medium text-foreground">
              Costo ($) <span className="text-muted-foreground font-normal text-[11px]">(Opcional)</span>
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">$</span>
              <Input
                id="cost"
                type="number"
                step="0.01"
                className="pl-7 h-10 text-sm"
                {...register('cost', { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
            {errors.cost && (
              <p className="text-xs text-destructive mt-1 font-medium">{errors.cost.message}</p>
            )}
          </div>
        </div>

        {/* Ganancia calculada / Margen o Sugerencias rápidas */}
        {cost && cost > 0 && !isVariablePrice && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex flex-wrap items-center justify-between gap-2">
            {price && price > 0 ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <span>Ganancia:</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    ${(price - cost).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  <Percent className="h-3 w-3" />
                  <span>{profitPercentage}% margen</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap w-full">
                <span className="text-[11px] text-muted-foreground font-medium">Margen sugerido:</span>
                {[25, 30, 35].map((pct) => {
                  const suggestedPrice = parseFloat((cost * (1 + pct / 100)).toFixed(2));
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setValue('price', suggestedPrice, { shouldValidate: true, shouldDirty: true })}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-colors"
                    >
                      +{pct}% (${suggestedPrice})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Categoría y Código de Barras Principal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category_id" className="text-xs font-semibold text-foreground">
              Categoría
            </Label>
            <div className="flex items-center gap-1.5 mt-1">
              <Select
                onValueChange={(value) => setValue('category_id', value === 'no-category' ? null : value, { shouldDirty: true })}
                value={selectedCategoryId || 'no-category'}
              >
                <SelectTrigger className="w-full h-10 text-sm">
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

          <div>
            <Label htmlFor="barcode" className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
              Código de Barras
            </Label>
            <div className="flex gap-1.5 mt-1">
              <Input
                id="barcode"
                {...register('barcode')}
                placeholder="Escanear o escribir"
                className="h-10 text-sm font-mono flex-1"
              />
              {!barcode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateBarcode}
                  className="shrink-0 gap-1 px-2.5 h-10 border-primary/20 hover:border-primary text-primary text-xs font-semibold bg-primary/5 hover:bg-primary/10"
                  title="Generar código de barras único"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Generar</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Stock Actual y Stock Mínimo */}
        {trackInventory ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stock" className="text-xs font-semibold text-foreground">
                Stock Actual <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock"
                type="number"
                step="any"
                className="mt-1 h-10 text-sm"
                {...register('stock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.stock && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.stock.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="min_stock" className="text-xs font-medium text-foreground">
                Stock Mínimo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="min_stock"
                type="number"
                step="any"
                className="mt-1 h-10 text-sm"
                {...register('min_stock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.min_stock && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.min_stock.message}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-muted/50 rounded-lg border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>📦 Este producto no descuenta existencias (Servicio/Digital).</span>
            <button
              type="button"
              onClick={() => setValue('track_inventory', true, { shouldDirty: true })}
              className="text-primary font-semibold hover:underline ml-2"
            >
              Activar stock
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECCIÓN SECUNDARIA: OPCIONES ADICIONALES (Colapsadas por defecto)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center gap-2 py-1">
          <div className="h-px bg-border/80 flex-1" />
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
            Más Opciones (Opcionales)
          </span>
          <div className="h-px bg-border/80 flex-1" />
        </div>

        {/* 1. Foto del Producto */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('photo')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Foto del Producto</span>
              {imageUrl ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <img src={imageUrl} alt="" className="h-5 w-5 rounded object-cover border border-border" />
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal text-emerald-600 bg-emerald-500/10">
                    Con foto
                  </Badge>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground ml-1">
                  Sin foto
                </Badge>
              )}
            </div>
            {openSections.photo ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.photo && (
            <div className="px-3 pb-3 pt-1 border-t border-border/40 animate-in fade-in-50 duration-200">
              <ProductImageUpload
                imageUrl={imageUrl}
                onImageUpload={(url) => setValue('image_url', url, { shouldDirty: true })}
              />
            </div>
          )}
        </div>

        {/* 2. Proveedor y Códigos Extra */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('supplierAndCodes')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Proveedor y Códigos Extra</span>
              {selectedSupplier && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 truncate max-w-[120px]">
                  {selectedSupplier.name}
                </Badge>
              )}
              {extraBarcodes.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">
                  +{extraBarcodes.length} barras
                </Badge>
              )}
            </div>
            {openSections.supplierAndCodes ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.supplierAndCodes && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
              {/* Proveedor */}
              <div>
                <Label htmlFor="supplier_id" className="text-xs font-medium">Proveedor Asignado</Label>
                <div className="mt-1">
                  <Select
                    onValueChange={(value) => setValue('supplier_id', value === 'no-supplier' ? null : value, { shouldDirty: true })}
                    value={selectedSupplierId || 'no-supplier'}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-supplier">Sin proveedor asignado</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Código Interno */}
              <div>
                <Label htmlFor="internal_code" className="text-xs font-medium">Código Interno / SKU</Label>
                <Input
                  id="internal_code"
                  {...register('internal_code')}
                  placeholder="Ej: ART-001"
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              {/* Códigos Adicionales */}
              <BarcodesManager
                hidePrimaryBarcode
                extraBarcodes={extraBarcodes}
                onExtraBarcodesChange={onExtraBarcodesChange}
              />
            </div>
          )}
        </div>

        {/* 3. Impuestos (ITBIS / Tax) */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('taxes')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Impuestos (ITBIS / Tax)</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                {taxPercentage}% {costIncludesTax ? '(Incluido)' : '(+ Tax)'}
              </Badge>
            </div>
            {openSections.taxes ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.taxes && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="tax_percentage" className="text-xs">Porcentaje de Impuesto (%)</Label>
                  <Input
                    id="tax_percentage"
                    type="number"
                    step="0.01"
                    className="mt-1 h-9 text-xs"
                    {...register('tax_percentage', { valueAsNumber: true })}
                    placeholder="18"
                  />
                  {errors.tax_percentage && (
                    <p className="text-xs text-destructive mt-1">{errors.tax_percentage.message}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <Checkbox
                    id="cost_includes_tax"
                    checked={costIncludesTax}
                    onCheckedChange={(checked) => setValue('cost_includes_tax', !!checked, { shouldDirty: true })}
                  />
                  <Label htmlFor="cost_includes_tax" className="text-xs font-normal cursor-pointer leading-tight">
                    Precios ya incluyen impuesto
                  </Label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Modalidades Especiales (Peso / Precio Variado) */}
        {!isStore && (
          <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => toggleSection('variableMode')}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-xs text-foreground">Venta por Peso o Precio Variado</span>
                {isVariablePrice && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-amber-600 bg-amber-500/10">
                    Precio abierto
                  </Badge>
                )}
                {isVariableQuantity && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-blue-600 bg-blue-500/10">
                    Por peso
                  </Badge>
                )}
              </div>
              {openSections.variableMode ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {openSections.variableMode && (
              <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_variable_price"
                      checked={isVariablePrice}
                      onCheckedChange={(checked) => {
                        setValue('is_variable_price', !!checked, { shouldDirty: true });
                        if (checked) {
                          setValue('price', 0, { shouldDirty: true });
                        }
                      }}
                    />
                    <Label htmlFor="is_variable_price" className="text-xs font-medium cursor-pointer">
                      Precio Variado (Se ingresa el precio manualmente en caja)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_variable_quantity"
                      checked={isVariableQuantity}
                      onCheckedChange={(checked) => {
                        setValue('is_variable_quantity', !!checked, { shouldDirty: true });
                      }}
                    />
                    <Label htmlFor="is_variable_quantity" className="text-xs font-medium cursor-pointer">
                      Cantidad Variada / Balanza (Preguntar peso o unidades al vender)
                    </Label>
                  </div>
                </div>

                {isVariablePrice && (
                  <div className="p-2.5 bg-amber-500/10 rounded-md border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    💡 Al vender este producto, el sistema te solicitará el monto exacto antes de cobrarlo.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Control de Inventario Avanzado */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('inventory')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Control de Inventario</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                {trackInventory ? 'Control activo' : 'Desactivado'}
              </Badge>
            </div>
            {openSections.inventory ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.inventory && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="track_inventory"
                  checked={trackInventory}
                  onCheckedChange={(checked) => setValue('track_inventory', !!checked, { shouldDirty: true })}
                />
                <Label htmlFor="track_inventory" className="text-xs font-semibold cursor-pointer">
                  Controlar existencias (stock) de este producto
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Desactiva esta opción si el producto es un servicio, recarga o producto virtual donde no requieres controlar almacén.
              </p>
            </div>
          )}
        </div>

        {/* 6. Descuentos y Tienda Online */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('discounts')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Descuentos y Tienda Online</span>
              {discountPercentage > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-destructive bg-destructive/10 font-bold">
                  -{discountPercentage}%
                </Badge>
              )}
              {isFeatured && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-amber-600 bg-amber-500/10 font-medium">
                  Destacado
                </Badge>
              )}
            </div>
            {openSections.discounts ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.discounts && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_visible_in_store"
                  checked={isVisibleInStore}
                  onCheckedChange={(checked) => setValue('is_visible_in_store', !!checked, { shouldDirty: true })}
                />
                <Label htmlFor="is_visible_in_store" className="text-xs font-normal flex items-center gap-1.5 cursor-pointer">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Visible en catálogo online / Mi Tienda
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_featured"
                  checked={isFeatured}
                  onCheckedChange={(checked) => setValue('is_featured', !!checked, { shouldDirty: true })}
                />
                <Label htmlFor="is_featured" className="text-xs font-normal flex items-center gap-1.5 cursor-pointer">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Producto destacado (promociones)
                </Label>
              </div>

              <div>
                <Label htmlFor="discount_percentage" className="text-xs">Porcentaje de Descuento (%)</Label>
                <Input
                  id="discount_percentage"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  className="mt-1 h-9 text-xs"
                  {...register('discount_percentage', { valueAsNumber: true })}
                  placeholder="0"
                />
                {discountedPrice && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded-md flex items-center justify-between">
                    <span className="text-xs">Precio con descuento:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs line-through text-muted-foreground">${price?.toFixed(2)}</span>
                      <span className="text-sm font-bold text-destructive">${discountedPrice.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Fechas de Descuento */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Fecha Inicio</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left text-xs font-normal h-8",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {startDate ? format(parseDate(startDate)!, "dd/MM/yyyy") : <span>Inicio</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDate(startDate)}
                          onSelect={(date) => date && setValue('discount_start_date', format(date, 'yyyy-MM-dd'), { shouldDirty: true })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Fecha Fin</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left text-xs font-normal h-8",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {endDate ? format(parseDate(endDate)!, "dd/MM/yyyy") : <span>Fin</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDate(endDate)}
                          onSelect={(date) => date && setValue('discount_end_date', format(date, 'yyyy-MM-dd'), { shouldDirty: true })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(3)} className="h-7 text-[10px] px-2">3 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(7)} className="h-7 text-[10px] px-2">7 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(15)} className="h-7 text-[10px] px-2">15 Días</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDuration(30)} className="h-7 text-[10px] px-2">30 Días</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Precios al por Mayor / Packs */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('wholesale')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Precios al por Mayor / Packs</span>
            </div>
            {openSections.wholesale ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.wholesale && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50 duration-200">
              <ProductOffersManager
                productId={productId}
                productPrice={price || 0}
              />
            </div>
          )}
        </div>

        {/* 8. Estado del Producto */}
        <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
          <button
            type="button"
            onClick={() => toggleSection('status')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-xs text-foreground">Estado del Producto</span>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] h-4 px-1.5 font-medium",
                  status === 'active'
                    ? "text-emerald-600 bg-emerald-500/10"
                    : "text-muted-foreground bg-muted"
                )}
              >
                {status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {openSections.status ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {openSections.status && (
            <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-2 animate-in fade-in-50 duration-200">
              <Label htmlFor="status" className="text-xs">Estado de visibilidad para venta</Label>
              <Select
                value={status}
                onValueChange={(value: 'active' | 'inactive') => setValue('status', value, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo (Disponible para venta)</SelectItem>
                  <SelectItem value="inactive">Inactivo (Oculto en caja)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
