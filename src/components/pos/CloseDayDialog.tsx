import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock, Calculator, CheckCircle, Wallet, TrendingUp, TrendingDown, Clock, FileText, X, RefreshCcw, ShoppingCart, Trash2 } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useActiveSession, useCloseSession, useSessionHistory, useOpenSessions } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CashCountDialog from './CashCountDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { generateCloseDayPDF } from '@/utils/closeDayPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface CloseDayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onGoToPOS?: (orderId: string, customerName: string, orderNumber: string) => void;
}

const CloseDayDialog: React.FC<CloseDayDialogProps> = ({ isOpen, onClose, onGoToPOS }) => {
    const [actualCash, setActualCash] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [showCashCount, setShowCashCount] = useState(false);

    // States for blocking orders
    const [blockingOrders, setBlockingOrders] = useState<any[]>([]);
    const [loadingBlockingOrders, setLoadingBlockingOrders] = useState(false);

    // Options
    const [downloadPdf, setDownloadPdf] = useState(true);
    const [sendEmail, setSendEmail] = useState(true);
    const [printReport, setPrintReport] = useState(false);

    // Hooks
    const queryClient = useQueryClient();
    const { data: activeSessionCached } = useActiveSession();
    const { profile: currentUserProfile } = useUserProfile();
    const { data: userData } = useUserStore();
    const { data: openSessionsData, isLoading: isLoadingOpenSessions, isPending: isPendingOpenSessions } = useOpenSessions();
    const { data: historyData, isLoading: isLoadingHistory, isPending: isPendingHistory } = useSessionHistory();
    const history = historyData || [];
    const isLoading = isLoadingHistory || isPendingHistory || isLoadingOpenSessions || isPendingOpenSessions;

    const openSessionsDataRaw = openSessionsData || [];
    
    // Ensure active session is included in the open sessions list
    // (It might be excluded from openSessionsData if it's older than 24h)
    const openSessions = useMemo(() => {
        const list = [...openSessionsDataRaw];
        if (activeSessionCached && !list.find(s => s.id === activeSessionCached.id)) {
            list.unshift(activeSessionCached);
        }
        return list;
    }, [openSessionsDataRaw, activeSessionCached]);

    // Resolve the TRUE active session for the current user.
    // Prefer the most recent open session from the live DB list (openSessions)
    // over the potentially stale localStorage-seeded activeSessionCached.
    const activeSession = useMemo(() => {
        const currentUserId = currentUserProfile?.id;
        if (!currentUserId) return activeSessionCached ?? null;

        // Find the most recent open session belonging to this user in the live list
        const myLiveSessions = openSessions.filter(
            (s: any) => {
                const uid = typeof s.opened_by === 'object' && s.opened_by !== null 
                    ? s.opened_by.id 
                    : (s.opened_by || s.user_id || s.opener?.id);
                return uid === currentUserId;
            }
        );

        if (myLiveSessions.length > 0) {
            // Sort descending by opened_at and pick the newest
            const newest = myLiveSessions.sort(
                (a: any, b: any) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
            )[0];

            // Only prefer live session if it is newer than the cached one
            if (!activeSessionCached || new Date(newest.opened_at) >= new Date(activeSessionCached.opened_at)) {
                return newest;
            }
        }

        return activeSessionCached ?? null;
    }, [openSessions, activeSessionCached, currentUserProfile]);

    const activeSessionUserId = useMemo(() => {
        if (!activeSession) return null;
        return typeof activeSession.opened_by === 'object' && activeSession.opened_by !== null 
            ? activeSession.opened_by.id 
            : (activeSession.opened_by || activeSession.user_id || activeSession.opener?.id);
    }, [activeSession]);

    // Fetch blocking orders when dialog opens or activeSessionUserId updates
    React.useEffect(() => {
        if (!isOpen || !userData?.id || !activeSessionUserId) {
            setBlockingOrders([]);
            return;
        }
        
        const fetchBlockingOrders = async () => {
            setLoadingBlockingOrders(true);
            try {
                const { data, error: fetchErr } = await supabase
                    .from('open_orders')
                    .select('*')
                    .eq('store_id', userData.id)
                    .eq('profile_id', activeSessionUserId)
                    .eq('payment_status', 'pending')
                    .eq('source', 'pos')
                    .or('notes.is.null,notes.not.ilike.[ACTUALIZADO]%');
                if (!fetchErr && data) {
                    setBlockingOrders(data);
                } else if (fetchErr) {
                    console.error('Error fetching blocking orders:', fetchErr);
                }
            } catch (err) {
                console.error('Exception fetching blocking orders:', err);
            } finally {
                setLoadingBlockingOrders(false);
            }
        };
        
        fetchBlockingOrders();
    }, [isOpen, userData?.id, activeSessionUserId]);

    const effectiveStart = useMemo(() => {
        if (!activeSession) return new Date();
        return new Date(activeSession.opened_at);
    }, [activeSession]);

    const earliestStart = useMemo(() => {
        if (openSessions.length === 0) return effectiveStart;
        const minTime = Math.min(...openSessions.map((s: any) => new Date(s.opened_at).getTime()));
        const minDate = new Date(minTime);
        return minDate < effectiveStart ? minDate : effectiveStart;
    }, [openSessions, effectiveStart]);

    const { data: allStoreSales = [] } = useSales({ 
        dateFrom: earliestStart
    });
    
    const { data: movements = [] } = useCashMovements(effectiveStart, activeSession?.opened_by);
    const { companyInfo } = usePrintSettings();
    const closeSession = useCloseSession();
    const { toast } = useToast();

    // Filter sales for the current session
    const sessionSales = useMemo(() => {
        if (!activeSession) return [];
        return allStoreSales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            const isWithinTime = saleDate >= effectiveStart;
            const saleUserId = sale.profile_id || sale.user_id;
            const isSameUser = !activeSessionUserId || saleUserId === activeSessionUserId;
            const isNotCancelled = sale.status !== 'cancelled';
            return isWithinTime && isSameUser && isNotCancelled;
        });
    }, [allStoreSales, activeSession, effectiveStart, activeSessionUserId]);

    // Helper to calculate sales for any open session
    const getSessionTotal = (session: any) => {
        const sessionStart = new Date(session.opened_at);
        // Priority: opener.id (from join) > opened_by string > user_id
        // opener is always a full profile object when the join query succeeds
        const sessionUserId = session.opener?.id
            || (typeof session.opened_by === 'object' && session.opened_by !== null
                ? session.opened_by.id
                : session.opened_by)
            || session.user_id;

        const sSales = allStoreSales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            // Sales store the cashier in profile_id (preferred) or user_id (legacy)
            const saleUserId = sale.profile_id || sale.user_id;
            const isNotCancelled = sale.status !== 'cancelled';
            const isWithinSession = saleDate >= sessionStart;
            // If we can't resolve a user ID for the session, show all sales (fallback)
            const isFromUser = !sessionUserId || saleUserId === sessionUserId;
            return isWithinSession && isNotCancelled && isFromUser;
        });

        return sSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
    };

    // Filter movements for the current session
    const sessionMovements = useMemo(() => {
        if (!activeSession) return [];
        return movements.filter(m => {
            const mDate = new Date(m.created_at);
            const isWithinTime = mDate >= effectiveStart;
            // Extract the user ID from activeSession.opened_by (may be object or string)
            const sessionUserId = typeof activeSession.opened_by === 'object' && activeSession.opened_by !== null
                ? (activeSession.opened_by as any).id
                : (activeSession.opened_by || activeSession.opener?.id || activeSession.user_id);
            const isSameUser = !sessionUserId || m.profile_id === sessionUserId || m.profile_id === activeSessionUserId;
            return isWithinTime && isSameUser;
        });
    }, [movements, activeSession, effectiveStart, activeSessionUserId]);

    // Calculate Financials
    const stats = useMemo(() => {
        let cashSales = 0;
        let cardSales = 0;
        let transferSales = 0;
        let otherSales = 0;
        let totalRefunds = 0;

        sessionSales.forEach(sale => {
            const amount = sale.total || 0;

            if (amount < 0) {
                totalRefunds += Math.abs(amount);
                if (sale.payment_method === 'cash') cashSales -= Math.abs(amount);
                else if (sale.payment_method === 'card') cardSales -= Math.abs(amount);
                else if (sale.payment_method === 'transfer') transferSales -= Math.abs(amount);
                else otherSales -= Math.abs(amount);
            } else {
                if (sale.payment_method === 'cash') cashSales += amount;
                else if (sale.payment_method === 'card') cardSales += amount;
                else if (sale.payment_method === 'transfer') transferSales += amount;
                else if (sale.payment_method === 'split') {
                    const cS = Number(sale.split_cash || 0);
                    cashSales += cS;
                    const diff = amount - cS;
                    if (sale.split_method === 'card') cardSales += diff;
                    else if (sale.split_method === 'transfer') transferSales += diff;
                    else otherSales += diff;
                }
                else otherSales += amount;
            }
        });

        const deposits = sessionMovements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + Number(m.amount), 0);
        const withdrawals = sessionMovements.filter(m => m.type === 'withdrawal').reduce((acc, m) => acc + Number(m.amount), 0);

        const initialCash = activeSession?.initial_cash || 0;
        const expectedCash = cashSales + deposits - withdrawals;

        return {
            salesCount: sessionSales.length,
            cashSales,
            cardSales,
            transferSales,
            otherSales,
            totalRefunds,
            deposits,
            withdrawals,
            initialCash,
            cashToWithdraw: Math.max(0, cashSales + deposits - withdrawals),
            expectedCash: cashSales + deposits - withdrawals,
            totalSales: cashSales + cardSales + transferSales + otherSales
        };
    }, [sessionSales, sessionMovements, activeSession]);

    const difference = (parseFloat(actualCash) || 0) - stats.expectedCash;

    const handleCloseDay = async () => {
        if (!activeSession) return;

        try {
            // 1. Eliminar automáticamente tickets delta de cocina (ventas fantasmas)
            try {
                if (userData?.id && activeSessionUserId) {
                    await supabase
                        .from('open_orders')
                        .delete()
                        .eq('store_id', userData.id)
                        .eq('profile_id', activeSessionUserId)
                        .ilike('notes', '[ACTUALIZADO]%');
                }
            } catch (cleanupErr) {
                console.error('Error cleaning up delta tickets:', cleanupErr);
            }

            // Verificación de ventas abiertas (excluyendo tickets delta)
            let count = 0;
            let countError = null;

            if (userData?.id && activeSessionUserId) {
                const result = await supabase
                    .from('open_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('store_id', userData.id)
                    .eq('profile_id', activeSessionUserId)
                    .eq('payment_status', 'pending')
                    .eq('source', 'pos')
                    .or('notes.is.null,notes.not.ilike.[ACTUALIZADO]%');
                count = result.count || 0;
                countError = result.error;
            }

            if (countError) throw countError;

            if (count && count > 0) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Ventas abiertas pendientes', 
                    description: `Debes cobrar o cancelar tus ${count} venta(s) abierta(s) antes de cerrar la caja.` 
                });
                return;
            }

            if (!confirm('¿Estás seguro de que deseas cerrar el turno de caja y finalizar el día?')) {
                return;
            }

            await closeSession.mutateAsync({
                sessionId: activeSession.id,
                closingData: {
                    total_sales_cash: stats.cashSales,
                    total_sales_card: stats.cardSales,
                    total_sales_transfer: stats.transferSales,
                    total_sales_other: stats.otherSales,
                    total_refunds: stats.totalRefunds,
                    total_cash_in: stats.deposits,
                    total_cash_out: stats.withdrawals,
                    expected_cash: stats.expectedCash,
                    actual_cash: parseFloat(actualCash) || 0,
                    difference: difference,
                    notes: notes
                }
            });

            toast({ title: 'Cierre Exitoso', description: 'La caja se ha cerrado correctamente.' });

            if (downloadPdf || printReport) {
                const openerName = history.find((h: any) => h.id === activeSession.id)?.opener?.full_name || 'Desconocido';
                const doc = await generateCloseDayPDF(companyInfo, {
                    stats,
                    actualCash: parseFloat(actualCash) || 0,
                    difference,
                    notes,
                    openedAt: activeSession.opened_at,
                    closedAt: new Date().toISOString(),
                    openedBy: openerName,
                    closedBy: userData?.full_name || 'Usuario Actual'
                });

                if (downloadPdf) doc.save(`Cierre_Caja_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                if (printReport) {
                    doc.autoPrint();
                    window.open(doc.output('bloburl'), '_blank');
                }
            }

            if (sendEmail && userData?.id) {
                try {
                    const { error } = await supabase.functions.invoke('send-daily-report', {
                        body: { store_id: userData.id, report_type: 'daily', session_id: activeSession.id }
                    });
                    if (error) toast({ variant: 'destructive', title: 'Error enviando correo', description: 'No se pudo enviar el reporte.' });
                    else toast({ title: 'Reporte enviado', description: 'Se ha enviado el reporte por correo electrónico.' });
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error enviando correo', description: 'Error de red.' });
                }
            }

            onClose();
            setActualCash('');
            setNotes('');
        } catch (error: any) {
            console.error("Cierre caja error:", error);
            const errorStr = error?.message || error?.error_description || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            toast({ variant: 'destructive', title: 'Error al cerrar caja', description: errorStr || 'Error desconocido.' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <CashCountDialog
                isOpen={showCashCount}
                onClose={() => setShowCashCount(false)}
                onConfirm={(total) => setActualCash(total.toString())}
            />
            <DialogContent 
                hideCloseButton 
                className="max-w-[95vw] sm:max-w-4xl lg:max-w-6xl w-full h-[90vh] p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-2xl border-white/10 flex flex-col rounded-[2rem]"
                centerOnMobile={true}
            >
                <div className="bg-gradient-to-b from-green-500/10 via-green-500/5 to-transparent p-5 pb-1">
                    <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500/20 p-2 rounded-xl">
                                    <Lock className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-white tracking-tight">
                                        Control de Caja
                                    </DialogTitle>
                                    <DialogDescription className="text-zinc-500 text-[10px] font-medium flex items-center gap-2">
                                        <Clock className="h-2.5 w-2.5" />
                                        Apertura: {activeSession ? format(new Date(activeSession.opened_at), 'dd/MM/yyyy hh:mm a', { locale: es }) : '-'}
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="close" className="w-full flex-1 flex flex-col overflow-hidden px-6 pb-6">
                    <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start bg-white/5 p-1 rounded-2xl h-12 mb-6 sm:grid sm:grid-cols-2">
                        <TabsTrigger value="close" className="rounded-xl font-bold data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
                            Cierre de Sesión
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-xl font-bold data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
                            Historial
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="close" className="mt-0 flex-1 overflow-y-auto pr-1 no-scrollbar outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                            <div className="space-y-2 flex flex-col h-full">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl flex flex-col justify-between h-[4.5rem] backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-zinc-500">
                                            <Wallet className="h-3 w-3" />
                                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500/80">Fondo Inicial</span>
                                        </div>
                                        <p className="text-lg font-black text-white">RD$ {stats.initialCash.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-green-500/10 border border-green-500/10 p-3 rounded-2xl flex flex-col justify-between h-[4.5rem] backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-green-500">
                                            <TrendingUp className="h-3 w-3" />
                                            <span className="text-[8px] font-black uppercase tracking-widest">Ingresos Caja</span>
                                        </div>
                                        <p className="text-lg font-black text-green-500">RD$ {stats.deposits.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl flex flex-col justify-between h-[4.5rem] backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <Calculator className="h-3 w-3" />
                                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400/80">Ventas Totales</span>
                                        </div>
                                        <p className="text-lg font-black text-white">RD$ {stats.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/10 p-3 rounded-2xl flex flex-col justify-between h-[4.5rem] backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-red-500">
                                            <TrendingDown className="h-3 w-3" />
                                            <span className="text-[8px] font-black uppercase tracking-widest">Salidas Caja</span>
                                        </div>
                                        <p className="text-lg font-black text-red-500">RD$ {stats.withdrawals.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                                        <FileText className="h-3 w-3" />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Desglose por Método</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-zinc-300">Efectivo</span>
                                            <span className="text-xs font-bold text-white">RD$ {stats.cashSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-zinc-300">Tarjeta</span>
                                            <span className="text-xs font-bold text-white">RD$ {stats.cardSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-zinc-300">Transferencia</span>
                                            <span className="text-xs font-bold text-white">RD$ {stats.transferSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-zinc-300">Crédito / Otros</span>
                                            <span className="text-xs font-bold text-white">RD$ {stats.otherSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                {sessionMovements.length > 0 && (
                                    <div className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl backdrop-blur-sm">
                                        <div className="flex items-center gap-2 mb-2 text-zinc-400">
                                            <Wallet className="h-3 w-3" />
                                            <span className="text-[8px] font-black uppercase tracking-widest">Detalle de Movimientos</span>
                                        </div>
                                        <div className="space-y-2 max-h-24 overflow-y-auto no-scrollbar">
                                            {sessionMovements.map(m => (
                                                <div key={m.id} className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-medium text-zinc-300 line-clamp-1">{m.reason || (m.type === 'deposit' ? 'Ingreso' : 'Salida')}</span>
                                                        <span className="text-[8px] text-zinc-600 font-bold uppercase">{format(new Date(m.created_at), 'hh:mm a')}</span>
                                                    </div>
                                                    <span className={cn("text-[11px] font-bold", m.type === 'deposit' ? "text-green-500" : "text-red-500")}>
                                                        {m.type === 'deposit' ? '+' : '-'} RD$ {Number(m.amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-2 text-green-500">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Turnos Abiertos</span>
                                    </div>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center py-6 text-zinc-600">
                                                <RefreshCcw className="h-4 w-4 animate-spin mb-2 opacity-20" />
                                                <p className="text-[8px] uppercase tracking-widest opacity-20 font-black">Cargando...</p>
                                            </div>
                                        ) : openSessions.length > 0 ? (
                                            openSessions.map((session: any) => (
                                                <div key={session.id} className={cn(
                                                    "flex justify-between items-center bg-white/5 p-3 rounded-2xl border transition-all hover:bg-white/[0.07]",
                                                    session.id === activeSession?.id ? "border-green-500/40 bg-green-500/10" : "border-white/5"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                         <div className={cn(
                                                             "h-10 w-10 rounded-full flex items-center justify-center font-black text-xs border relative",
                                                             session.id === activeSession?.id ? "bg-green-500 text-white border-green-400" : "bg-zinc-800 text-zinc-400 border-white/10"
                                                         )}>
                                                             {(session.opener?.full_name || 'U').charAt(0)}
                                                             <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-zinc-900 rounded-full" />
                                                         </div>
                                                         <div className="flex flex-col">
                                                             <div className="flex items-center gap-2">
                                                                 <span className="text-xs font-bold text-white leading-none">{session.opener?.full_name || 'Cajero'}</span>
                                                                 <span className="text-[7px] bg-white/10 text-zinc-400 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-white/5">
                                                                     {session.opener?.role || 'Cajero'}
                                                                 </span>
                                                                 {session.id === activeSession?.id && <span className="text-[7px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase shadow-lg shadow-green-500/20">Tú</span>}
                                                             </div>
                                                             <span className="text-[9px] text-zinc-500 font-medium mt-1">
                                                                 Abierto hace {Math.floor((new Date().getTime() - new Date(session.opened_at).getTime()) / (1000 * 60 * 60))}h {Math.floor(((new Date().getTime() - new Date(session.opened_at).getTime()) / (1000 * 60)) % 60)}m
                                                             </span>
                                                         </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse" />
                                                            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">En Línea</span>
                                                        </div>
                                                        <span className="text-[11px] font-black text-white bg-zinc-950/50 px-2.5 py-1 rounded-lg border border-white/5 shadow-inner">
                                                            RD$ {getSessionTotal(session).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-[8px] font-black uppercase text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!confirm(`¿Estás seguro de cerrar forzosamente el turno de ${session.opener?.full_name || 'este cajero'}?`)) return;
                                                                
                                                                try {
                                                                    const sessionUserId = session.opener?.id || (typeof session.opened_by === 'object' && session.opened_by !== null ? session.opened_by.id : session.opened_by) || session.user_id;
                                                                    
                                                                    // 1. Eliminar automáticamente tickets delta de cocina (ventas fantasmas)
                                                                    try {
                                                                        await supabase
                                                                            .from('open_orders')
                                                                            .delete()
                                                                            .eq('store_id', userData?.id)
                                                                            .eq('profile_id', sessionUserId)
                                                                            .ilike('notes', '[ACTUALIZADO]%');
                                                                    } catch (cleanupErr) {
                                                                        console.error('Error cleaning up delta tickets:', cleanupErr);
                                                                    }

                                                                    // Verificación de ventas abiertas (excluyendo tickets delta)
                                                                    const { count, error: countError } = await supabase
                                                                        .from('open_orders')
                                                                        .select('id', { count: 'exact', head: true })
                                                                        .eq('store_id', userData?.id)
                                                                        .eq('profile_id', sessionUserId)
                                                                        .eq('payment_status', 'pending')
                                                                        .eq('source', 'pos')
                                                                        .or('notes.is.null,notes.not.ilike.[ACTUALIZADO]%');
                                                                        
                                                                    if (countError) throw countError;
                                                                    
                                                                    if (count && count > 0) {
                                                                        toast({ 
                                                                            variant: 'destructive', 
                                                                            title: 'Ventas abiertas pendientes', 
                                                                            description: `No se puede cerrar. ${session.opener?.full_name || 'El cajero'} tiene ${count} venta(s) abierta(s).` 
                                                                        });
                                                                        return;
                                                                    }

                                                                    const { error } = await supabase
                                                                        .from('cash_sessions')
                                                                        .update({ 
                                                                            status: 'closed', 
                                                                            closed_at: new Date().toISOString(),
                                                                            closed_by: currentUserProfile?.id 
                                                                        })
                                                                        .eq('id', session.id);
                                                                    
                                                                    if (error) throw error;
                                                                    queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
                                                                    queryClient.invalidateQueries({ queryKey: ['store-open-sessions'] });
                                                                    toast({ title: 'Turno cerrado', description: 'El turno se ha cerrado correctamente.' });
                                                                } catch (err: any) {
                                                                    toast({ variant: 'destructive', title: 'Error', description: err.message });
                                                                }
                                                            }}
                                                        >
                                                            Cerrar Turno
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-zinc-500 text-center py-2 italic">No hay otros turnos abiertos.</p>
                                        )}
                                    </div>
                                </div>

                                <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden mt-auto">
                                    <CardContent className="p-3">
                                        <div className="bg-zinc-950/50 rounded-xl p-3 border border-white/5 shadow-inner text-center">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">Efectivo Generado Esperado</span>
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                            </div>
                                            <p className="text-3xl font-black text-green-500 tracking-tighter leading-none">
                                                RD$ {stats.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-3 bg-white/[0.02] border border-white/5 p-5 rounded-3xl flex flex-col h-full">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-base font-black text-white italic tracking-tight">Declaración de Efectivo</Label>
                                        <Button variant="outline" size="sm" onClick={() => setShowCashCount(true)} className="h-7 gap-1.5 bg-white/5 border-white/10 text-[9px] font-bold rounded-lg active:scale-95 transition-all">
                                            <Calculator className="h-3 w-3 text-green-500" /> Conteo
                                        </Button>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-green-500/5 blur-2xl group-focus-within:bg-green-500/10 transition-all rounded-xl" />
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500/50 text-lg font-black">RD$</span>
                                            <Input
                                                id="actualCash"
                                                type="number"
                                                placeholder="0.00"
                                                className="pl-14 h-12 text-2xl font-black bg-zinc-900/50 border-white/5 rounded-xl focus-visible:ring-green-500/30 text-white placeholder:text-zinc-800 transition-all"
                                                value={actualCash}
                                                onChange={(e) => setActualCash(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-zinc-500 text-center font-medium">Solo monto de ventas y entradas. No incluya el fondo inicial.</p>
                                </div>

                                <AnimatePresence>
                                    {actualCash && (
                                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn("p-4 rounded-2xl border backdrop-blur-sm", difference === 0 ? "bg-green-500/10 border-green-500/20" : difference > 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-red-500/10 border-red-500/20")}>
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="font-bold text-zinc-400 text-[10px]">Diferencia de Caja:</span>
                                                <span className={cn("font-black text-xl tracking-tight", difference === 0 ? "text-green-500" : difference > 0 ? "text-blue-500" : "text-red-500")}>
                                                    {difference > 0 ? '+' : ''}RD$ {Math.abs(difference).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className={cn("text-center text-[8px] font-black uppercase tracking-widest", difference === 0 ? "text-green-500" : difference > 0 ? "text-blue-500" : "text-red-500")}>
                                                {difference === 0 ? '¡Cuadre Perfecto!' : difference < 0 ? 'Faltante de Efectivo' : 'Sobrante en Caja'}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {blockingOrders.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between gap-2 text-red-500">
                                            <div className="flex items-center gap-2">
                                                <Lock className="h-4 w-4 shrink-0" />
                                                <span className="text-xs font-black uppercase tracking-widest">Ventas Pendientes ({blockingOrders.length})</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-6 px-2 text-[10px] font-bold gap-1 rounded-lg shrink-0"
                                                onClick={async () => {
                                                    if (!confirm(`¿Eliminar los ${blockingOrders.length} pedidos pendientes? Esta acción no se puede deshacer.`)) return;
                                                    try {
                                                        const ids = blockingOrders.map(o => o.id);
                                                        await supabase.from('open_order_items').delete().in('order_id', ids);
                                                        await supabase.from('open_orders').delete().in('id', ids);
                                                        setBlockingOrders([]);
                                                        toast({ title: 'Pedidos eliminados', description: 'Se eliminaron todos los pedidos pendientes.' });
                                                    } catch (err: any) {
                                                        toast({ variant: 'destructive', title: 'Error', description: err.message });
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Cancelar Todos
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-medium">Debes cobrar o cancelar estos pedidos antes de finalizar el día:</p>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                                            {blockingOrders.map(order => (
                                                <div key={order.id} className="flex justify-between items-center bg-zinc-900/60 border border-white/5 p-2.5 rounded-xl gap-2">
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="text-xs font-bold text-white truncate">{order.customer_name || 'Cliente sin nombre'}</span>
                                                        <span className="text-[9px] text-zinc-500">RD$ {Number(order.total || 0).toLocaleString()} · #{order.order_number}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {onGoToPOS && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-[9px] font-black uppercase text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                                                                onClick={() => {
                                                                    onClose();
                                                                    onGoToPOS(order.id, order.customer_name, order.order_number);
                                                                }}
                                                            >
                                                                <ShoppingCart className="h-3 w-3" />
                                                                Cobrar
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-[9px] font-black uppercase text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            onClick={async () => {
                                                                if (!confirm(`¿Cancelar el pedido "${order.customer_name}" por RD$ ${Number(order.total || 0).toLocaleString()}?`)) return;
                                                                try {
                                                                    await supabase.from('open_order_items').delete().eq('order_id', order.id);
                                                                    await supabase.from('open_orders').delete().eq('id', order.id);
                                                                    setBlockingOrders(prev => prev.filter(o => o.id !== order.id));
                                                                    toast({ title: 'Pedido cancelado', description: `"${order.customer_name}" eliminado.` });
                                                                } catch (err: any) {
                                                                    toast({ variant: 'destructive', title: 'Error', description: err.message });
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 px-1">
                                        <FileText className="h-3 w-3 text-zinc-500" />
                                        <Label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Notas</Label>
                                    </div>
                                    <Input placeholder="Observaciones..." className="h-9 bg-white/5 border-white/5 rounded-lg text-[11px] italic" value={notes} onChange={(e) => setNotes(e.target.value)} />
                                </div>

                                <div className="space-y-2 mt-auto">
                                    <div className="flex items-center justify-between bg-zinc-900/40 p-2 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <Checkbox id="pdf-opt" checked={downloadPdf} onCheckedChange={(c) => setDownloadPdf(!!c)} className="border-zinc-700 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 w-3.5 h-3.5" />
                                                <Label htmlFor="pdf-opt" className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter cursor-pointer">PDF</Label>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Checkbox id="email-opt" checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} className="border-zinc-700 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 w-3.5 h-3.5" />
                                                <Label htmlFor="email-opt" className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter cursor-pointer">Email</Label>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Checkbox id="print-opt" checked={printReport} onCheckedChange={(c) => setPrintReport(!!c)} className="border-zinc-700 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 w-3.5 h-3.5" />
                                            <Label htmlFor="print-opt" className="text-[8px] font-black uppercase text-zinc-400 tracking-tighter cursor-pointer">Ticket</Label>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" className="flex-1 h-10 rounded-xl font-black text-zinc-500 hover:text-white transition-all uppercase tracking-widest text-[9px]" onClick={onClose}>Cancelar</Button>
                                        <Button className="flex-[2] h-10 rounded-xl font-black bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-600/20 active:scale-95 transition-all text-xs" disabled={!actualCash || closeSession.isPending} onClick={handleCloseDay}>
                                            {closeSession.isPending ? 'Cerrando...' : 'FINALIZAR DIA'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="flex-1 outline-none">
                        <Card className="bg-white/5 border-white/10 rounded-[2.5rem] overflow-hidden">
                            <CardContent className="p-0">
                                <ScrollArea className="h-[60vh] px-6 py-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Fecha & Hora</TableHead>
                                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Responsable</TableHead>
                                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest text-right">Fondo</TableHead>
                                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest text-right">Real</TableHead>
                                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest text-right">Diferencia</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.filter(h => h.status === 'closed').length === 0 ? (
                                                <TableRow className="border-transparent">
                                                    <TableCell colSpan={5} className="text-center py-20">
                                                        <div className="flex flex-col items-center gap-4 text-zinc-600">
                                                            <div className="p-6 bg-white/5 rounded-full"><FileText className="h-12 w-12" /></div>
                                                            <p className="font-bold text-lg">No hay cierres registrados aún</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                history.filter(h => h.status === 'closed').map((closing: any) => (
                                                    <TableRow key={closing.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                                        <TableCell className="py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-zinc-100 font-bold">{closing.closed_at ? format(new Date(closing.closed_at), 'dd MMM, yyyy', { locale: es }) : '-'}</span>
                                                                <span className="text-zinc-500 text-[10px] uppercase font-black tracking-tighter">{closing.closed_at ? format(new Date(closing.closed_at), 'hh:mm a', { locale: es }) : '-'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center font-black text-[10px] text-zinc-400">{(closing.opener?.full_name || 'N').charAt(0)}</div>
                                                                <span className="text-zinc-300 font-medium">{closing.opener?.full_name || 'N/A'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-zinc-400 font-bold">RD$ {(closing.initial_cash || 0).toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-white font-black text-lg">RD$ {(closing.actual_cash || 0).toLocaleString()}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge className={cn("rounded-lg px-2 h-7 font-black text-[11px]", (closing.difference || 0) === 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : (closing.difference || 0) > 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                                                {(closing.difference || 0) > 0 ? '+' : ''}RD$ {(closing.difference || 0).toLocaleString()}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};



export default CloseDayDialog;
