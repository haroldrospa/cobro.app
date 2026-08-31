import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { DeductionDetail } from '@/hooks/usePayroll';
import { cn } from '@/lib/utils';

interface Props {
    deductions: DeductionDetail[];
    onChange: (newDeductions: DeductionDetail[]) => void;
    readOnly?: boolean;
}

export function DeductionsManager({ deductions = [], onChange, readOnly = false }: Props) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<DeductionDetail[]>(deductions);

    useEffect(() => {
        setItems(deductions);
    }, [deductions]);

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
        onChange(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 px-2.5 rounded-lg border transition-all text-xs font-mono flex items-center gap-1.5",
                        total > 0
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-semibold"
                            : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Receipt className="h-3 w-3 shrink-0" />
                    <span>{total > 0 ? `-$${total.toLocaleString()}` : '$0'}</span>
                    {items.length > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1 py-0.2 rounded-full ml-0.5">
                            {items.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-2xl rounded-2xl overflow-hidden" align="center">
                <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Deducciones Detalladas</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Descuentos, préstamos o consumos</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Total</span>
                        <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">-${total.toLocaleString()}</span>
                    </div>
                </div>
                <div className="p-3 max-h-[280px] overflow-y-auto space-y-2">
                    {items.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                            No hay deducciones aplicadas.
                        </div>
                    ) : (
                        items.map((d, index) => (
                            <div key={index} className="flex gap-2 items-center bg-muted/30 p-1.5 rounded-lg border border-border/50">
                                <Input
                                    placeholder="Motivo (ej. Uniforme, Vale)"
                                    className="h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground flex-1"
                                    value={d.reason}
                                    onChange={(e) => handleUpdate(index, 'reason', e.target.value)}
                                    readOnly={readOnly}
                                    autoFocus={d.reason === '' && d.amount === 0}
                                />
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="h-8 text-xs pl-5 text-right font-mono bg-background border-border text-rose-600 dark:text-rose-400 placeholder:text-muted-foreground"
                                        value={d.amount || ''}
                                        onChange={(e) => handleUpdate(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        readOnly={readOnly}
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-md shrink-0"
                                        onClick={() => handleRemove(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
                {!readOnly && (
                    <div className="p-2 border-t border-border bg-muted/30">
                        <Button variant="ghost" size="sm" className="w-full text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-8 font-medium" onClick={handleAdd}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar Deducción
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
