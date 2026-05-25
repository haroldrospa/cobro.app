
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DeductionDetail } from '@/hooks/usePayroll';

interface Props {
    deductions: DeductionDetail[];
    onChange: (newDeductions: DeductionDetail[]) => void;
    readOnly?: boolean;
}

export function DeductionsManager({ deductions = [], onChange, readOnly = false }: Props) {
    const [open, setOpen] = useState(false);
    // Local state for immediate UI feedback. Initialized from props.
    // We trust props as source of truth on mount or external changes, 
    // but behave optimistically on internal changes.
    const [items, setItems] = useState<DeductionDetail[]>(deductions);

    // Sync external changes (e.g. initial load or refetch)
    useEffect(() => {
        setItems(deductions);
    }, [deductions]);

    // Calculate total from local items to show immediate feedback
    const total = items.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const handleAdd = () => {
        const newItems = [...items, { reason: '', amount: 0 }];
        setItems(newItems);
        onChange(newItems);
    };

    const handleRemove = (index: number) => {
        const next = [...items];
        next.splice(index, 1);
        setItems(next);
        onChange(next);
    };

    const handleUpdate = (index: number, field: keyof DeductionDetail, value: any) => {
        const next = [...items];
        next[index] = { ...next[index], [field]: value };
        setItems(next);

        // Debounce external sync? For now calling immediate is fine if parent handles it well, 
        // but given the parent does DB call, it might be heavy. 
        // We will call it, but the UI won't freeze because we use local state for render.
        onChange(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`h-8 border-dashed ${total > 0 ? 'border-red-300 bg-red-50 text-red-900' : 'text-muted-foreground'}`}
                >
                    <List className="mr-2 h-3 w-3" />
                    ${total.toLocaleString()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4 border-b bg-muted/30">
                    <h4 className="font-medium leading-none">Deducciones Detalladas</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                        Total: <span className="font-bold text-red-600">${total.toLocaleString()}</span>
                    </p>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                    {items.length === 0 && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                            No hay deducciones adicionales.
                        </div>
                    )}
                    <div className="space-y-2">
                        {items.map((d, index) => (
                            <div key={index} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                                <Input
                                    placeholder="Razón (ej. Uniforme)"
                                    className="h-8 text-xs flex-1"
                                    value={d.reason}
                                    onChange={(e) => handleUpdate(index, 'reason', e.target.value)}
                                    readOnly={readOnly}
                                    autoFocus={d.reason === '' && d.amount === 0} // Autofocus new items
                                />
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="h-8 w-20 text-xs text-right"
                                    value={d.amount || ''}
                                    onChange={(e) => handleUpdate(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    readOnly={readOnly}
                                    onFocus={(e) => e.target.select()}
                                />
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                        onClick={() => handleRemove(index)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {!readOnly && (
                    <div className="p-2 border-t bg-muted/30">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleAdd}>
                            <Plus className="mr-2 h-3 w-3" /> Agregar Deducción
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
