import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Wrench, ShieldCheck, FileCheck2, Sparkles, AlertTriangle, AlertCircle } from 'lucide-react';

interface InvoiceSequenceInputProps {
    id: string;
    invoiceTypeId: string;
    currentNumber: number; // Último número en el contador (el próximo a emitir es currentNumber + 1)
    endNumber?: number | null; // Hasta dónde termina el rango autorizado por la DGII
    emittedCount?: number; // Cantidad REAL de comprobantes aceptados en DGII (ej. 2)
    maxUsedNumber?: number; // Secuencia del último comprobante aceptado en DGII (ej. 6)
    lastAcceptedEncf?: string | null; // Código del último e-NCF aceptado (ej. E320000000006)
    acceptedSeqNumbers?: number[]; // Números de secuencia ya aceptados en DGII (ej. [3, 6])
    authorizedLimit?: number; // Compatibilidad heredada
    onLimitChange?: (invoiceTypeId: string, newLimit: number) => void;
    onUpdate: (id: string, newNumber: number, invoiceTypeId: string) => Promise<void>;
    onUpdateEndNumber?: (id: string, newEndNumber: number | null, invoiceTypeId: string) => Promise<void>;
    isElectronic?: boolean;
}

export const InvoiceSequenceInput = ({
    id,
    invoiceTypeId,
    currentNumber,
    endNumber = null,
    emittedCount = 0,
    maxUsedNumber = 0,
    lastAcceptedEncf = null,
    acceptedSeqNumbers = [],
    authorizedLimit = 1000,
    onLimitChange,
    onUpdate,
    onUpdateEndNumber,
    isElectronic = false
}: InvoiceSequenceInputProps) => {
    // El campo editable "Próximo a emitir" = currentNumber + 1
    const initialNextNumber = currentNumber + 1;
    const [value, setValue] = useState(String(initialNextNumber));
    
    // El campo editable "Hasta dónde termina el rango"
    const effectiveEnd = endNumber !== undefined && endNumber !== null ? endNumber : (authorizedLimit || null);
    const [endValue, setEndValue] = useState(effectiveEnd ? String(effectiveEnd) : '');
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUpdatingEnd, setIsUpdatingEnd] = useState(false);
    const prevCurrentNumberRef = useRef(currentNumber);
    const prevEndNumberRef = useRef(effectiveEnd);

    useEffect(() => {
        if (prevCurrentNumberRef.current !== currentNumber) {
            setValue(String(currentNumber + 1));
            prevCurrentNumberRef.current = currentNumber;
        }
    }, [currentNumber]);

    useEffect(() => {
        if (prevEndNumberRef.current !== effectiveEnd) {
            setEndValue(effectiveEnd ? String(effectiveEnd) : '');
            prevEndNumberRef.current = effectiveEnd;
        }
    }, [effectiveEnd]);

    const handleSaveCurrent = async () => {
        let numericValue = parseInt(value, 10);

        if (isNaN(numericValue) || numericValue < 1) {
            setValue(String(currentNumber + 1));
            return;
        }

        const valueToSave = numericValue - 1;
        setValue(String(numericValue));

        if (valueToSave === currentNumber) return;

        setIsUpdating(true);
        try {
            await onUpdate(id, valueToSave, invoiceTypeId);
        } catch (e) {
            setValue(String(currentNumber + 1));
            console.error('Error al guardar secuencia actual:', e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveEndNumber = async () => {
        const raw = endValue.trim();
        if (!raw) {
            // Usuario dejó el campo vacío -> Sin límite
            if (effectiveEnd === null) return;
            setIsUpdatingEnd(true);
            try {
                if (onUpdateEndNumber) {
                    await onUpdateEndNumber(id, null, invoiceTypeId);
                } else if (onLimitChange) {
                    onLimitChange(invoiceTypeId, 0);
                }
            } catch (e) {
                console.error('Error al borrar límite final:', e);
            } finally {
                setIsUpdatingEnd(false);
            }
            return;
        }

        // Extraer número final aunque hayan pegado el código completo (ej: B0100000500 -> 500)
        const match = raw.match(/(\d+)$/);
        let parsed = match ? parseInt(match[1], 10) : parseInt(raw, 10);

        if (isNaN(parsed) || parsed < 1) {
            setEndValue(effectiveEnd ? String(effectiveEnd) : '');
            return;
        }

        setEndValue(String(parsed));
        if (parsed === effectiveEnd) return;

        setIsUpdatingEnd(true);
        try {
            if (onUpdateEndNumber) {
                await onUpdateEndNumber(id, parsed, invoiceTypeId);
            }
            if (onLimitChange) {
                onLimitChange(invoiceTypeId, parsed);
            }
        } catch (e) {
            console.error('Error al guardar fin de secuencia:', e);
            setEndValue(effectiveEnd ? String(effectiveEnd) : '');
        } finally {
            setIsUpdatingEnd(false);
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

    const handleSyncToEmittedCount = async () => {
        if (emittedCount < 0) return;
        setIsUpdating(true);
        try {
            await onUpdate(id, emittedCount, invoiceTypeId);
            setValue(String(emittedCount + 1));
        } catch (e) {
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleKeyDownCurrent = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    const handleKeyDownEnd = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const parsedEndNumber = parseInt(endValue, 10) || (effectiveEnd ?? null);
    const formattedEndEncf = parsedEndNumber && parsedEndNumber > 0
        ? `${displayTypeId}${separator}${String(parsedEndNumber).padStart(padding, '0')}`
        : null;

    const formattedLastAccepted = lastAcceptedEncf || (maxUsedNumber > 0
        ? `${displayTypeId}${separator}${String(maxUsedNumber).padStart(padding, '0')}`
        : null);

    // ¿El próximo número configurado choca con uno ya emitido en DGII?
    const isCollidingWithAccepted = acceptedSeqNumbers.includes(nextSequenceNumber);

    // Cálculo real de comprobantes disponibles en el rango autorizado
    const hasEndLimit = parsedEndNumber !== null && parsedEndNumber > 0;
    const availableCount = hasEndLimit ? Math.max(0, parsedEndNumber - currentNumber) : null;
    const isNearDepletion = availableCount !== null && availableCount > 0 && availableCount <= 50;
    const isDepleted = availableCount !== null && availableCount <= 0;

    return (
        <div className="flex flex-col gap-2.5 w-full">
            {/* Fila Superior: Controles de Rango (Desde/Próximo y Hasta/Final) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* 1. Por cuál comprobante voy (Próximo a emitir) */}
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/70">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Próximo (# Desde)
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    onBlur={handleSaveCurrent}
                                    onKeyDown={handleKeyDownCurrent}
                                    className={`w-20 h-7 text-xs text-center font-mono font-bold ${isUpdating ? 'pr-6' : ''}`}
                                    disabled={isUpdating}
                                    title="Ingresa el número de comprobante por el que vas a facturar ahora"
                                />
                                {isUpdating && (
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>
                            <span className="text-xs text-primary font-mono font-bold whitespace-nowrap" title="Próximo comprobante que se emitirá">
                                → {formattedNextEncf}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Hasta dónde termina el rango autorizado (Fin de Secuencia) */}
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/70">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            Hasta (# Fin de Rango)
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="relative">
                                <Input
                                    type="text"
                                    value={endValue}
                                    onChange={(e) => setEndValue(e.target.value)}
                                    onBlur={handleSaveEndNumber}
                                    onKeyDown={handleKeyDownEnd}
                                    placeholder="Ej: 500"
                                    className={`w-24 h-7 text-xs text-center font-mono font-bold ${isUpdatingEnd ? 'pr-6' : ''}`}
                                    disabled={isUpdatingEnd}
                                    title="Ingresa hasta qué número de secuencia te autorizó la DGII"
                                />
                                {isUpdatingEnd && (
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono font-medium whitespace-nowrap">
                                {formattedEndEncf ? `→ ${formattedEndEncf}` : '(Sin límite)'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Emitidos en DGII */}
                <div
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-foreground flex items-center gap-1.5 text-xs h-auto"
                    title={
                        acceptedSeqNumbers.length > 0
                            ? `Secuencias aceptadas en DGII: ${acceptedSeqNumbers.sort((a, b) => a - b).map(n => `#${n}`).join(', ')}`
                            : 'Aún no hay comprobantes aceptados en DGII para este tipo'
                    }
                >
                    <FileCheck2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Emitidos:</span>
                    <span className="font-bold text-primary font-mono text-sm">{emittedCount.toLocaleString()}</span>
                    {formattedLastAccepted && (
                        <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
                            • Último: <strong className="text-foreground">{formattedLastAccepted}</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Fila Inferior: Disponibilidad, Alerta de 50 comprobantes y Botones de Alinear */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                {/* Badge de Disponibilidad y Alerta */}
                <div className="flex items-center gap-2">
                    {isDepleted ? (
                        <div className="px-2.5 py-1 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive flex items-center gap-1.5 font-semibold animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>🚨 Secuencia Agotada (0 disponibles) • ¡Debes solicitar comprobantes a la DGII!</span>
                        </div>
                    ) : isNearDepletion ? (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-500 flex items-center gap-1.5 font-semibold">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>⚠️ ¡Quedan solo {availableCount} comprobantes disponibles! Solicita comprobantes a la DGII.</span>
                        </div>
                    ) : availableCount !== null ? (
                        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            <span>Disponibles: <strong className="font-mono text-foreground font-bold">{availableCount.toLocaleString()}</strong> de {parsedEndNumber?.toLocaleString()}</span>
                        </div>
                    ) : (
                        <div className="px-2 py-0.5 rounded text-muted-foreground text-[11px] italic">
                            Sin rango final configurado (Puedes ingresar el número final arriba)
                        </div>
                    )}
                </div>

                {/* Acciones de Sincronización con DGII */}
                <div className="flex items-center gap-2 ml-auto">
                    {isCollidingWithAccepted ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleQuickSyncToNextAfterLast}
                            disabled={isUpdating}
                            className="h-7 px-2.5 text-xs bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 gap-1"
                            title="El comprobante actual ya fue emitido en DGII. Haz clic para avanzar al próximo libre."
                        >
                            <Wrench className="h-3 w-3" />
                            Saltar a #{maxUsedNumber + 1}
                        </Button>
                    ) : (emittedCount > 0 && nextSequenceNumber !== (emittedCount + 1)) ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSyncToEmittedCount}
                            disabled={isUpdating}
                            className="h-7 px-2.5 text-xs bg-blue-500/15 border-blue-500/40 text-blue-400 hover:bg-blue-500/25 gap-1"
                            title={`Alinear secuencia con los ${emittedCount} comprobantes reportados en DGII (Próximo: #${emittedCount + 1})`}
                        >
                            <Sparkles className="h-3 w-3" />
                            Alinear a #{emittedCount + 1}
                        </Button>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Secuencia al día
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoiceSequenceInput;