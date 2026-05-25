import { useState, FC, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  onConfirm: (mapping: Record<string, string>, strategy: 'skip' | 'overwrite') => void;
}

export const ImportProductsDialog: FC<ImportProductsDialogProps> = ({ open, onOpenChange, headers, onConfirm }) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<'skip' | 'overwrite'>('skip');

  // Auto-map based on string match
  useEffect(() => {
    if (!open) return;
    const initialMapping: Record<string, string> = {};
    const systemFields = ['name', 'price', 'cost', 'stock', 'min_stock', 'barcode', 'internal_code', 'category', 'status', 'tax_percentage', 'cost_includes_tax'];
    
    systemFields.forEach(field => {
      const match = headers.find(h => {
        const hLower = h.toLowerCase().trim();
        if (field === 'name' && (hLower === 'nombre' || hLower === 'name')) return true;
        if (field === 'price' && (hLower === 'precio' || hLower === 'price')) return true;
        if (field === 'cost' && (hLower === 'costo' || hLower === 'cost')) return true;
        if (field === 'stock' && hLower === 'stock') return true;
        if (field === 'min_stock' && (hLower === 'stock mínimo' || hLower === 'stock minimo' || hLower === 'min_stock' || hLower === 'stock_minimo')) return true;
        if (field === 'barcode' && (hLower === 'código de barras' || hLower === 'codigo de barras' || hLower === 'barcode' || hLower === 'codigo_barras')) return true;
        if (field === 'internal_code' && (hLower === 'código interno' || hLower === 'codigo interno' || hLower === 'internal_code' || hLower === 'codigo_interno' || hLower === 'codigo unico')) return true;
        if (field === 'category' && (hLower === 'categoría' || hLower === 'categoria' || hLower === 'category')) return true;
        if (field === 'status' && (hLower === 'estado' || hLower === 'status')) return true;
        if (field === 'tax_percentage' && (hLower === 'impuesto(%)' || hLower === 'impuesto' || hLower === 'tax' || hLower === 'tax_percentage' || hLower === '%')) return true;
        if (field === 'cost_includes_tax' && (hLower === 'costo incluye impuesto' || hLower === 'cost_includes_tax' || hLower === 'incluye_itbis')) return true;
        return false;
      });
      if (match) {
        initialMapping[field] = match;
      }
    });
    setMapping(initialMapping);
  }, [open, headers]);

  const handleConfirm = () => {
    onConfirm(mapping, strategy);
  };

  const systemFieldsList = [
    { key: 'name', label: 'Nombre del Producto', required: true },
    { key: 'price', label: 'Precio de Venta', required: true },
    { key: 'cost', label: 'Costo' },
    { key: 'stock', label: 'Stock / Cantidad' },
    { key: 'min_stock', label: 'Stock Mínimo' },
    { key: 'barcode', label: 'Código de Barras' },
    { key: 'internal_code', label: 'Código Interno (Único)' },
    { key: 'category', label: 'Categoría' },
    { key: 'status', label: 'Estado (active/inactive)' },
    { key: 'tax_percentage', label: 'Impuesto (%)' },
    { key: 'cost_includes_tax', label: 'El costo incluye impuesto (si/no)' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mapeo de Columnas para Importación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
          <p className="text-xs text-muted-foreground">Asocia las columnas de tu archivo Excel/CSV con los campos del sistema para una importación correcta.</p>
          
          <div className="space-y-3">
            {systemFieldsList.map(field => (
              <div key={field.key} className="flex flex-col space-y-1.5">
                <Label className="text-sm font-medium">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                <Select 
                  value={mapping[field.key] || "no_map"} 
                  onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val === "no_map" ? undefined : val }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar columna..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_map">-- No importar --</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t space-y-2">
            <Label className="text-sm font-semibold mb-1 block">En caso de duplicados (Nombre Coincidente):</Label>
            <RadioGroup value={strategy} onValueChange={(val: any) => setStrategy(val)} className="space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skip" id="r-skip" />
                <Label htmlFor="r-skip" className="font-normal text-sm">Omitir y no importar</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="overwrite" id="r-overwrite" />
                <Label htmlFor="r-overwrite" className="font-normal text-sm">Actualizar producto existente con nuevos datos</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!mapping['name'] || !mapping['price']}>Confirmar e Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
