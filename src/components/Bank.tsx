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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/10 text-indigo-600 rounded-2xl">
              <Landmark className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Banco y Cierres
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Historial completo y auditoría detallada de todos los cierres de caja
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="rounded-xl border-slate-200 hover:bg-slate-100/80 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Cierres
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {safeSessions.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Sesiones de caja registradas
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ventas Totales
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            RD$ {totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Facturado en todas las sesiones
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Efectivo Entregado
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2">
            RD$ {totalSettled.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Total recaudado físicamente
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cajero o fecha (dd/mm/aaaa)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 text-sm focus-visible:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Badge variant="outline" className="px-3 py-1.5 font-normal text-slate-600 border-slate-200 rounded-xl">
            {filteredSessions.length} {filteredSessions.length === 1 ? 'cierre registrado' : 'cierres registrados'}
          </Badge>
        </div>
      </div>

      {/* Closings Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
            <p className="text-sm text-slate-500">Cargando historial de cierres de caja...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-20 text-center px-4">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No se encontraron cierres</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Prueba ajustando los términos de búsqueda.' : 'Aún no se han completado cierres de caja en el sistema.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-4 sm:px-6">Fecha & Turno</th>
                  <th className="py-4 px-4 sm:px-6">Cajero Responsable</th>
                  <th className="py-4 px-4 sm:px-6 text-right">Fondo Apertura</th>
                  <th className="py-4 px-4 sm:px-6 text-right">Ventas Totales</th>
                  <th className="py-4 px-4 sm:px-6 text-right">Efectivo Cierre</th>
                  <th className="py-4 px-4 sm:px-6 text-right">Diferencia</th>
                  <th className="py-4 px-4 sm:px-6 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => {
                  const isClosed = session.status === 'closed';
                  const discrepancy = getSessionDiscrepancy(session);
                  const hasDiscrepancy = Math.abs(discrepancy) > 0.01;
                  const totalSalesAmount = getSessionTotalSales(session);
                  const cashierName = getSessionCashier(session);

                  return (
                    <tr 
                      key={session.id} 
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetails(session)}
                    >
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-medium text-slate-900">
                          {format(new Date(session.opened_at), "dd 'de' MMM, yyyy", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(session.opened_at), 'hh:mm a', { locale: es })}
                            {session.closed_at ? ` → ${format(new Date(session.closed_at), 'hh:mm a', { locale: es })}` : ''}
                          </span>
                        </div>
                        <div className="mt-1">
                          {isClosed ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/60 font-medium text-[10px] px-2 py-0.5">
                              Cerrada
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200/60 font-medium text-[10px] px-2 py-0.5 animate-pulse">
                              Abierta
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-900 truncate">
                            {cashierName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {userStore?.store_name || 'Sucursal Principal'}
                        </div>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right font-mono text-slate-700">
                        RD$ {(session.initial_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right">
                        <span className="font-semibold text-slate-900 font-mono">
                          RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Efectivo: RD$ {(session.total_sales_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right font-mono font-semibold text-slate-900">
                        RD$ {getSessionActualCash(session).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right">
                        {hasDiscrepancy ? (
                          <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-lg ${
                            discrepancy < 0 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/50' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200/50'
                          }`}>
                            <AlertCircle className="h-3 w-3" />
                            {discrepancy < 0 ? '-' : '+'}RD$ {Math.abs(discrepancy).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            <CheckCircle2 className="h-3 w-3" />
                            Exacto
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            onClick={() => handleOpenDetails(session)}
                            title="Ver Detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            onClick={() => handleDownloadPDF(session)}
                            title="Descargar Comprobante PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-slate-200 shadow-2xl">
          {selectedSession && (
            <div>
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 rounded-t-2xl relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
                  <div>
                    <div className="flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-xl font-bold">
                        Detalle de Cierre de Caja
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(selectedSession.opened_at), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                      {' • '}
                      Cajero: {getSessionCashier(selectedSession)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(selectedSession)}
                      disabled={downloadingPdf}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Financial Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Fondo Inicial</span>
                    <p className="text-base font-bold text-slate-800 font-mono mt-0.5">
                      RD$ {(selectedSession.initial_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Ventas Totales</span>
                    <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                      RD$ {getSessionTotalSales(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Efectivo Contado</span>
                    <p className="text-base font-bold text-indigo-600 font-mono mt-0.5">
                      RD$ {getSessionActualCash(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Diferencia</span>
                    <p className={`text-base font-bold font-mono mt-0.5 ${
                      getSessionDiscrepancy(selectedSession) < 0 
                        ? 'text-rose-600' 
                        : getSessionDiscrepancy(selectedSession) > 0 
                        ? 'text-blue-600' 
                        : 'text-emerald-600'
                    }`}>
                      RD$ {getSessionDiscrepancy(selectedSession).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Breakdown by Payment Method */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 mb-6">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                    Desglose de Ventas por Método de Pago
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Efectivo</p>
                        <p className="text-sm font-bold text-slate-800 font-mono">
                          RD$ {(selectedSession.total_sales_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Tarjeta</p>
                        <p className="text-sm font-bold text-slate-800 font-mono">
                          RD$ {(selectedSession.total_sales_card || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Transferencia</p>
                        <p className="text-sm font-bold text-slate-800 font-mono">
                          RD$ {(selectedSession.total_sales_transfer || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedSession.notes && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200/70 rounded-lg text-xs text-amber-900">
                      <span className="font-semibold">Nota o motivo de discrepancia: </span>
                      {selectedSession.notes}
                    </div>
                  )}
                </div>

                {/* Tabs for Invoices & Movements */}
                <Tabs defaultValue="invoices" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="invoices" className="text-xs">
                      Facturas Emitidas ({sessionSales.length})
                    </TabsTrigger>
                    <TabsTrigger value="movements" className="text-xs">
                      Movimientos de Caja ({sessionMovements.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="invoices">
                    {loadingDetails ? (
                      <div className="py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span className="text-xs">Cargando facturas del turno...</span>
                      </div>
                    ) : sessionSales.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        No hay facturas registradas en este turno.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">No. Factura</th>
                              <th className="py-2.5 px-3">Cliente</th>
                              <th className="py-2.5 px-3">Método</th>
                              <th className="py-2.5 px-3">Hora</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sessionSales.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {s.invoice_number || 'S/N'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {s.customer_name || 'Consumidor Final'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="capitalize px-2 py-0.5 bg-slate-100 rounded-md font-medium">
                                    {s.payment_method}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {format(new Date(s.created_at), 'hh:mm a')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                  RD$ {s.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="movements">
                    {loadingDetails ? (
                      <div className="py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span className="text-xs">Cargando movimientos...</span>
                      </div>
                    ) : sessionMovements.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        No hubo entradas ni salidas extraordinarias durante este turno.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Tipo</th>
                              <th className="py-2.5 px-3">Motivo / Concepto</th>
                              <th className="py-2.5 px-3">Hora</th>
                              <th className="py-2.5 px-3 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sessionMovements.map((m) => {
                              const isIncome = m.type === 'deposit' || m.type === 'income';
                              return (
                                <tr key={m.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-3">
                                    <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                                      isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}>
                                      {isIncome ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                      {isIncome ? 'Entrada' : 'Salida'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">{m.reason}</td>
                                  <td className="py-2.5 px-3 text-slate-400">
                                    {format(new Date(m.created_at), 'hh:mm a')}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                    RD$ {m.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
