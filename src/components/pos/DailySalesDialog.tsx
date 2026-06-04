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
            return sales.filter(sale => new Date(sale.created_at) >= new Date(activeSession.opened_at));
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
            return baseMovements.filter(m => new Date(m.created_at) >= effectiveStart);
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
                className="max-w-[95vw] sm:max-w-4xl lg:max-w-6xl w-full h-[90vh] p-0 overflow-hidden flex flex-col bg-[#0a0a0a] border-zinc-900 rounded-[2rem] shadow-2xl"
                centerOnMobile={true}
            >
                    {/* Header Section */}
                    <div className="p-6 border-b border-zinc-900 bg-transparent">
                        <div className="flex justify-between items-center mb-4">
                            <div className="space-y-0.5">
                                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                                    <ReceiptText className="h-5 w-5 text-emerald-500" />
                                    Historial de Facturación
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-[10px] font-medium">
                                    {activeSession ? "Monitor de ventas activas del turno actual" : "Ventas de la última sesión finalizada"}
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Summary Cards - Simplified */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl transition-all hover:border-zinc-700">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Facturas Totales</span>
                                    <Hash className="h-3.5 w-3.5 text-zinc-600" />
                                </div>
                                <div className="text-2xl font-bold text-white leading-none">{totals.salesCount}</div>
                                <div className="mt-1 text-[8px] text-zinc-600 font-medium tracking-wide">COMPROBANTES HOY</div>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl transition-all hover:border-emerald-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ventas Brutas</span>
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                </div>
                                <div className="text-2xl font-bold text-white leading-none">
                                    <span className="text-xs font-medium text-emerald-500/50 mr-1">RD$</span>
                                    {totals.salesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-1 text-[8px] text-emerald-600 font-medium tracking-wide uppercase">Total Facturado</div>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl transition-all hover:border-blue-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Efectivo en Caja</span>
                                    <Wallet className="h-3.5 w-3.5 text-blue-500" />
                                </div>
                                <div className="text-2xl font-bold text-white leading-none">
                                    <span className="text-xs font-medium text-blue-500/50 mr-1">RD$</span>
                                    {totals.netTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
                                    <span className="text-[8px] font-bold text-zinc-500 bg-zinc-800 px-1 py-0.5 rounded">INI: {totals.initialCash.toLocaleString()}</span>
                                    <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded">+{totals.deposits.toLocaleString()}</span>
                                    <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded">-{totals.withdrawals.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter Row */}
                        <div className="flex flex-col md:flex-row gap-2 mt-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    placeholder="Buscar factura o cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 pl-11 bg-zinc-900 border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-500/30 text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                {profile?.role === 'admin' && (
                                    <Select value={userFilter} onValueChange={setUserFilter}>
                                        <SelectTrigger className="w-[180px] h-10 bg-zinc-900 border-zinc-800 rounded-lg text-white font-semibold text-xs">
                                            <div className="flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-zinc-500" />
                                                <SelectValue placeholder="Usuario" />
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
                                    className="h-10 px-4 rounded-lg border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs tracking-wide"
                                >
                                    <Download className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                                    EXPORTAR
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="flex-1 overflow-hidden px-6 pb-6 flex flex-col">
                        <div className="flex-1 bg-transparent border border-zinc-900/50 rounded-xl overflow-hidden flex flex-col mt-2">
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                                        <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
                                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Cargando transacciones...</p>
                                    </div>
                                ) : filteredSales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                        <div className="bg-zinc-900/50 p-6 rounded-full border border-zinc-900">
                                            <AlertCircle className="h-8 w-8 text-zinc-800" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-white font-bold">No se encontraron resultados</p>
                                            <p className="text-zinc-600 text-xs font-medium">Intenta con otros filtros o términos de búsqueda</p>
                                        </div>
                                    </div>
                                ) : (
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
                                )}
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-zinc-600 px-4">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                                <AlertCircle className="h-2.5 w-2.5 text-emerald-500" />
                                Turno actual en curso
                            </div>
                            <div className="text-[9px] font-bold uppercase tracking-wider bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
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
