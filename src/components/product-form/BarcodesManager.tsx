import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Barcode, Tag, Percent, Banknote, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { ProductBarcode } from '@/hooks/useProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductsOffline } from '@/hooks/useProductsOffline';

interface BarcodesManagerProps {
    /** Código de barra principal (campo original del producto) */
    primaryBarcode: string;
    onPrimaryBarcodeChange: (value: string) => void;
    /** Códigos adicionales */
    extraBarcodes: Omit<ProductBarcode, 'id'>[];
    onExtraBarcodesChange: (barcodes: Omit<ProductBarcode, 'id'>[]) => void;
}

const BarcodesManager: React.FC<BarcodesManagerProps> = ({
    primaryBarcode,
    onPrimaryBarcodeChange,
    extraBarcodes,
    onExtraBarcodesChange,
}) => {
    const [newBarcode, setNewBarcode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newQuantity, setNewQuantity] = useState<string>('1');
    const [newDiscountValue, setNewDiscountValue] = useState<string>('0');
    const [newDiscountType, setNewDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [isExpanded, setIsExpanded] = useState(false);

    const { data: products = [] } = useProductsOffline();

    // Recolectar todos los códigos de barra existentes en la app para asegurar que no se repitan
    const existingBarcodes = useMemo(() => {
        const barcodes = new Set<string>();
        products.forEach(p => {
            if (p.barcode) barcodes.add(p.barcode.trim());
            if (p.barcodes) {
                p.barcodes.forEach(b => {
                    if (b.barcode) barcodes.add(b.barcode.trim());
                });
            }
        });
        return barcodes;
    }, [products]);

    // Generar un código numérico aleatorio de 6 dígitos que no exista en el sistema
    const generateUniqueBarcode = () => {
        let newCode = '';
        let attempts = 0;
        const maxAttempts = 1000;
        
        while (attempts < maxAttempts) {
            const num = Math.floor(100000 + Math.random() * 900000); // 100000 a 999999
            newCode = num.toString();
            
            const isDuplicate = 
                existingBarcodes.has(newCode) || 
                extraBarcodes.some(b => b.barcode === newCode);
                
            if (!isDuplicate) {
                break;
            }
            attempts++;
        }
        return newCode;
    };

    const handleGeneratePrimary = () => {
        onPrimaryBarcodeChange(generateUniqueBarcode());
    };

    const handleGenerateExtra = () => {
        setNewBarcode(generateUniqueBarcode());
    };

    const handleAdd = () => {
        const trimmed = newBarcode.trim();
        if (!trimmed) return;

        // Evitar duplicados
        const isDuplicate =
            trimmed === primaryBarcode.trim() ||
            extraBarcodes.some(b => b.barcode === trimmed);

        if (isDuplicate) {
            return; // Sería ideal un toast, pero la lógica de toast está en el padre
        }

        onExtraBarcodesChange([
            ...extraBarcodes,
            { 
                barcode: trimmed, 
                label: newLabel.trim() || undefined,
                quantity: parseFloat(newQuantity) || 1,
                discount_value: parseFloat(newDiscountValue) || 0,
                discount_type: newDiscountType,
            },
        ]);
        setNewBarcode('');
        setNewLabel('');
        setNewQuantity('1');
        setNewDiscountValue('0');
    };

    const handleRemove = (index: number) => {
        onExtraBarcodesChange(extraBarcodes.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3">
            {/* Código principal */}
            <div>
                <Label htmlFor="barcode" className="flex items-center gap-1.5">
                    <Barcode className="h-3.5 w-3.5" />
                    Código de Barras Principal
                </Label>
                <div className="flex gap-2 mt-1.5">
                    <Input
                        id="barcode"
                        value={primaryBarcode}
                        onChange={e => onPrimaryBarcodeChange(e.target.value)}
                        placeholder="Código de barras escaneable"
                        className="flex-1 font-mono"
                    />
                    {!primaryBarcode && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGeneratePrimary}
                            className="shrink-0 gap-1.5 h-10 border-primary/20 hover:border-primary text-primary font-semibold text-xs bg-primary/5 hover:bg-primary/10"
                            title="Generar un código corto y único automáticamente"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Generar
                        </Button>
                    )}
                </div>
            </div>

            {/* Códigos adicionales */}
            <div className="space-y-2 border border-dashed rounded-lg p-3 bg-muted/10">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center w-full justify-between focus:outline-none"
                >
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-semibold cursor-pointer">
                        <Tag className="h-3.5 w-3.5" />
                        <span>Códigos Adicionales</span>
                        {extraBarcodes.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] font-bold">
                                {extraBarcodes.length}
                            </Badge>
                        )}
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                    <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                        {/* Lista de códigos adicionales */}
                        {extraBarcodes.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                {extraBarcodes.map((barcode, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-md px-3 py-1.5 group"
                                    >
                                        <Barcode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="font-mono text-sm font-medium flex-1 truncate">
                                            {barcode.barcode}
                                        </span>
                                        {barcode.label && (
                                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                                {barcode.label}
                                            </Badge>
                                        )}
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            {(barcode.quantity > 1) && (
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 border-blue-200">
                                                    Cant: {barcode.quantity}
                                                </Badge>
                                            )}
                                            {(barcode.discount_value > 0) && (
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-green-500/10 text-green-600 border-green-200">
                                                    -{barcode.discount_type === 'percentage' ? `${barcode.discount_value}%` : `$${barcode.discount_value}`}
                                                </Badge>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(index)}
                                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                            aria-label="Eliminar código"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Inputs para agregar nuevo código */}
                        <div className="flex flex-col gap-2 p-3 bg-muted/30 border border-dashed border-border rounded-lg">
                            <div className="flex gap-2">
                                <div className="flex-[2] min-w-0">
                                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Código</Label>
                                    <div className="flex gap-1.5">
                                        <Input
                                            placeholder="Código de barras"
                                            value={newBarcode}
                                            onChange={e => setNewBarcode(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="h-9 text-sm font-mono flex-1"
                                        />
                                        {!newBarcode && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={handleGenerateExtra}
                                                className="h-9 w-9 shrink-0 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
                                                title="Generar código aleatorio corto y único"
                                            >
                                                <Sparkles className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-[3] min-w-0">
                                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Etiqueta</Label>
                                    <Input
                                        placeholder='Ej: "Caja de 6"'
                                        value={newLabel}
                                        onChange={e => setNewLabel(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 items-end">
                                <div className="flex-1 min-w-0">
                                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Cantidad</Label>
                                    <Input
                                        type="number"
                                        placeholder="Cant."
                                        value={newQuantity}
                                        onChange={e => setNewQuantity(e.target.value)}
                                        className="h-9 text-sm"
                                        min="1"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Descto.</Label>
                                    <Input
                                        type="number"
                                        placeholder="Valor"
                                        value={newDiscountValue}
                                        onChange={e => setNewDiscountValue(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="w-24">
                                    <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Tipo</Label>
                                    <Select 
                                        value={newDiscountType} 
                                        onValueChange={(v: 'percentage' | 'fixed') => setNewDiscountType(v)}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">%</SelectItem>
                                            <SelectItem value="fixed">$</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={handleAdd}
                                    disabled={!newBarcode.trim()}
                                    className="h-9 px-3 shrink-0"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Agregar
                                </Button>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Agrega códigos alternativos (presentaciones, unidades de medida, etc.)
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodesManager;
