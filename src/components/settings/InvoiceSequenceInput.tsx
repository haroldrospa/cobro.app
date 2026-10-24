import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Wrench, ShieldCheck, FileCheck2 } from 'lucide-react';

interface InvoiceSequenceInputProps {
    id: string;
    invoiceTypeId: string;
    currentNumber: number; // Último número en el contador (el próximo a emitir es currentNumber + 1)
    emittedCount?: number; // Cantidad REAL de comprobantes aceptados en DGII (ej. 2)
    maxUsedNumber?: number; // Secuencia del último comprobante aceptado en DGII (ej. 6)
    lastAcceptedEncf?: string | null; // Código del último e-NCF aceptado (ej. E320000000006)
    acceptedSeqNumbers?: number[]; // Números de secuencia ya aceptados en DGII (ej. [3, 6])
    authorizedLimit?: number; // Límite autorizado por la DGII para este tipo de comprobante
    onLimitChange?: (invoiceTypeId: string, newLimit: number) => void;
    onUpdate: (id: string, newNumber: number, invoiceTypeId: string) => Promise<void>;
    isElectronic?: boolean;
}

export const InvoiceSequenceInput = ({
    id,
    invoiceTypeId,
    currentNumber,
    emittedCount = 0,
    maxUsedNumber = 0,
    lastAcceptedEncf = null,
    acceptedSeqNumbers = [],
    authorizedLimit = 10000,
    onLimitChange,
    onUpdate,
    isElectronic = false
}: InvoiceSequenceInputProps) => {
    // El campo editable muestra "Por cuál comprobante voy (Próximo a emitir)" = currentNumber + 1
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
        let numericValue = parseInt(value, 10);

        if (isNaN(numericValue) || numericValue < 1) {
            setValue(String(currentNumber + 1));
            return;
        }

        // Si el número elegido ya fue aceptado en DGII (ej. el 3 o el 6), avanzar al siguiente libre
        const usedSet = new Set(acceptedSeqNumbers);
        while (usedSet.has(numericValue)) {
            numericValue++;
        }

        const valueToSave = numericValue - 1;
        setValue(String(numericValue));

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

    const handleQuickSyncToNextAfterLast = async () => {
        if (maxUsedNumber <= 0) return;
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

    const nextSequenceNumber = parseInt(value, 10) || (currentNumber + 1);
    const formattedNextEncf = `${displayTypeId}${separator}${String(nextSequenceNumber).padStart(padding, '0')}`;
    const formattedLastAccepted = lastAcceptedEncf || (maxUsedNumber > 0
        ? `${displayTypeId}${separator}${String(maxUsedNumber).padStart(padding, '0')}`
        : null);

    // ¿El próximo número configurado choca con uno ya emitido en DGII?
    const isCollidingWithAccepted = acceptedSeqNumbers.includes(nextSequenceNumber);
    // Restar únicamente los comprobantes REALMENTE emitidos/aceptados en DGII
    const availableCount = Math.max(0, authorizedLimit - emittedCount);

    return (
        <div className="flex flex-col lg:flex-row lg:items-center justify-end gap-3 w-full lg:w-auto">
            {/* Indicadores claros: Cuántos tengo emitidos + Último comprobante + Disponibles */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* 1. Cuántos tengo emitidos realmente en la DGII */}
                <div
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-foreground flex items-center gap-1.5"
                    title={
                        acceptedSeqNumbers.length > 0
                            ? `Secuencias aceptadas en DGII: ${acceptedSeqNumbers.sort((a, b) => a - b).map(n => `#${n}`).join(', ')}`
                            : 'Aún no hay comprobantes aceptados en DGII para este tipo'
                    }
                >
                    <FileCheck2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Emitidos en DGII:</span>
                    <span className="font-bold text-primary font-mono text-sm">{emittedCount.toLocaleString()}</span>
                    {formattedLastAccepted && (
                        <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
                            • Último: <strong className="text-foreground">{formattedLastAccepted}</strong>
                        </span>
                    )}
                </div>

                {/* 2. Cuántos quedan disponibles del lote autorizado */}
                <div
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        availableCount > 50
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : availableCount > 0
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-destructive/10 border-destructive/30 text-destructive'
                    }`}
                    onClick={() => !isEditingLimit && setIsEditingLimit(true)}
                    title="Haz clic para ajustar el total de secuencias autorizadas por la DGII"
                >
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Disponibles:</span>
                    <span className="font-bold font-mono">{availableCount.toLocaleString()}</span>
                    <span className="opacity-70">de</span>
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
                        <span className="underline decoration-dotted opacity-90 font-mono" title="Editar límite autorizado DGII">
                            {authorizedLimit.toLocaleString()}
                        </span>
                    )}
                </div>

                {isCollidingWithAccepted ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleQuickSyncToNextAfterLast}
                        disabled={isUpdating}
                        className="h-7 px-2.5 text-xs bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 gap-1"
                    >
                        <Wrench className="h-3 w-3" />
                        Saltar a #{maxUsedNumber + 1}
                    </Button>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Lista
                    </span>
                )}
            </div>

            {/* 3. Por cuál comprobante voy (Próximo a emitir) */}
            <div className="flex items-center gap-2 justify-end bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Voy por el comprobante (Próximo)
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="relative">
                            <Input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                className={`w-20 h-8 text-center font-mono font-bold ${isUpdating ? 'pr-6' : ''}`}
                                disabled={isUpdating}
                            />
                            {isUpdating && (
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                                </div>
                            )}
                        </div>
                        <span className="text-sm text-primary font-mono font-bold whitespace-nowrap">
                            → {formattedNextEncf}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceSequenceInput;
