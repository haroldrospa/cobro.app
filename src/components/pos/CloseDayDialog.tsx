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
    const [activeTab, setActiveTab] = useState<'close' | 'history'>('close');
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
    const { data: openSessionsData, isLoading: isLoadingOpenSessions, isPending: isPendingOpenSessions } = useOpenSessions({ enabled: isOpen });
    const { data: historyData, isLoading: isLoadingHistory, isPending: isPendingHistory } = useSessionHistory({ enabled: isOpen && activeTab === 'history' });
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
                    .select('id, total, order_number, customer_name, notes')
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
        if (!activeSession) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        }
        return new Date(activeSession.opened_at);
    }, [activeSession]);

    const earliestStart = useMemo(() => {
        let baseDate: Date = effectiveStart;
        if (openSessions.length > 0) {
            const timestamps = openSessions
                .map((s: any) => s.opened_at ? new Date(s.opened_at).getTime() : null)
                .filter((t): t is number => t !== null && !isNaN(t));
            if (timestamps.length > 0) {
                const minTime = Math.min(...timestamps);
                const minDate = new Date(minTime);
                if (minDate < baseDate) {
                    baseDate = minDate;
                }
            }
        }
        return baseDate;
    }, [openSessions, effectiveStart]);

    const { data: allStoreSales = [] } = useSales({ 
        dateFrom: earliestStart,
        userId: currentUserProfile?.role === 'admin' ? 'all' : (currentUserProfile?.id || 'all')
    });
    
    const { data: movements = [] } = useCashMovements(
        earliestStart, 
        currentUserProfile?.role === 'admin' ? 'all' : (currentUserProfile?.id || 'all')
    );
    const { companyInfo } = usePrintSettings();
    const closeSession = useCloseSession();
    const { toast } = useToast();

    // Filter sales for the current session
    const sessionSales = useMemo(() => {
        if (!activeSession) return [];
        // Buffer de 1 minuto para absorber desincronización menor de relojes
        const bufferStart = new Date(activeSession.opened_at);
        bufferStart.setMinutes(bufferStart.getMinutes() - 1);

        return allStoreSales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            const isWithinTime = saleDate >= bufferStart;
            const isNotCancelled = sale.status !== 'cancelled';
            return isWithinTime && isNotCancelled;
        });
    }, [allStoreSales, activeSession]);

    // Helper to calculate sales for any open session
    const getSessionTotal = (session: any) => {
        const sessionStart = new Date(session.opened_at);
        sessionStart.setMinutes(sessionStart.getMinutes() - 1);

        const sessionUserId = session.opener?.id
            || (typeof session.opened_by === 'object' && session.opened_by !== null
                ? session.opened_by.id
                : session.opened_by)
            || session.user_id;

        const sSales = allStoreSales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            const saleUserId = sale.profile_id || sale.user_id;
            const isNotCancelled = sale.status !== 'cancelled';
            const isWithinSession = saleDate >= sessionStart;
            const isFromUser = !sessionUserId || !saleUserId || saleUserId === sessionUserId;
            return isWithinSession && isNotCancelled && isFromUser;
        });

        return sSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
    };

    // Filter movements for the current session
    const sessionMovements = useMemo(() => {
        if (!activeSession) return [];
        const bufferStart = new Date(activeSession.opened_at);
        bufferStart.setMinutes(bufferStart.getMinutes() - 1);

        return movements.filter(m => {
            const mDate = new Date(m.created_at);
            const isWithinTime = mDate >= bufferStart;
            return isWithinTime;
        });
    }, [movements, activeSession]);

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
                const openerName = history.find((h: any) => h.id === activeSession.id)?.opener?.full_name 
                    || (typeof activeSession.opened_by === 'object' ? (activeSession.opened_by as any)?.full_name : null) 
                    || (activeSession as any).opener?.full_name 
                    || currentUserProfile?.full_name 
                    || 'Desconocido';
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
                className="max-w-[95vw] sm:max-w-4xl lg:max-w-5xl w-full h-[90vh] max-h-[660px] p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/40 flex flex-col rounded-3xl shadow-2xl"
                centerOnMobile={true}
            >
                {/* Header with integrated tabs */}
                <div className="px-5 py-3 border-b border-border/40 bg-gradient-to-r from-green-500/10 via-transparent to-transparent flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 p-2 rounded-xl text-green-500">
                            <Lock className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <DialogTitle className="text-lg font-black text-foreground tracking-tight">
                                    Control de Caja
                                </DialogTitle>
                                {activeSession && (
                                    <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground border-border/40 py-0 h-5 gap-1">
                                        <Clock className="h-2.5 w-2.5 text-green-500" />
                                        {format(new Date(activeSession.opened_at), 'dd/MM/yyyy hh:mm a', { locale: es })}
                                    </Badge>
                                )}
                            </div>
                            <DialogDescription className="sr-only">Cierre de sesión y arqueo de caja</DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                            <TabsList className="bg-muted/80 p-0.5 rounded-xl h-8">
                                <TabsTrigger value="close" className="rounded-lg text-xs font-bold px-3 h-7 data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
                                    Cierre de Sesión
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-lg text-xs font-bold px-3 h-7 data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
                                    Historial
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <TabsContent value="close" className="m-0 p-4 flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-3.5 outline-none">
                        {/* Left Column: Financial Overview */}
                        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5 min-h-0 h-full overflow-hidden">
                            {/* 4 Stats Cards in 1 Row */}
                            <div className="grid grid-cols-4 gap-2 shrink-0">
                                <div className="bg-card/60 border border-border/40 p-2.5 rounded-xl flex flex-col justify-between h-14 backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Wallet className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Fondo</span>
                                    </div>
                                    <p className="text-xs font-black text-foreground truncate">RD$ {stats.initialCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-card/60 border border-border/40 p-2.5 rounded-xl flex flex-col justify-between h-14 backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Calculator className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Ventas</span>
                                    </div>
                                    <p className="text-xs font-black text-foreground truncate">RD$ {stats.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl flex flex-col justify-between h-14 backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 text-green-500">
                                        <TrendingUp className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Entradas</span>
                                    </div>
                                    <p className="text-xs font-black text-green-500 truncate">RD$ {stats.deposits.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex flex-col justify-between h-14 backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 text-red-500">
                                        <TrendingDown className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Salidas</span>
                                    </div>
                                    <p className="text-xs font-black text-red-500 truncate">RD$ {stats.withdrawals.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            {/* Middle Details: Breakdown + Active Shifts/Movements */}
                            <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 overflow-hidden">
                                {/* Card 1: Desglose por Método */}
                                <div className="bg-card/60 border border-border/40 p-3 rounded-xl flex flex-col justify-between overflow-hidden">
                                    <div className="flex items-center gap-1.5 text-muted-foreground border-b border-border/30 pb-1.5">
                                        <FileText className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Desglose Métodos</span>
                                    </div>
                                    <div className="space-y-1.5 py-1">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-medium">Efectivo</span>
                                            <span className="font-bold text-foreground">RD$ {stats.cashSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-medium">Tarjeta</span>
                                            <span className="font-bold text-foreground">RD$ {stats.cardSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-medium">Transferencia</span>
                                            <span className="font-bold text-foreground">RD$ {stats.transferSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-medium">Crédito / Otros</span>
                                            <span className="font-bold text-foreground">RD$ {stats.otherSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                    <div className="pt-1.5 border-t border-border/30 flex justify-between items-center text-[10px] text-muted-foreground">
                                        <span>Total Facturas:</span>
                                        <span className="font-bold text-foreground">{stats.salesCount}</span>
                                    </div>
                                </div>

                                {/* Card 2: Turnos & Movimientos */}
                                <div className="bg-card/60 border border-border/40 p-3 rounded-xl flex flex-col min-h-0 overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
                                        <div className="flex items-center gap-1.5 text-green-500">
                                            <Clock className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">Turnos Abiertos</span>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-green-500/30 text-green-500 font-bold">
                                            {openSessions.length} Activos
                                        </Badge>
                                    </div>

                                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 py-1.5">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center py-4 text-muted-foreground">
                                                <RefreshCcw className="h-3 w-3 animate-spin mr-1.5 opacity-50" />
                                                <span className="text-[9px]">Cargando...</span>
                                            </div>
                                        ) : openSessions.length > 0 ? (
                                            openSessions.map((session: any) => (
                                                <div key={session.id} className={cn(
                                                    "flex items-center justify-between p-1.5 rounded-lg border text-xs transition-all",
                                                    session.id === activeSession?.id ? "border-green-500/30 bg-green-500/5" : "border-border/30 bg-muted/40"
                                                )}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={cn(
                                                            "h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0",
                                                            session.id === activeSession?.id ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {(session.opener?.full_name || 'U').charAt(0)}
                                                        </div>
                                                        <div className="truncate flex flex-col">
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold truncate text-[11px]">{session.opener?.full_name || 'Cajero'}</span>
                                                                {session.id === activeSession?.id && <span className="text-[7px] bg-green-500 text-white px-1 rounded-full font-black">TÚ</span>}
                                                            </div>
                                                            <span className="text-[8px] text-muted-foreground">
                                                                {Math.floor((new Date().getTime() - new Date(session.opened_at).getTime()) / (1000 * 60 * 60))}h {Math.floor(((new Date().getTime() - new Date(session.opened_at).getTime()) / (1000 * 60)) % 60)}m
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="text-[10px] font-bold text-foreground">
                                                            RD$ {getSessionTotal(session).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </span>
                                                        {session.id !== activeSession?.id && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-5 px-1 text-[8px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!confirm(`¿Cerrar forzosamente el turno de ${session.opener?.full_name || 'este cajero'}?`)) return;
                                                                    try {
                                                                        const sessionUserId = session.opener?.id || (typeof session.opened_by === 'object' && session.opened_by !== null ? session.opened_by.id : session.opened_by) || session.user_id;
                                                                        const { error } = await supabase
                                                                            .from('cash_sessions')
                                                                            .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: currentUserProfile?.id })
                                                                            .eq('id', session.id);
                                                                        if (error) throw error;
                                                                        queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
                                                                        queryClient.invalidateQueries({ queryKey: ['store-open-sessions'] });
                                                                        toast({ title: 'Turno cerrado' });
                                                                    } catch (err: any) {
                                                                        toast({ variant: 'destructive', title: 'Error', description: err.message });
                                                                    }
                                                                }}
                                                            >
                                                                Cerrar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground text-center py-2 italic">Sin otros turnos.</p>
                                        )}
                                    </div>

                                    {sessionMovements.length > 0 && (
                                        <div className="pt-1.5 border-t border-border/30 flex items-center justify-between text-[9px] text-muted-foreground">
                                            <span>Movimientos de caja:</span>
                                            <span className="font-bold text-foreground">{sessionMovements.length} registradas</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Hero: Expected Cash */}
                            <div className="bg-gradient-to-r from-green-500/15 via-green-500/10 to-transparent border border-green-500/20 p-3 rounded-xl flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="bg-green-500/20 p-1.5 rounded-lg text-green-500">
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Efectivo Esperado en Caja</p>
                                        <p className="text-[10px] text-muted-foreground">Fondo + Ventas Efectivo + Entradas - Salidas</p>
                                    </div>
                                </div>
                                <p className="text-2xl font-black text-green-500 tracking-tight">
                                    RD$ {stats.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Declaration & Closing Actions */}
                        <div className="lg:col-span-5 bg-card/40 border border-border/40 p-3.5 rounded-2xl flex flex-col justify-between gap-2.5 min-h-0 h-full overflow-hidden">
                            {/* Declaration Header & Input */}
                            <div className="space-y-2 shrink-0">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-black text-foreground uppercase tracking-wider">Declaración de Efectivo</Label>
                                    <Button variant="outline" size="sm" onClick={() => setShowCashCount(true)} className="h-6 gap-1 bg-background/80 border-border/60 text-[9px] font-bold rounded-lg active:scale-95 transition-all px-2">
                                        <Calculator className="h-2.5 w-2.5 text-green-500" /> Conteo
                                    </Button>
                                </div>

                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500/60 text-sm font-black">RD$</span>
                                    <Input
                                        id="actualCash"
                                        type="number"
                                        placeholder="0.00"
                                        className="pl-11 h-10 text-lg font-black bg-background/80 border-border/60 rounded-xl focus-visible:ring-green-500/30 text-foreground placeholder:text-muted-foreground/40"
                                        value={actualCash}
                                        onChange={(e) => setActualCash(e.target.value)}
                                    />
                                </div>

                                {/* Compact Difference Indicator */}
                                {actualCash ? (
                                    <div className={cn(
                                        "p-2 rounded-xl border flex items-center justify-between text-xs transition-all",
                                        difference === 0 ? "bg-green-500/10 border-green-500/20 text-green-500" :
                                        difference > 0 ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                        "bg-red-500/10 border-red-500/20 text-red-500"
                                    )}>
                                        <div className="flex items-center gap-1 font-bold text-[10px]">
                                            <span>{difference === 0 ? '¡Cuadre Perfecto!' : difference < 0 ? 'Faltante:' : 'Sobrante:'}</span>
                                        </div>
                                        <span className="font-black text-sm">
                                            {difference > 0 ? '+' : ''}RD$ {Math.abs(difference).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-muted-foreground text-center italic">Ingresa el total contado de ventas y entradas.</p>
                                )}
                            </div>

                            {/* Middle section: Blocking Orders or Notes */}
                            <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 overflow-hidden">
                                {blockingOrders.length > 0 ? (
                                    <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl space-y-1.5 flex-1 min-h-0 flex flex-col justify-between">
                                        <div className="flex items-center justify-between text-red-500">
                                            <div className="flex items-center gap-1.5">
                                                <Lock className="h-3 w-3 shrink-0" />
                                                <span className="text-[10px] font-black uppercase">Ventas Pendientes ({blockingOrders.length})</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-5 px-1.5 text-[8px] font-bold gap-1 rounded-md"
                                                onClick={async () => {
                                                    if (!confirm(`¿Eliminar los ${blockingOrders.length} pedidos pendientes?`)) return;
                                                    try {
                                                        const ids = blockingOrders.map(o => o.id);
                                                        await supabase.from('open_order_items').delete().in('order_id', ids);
                                                        await supabase.from('open_orders').delete().in('id', ids);
                                                        setBlockingOrders([]);
                                                        toast({ title: 'Pedidos eliminados' });
                                                    } catch (err: any) {
                                                        toast({ variant: 'destructive', title: 'Error', description: err.message });
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-2.5 w-2.5" /> Cancelar Todos
                                            </Button>
                                        </div>
                                        <div className="space-y-1 max-h-20 overflow-y-auto no-scrollbar">
                                            {blockingOrders.map(order => (
                                                <div key={order.id} className="flex justify-between items-center bg-background/60 p-1.5 rounded-lg text-[10px]">
                                                    <span className="font-bold truncate text-foreground flex-1">{order.customer_name || 'Sin nombre'}</span>
                                                    <span className="text-muted-foreground font-semibold px-1">RD$ {Number(order.total || 0).toLocaleString()}</span>
                                                    {onGoToPOS && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 px-1 text-[8px] font-bold text-green-500"
                                                            onClick={() => {
                                                                onClose();
                                                                onGoToPOS(order.id, order.customer_name, order.order_number);
                                                            }}
                                                        >
                                                            Cobrar
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                        <FileText className="h-2.5 w-2.5" /> Observaciones / Notas
                                    </Label>
                                    <Input 
                                        placeholder="Escribe aquí observaciones del cierre (opcional)..." 
                                        className="h-8 bg-background/60 border-border/40 rounded-lg text-xs" 
                                        value={notes} 
                                        onChange={(e) => setNotes(e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* Bottom: Options and Action Buttons */}
                            <div className="space-y-2 shrink-0 pt-1 border-t border-border/30">
                                <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1 rounded-lg border border-border/30">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setDownloadPdf(!downloadPdf)}>
                                            <Checkbox id="pdf-opt" checked={downloadPdf} onCheckedChange={(c) => setDownloadPdf(!!c)} className="w-3 h-3 border-border data-[state=checked]:bg-green-600" />
                                            <Label htmlFor="pdf-opt" className="text-[9px] font-bold text-muted-foreground cursor-pointer">PDF</Label>
                                        </div>
                                        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setSendEmail(!sendEmail)}>
                                            <Checkbox id="email-opt" checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} className="w-3 h-3 border-border data-[state=checked]:bg-green-600" />
                                            <Label htmlFor="email-opt" className="text-[9px] font-bold text-muted-foreground cursor-pointer">Email</Label>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => setPrintReport(!printReport)}>
                                        <Checkbox id="print-opt" checked={printReport} onCheckedChange={(c) => setPrintReport(!!c)} className="w-3 h-3 border-border data-[state=checked]:bg-green-600" />
                                        <Label htmlFor="print-opt" className="text-[9px] font-bold text-muted-foreground cursor-pointer">Ticket</Label>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="ghost" className="flex-1 h-9 rounded-xl font-bold text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider" onClick={onClose}>
                                        Cancelar
                                    </Button>
                                    <Button 
                                        className="flex-[2] h-9 rounded-xl font-black bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-all text-xs tracking-wider uppercase shadow-md shadow-green-600/20" 
                                        disabled={!actualCash || closeSession.isPending} 
                                        onClick={handleCloseDay}
                                    >
                                        {closeSession.isPending ? 'Cerrando...' : 'FINALIZAR DÍA'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="m-0 p-4 flex-1 min-h-0 overflow-hidden outline-none">
                        <div className="bg-card/40 border border-border/40 rounded-2xl overflow-hidden h-full flex flex-col">
                            <ScrollArea className="flex-1 h-full px-4 py-2">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="text-muted-foreground font-black uppercase text-[9px] tracking-wider">Fecha & Hora</TableHead>
                                            <TableHead className="text-muted-foreground font-black uppercase text-[9px] tracking-wider">Responsable</TableHead>
                                            <TableHead className="text-muted-foreground font-black uppercase text-[9px] tracking-wider text-right">Fondo</TableHead>
                                            <TableHead className="text-muted-foreground font-black uppercase text-[9px] tracking-wider text-right">Real</TableHead>
                                            <TableHead className="text-muted-foreground font-black uppercase text-[9px] tracking-wider text-right">Diferencia</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.filter(h => h.status === 'closed').length === 0 ? (
                                            <TableRow className="border-transparent">
                                                <TableCell colSpan={5} className="text-center py-16">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <FileText className="h-8 w-8 opacity-30" />
                                                        <p className="font-bold text-sm">No hay cierres registrados aún</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            history.filter(h => h.status === 'closed').map((closing: any) => (
                                                <TableRow key={closing.id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                    <TableCell className="py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-foreground font-bold text-xs">{closing.closed_at ? format(new Date(closing.closed_at), 'dd MMM, yyyy', { locale: es }) : '-'}</span>
                                                            <span className="text-muted-foreground text-[9px] uppercase font-semibold">{closing.closed_at ? format(new Date(closing.closed_at), 'hh:mm a', { locale: es }) : '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-[9px] text-muted-foreground">
                                                                {(closing.opener?.full_name || 'N').charAt(0)}
                                                            </div>
                                                            <span className="text-foreground font-medium text-xs">{closing.opener?.full_name || 'N/A'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground font-bold text-xs">RD$ {(closing.initial_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right text-foreground font-black text-xs">RD$ {(closing.actual_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge className={cn("rounded-md px-1.5 h-5 font-bold text-[10px]", (closing.difference || 0) === 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : (closing.difference || 0) > 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                                            {(closing.difference || 0) > 0 ? '+' : ''}RD$ {(closing.difference || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};



export default CloseDayDialog;
