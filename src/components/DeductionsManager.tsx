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
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 font-semibold"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                >
                    <Receipt className="h-3 w-3 shrink-0" />
                    <span>{total > 0 ? `-$${total.toLocaleString()}` : '$0'}</span>
                    {items.length > 0 && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1 py-0.2 rounded-full ml-0.5">
                            {items.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl overflow-hidden" align="center">
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">Deducciones Detalladas</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Descuentos, préstamos o consumos</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Total</span>
                        <span className="text-sm font-bold font-mono text-rose-400">-${total.toLocaleString()}</span>
                    </div>
                </div>
                <div className="p-3 max-h-[280px] overflow-y-auto space-y-2">
                    {items.length === 0 ? (
                        <div className="text-center py-6 text-xs text-zinc-500">
                            No hay deducciones aplicadas.
                        </div>
                    ) : (
                        items.map((d, index) => (
                            <div key={index} className="flex gap-2 items-center bg-zinc-900/40 p-1.5 rounded-lg border border-zinc-800/50">
                                <Input
                                    placeholder="Motivo (ej. Uniforme, Vale)"
                                    className="h-8 text-xs bg-zinc-900 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 flex-1"
                                    value={d.reason}
                                    onChange={(e) => handleUpdate(index, 'reason', e.target.value)}
                                    readOnly={readOnly}
                                    autoFocus={d.reason === '' && d.amount === 0}
                                />
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="h-8 text-xs pl-5 text-right font-mono bg-zinc-900 border-zinc-700/60 text-rose-300 placeholder:text-zinc-600"
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
                                        className="h-7 w-7 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md shrink-0"
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
                    <div className="p-2 border-t border-zinc-800/80 bg-zinc-900/40">
                        <Button variant="ghost" size="sm" className="w-full text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 font-medium" onClick={handleAdd}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar Deducción
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
