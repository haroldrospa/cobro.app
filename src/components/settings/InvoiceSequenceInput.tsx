import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, Wrench, ShieldCheck } from 'lucide-react';

interface InvoiceSequenceInputProps {
    id: string;
    invoiceTypeId: string;
    currentNumber: number; // Último número usado en BD (el próximo a emitir es currentNumber + 1)
    maxUsedNumber?: number; // Máximo número ya emitido en DGII / Alanube / Ventas
    authorizedLimit?: number; // Límite autorizado por la DGII para este tipo de comprobante
    onLimitChange?: (invoiceTypeId: string, newLimit: number) => void;
    onUpdate: (id: string, newNumber: number, invoiceTypeId: string) => Promise<void>;
    isElectronic?: boolean;
}

export const InvoiceSequenceInput = ({
    id,
    invoiceTypeId,
    currentNumber,
    maxUsedNumber = 0,
    authorizedLimit = 10000,
    onLimitChange,
    onUpdate,
    isElectronic = false
}: InvoiceSequenceInputProps) => {
    // El campo editable muestra la "Secuencia que va (Próxima a emitir)" = currentNumber + 1
    const initialNextNumber = currentNumber + 1;
    const [value, setValue] = useState(String(initialNextNumber));
    const [limitValue, setLimitValue] = useState(String(authorizedLimit));
    const [isEditingLimit, setIsEditingLimit] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const prevCurrentNumberRef = useRef(currentNumber);

    useEffect(() => {
        if (prevCurrentNumberRef.current !== currentNumber) {
            setValue(String(currentNumber + 1));
            prevCurrentNumberRef.current = currentNumber;
        }
    }, [currentNumber]);

    useEffect(() => {
        setLimitValue(String(authorizedLimit));
    }, [authorizedLimit]);

    const handleSave = async () => {
        const numericValue = parseInt(value, 10);

        if (isNaN(numericValue) || numericValue < 1) {
            setValue(String(currentNumber + 1));
            return;
        }

        // Si intenta poner un número que ya fue consumido en DGII/Alanube, ajustarlo al próximo libre real
        const minAllowedNext = Math.max(1, maxUsedNumber + 1);
        const safeNextNumber = numericValue < minAllowedNext ? minAllowedNext : numericValue;
        const valueToSave = safeNextNumber - 1;

        setValue(String(safeNextNumber));

        if (valueToSave === currentNumber) return;

        setIsUpdating(true);
        try {
            await onUpdate(id, valueToSave, invoiceTypeId);
        } catch (e) {
            setValue(String(currentNumber + 1));
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleQuickRepair = async () => {
        if (maxUsedNumber <= currentNumber) return;
        setIsUpdating(true);
        try {
            await onUpdate(id, maxUsedNumber, invoiceTypeId);
            setValue(String(maxUsedNumber + 1));
        } catch (e) {
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleLimitBlur = () => {
        setIsEditingLimit(false);
        const parsed = parseInt(limitValue, 10);
        if (!isNaN(parsed) && parsed >= 1 && onLimitChange) {
            onLimitChange(invoiceTypeId, parsed);
        } else {
            setLimitValue(String(authorizedLimit));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    let displayTypeId = invoiceTypeId;
    if (isElectronic) {
        switch (invoiceTypeId) {
            case 'B01': displayTypeId = 'E31'; break;
            case 'B02': displayTypeId = 'E32'; break;
            case 'B03': displayTypeId = 'E33'; break;
            case 'B04': displayTypeId = 'E34'; break;
            case 'B11': displayTypeId = 'E41'; break;
            case 'B14': displayTypeId = 'E44'; break;
            case 'B15': displayTypeId = 'E45'; break;
            case 'B16': displayTypeId = 'E46'; break;
        }
    }

    const separator = isElectronic ? '' : '-';
    const padding = isElectronic ? 10 : 8;

    const effectiveUsedCount = Math.max(currentNumber, maxUsedNumber);
    const nextSequenceNumber = parseInt(value, 10) || (currentNumber + 1);
    const formattedNextEncf = `${displayTypeId}${separator}${String(nextSequenceNumber).padStart(padding, '0')}`;
    const formattedLastUsedEncf = effectiveUsedCount > 0
        ? `${displayTypeId}${separator}${String(effectiveUsedCount).padStart(padding, '0')}`
        : 'Ninguno';
    const isOutOfSync = maxUsedNumber > currentNumber;
    const availableCount = Math.max(0, authorizedLimit - effectiveUsedCount);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 w-full sm:w-auto">
            {/* Panel de estado DGII: Emitidos, Disponibles y Sincronización */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-2.5 py-1 rounded-md bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5">
                    <span>Emitidos DGII:</span>
                    <span className="font-semibold text-foreground font-mono">{effectiveUsedCount.toLocaleString()}</span>
                    {effectiveUsedCount > 0 && (
                        <span className="text-[11px] opacity-75 font-mono hidden md:inline">
                            (Últ: {formattedLastUsedEncf})
                        </span>
                    )}
                </div>

                <div
                    className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        availableCount > 50
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : availableCount > 0
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-destructive/10 border-destructive/30 text-destructive'
                    }`}
                    onClick={() => !isEditingLimit && setIsEditingLimit(true)}
                    title="Haz clic para ajustar la cantidad total de secuencias autorizadas por la DGII"
                >
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Disponibles DGII:</span>
                    <span className="font-bold font-mono">{availableCount.toLocaleString()}</span>
                    <span className="opacity-70">/</span>
                    {isEditingLimit ? (
                        <input
                            type="number"
                            value={limitValue}
                            onChange={(e) => setLimitValue(e.target.value)}
                            onBlur={handleLimitBlur}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            autoFocus
                            className="w-20 px-1 py-0 text-xs bg-background text-foreground border rounded font-mono"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="underline decoration-dotted opacity-85 font-mono" title="Editar límite autorizado DGII">
                            {authorizedLimit.toLocaleString()}
                        </span>
                    )}
                </div>

                {isOutOfSync ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleQuickRepair}
                        disabled={isUpdating}
                        className="h-7 px-2.5 text-xs bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 gap-1"
                    >
                        <Wrench className="h-3 w-3" />
                        Reparar a #{maxUsedNumber + 1}
                    </Button>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Al día
                    </span>
                )}
            </div>

            {/* Control de Próxima Secuencia */}
            <div className="flex items-center gap-2 justify-end">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Va por (Próxima)
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="relative">
                            <Input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                className={`w-24 h-8 text-center font-mono font-semibold ${isUpdating ? 'pr-7' : ''} ${
                                    isOutOfSync ? 'border-amber-500/60 text-amber-400' : ''
                                }`}
                                disabled={isUpdating}
                            />
                            {isUpdating && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                                </div>
                            )}
                        </div>
                        <span className="text-sm text-primary font-mono font-semibold whitespace-nowrap">
                            → {formattedNextEncf}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceSequenceInput;
