import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface InvoiceSequenceInputProps {
    id: string;
    invoiceTypeId: string;
    currentNumber: number; // This is actually the "last used" number from DB
    onUpdate: (id: string, newNumber: number, invoiceTypeId: string) => Promise<void>;
    isElectronic?: boolean;
}

export const InvoiceSequenceInput = ({
    id,
    invoiceTypeId,
    currentNumber,
    onUpdate,
    isElectronic = false
}: InvoiceSequenceInputProps) => {
    // We want to edit the "Next Number", which is currentNumber + 1
    const initialNextNumber = currentNumber + 1;
    const [value, setValue] = useState(String(initialNextNumber));
    const [isUpdating, setIsUpdating] = useState(false);
    const prevCurrentNumberRef = useRef(currentNumber);

    // Update local state if the prop changes externally
    useEffect(() => {
        if (prevCurrentNumberRef.current !== currentNumber) {
            setValue(String(currentNumber + 1));
            prevCurrentNumberRef.current = currentNumber;
        }
    }, [currentNumber]);

    const handleSave = async () => {
        const numericValue = parseInt(value);

        // Basic validation
        if (isNaN(numericValue) || numericValue < 1) {
            // Revert if invalid
            setValue(String(currentNumber + 1));
            return;
        }

        // The logic: 
        // Input shows "Next Number" (e.g. 1765)
        // DB stores "Current/Last Number" (e.g. 1764)
        // So we need to save (numericValue - 1)
        const valueToSave = numericValue - 1;

        // Optimization: Don't save if unchanged
        if (valueToSave === currentNumber) return;

        setIsUpdating(true);
        try {
            await onUpdate(id, valueToSave, invoiceTypeId);
        } catch (e) {
            // Revert on error
            setValue(String(currentNumber + 1));
            console.error(e);
        } finally {
            setIsUpdating(false);
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
            case 'B14': displayTypeId = 'E44'; break;
            case 'B15': displayTypeId = 'E45'; break;
            case 'B16': displayTypeId = 'E46'; break;
        }
    }
    
    const separator = isElectronic ? '' : '-';
    const padding = isElectronic ? 10 : 8;

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={`w-24 text-center ${isUpdating ? 'pr-8' : ''}`}
                    disabled={isUpdating}
                />
                {isUpdating && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    </div>
                )}
            </div>
            <span className="text-sm text-muted-foreground font-mono">
                → {displayTypeId}{separator}{String(value).padStart(padding, '0')}
            </span>
        </div>
    );
};

export default InvoiceSequenceInput;
