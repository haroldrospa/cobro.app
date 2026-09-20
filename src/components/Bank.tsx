import React, { useState, useMemo } from 'react';
import { useBankClosings } from '@/hooks/useBankClosings';
import type { BankSessionItem, SessionDetailSales, SessionDetailMovement } from '@/hooks/useBankClosings';
import { generateCloseDayPDF } from '@/utils/closeDayPdfGenerator';
import { useUserStore } from '@/hooks/useUserStore';
import { 
  Building2, 
  Receipt, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Eye, 
  Download, 
  RefreshCw, 
  Search, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  Landmark, 
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Bank() {
  const { data: userStore } = useUserStore();
  const { 
    sessions = [], 
    isLoading, 
    refetch, 
    fetchSessionSales, 
    fetchSessionMovements 
  } = useBankClosings();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<BankSessionItem | null>(null);
  const [sessionSales, setSessionSales] = useState<SessionDetailSales[]>([]);
  const [sessionMovements, setSessionMovements] = useState<SessionDetailMovement[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Helper getters for session fields
  const getSessionCashier = (s: BankSessionItem) => s.opener?.full_name || s.closer?.full_name || 'Cajero';
  const getSessionTotalSales = (s: BankSessionItem) => 
    (s.total_sales_cash || 0) + (s.total_sales_card || 0) + (s.total_sales_transfer || 0) + (s.total_sales_other || 0);
  const getSessionActualCash = (s: BankSessionItem) => s.actual_cash ?? s.expected_cash ?? 0;
  const getSessionDiscrepancy = (s: BankSessionItem) => s.difference ?? 0;

  // Open details dialog
  const handleOpenDetails = async (session: BankSessionItem) => {
    setSelectedSession(session);
    setLoadingDetails(true);
    try {
      const [sales, movements] = await Promise.all([
        fetchSessionSales(session),
        fetchSessionMovements(session)
      ]);
      setSessionSales(sales);
      setSessionMovements(movements);
    } catch (err) {
      console.error('Error fetching session details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Generate & download PDF for a session
  const handleDownloadPDF = async (session: BankSessionItem) => {
    setDownloadingPdf(true);
    try {
      let sales = sessionSales;
      let movements = sessionMovements;
      if (!selectedSession || selectedSession.id !== session.id) {
        const [fetchedSales, fetchedMovements] = await Promise.all([
          fetchSessionSales(session),
          fetchSessionMovements(session)
        ]);
        sales = fetchedSales;
        movements = fetchedMovements;
      }

      await generateCloseDayPDF({
        branchName: userStore?.store_name || 'Sucursal Principal',
        cashierName: getSessionCashier(session),
        businessName: userStore?.store_name || 'Sistema de Cobro',
        businessRnc: userStore?.rnc || '',
        phone: userStore?.phone || '',
        openedAt: session.opened_at,
        closedAt: session.closed_at || new Date().toISOString(),
        openingCash: session.initial_cash || 0,
        cashSales: session.total_sales_cash || 0,
        cardSales: session.total_sales_card || 0,
        transferSales: session.total_sales_transfer || 0,
        totalSales: getSessionTotalSales(session),
        totalIncomeMovements: session.total_cash_in || 0,
        totalExpensesMovements: session.total_cash_out || 0,
        expectedCash: session.expected_cash || 0,
        actualCash: getSessionActualCash(session),
        discrepancy: getSessionDiscrepancy(session),
        discrepancyReason: session.notes || '',
        invoices: sales.map(s => ({
          invoice_number: s.invoice_number,
          client_name: s.customer_name,
          payment_method: s.payment_method,
          total: s.total,
          created_at: s.created_at
        })),
        movements: movements.map(m => ({
          type: m.type,
          amount: m.amount,
          reason: m.reason,
          created_at: m.created_at
        }))
      });
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Metrics summary
  const safeSessions = useMemo(() => Array.isArray(sessions) ? sessions : [], [sessions]);
  const totalSettled = safeSessions.reduce((acc, s) => acc + getSessionActualCash(s), 0);
  const totalSales = safeSessions.reduce((acc, s) => acc + getSessionTotalSales(s), 0);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return safeSessions;
    return safeSessions.filter(s => {
      const cashierMatch = getSessionCashier(s).toLowerCase().includes(q);
      let dateMatch = false;
      try {
        dateMatch = format(new Date(s.opened_at), 'dd/MM/yyyy').includes(q);
      } catch { /* ignore */ }
      return cashierMatch || dateMatch;
    });
  }, [safeSessions, searchQuery]);

  return (
    <div className="space-y-10 animate-fade-in pb-20 pt-2">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6 py-4">
        <div className="space-y-3">
          <div className="mx-auto w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner border border-primary/20">
            <Landmark className="h-7 w-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal text-foreground">
            Banco y Cierres
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Historial y Auditoría de Cierres de Caja
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            className="h-12 px-6 rounded-2xl border-border/50 bg-muted/10 hover:bg-muted/20 font-black uppercase text-[10px] tracking-widest gap-2 text-foreground transition-all"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards - Centered */}
      <div className="max-w-5xl mx-auto w-full px-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl mb-1">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Total Cierres
            </span>
            <span className="text-3xl font-black tracking-tighter text-foreground">
              {safeSessions.length}
            </span>
            <p className="text-xs text-muted-foreground">
              Sesiones de caja registradas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-2xl mb-1">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Ventas Totales
            </span>
            <span className="text-3xl font-black tracking-tighter text-emerald-500">
              RD$ {totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-muted-foreground">
              Facturado en todas las sesiones
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl mb-1">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Efectivo Entregado
            </span>
            <span className="text-3xl font-black tracking-tighter text-indigo-400">
              RD$ {totalSettled.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-muted-foreground">
              Total recaudado físicamente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search Bar - Centered */}
      <div className="max-w-5xl mx-auto w-full px-4">
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm rounded-2xl shadow-sm">
          <CardContent className="p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cajero o fecha (dd/mm/aaaa)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl bg-background/60 border-border/40 text-sm focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Badge variant="outline" className="px-3 py-1 font-semibold text-muted-foreground border-border/50 rounded-xl text-xs">
                {filteredSessions.length} {filteredSessions.length === 1 ? 'cierre' : 'cierres'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closings Table - Centered & Adaptive */}
      <div className="max-w-5xl mx-auto w-full px-4">
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm rounded-3xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Cargando historial de cierres de caja...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">No se encontraron cierres</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery ? 'Prueba ajustando los términos de búsqueda.' : 'Aún no se han completado cierres de caja en el sistema.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 border-border/30 hover:bg-muted/40">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6">Fecha & Turno</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6">Cajero Responsable</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6 text-right">Fondo Apertura</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6 text-right">Ventas Totales</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6 text-right">Efectivo Cierre</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6 text-right">Diferencia</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-4 px-4 sm:px-6 text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => {
                    const isClosed = session.status === 'closed';
                    const discrepancy = getSessionDiscrepancy(session);
                    const hasDiscrepancy = Math.abs(discrepancy) > 0.01;
                    const totalSalesAmount = getSessionTotalSales(session);
                    const cashierName = getSessionCashier(session);

                    return (
                      <TableRow 
                        key={session.id} 
                        className="hover:bg-muted/30 border-border/30 transition-colors cursor-pointer group"
                        onClick={() => handleOpenDetails(session)}
                      >
                        <TableCell className="py-4 px-4 sm:px-6">
                          <div className="font-semibold text-foreground">
                            {format(new Date(session.opened_at), "dd 'de' MMM, yyyy", { locale: es })}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(new Date(session.opened_at), 'hh:mm a', { locale: es })}
                              {session.closed_at ? ` → ${format(new Date(session.closed_at), 'hh:mm a', { locale: es })}` : ''}
                            </span>
                          </div>
                          <div className="mt-1">
                            {isClosed ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold text-[10px] px-2 py-0.5">
                                Cerrada
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold text-[10px] px-2 py-0.5 animate-pulse">
                                Abierta
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate">
                              {cashierName}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {userStore?.store_name || 'Sucursal Principal'}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6 text-right font-mono text-muted-foreground">
                          RD$ {(session.initial_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6 text-right">
                          <span className="font-bold text-foreground font-mono">
                            RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Efectivo: RD$ {(session.total_sales_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6 text-right font-mono font-bold text-foreground">
                          RD$ {getSessionActualCash(session).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6 text-right">
                          {hasDiscrepancy ? (
                            <span className={`inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-lg ${
                              discrepancy < 0 
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}>
                              <AlertCircle className="h-3 w-3" />
                              {discrepancy < 0 ? '-' : '+'}RD$ {Math.abs(discrepancy).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                              <CheckCircle2 className="h-3 w-3" />
                              Exacto
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-4 px-4 sm:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                              onClick={() => handleOpenDetails(session)}
                              title="Ver Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                              onClick={() => handleDownloadPDF(session)}
                              title="Descargar Comprobante PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Details Modal - Adaptive Theme */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-border/50 bg-card text-card-foreground shadow-2xl">
          {selectedSession && (
            <div>
              {/* Modal Header */}
              <div className="bg-muted/40 p-6 rounded-t-3xl border-b border-border/30 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <Landmark className="h-5 w-5" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">
                        Detalle de Cierre de Caja
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {format(new Date(selectedSession.opened_at), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                      {' • '}
                      Cajero: <span className="font-semibold text-foreground">{getSessionCashier(selectedSession)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(selectedSession)}
                      disabled={downloadingPdf}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Financial Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Fondo Inicial</span>
                    <p className="text-base font-bold text-foreground font-mono mt-1">
                      RD$ {(selectedSession.initial_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Ventas Totales</span>
                    <p className="text-base font-bold text-emerald-500 font-mono mt-1">
                      RD$ {getSessionTotalSales(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Efectivo Contado</span>
                    <p className="text-base font-bold text-indigo-400 font-mono mt-1">
                      RD$ {getSessionActualCash(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Diferencia</span>
                    <p className={`text-base font-bold font-mono mt-1 ${
                      getSessionDiscrepancy(selectedSession) < 0 
                        ? 'text-red-500' 
                        : getSessionDiscrepancy(selectedSession) > 0 
                        ? 'text-blue-500' 
                        : 'text-emerald-500'
                    }`}>
                      RD$ {getSessionDiscrepancy(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Breakdown by Payment Method */}
                <div className="bg-muted/20 border border-border/30 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Desglose de Ventas por Método de Pago
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-3 bg-card/80 p-3 rounded-xl border border-border/30">
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Efectivo</p>
                        <p className="text-sm font-bold text-foreground font-mono">
                          RD$ {(selectedSession.total_sales_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-card/80 p-3 rounded-xl border border-border/30">
                      <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Tarjeta</p>
                        <p className="text-sm font-bold text-foreground font-mono">
                          RD$ {(selectedSession.total_sales_card || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-card/80 p-3 rounded-xl border border-border/30">
                      <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Transferencia</p>
                        <p className="text-sm font-bold text-foreground font-mono">
                          RD$ {(selectedSession.total_sales_transfer || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedSession.notes && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500">
                      <span className="font-bold">Observaciones / Notas: </span>
                      {selectedSession.notes}
                    </div>
                  )}
                </div>

                {/* Tabs for Invoices & Movements */}
                <Tabs defaultValue="invoices" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-4 bg-muted/40 p-1 rounded-2xl">
                    <TabsTrigger value="invoices" className="text-xs rounded-xl font-semibold">
                      Facturas Emitidas ({sessionSales.length})
                    </TabsTrigger>
                    <TabsTrigger value="movements" className="text-xs rounded-xl font-semibold">
                      Movimientos de Caja ({sessionMovements.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="invoices">
                    {loadingDetails ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        <span className="text-xs">Cargando facturas del turno...</span>
                      </div>
                    ) : sessionSales.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-xs">
                        No hay facturas registradas en este turno.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-border/30 rounded-2xl">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 border-border/30 font-semibold text-muted-foreground uppercase sticky top-0">
                              <TableHead className="py-2.5 px-3 text-xs">No. Factura</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs">Cliente</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs">Método</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs">Hora</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessionSales.map((s) => (
                              <TableRow key={s.id} className="hover:bg-muted/30 border-border/20">
                                <TableCell className="py-2.5 px-3 font-semibold text-primary">
                                  {s.invoice_number || 'S/N'}
                                </TableCell>
                                <TableCell className="py-2.5 px-3 text-muted-foreground">
                                  {s.customer_name || 'Consumidor Final'}
                                </TableCell>
                                <TableCell className="py-2.5 px-3">
                                  <Badge variant="outline" className="capitalize text-[10px] font-semibold border-border/40">
                                    {s.payment_method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 px-3 text-muted-foreground text-xs">
                                  {format(new Date(s.created_at), 'hh:mm a')}
                                </TableCell>
                                <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                  RD$ {s.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="movements">
                    {loadingDetails ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        <span className="text-xs">Cargando movimientos...</span>
                      </div>
                    ) : sessionMovements.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-xs">
                        No hubo entradas ni salidas extraordinarias durante este turno.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-border/30 rounded-2xl">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 border-border/30 font-semibold text-muted-foreground uppercase sticky top-0">
                              <TableHead className="py-2.5 px-3 text-xs">Tipo</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs">Motivo / Concepto</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs">Hora</TableHead>
                              <TableHead className="py-2.5 px-3 text-xs text-right">Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessionMovements.map((m) => {
                              const isIncome = m.type === 'deposit' || m.type === 'income';
                              return (
                                <TableRow key={m.id} className="hover:bg-muted/30 border-border/20">
                                  <TableCell className="py-2.5 px-3">
                                    <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-lg ${
                                      isIncome ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}>
                                      {isIncome ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                      {isIncome ? 'Entrada' : 'Salida'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2.5 px-3 text-foreground">{m.reason}</TableCell>
                                  <TableCell className="py-2.5 px-3 text-muted-foreground text-xs">
                                    {format(new Date(m.created_at), 'hh:mm a')}
                                  </TableCell>
                                  <TableCell className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                    RD$ {m.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
