import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownCircle, ArrowUpCircle, DollarSign, Wallet, History, PlusIcon, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useCashMovements, useCreateCashMovement } from '@/hooks/useCashMovements';
import { useActiveSession } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CashMovementsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const CashMovementsDialog: React.FC<CashMovementsDialogProps> = ({ isOpen, onClose }) => {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [activeTab, setActiveTab] = useState('new');

    const { data: activeSession } = useActiveSession();
    const sessionStartDate = activeSession?.opened_at ? new Date(activeSession.opened_at) : new Date();
    const queryDate = new Date(sessionStartDate);
    queryDate.setHours(0, 0, 0, 0);

    const { data: movements = [], isLoading } = useCashMovements(queryDate);

    const sessionMovements = movements.filter(m => {
        if (!activeSession?.opened_at) return false;
        return new Date(m.created_at) >= new Date(activeSession.opened_at);
    });

    const createMovement = useCreateCashMovement();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amountValue = parseFloat(amount);
        if (!amountValue || amountValue <= 0) {
            toast({ variant: 'destructive', title: 'Monto inválido', description: 'Por favor ingrese un monto mayor a 0' });
            return;
        }

        if (!reason.trim()) {
            toast({ variant: 'destructive', title: 'Razón requerida', description: 'Por favor ingrese una descripción' });
            return;
        }

        try {
            await createMovement.mutateAsync({ type, amount: amountValue, reason });
            setAmount('');
            setReason('');
            setActiveTab('history');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Sistema', description: error.message || 'Error desconocido.' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                hideCloseButton 
                className="max-w-[95vw] sm:max-w-md lg:max-w-xl w-full p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-2xl border-white/10 rounded-[2.5rem]"
                centerOnMobile={true}
            >
                <div className="bg-gradient-to-b from-green-500/10 to-transparent p-6 pb-2">
                    <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500/20 p-2.5 rounded-2xl">
                                    <Wallet className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-white tracking-tight">
                                        Movimientos de Caja
                                    </DialogTitle>
                                    <DialogDescription className="text-zinc-500 font-medium">
                                        {activeSession
                                            ? `Sesión iniciada: ${format(new Date(activeSession.opened_at), 'hh:mm a')}`
                                            : 'Registre entradas y salidas manuales'
                                        }
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400">
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start bg-white/5 p-1 rounded-2xl h-12 mb-6 sm:grid sm:grid-cols-2">
                            <TabsTrigger value="new" className="rounded-xl font-bold data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all flex items-center gap-2">
                                <PlusIcon className="h-4 w-4" /> Nuevo Registro
                            </TabsTrigger>
                            <TabsTrigger value="history" className="rounded-xl font-bold data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all flex items-center gap-2">
                                <History className="h-4 w-4" /> Historial
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="new" className="mt-0 outline-none">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                            "h-24 flex flex-col gap-2 rounded-3xl border-white/10 transition-all",
                                            type === 'deposit' ? "bg-green-500/20 border-green-500/40 text-green-500 shadow-lg shadow-green-500/10 ring-1 ring-green-500/20" : "bg-white/5 hover:bg-white/10 text-zinc-500"
                                        )}
                                        onClick={() => setType('deposit')}
                                    >
                                        <ArrowUpCircle className={cn("h-8 w-8", type === 'deposit' ? "text-green-500" : "text-zinc-500")} />
                                        <span className="font-black uppercase tracking-widest text-[10px]">Entrada</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                            "h-24 flex flex-col gap-2 rounded-3xl border-white/10 transition-all",
                                            type === 'withdrawal' ? "bg-red-500/20 border-red-500/40 text-red-500 shadow-lg shadow-red-500/10 ring-1 ring-red-500/20" : "bg-white/5 hover:bg-white/10 text-zinc-500"
                                        )}
                                        onClick={() => setType('withdrawal')}
                                    >
                                        <ArrowDownCircle className={cn("h-8 w-8", type === 'withdrawal' ? "text-red-500" : "text-zinc-500")} />
                                        <span className="font-black uppercase tracking-widest text-[10px]">Salida</span>
                                    </Button>
                                </div>

                                <div className="space-y-2 group">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto del Movimiento</Label>
                                    <div className="relative">
                                        <span className={cn(
                                            "absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black transition-colors",
                                            type === 'deposit' ? "text-green-500/50" : "text-red-500/50"
                                        )}>RD$</span>
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="0.00"
                                            className="pl-20 h-20 text-4xl font-black bg-zinc-900/50 border-white/10 rounded-[2rem] focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-white/20 text-white placeholder:text-zinc-800 transition-all"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descripción / Motivo</Label>
                                    <Input
                                        id="reason"
                                        placeholder={type === 'deposit' ? "Ej. Cobro a deuda..." : "Ej. Pago a proveedor..."}
                                        className="h-14 bg-white/5 border-white/5 rounded-2xl text-sm italic"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                <Button
                                    className={cn(
                                        "w-full h-16 mt-4 rounded-3xl font-black transition-all active:scale-95 text-lg shadow-lg uppercase tracking-widest",
                                        type === 'deposit' ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-green-500/20" : "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/20"
                                    )}
                                    onClick={handleSubmit}
                                    disabled={createMovement.isPending}
                                >
                                    {createMovement.isPending ? 'Procesando...' : (
                                        <div className="flex items-center gap-2">
                                            Registrar {type === 'deposit' ? 'Entrada' : 'Salida'} <ChevronRight className="h-5 w-5" />
                                        </div>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="history" className="mt-0 outline-none">
                            <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden max-h-[400px] overflow-y-auto no-scrollbar">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-white/5 hover:bg-transparent">
                                            <TableHead className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Hora</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Detalle</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow className="border-transparent">
                                                <TableCell colSpan={3} className="text-center py-20 text-zinc-500 font-bold">Cargando...</TableCell>
                                            </TableRow>
                                        ) : sessionMovements.length === 0 ? (
                                            <TableRow className="border-transparent">
                                                <TableCell colSpan={3} className="text-center py-20">
                                                    <div className="flex flex-col items-center gap-3 text-zinc-600">
                                                        <AlertCircle className="h-10 w-10 opacity-30" />
                                                        <p className="font-bold">Sin movimientos aún</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sessionMovements.map((mov) => (
                                                <TableRow key={mov.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                                    <TableCell className="py-4">
                                                        <span className="text-zinc-500 text-[10px] font-black tracking-tighter uppercase">
                                                            {format(new Date(mov.created_at), 'hh:mm a')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                {mov.type === 'deposit' ? (
                                                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                                                ) : (
                                                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                                                )}
                                                                <span className={cn(
                                                                    "text-[10px] font-black uppercase tracking-widest",
                                                                    mov.type === 'deposit' ? "text-green-500" : "text-red-500"
                                                                )}>
                                                                    {mov.type === 'deposit' ? 'Entrada' : 'Salida'}
                                                                </span>
                                                            </div>
                                                            <span className="text-zinc-300 font-medium text-xs line-clamp-1">{mov.reason}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cn(
                                                        "text-right font-black text-sm",
                                                        mov.type === 'deposit' ? "text-green-500" : "text-red-500"
                                                    )}>
                                                        {mov.type === 'deposit' ? '+' : '-'} RD$ {mov.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CashMovementsDialog;
