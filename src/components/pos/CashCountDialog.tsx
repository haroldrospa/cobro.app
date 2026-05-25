import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Calculator } from 'lucide-react';

interface CashCountDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (total: number) => void;
    initialTotal?: number;
}

const DENOMINATIONS = [
    { value: 2000, label: 'RD$ 2,000' },
    { value: 1000, label: 'RD$ 1,000' },
    { value: 500, label: 'RD$ 500' },
    { value: 200, label: 'RD$ 200' },
    { value: 100, label: 'RD$ 100' },
    { value: 50, label: 'RD$ 50' },
    { value: 25, label: 'RD$ 25' },
    { value: 10, label: 'RD$ 10' },
    { value: 5, label: 'RD$ 5' },
    { value: 1, label: 'RD$ 1' },
];

const CashCountDialog: React.FC<CashCountDialogProps> = ({ isOpen, onClose, onConfirm, initialTotal = 0 }) => {
    // Map denomination value to count (quantity)
    const [counts, setCounts] = useState<Record<number, string>>(() => {
        const saved = localStorage.getItem('pos_cash_counts');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('pos_cash_counts', JSON.stringify(counts));
    }, [counts]);

    const calculateTotal = () => {
        return DENOMINATIONS.reduce((acc, denom) => {
            const count = parseInt(counts[denom.value] || '0', 10);
            return acc + (count * denom.value);
        }, 0);
    };

    const handleConfirm = () => {
        onConfirm(calculateTotal());
        onClose();
    };

    const handleCountChange = (value: number, quantity: string) => {
        // Allow empty string or numbers only
        if (quantity === '' || /^\d+$/.test(quantity)) {
            setCounts(prev => ({ ...prev, [value]: quantity }));
        }
    };

    const total = calculateTotal();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Conteo de Efectivo por Denominación
                    </DialogTitle>
                    <div className="flex items-center justify-between">
                        <DialogDescription>
                            Ingrese la cantidad de billetes y monedas.
                        </DialogDescription>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setCounts({})}
                            className="h-7 text-[10px] font-bold uppercase text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                            Limpiar
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    <Table>
                        <TableBody>
                            {DENOMINATIONS.map((denom) => (
                                <TableRow key={denom.value} className="border-b-0">
                                    <TableCell className="font-medium py-2 w-1/3">
                                        {denom.label}
                                    </TableCell>
                                    <TableCell className="py-1">
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="text-right h-8"
                                            value={counts[denom.value] || ''}
                                            onChange={(e) => handleCountChange(denom.value, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right py-2 w-1/3 text-muted-foreground">
                                        RD$ {((parseInt(counts[denom.value] || '0', 10)) * denom.value).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="bg-muted p-4 rounded-lg mt-2 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total Contado:</span>
                        <span className="font-bold text-2xl text-primary">
                            RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleConfirm}>Confirmar Total</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CashCountDialog;
