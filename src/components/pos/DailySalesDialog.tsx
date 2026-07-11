import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Mail, Printer, DollarSign, Calendar, User, FileText, X, ChevronRight, Hash, ReceiptText, Clock, AlertCircle, Wallet, TrendingUp, Filter, Eye } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useInvoiceActions } from '@/hooks/useInvoiceActions';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { SaleData, CompanyInfo } from '@/utils/invoicePdfGenerator';
import { useEmployees } from '@/hooks/useEmployees';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useActiveSession, useSessionHistory, useOpenSessions } from '@/hooks/useCashSession';
import { useUserProfile } from '@/hooks/useUserProfile';
import PrintOptionsDialog from './PrintOptionsDialog';
import InvoicePreviewDialog from '../invoices/InvoicePreviewDialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface DailySalesDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const DailySalesDialog: React.FC<DailySalesDialogProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { profile } = useUserProfile();
    const [userFilter, setUserFilter] = useState('all');
    
    // Set initial filter to current user if not already set
    React.useEffect(() => {
        if (profile?.id && userFilter === 'all') {
            setUserFilter(profile.id);
        }
    }, [profile, userFilter]);
    const [selectedActionSale, setSelectedActionSale] = useState<any | null>(null);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [selectedSaleForPreview, setSelectedSaleForPreview] = useState<any | null>(null);

    const handlePreview = (sale: any) => {
        setSelectedSaleForPreview(sale);
        setPreviewDialogOpen(true);
    };
    const { data: activeSessionCached } = useActiveSession();
    const { data: openSessionsData } = useOpenSessions();
    const { data: sessionHistoryData } = useSessionHistory();
    const sessionHistory = sessionHistoryData || [];
    const openSessions = openSessionsData || [];

    // Resolve the TRUE active session for the current user from live DB data,
    // bypassing any stale localStorage-cached session.
    const activeSession = useMemo(() => {
        const currentUserId = profile?.id;
        if (!currentUserId) return activeSessionCached ?? null;

        const myLiveSessions = openSessions.filter((s: any) => {
            // opened_by can be a UUID string OR a profile object depending on how Supabase returned it
            const uid = typeof s.opened_by === 'object' && s.opened_by !== null
                ? s.opened_by.id
                : (s.opened_by || s.user_id || s.opener?.id);
            return uid === currentUserId;
        });
        if (myLiveSessions.length > 0) {
            const newest = myLiveSessions.sort(
                (a: any, b: any) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
            )[0];
            if (!activeSessionCached || new Date(newest.opened_at) >= new Date(activeSessionCached.opened_at)) {
                return newest;
            }
        }
        return activeSessionCached ?? null;
    }, [openSessions, activeSessionCached, profile]);

    const effectiveStart = useMemo(() => {
        if (activeSession) {
            return new Date(activeSession.opened_at);
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const lastClosedToday = (sessionHistory as any[])
            .filter(s => s.status === 'closed' && s.closed_at && new Date(s.closed_at) >= todayStart)
            .sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime())[0];
        if (lastClosedToday) {
            return new Date(lastClosedToday.opened_at);
        }
        return todayStart;
    }, [activeSession, sessionHistory]);

    const { data: sales = [], isLoading } = useSales({ 
        dateFrom: effectiveStart,
        userId: profile?.role === 'admin' ? 'all' : (profile?.id || 'all')
    });
    const { data: employees = [] } = useEmployees();
    const { toast } = useToast();
    const { handleDownloadPDF, handleSendEmail, isEmailLoading } = useInvoiceActions();
    const { companyInfo: dbCompanyInfo } = usePrintSettings();
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

    const sessionSales = useMemo(() => {
        if (activeSession) {
            // Only return sales within the active session time window
            // Buffer de 30 mins para absorber desincronización de relojes
            const bufferStart = new Date(activeSession.opened_at);
            bufferStart.setMinutes(bufferStart.getMinutes() - 30);
            return sales.filter(sale => new Date(sale.created_at) >= bufferStart);
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const lastClosedToday = (sessionHistory as any[])
            .filter(s => s.status === 'closed' && s.closed_at && new Date(s.closed_at) >= todayStart)
            .sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime())[0];
        if (lastClosedToday) {
            const start = new Date(lastClosedToday.opened_at);
            const end = new Date(lastClosedToday.closed_at);
            return sales.filter(sale => {
                const d = new Date(sale.created_at);
                return d >= start && d <= end;
            });
        }
        return sales;
    }, [sales, activeSession, sessionHistory]);

    const filteredSales = useMemo(() => {
        return sessionSales.filter(sale => {
            const matchesSearch = searchTerm === '' ||
                sale.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
            const saleUserId = sale.profile_id || sale.user_id;
            const matchesUser = userFilter === 'all' || saleUserId === userFilter;
            return matchesSearch && matchesUser;
        });
    }, [sessionSales, searchTerm, userFilter]);

    const { data: movements = [] } = useCashMovements(
        effectiveStart, 
        profile?.role === 'admin' ? 'all' : (profile?.id || 'all')
    );

    const sessionMovements = useMemo(() => {
        const baseMovements = movements.filter(m => {
            const matchesUser = userFilter === 'all' || m.profile_id === userFilter;
            return matchesUser;
        });

        if (activeSession) {
            const bufferStart = new Date(effectiveStart);
            bufferStart.setMinutes(bufferStart.getMinutes() - 30);
            return baseMovements.filter(m => new Date(m.created_at) >= bufferStart);
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return baseMovements.filter(m => {
            const mDate = new Date(m.created_at);
            mDate.setHours(0, 0, 0, 0);
            return mDate.getTime() === today.getTime();
        });
    }, [movements, activeSession, effectiveStart, userFilter]);

    const totals = useMemo(() => {
        let cashSales = 0;
        let cardSales = 0;
        let transferSales = 0;
        let otherSales = 0;
        
        filteredSales.forEach(sale => {
            const amount = sale.total || 0;
            if (sale.payment_method === 'cash') {
                cashSales += amount;
            } else if (sale.payment_method === 'card') {
                cardSales += amount;
            } else if (sale.payment_method === 'transfer') {
                transferSales += amount;
            } else if (sale.payment_method === 'split') {
                const cS = Number(sale.split_cash || 0);
                cashSales += cS;
                const diff = amount - cS;
                if (sale.split_method === 'card') cardSales += diff;
                else if (sale.split_method === 'transfer') transferSales += diff;
                else otherSales += diff;
            } else {
                otherSales += amount;
            }
        });

        const salesCount = filteredSales.length;
        const deposits = sessionMovements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + Number(m.amount), 0);
        const withdrawals = sessionMovements.filter(m => m.type === 'withdrawal').reduce((acc, m) => acc + Number(m.amount), 0);
        let initialCash = activeSession?.initial_cash || 0;
        
        if (!activeSession) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const lastClosedToday = (sessionHistory as any[])
                .filter(s => s.status === 'closed' && s.closed_at && new Date(s.closed_at) >= todayStart)
                .sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime())[0];
            if (lastClosedToday) initialCash = lastClosedToday.initial_cash || 0;
        }

        return {
            salesTotal: cashSales + cardSales + transferSales + otherSales,
            salesCount,
            deposits,
            withdrawals,
            initialCash,
            netTotal: initialCash + cashSales + deposits - withdrawals
        };
    }, [filteredSales, sessionMovements, activeSession, sessionHistory]);

    const users = useMemo(() => {
        const uniqueUsers = new Map();
        sessionSales.forEach(sale => {
            const userId = sale.profile_id || sale.user_id;
            if (userId && !uniqueUsers.has(userId)) uniqueUsers.set(userId, userId);
        });
        return Array.from(uniqueUsers.values());
    }, [sessionSales]);

    const handleEmail = async (sale: any) => {
        const email = prompt("Correo del cliente:", sale.customer?.email || "");
        if (email) {
            setSendingEmailId(sale.id);
            await handleSendEmail(dbCompanyInfo as CompanyInfo, sale as SaleData, sale.invoice_number, email, () => setSendingEmailId(null));
            setSendingEmailId(null);
        }
    };

    const handleDownload = async (sale: any) => {
        await handleDownloadPDF(dbCompanyInfo as CompanyInfo, sale as SaleData, sale.invoice_number);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                className="!flex !flex-col !p-0 !overflow-hidden !max-w-[95vw] sm:!max-w-4xl lg:!max-w-6xl w-full !h-[90dvh] !max-h-[90dvh] bg-[#0a0a0a] border-zinc-900 !rounded-[2rem] shadow-2xl"
                centerOnMobile={true}
            >
                    {/* Header Section */}
                    <div className="p-4 sm:p-6 border-b border-zinc-900 bg-transparent flex flex-col gap-3 sm:gap-4 [@media(max-height:580px)]:p-2 [@media(max-height:580px)]:gap-2 shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="space-y-0.5">
                                <DialogTitle className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                                    <ReceiptText className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-500" />
                                    Historial de Facturación
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-[9px] sm:text-[10px] font-medium [@media(max-height:580px)]:hidden">
                                    {activeSession ? "Monitor de ventas activas del turno actual" : "Ventas de la última sesión finalizada"}
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 [@media(max-height:580px)]:hidden">
                            <div className="bg-zinc-900/50 border border-zinc-800/80 p-2 sm:p-4 rounded-xl transition-all hover:border-zinc-700">
                                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                                    <span className="text-[8px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                                        <span className="inline sm:hidden">Facturas</span>
                                        <span className="hidden sm:inline">Facturas Totales</span>
                                    </span>
                                    <Hash className="hidden sm:block h-3.5 w-3.5 text-zinc-600" />
                                </div>
                                <div className="text-base sm:text-2xl font-black text-white leading-none">{totals.salesCount}</div>
                                <div className="mt-0.5 sm:mt-1 text-[7px] sm:text-[8px] text-zinc-600 font-bold tracking-wide uppercase truncate">Comprobantes</div>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800/80 p-2 sm:p-4 rounded-xl transition-all hover:border-emerald-500/20">
                                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                                    <span className="text-[8px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                                        <span className="inline sm:hidden">Ventas</span>
                                        <span className="hidden sm:inline">Ventas Brutas</span>
                                    </span>
                                    <DollarSign className="hidden sm:block h-3.5 w-3.5 text-emerald-500" />
                                </div>
                                <div className="text-base sm:text-2xl font-black text-white leading-none truncate">
                                    <span className="text-[9px] sm:text-xs font-medium text-emerald-500/50 mr-0.5">RD$</span>
                                    {totals.salesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-0.5 sm:mt-1 text-[7px] sm:text-[8px] text-emerald-600/80 font-bold tracking-wide uppercase truncate">Facturado</div>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800/80 p-2 sm:p-4 rounded-xl transition-all hover:border-blue-500/20">
                                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                                    <span className="text-[8px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                                        <span className="inline sm:hidden">Caja</span>
                                        <span className="hidden sm:inline">En Caja</span>
                                    </span>
                                    <Wallet className="hidden sm:block h-3.5 w-3.5 text-blue-500" />
                                </div>
                                <div className="text-base sm:text-2xl font-black text-white leading-none truncate">
                                    <span className="text-[9px] sm:text-xs font-medium text-blue-500/50 mr-0.5">RD$</span>
                                    {totals.netTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
                                    <span className="text-[6.5px] sm:text-[8px] font-extrabold text-zinc-500 bg-zinc-800/80 px-1 py-0.2 sm:py-0.5 rounded shrink-0">INI: {totals.initialCash.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                                    <span className="text-[6.5px] sm:text-[8px] font-extrabold text-emerald-500 bg-emerald-500/10 px-1 py-0.2 sm:py-0.5 rounded shrink-0">+{totals.deposits.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                                    <span className="text-[6.5px] sm:text-[8px] font-extrabold text-red-500 bg-red-500/10 px-1 py-0.2 sm:py-0.5 rounded shrink-0">-{totals.withdrawals.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter Row */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    placeholder="Buscar factura o cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 pl-9 sm:pl-11 bg-zinc-900 border-zinc-800/80 rounded-lg text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-500/30 text-xs sm:text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {profile?.role === 'admin' && (
                                    <Select value={userFilter} onValueChange={setUserFilter}>
                                        <SelectTrigger className="w-[110px] sm:w-[180px] h-10 bg-zinc-900 border-zinc-800/80 rounded-lg text-white font-semibold text-xs">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                                <span className="truncate"><SelectValue placeholder="Usuario" /></span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white p-1 rounded-xl">
                                            <SelectItem value="all" className="rounded-lg font-medium text-xs">Todos</SelectItem>
                                            {users.map(userId => {
                                                const employee = employees.find(e => e.id === userId);
                                                return (
                                                    <SelectItem key={userId} value={userId} className="rounded-lg font-medium text-xs">
                                                        {employee?.full_name || `ID: ${userId.slice(0, 4)}`}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
                                <Button 
                                    variant="outline" 
                                    className="h-10 px-3 sm:px-4 rounded-lg border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs tracking-wide flex items-center justify-center shrink-0"
                                >
                                    <Download className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="hidden sm:inline ml-2">EXPORTAR</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="flex-1 overflow-hidden px-3 sm:px-6 pb-3 sm:pb-6 flex flex-col min-h-0 [@media(max-height:580px)]:px-2 [@media(max-height:580px)]:pb-2">
                        <div className="flex-1 bg-transparent border border-zinc-900/60 rounded-2xl overflow-hidden flex flex-col mt-2 min-h-0 [@media(max-height:580px)]:mt-1">
                            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                                        <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
                                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Cargando transacciones...</p>
                                    </div>
                                ) : filteredSales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                                        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/30 p-5 rounded-2xl border border-zinc-800/80 shadow-inner">
                                            <ReceiptText className="h-8 w-8 text-zinc-700" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-zinc-400 font-semibold text-sm">No se encontraron facturas</p>
                                            <p className="text-zinc-600 text-xs max-w-xs">Aún no hay transacciones registradas en este turno o no coinciden con los filtros.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Invoices Table */}
                                        <div className="hidden sm:block">
                                            <Table>
                                                <TableHeader className="bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
                                                    <TableRow className="border-zinc-900 hover:bg-transparent">
                                                        <TableHead className="py-2.5 px-4 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Factura</TableHead>
                                                        <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Cliente / Cajero</TableHead>
                                                        <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Pago</TableHead>
                                                        <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-right">Total</TableHead>
                                                        <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center w-32">Acciones</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredSales.map((sale) => (
                                                        <TableRow key={sale.id} className="border-zinc-900 hover:bg-zinc-900/30 transition-colors cursor-pointer" onDoubleClick={() => handlePreview(sale)}>
                                                            <TableCell className="py-3 px-4">
                                                                 <div className="flex flex-col">
                                                                     <span className="text-xs font-bold text-white tracking-tight">{sale.invoice_number}</span>
                                                                     <div className="flex items-center gap-1 text-[8px] text-zinc-600 font-bold uppercase">
                                                                         <Clock className="h-2.5 w-2.5" />
                                                                         {format(new Date(sale.created_at), 'hh:mm a')}
                                                                     </div>
                                                                 </div>
                                                            </TableCell>
                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-semibold text-zinc-300">{sale.customer?.name || 'Venta Rápida'}</span>
                                                                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-tight">{sale.profile?.full_name || 'Sistema'}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-3">
                                                                <div className={cn(
                                                                    "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border",
                                                                    sale.payment_method === 'cash' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" :
                                                                    sale.payment_method === 'card' ? "bg-blue-500/5 text-blue-500 border-blue-500/10" :
                                                                    "bg-zinc-900 text-zinc-500 border-zinc-800"
                                                                )}>
                                                                    {sale.payment_method === 'split' ? "Mixto" : 
                                                                     sale.payment_method === 'cash' ? "Efectivo" : 
                                                                     sale.payment_method === 'card' ? "Tarjeta" : 
                                                                     sale.payment_method === 'credit' ? "Crédito" :
                                                                     sale.payment_method === 'transfer' ? "Transf." : sale.payment_method}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className={cn(
                                                                "text-right font-bold text-xs py-3",
                                                                sale.total < 0 ? "text-red-500" : "text-white"
                                                            )}>
                                                                RD$ {(sale.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell className="px-4 py-3">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handlePreview(sale)}
                                                                        className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary text-zinc-600 transition-colors"
                                                                        title="Vista Previa"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => setSelectedActionSale(sale)}
                                                                        className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-zinc-600 transition-colors"
                                                                        title="Imprimir"
                                                                    >
                                                                        <Printer className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleEmail(sale)}
                                                                        className="h-8 w-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 text-zinc-600 transition-colors"
                                                                        title="Correo"
                                                                    >
                                                                        <Mail className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleDownload(sale)}
                                                                        className="h-8 w-8 rounded-lg hover:bg-zinc-800 text-zinc-600 transition-colors"
                                                                        title="Descargar"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Mobile Invoices List (Highly Responsive Cards) */}
                                        <div className="block sm:hidden space-y-2 p-1.5">
                                            {filteredSales.map((sale) => (
                                                <div 
                                                    key={sale.id}
                                                    onClick={() => handlePreview(sale)}
                                                    className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 hover:border-zinc-800 transition-colors cursor-pointer"
                                                >
                                                    {/* Top Row: Invoice Number & Total */}
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white tracking-tight">{sale.invoice_number}</span>
                                                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight mt-0.5">{format(new Date(sale.created_at), 'hh:mm a')}</span>
                                                        </div>
                                                        <span className={cn(
                                                            "text-sm font-black tracking-tight",
                                                            sale.total < 0 ? "text-red-500" : "text-emerald-500"
                                                        )}>
                                                            RD$ {(sale.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {/* Middle Row: Customer, Cashier, and Payment Badge */}
                                                    <div className="flex justify-between items-center gap-2 mb-3">
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span className="text-[11px] font-bold text-zinc-300 truncate">{sale.customer?.name || 'Venta Rápida'}</span>
                                                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-tight mt-0.5 truncate">{sale.profile?.full_name || 'Sistema'}</span>
                                                        </div>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shrink-0",
                                                            sale.payment_method === 'cash' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" :
                                                            sale.payment_method === 'card' ? "bg-blue-500/5 text-blue-500 border-blue-500/10" :
                                                            "bg-zinc-900 text-zinc-500 border-zinc-800"
                                                        )}>
                                                            {sale.payment_method === 'split' ? "Mixto" : 
                                                             sale.payment_method === 'cash' ? "Efectivo" : 
                                                             sale.payment_method === 'card' ? "Tarjeta" : 
                                                             sale.payment_method === 'credit' ? "Crédito" :
                                                             sale.payment_method === 'transfer' ? "Transf." : sale.payment_method}
                                                        </span>
                                                    </div>

                                                    {/* Bottom Row: Actions */}
                                                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); handlePreview(sale); }}
                                                            className="h-8 px-2.5 rounded-lg bg-zinc-900/60 hover:bg-primary/10 hover:text-primary text-zinc-400 font-black text-[9px] uppercase tracking-wider"
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1 text-primary" /> Ver
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); setSelectedActionSale(sale); }}
                                                            className="h-8 px-2.5 rounded-lg bg-zinc-900/60 hover:bg-emerald-500/10 hover:text-emerald-500 text-zinc-400 font-black text-[9px] uppercase tracking-wider"
                                                        >
                                                            <Printer className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Imprimir
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); handleEmail(sale); }}
                                                            className="h-8 px-2.5 rounded-lg bg-zinc-900/60 hover:bg-blue-500/10 hover:text-blue-500 text-zinc-400 font-black text-[9px] uppercase tracking-wider"
                                                        >
                                                            <Mail className="h-3.5 w-3.5 mr-1 text-blue-500" /> Email
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); handleDownload(sale); }}
                                                            className="h-8 w-8 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-zinc-600 px-4 shrink-0">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                                <AlertCircle className="h-2.5 w-2.5 text-emerald-500" />
                                Turno actual en curso
                            </div>
                            <div className="text-[9px] font-bold uppercase tracking-wider bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800 text-zinc-400">
                                {filteredSales.length} facturas
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {selectedActionSale && (
                <PrintOptionsDialog
                    isOpen={true}
                    onClose={() => setSelectedActionSale(null)}
                    saleData={selectedActionSale}
                />
            )}

            {selectedSaleForPreview && (
                <InvoicePreviewDialog
                    isOpen={previewDialogOpen}
                    onClose={() => {
                        setPreviewDialogOpen(false);
                        setSelectedSaleForPreview(null);
                    }}
                    sale={selectedSaleForPreview}
                    onPrint={() => {
                        setPreviewDialogOpen(false);
                        setSelectedActionSale(selectedSaleForPreview);
                    }}
                />
            )}
        </>
    );
};

export default DailySalesDialog;
