import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBankClosings } from '@/hooks/useBankClosings';
import type { BankSessionItem, SessionDetailSales, SessionDetailMovement } from '@/hooks/useBankClosings';
import { generateCloseDayPDF } from '@/utils/closeDayPdfGenerator';
import { useUserStore } from '@/hooks/useUserStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useProducts } from '@/hooks/useProducts';
import { usePrintSettings } from '@/hooks/usePrintSettings';
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
  DollarSign,
  Filter,
  X,
  RotateCcw,
  Calendar as CalendarIcon,
  SlidersHorizontal,
  Scale,
  Sparkles,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { 
  format, 
  isToday, 
  isYesterday, 
  isThisWeek, 
  isThisMonth, 
  isWithinInterval, 
  startOfDay, 
  endOfDay 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Bank() {
  const { data: userStore } = useUserStore();
  const { data: products = [] } = useProducts();
  const { companyInfo } = usePrintSettings();
  const { 
    sessions = [], 
    isLoading, 
    refetch, 
    fetchSessionSales, 
    fetchSessionMovements 
  } = useBankClosings();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'exact' | 'has_diff'>('all');

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

  // Sessions list
  const safeSessions = useMemo(() => Array.isArray(sessions) ? sessions : [], [sessions]);

  const { profile } = useUserProfile();
  const targetStoreId = userStore?.id || profile?.store_id || safeSessions[0]?.store_id;

  // Map products by ID for fast cost lookups fallback
  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach(p => {
      map.set(p.id, p);
    });
    return map;
  }, [products]);

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

      const doc = await generateCloseDayPDF(companyInfo, {
        stats: {
          initialCash: session.initial_cash || 0,
          cashSales: session.total_sales_cash || 0,
          cardSales: session.total_sales_card || 0,
          transferSales: session.total_sales_transfer || 0,
          otherSales: session.total_sales_other || 0,
          totalRefunds: session.total_refunds || 0,
          deposits: session.total_cash_in || 0,
          withdrawals: session.total_cash_out || 0,
          expectedCash: session.expected_cash || 0,
          cashToWithdraw: 0,
          totalSales: getSessionTotalSales(session),
        },
        actualCash: getSessionActualCash(session),
        difference: getSessionDiscrepancy(session),
        notes: session.notes,
        openedAt: session.opened_at,
        closedAt: session.closed_at || new Date().toISOString(),
        openedBy: session.opener?.full_name,
        closedBy: session.closer?.full_name,
      });
      doc.save(`Cierre_${format(new Date(session.opened_at), 'yyyyMMdd_HHmm')}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Unique cashiers list for select
  const cashiers = useMemo(() => {
    const set = new Set<string>();
    safeSessions.forEach(s => {
      const name = getSessionCashier(s);
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [safeSessions]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (dateFilter !== 'month') count++;
    if (cashierFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (discrepancyFilter !== 'all') count++;
    return count;
  }, [searchQuery, dateFilter, cashierFilter, statusFilter, discrepancyFilter]);

  const hasActiveFilters = activeFiltersCount > 0;

  // Clear all filters (resets to default: current month)
  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilter('month');
    setDateRange(undefined);
    setCashierFilter('all');
    setStatusFilter('all');
    setDiscrepancyFilter('all');
  };

  const handleCustomDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      setDateFilter('custom');
    } else {
      setDateFilter('month');
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return safeSessions.filter(s => {
      const sessionDate = new Date(s.opened_at);

      // 1. Text search (cashier, date, or notes)
      if (q) {
        const cashierMatch = getSessionCashier(s).toLowerCase().includes(q);
        const notesMatch = s.notes ? s.notes.toLowerCase().includes(q) : false;
        let dateMatch = false;
        try {
          dateMatch = format(sessionDate, 'dd/MM/yyyy').includes(q);
        } catch { /* ignore */ }
        if (!cashierMatch && !dateMatch && !notesMatch) return false;
      }

      // 2. Cashier filter
      if (cashierFilter !== 'all') {
        if (getSessionCashier(s) !== cashierFilter) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        if (s.status !== statusFilter) return false;
      }

      // 4. Discrepancy filter
      if (discrepancyFilter !== 'all') {
        const diff = Math.abs(getSessionDiscrepancy(s));
        if (discrepancyFilter === 'exact' && diff > 0.01) return false;
        if (discrepancyFilter === 'has_diff' && diff <= 0.01) return false;
      }

      // 5. Date filter
      if (dateFilter === 'today') {
        if (!isToday(sessionDate)) return false;
      } else if (dateFilter === 'yesterday') {
        if (!isYesterday(sessionDate)) return false;
      } else if (dateFilter === 'week') {
        if (!isThisWeek(sessionDate, { weekStartsOn: 1 })) return false;
      } else if (dateFilter === 'month') {
        if (!isThisMonth(sessionDate)) return false;
      } else if (dateFilter === 'custom' && dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        if (!isWithinInterval(sessionDate, { start: from, end: to })) return false;
      }

      return true;
    });
  }, [safeSessions, searchQuery, cashierFilter, statusFilter, discrepancyFilter, dateFilter, dateRange]);

  // Date bounds covering visible sessions for single query fetch
  const { minOpenedAt, maxClosedAt } = useMemo(() => {
    const sessionsToCover = filteredSessions.length > 0 ? filteredSessions : safeSessions.slice(0, 30);
    if (sessionsToCover.length === 0) return { minOpenedAt: null, maxClosedAt: null };

    let min = sessionsToCover[0].opened_at;
    let max = sessionsToCover[0].closed_at || new Date().toISOString();
    let hasOpen = false;

    for (const s of sessionsToCover) {
      if (s.opened_at < min) min = s.opened_at;
      if (!s.closed_at || s.status === 'open') {
        hasOpen = true;
      } else if (s.closed_at > max) {
        max = s.closed_at;
      }
    }

    return {
      minOpenedAt: min,
      maxClosedAt: hasOpen ? new Date().toISOString() : max
    };
  }, [filteredSessions, safeSessions]);

  // Single efficient query to fetch sales with joined product items for all sessions
  const { data: closingsSales = [] } = useQuery({
    queryKey: ['bank-closings-sales', targetStoreId, minOpenedAt, maxClosedAt],
    enabled: !!targetStoreId && !!minOpenedAt && !!maxClosedAt,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      if (!targetStoreId || !minOpenedAt || !maxClosedAt) return [];
      const start = new Date(minOpenedAt);
      start.setMinutes(start.getMinutes() - 5);

      const end = new Date(maxClosedAt);
      end.setMinutes(end.getMinutes() + 5);

      const { data, error } = await supabase
        .from('sales')
        .select('id, total, created_at, status, payment_method, sale_items(product_id, quantity, total, product:products(id, name, cost, is_variable_price))')
        .eq('store_id', targetStoreId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(3000);

      if (error) {
        console.error('Error fetching closings sales for profit calculation:', error);
        return [];
      }
      return data || [];
    }
  });

  // Precalculate profit, cost, and percentages for every session
  const sessionsProfitMap = useMemo(() => {
    const map = new Map<string, { cost: number; profit: number; profitPct: number; costPct: number }>();
    if (!safeSessions.length) return map;

    safeSessions.forEach(session => {
      const totalSales = getSessionTotalSales(session);
      if (totalSales <= 0) {
        map.set(session.id, { cost: 0, profit: 0, profitPct: 0, costPct: 0 });
        return;
      }

      const sessionStart = new Date(session.opened_at).getTime() - 120000;
      const sessionEnd = session.closed_at 
        ? new Date(session.closed_at).getTime() + 120000 
        : Infinity;

      let cost = 0;
      closingsSales.forEach((sale: any) => {
        if (!sale.created_at) return;
        const saleTime = new Date(sale.created_at).getTime();
        if (saleTime >= sessionStart && saleTime <= sessionEnd) {
          sale.sale_items?.forEach((item: any) => {
            const product = item.product || productsMap.get(item.product_id);
            if (product && product.cost) {
              if (product.is_variable_price) {
                cost += (product.cost / 100) * (item.total || 0);
              } else {
                cost += Number(product.cost) * (item.quantity || 0);
              }
            }
          });
        }
      });

      const safeCost = Math.min(cost, totalSales);
      const profit = Math.max(0, totalSales - safeCost);
      const profitPct = totalSales > 0 ? (profit / totalSales) * 100 : 0;
      const costPct = totalSales > 0 ? (safeCost / totalSales) * 100 : 0;

      map.set(session.id, { cost: safeCost, profit, profitPct, costPct });
    });

    return map;
  }, [safeSessions, closingsSales, productsMap]);

  // Metrics summary calculated over filtered sessions
  const totalSettled = useMemo(() => filteredSessions.reduce((acc, s) => acc + getSessionActualCash(s), 0), [filteredSessions]);
  const totalSales = useMemo(() => filteredSessions.reduce((acc, s) => acc + getSessionTotalSales(s), 0), [filteredSessions]);
  const totalDifference = useMemo(() => filteredSessions.reduce((acc, s) => acc + getSessionDiscrepancy(s), 0), [filteredSessions]);

  const totalProfit = useMemo(() => {
    return filteredSessions.reduce((sum, s) => {
      const info = sessionsProfitMap.get(s.id);
      return sum + (info ? info.profit : getSessionTotalSales(s));
    }, 0);
  }, [filteredSessions, sessionsProfitMap]);

  const totalCost = useMemo(() => {
    return filteredSessions.reduce((sum, s) => {
      const info = sessionsProfitMap.get(s.id);
      return sum + (info ? info.cost : 0);
    }, 0);
  }, [filteredSessions, sessionsProfitMap]);

  const overallProfitPct = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
  const overallCostPct = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in pb-20 pt-2">
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

      {/* Summary KPI Cards - Centered & Dynamic with Filters */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ventas Totales */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Ventas Totales
            </span>
            <span className="text-3xl font-black tracking-tighter text-foreground font-mono">
              RD$ {totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-muted-foreground">
              {filteredSessions.length} {filteredSessions.length === 1 ? 'cierre' : 'cierres'} • Facturado en el período
            </p>
          </CardContent>
        </Card>

        {/* 2. Reinversión (Costo) */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 font-bold">
              Reinversión (Costo)
            </span>
            <span className="text-3xl font-black tracking-tighter text-blue-500 dark:text-blue-400 font-mono">
              RD$ {totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-blue-500/80 font-medium">
              {overallCostPct.toFixed(1)}% del total (dinero a apartar)
            </p>
          </CardContent>
        </Card>

        {/* 3. Ganancia Neta */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 font-bold">
              Ganancia Neta
            </span>
            <span className="text-3xl font-black tracking-tighter text-emerald-500 font-mono">
              RD$ {totalProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {overallProfitPct.toFixed(1)}% margen real de ganancia
            </p>
          </CardContent>
        </Card>

        {/* 4. Efectivo Entregado */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden relative group hover:bg-card/80 transition-all rounded-3xl shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Efectivo Entregado
            </span>
            <span className="text-3xl font-black tracking-tighter text-indigo-400 font-mono">
              RD$ {totalSettled.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters 
                ? `Recaudado en la selección actual`
                : 'Total recaudado este mes'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modern & Fast Filter Hub */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <Card className="bg-card/70 border-border/50 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
          {/* Quick Date Presets Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                Fecha:
              </span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'today', label: 'Hoy' },
                { id: 'yesterday', label: 'Ayer' },
                { id: 'week', label: 'Esta Semana' },
                { id: 'month', label: 'Este Mes' },
              ].map(tab => {
                const isActive = dateFilter === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setDateFilter(tab.id as any);
                      setDateRange(undefined);
                    }}
                    className={cn(
                      "h-8 px-3 rounded-xl text-xs font-bold transition-all shrink-0",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-2 shrink-0">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={handleCustomDateRange}
                className={cn(
                  "h-8 text-xs font-medium rounded-xl border-border/60 bg-background/50",
                  dateFilter === 'custom' && "border-primary text-primary font-bold ring-1 ring-primary/40 bg-primary/5"
                )}
              />
            </div>
          </div>

          {/* Secondary Filters Grid: Search, Cashier, Status, Discrepancy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar cajero, fecha..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-10 rounded-xl bg-background/60 border-border/40 text-sm focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Cashier Select */}
            <div>
              <Select value={cashierFilter} onValueChange={setCashierFilter}>
                <SelectTrigger className="h-10 rounded-xl bg-background/60 border-border/40 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Cajero: Todos" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 bg-popover">
                  <SelectItem value="all">Todos los cajeros</SelectItem>
                  {cashiers.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Select */}
            <div>
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-10 rounded-xl bg-background/60 border-border/40 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Estado" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 bg-popover">
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="closed">Solo Cerradas</SelectItem>
                  <SelectItem value="open">Solo Abiertas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discrepancy Select */}
            <div>
              <Select value={discrepancyFilter} onValueChange={(val: any) => setDiscrepancyFilter(val)}>
                <SelectTrigger className="h-10 rounded-xl bg-background/60 border-border/40 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Cuadre" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 bg-popover">
                  <SelectItem value="all">Cualquier cuadre</SelectItem>
                  <SelectItem value="exact">Exacto (Sin diferencia)</SelectItem>
                  <SelectItem value="has_diff">Con diferencia (+ / -)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Status Bar: Result Count & Reset Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground border-t border-border/20">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Mostrando <strong className="text-foreground font-semibold">{filteredSessions.length}</strong> de {safeSessions.length} cierres
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border-primary/20">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro activo' : 'filtros activos'}
                </Badge>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg gap-1.5 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Closings Table - Centered & Adaptive */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <Card className="bg-card/70 border-border/50 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Cargando historial de cierres de caja...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">
                {hasActiveFilters ? 'No se encontraron cierres con estos filtros' : 'No se encontraron cierres'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {hasActiveFilters 
                  ? 'Prueba cambiando las fechas, el cajero o limpiando los filtros activos.' 
                  : 'Aún no se han completado cierres de caja en el sistema.'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="mt-4 rounded-xl text-xs gap-1.5 border-border/60 hover:bg-muted/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer todos los filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-[1050px] text-left border-collapse">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-b border-border/30 hover:bg-muted/40">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 whitespace-nowrap w-[180px]">Fecha & Turno</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 whitespace-nowrap w-[160px]">Cajero</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 text-right whitespace-nowrap w-[150px]">Ventas Totales</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-blue-500 dark:text-blue-400 py-3.5 px-4 text-right whitespace-nowrap w-[160px]">Reinversión (Costo)</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-emerald-500 dark:text-emerald-400 py-3.5 px-4 text-right whitespace-nowrap w-[160px]">Ganancia Neta</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 text-right whitespace-nowrap w-[140px]">Efectivo Cierre</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 text-center whitespace-nowrap w-[130px]">Diferencia</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3.5 px-4 text-center whitespace-nowrap w-[110px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => {
                    const isClosed = session.status === 'closed';
                    const discrepancy = getSessionDiscrepancy(session);
                    const hasDiscrepancy = Math.abs(discrepancy) > 0.01;
                    const totalSalesAmount = getSessionTotalSales(session);
                    const cashierName = getSessionCashier(session);
                    const profitInfo = sessionsProfitMap.get(session.id) || {
                      cost: 0,
                      profit: totalSalesAmount,
                      profitPct: totalSalesAmount > 0 ? 100 : 0,
                      costPct: 0
                    };

                    return (
                      <TableRow 
                        key={session.id} 
                        className="hover:bg-muted/30 border-b border-border/25 transition-colors cursor-pointer group"
                        onClick={() => handleOpenDetails(session)}
                      >
                        {/* Fecha & Turno */}
                        <TableCell className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">
                              {format(new Date(session.opened_at), "dd MMM yyyy", { locale: es })}
                            </span>
                            {isClosed ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold text-[10px] px-1.5 py-0">
                                Cerrada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold text-[10px] px-1.5 py-0 animate-pulse">
                                Abierta
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                            <span>
                              {format(new Date(session.opened_at), 'hh:mm a', { locale: es })}
                              {session.closed_at ? ` — ${format(new Date(session.closed_at), 'hh:mm a', { locale: es })}` : ''}
                            </span>
                          </div>
                        </TableCell>

                        {/* Cajero Responsable */}
                        <TableCell className="py-3.5 px-4">
                          <span className="font-semibold text-foreground text-sm block truncate max-w-[160px]" title={cashierName}>
                            {cashierName}
                          </span>
                          {session.notes && (
                            <span className="text-[11px] text-muted-foreground block truncate max-w-[160px]" title={session.notes}>
                              {session.notes}
                            </span>
                          )}
                        </TableCell>

                        {/* Ventas Totales */}
                        <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-sm text-foreground">
                            RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Efec: RD$ {(session.total_sales_cash || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </TableCell>

                        {/* Reinversión (Costo) */}
                        <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-sm text-blue-500 dark:text-blue-400">
                            RD$ {profitInfo.cost.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {profitInfo.cost > 0 ? (
                              <span className="text-blue-500/80 font-medium">
                                {profitInfo.costPct.toFixed(1)}% a apartar
                              </span>
                            ) : totalSalesAmount > 0 ? (
                              <span className="text-amber-500/90 text-[10px]">Sin costo reg.</span>
                            ) : (
                              <span className="text-muted-foreground">0.0%</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Ganancia Neta */}
                        <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-sm text-emerald-500 dark:text-emerald-400">
                            RD$ {profitInfo.profit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {profitInfo.profit > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {profitInfo.profitPct.toFixed(1)}% ganancia
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0.0%</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Efectivo Cierre */}
                        <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-mono font-black text-sm text-foreground">
                            RD$ {getSessionActualCash(session).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>

                        {/* Diferencia */}
                        <TableCell className="py-3.5 px-4 text-center whitespace-nowrap">
                          {hasDiscrepancy ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border",
                              discrepancy < 0 
                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' 
                                : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                            )}>
                              <AlertCircle className="h-3 w-3" />
                              {discrepancy < 0 ? '-' : '+'}RD$ {Math.abs(discrepancy).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                              <CheckCircle2 className="h-3 w-3" />
                              Exacto
                            </span>
                          )}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl gap-1 text-xs font-semibold"
                              onClick={() => handleOpenDetails(session)}
                              title="Ver Detalle"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Detalle</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                              onClick={() => handleDownloadPDF(session)}
                              title="Descargar Comprobante PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
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
        <DialogContent 
          hideCloseButton
          className="max-w-4xl max-h-[90vh] p-0 rounded-3xl border border-border/50 bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col"
        >
          {selectedSession && (() => {
            const totalSales = getSessionTotalSales(selectedSession);
            let selectedProfitInfo = sessionsProfitMap.get(selectedSession.id) || {
              cost: 0,
              profit: totalSales,
              profitPct: totalSales > 0 ? 100 : 0,
              costPct: 0
            };

            if (totalSales <= 0) {
              selectedProfitInfo = { cost: 0, profit: 0, profitPct: 0, costPct: 0 };
            } else if (sessionSales && sessionSales.length > 0) {
              let modalCost = 0;
              sessionSales.forEach((sale: any) => {
                sale.sale_items?.forEach((item: any) => {
                  const product = item.product || productsMap.get(item.product_id);
                  if (product && product.cost) {
                    if (product.is_variable_price) {
                      modalCost += (product.cost / 100) * (item.total || 0);
                    } else {
                      modalCost += Number(product.cost) * (item.quantity || 0);
                    }
                  }
                });
              });
              const safeModalCost = Math.min(modalCost, totalSales);
              const profit = Math.max(0, totalSales - safeModalCost);
              const profitPct = totalSales > 0 ? (profit / totalSales) * 100 : 0;
              const costPct = totalSales > 0 ? (safeModalCost / totalSales) * 100 : 0;
              selectedProfitInfo = { cost: safeModalCost, profit, profitPct, costPct };
            }

            return (
              <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="bg-muted/40 px-6 py-4 border-b border-border/30 shrink-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shrink-0">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg sm:text-xl font-bold text-foreground truncate">
                        Detalle de Cierre de Caja
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {format(new Date(selectedSession.opened_at), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                        {' • '}
                        Cajero: <span className="font-semibold text-foreground">{getSessionCashier(selectedSession)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(selectedSession)}
                      disabled={downloadingPdf}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md h-9"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedSession(null)}
                      className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                      title="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

                  {/* Rentabilidad: Reinversión vs Ganancia Neta */}
                  <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 bg-muted/20 border-b border-border/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Análisis de Rentabilidad
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Margen: {selectedProfitInfo.profitPct.toFixed(1)}% de la venta
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/30">
                      <div className="p-5 bg-card">
                        <div className="text-[10px] font-extrabold uppercase text-blue-500 tracking-wider mb-1.5">
                          REINVERSIÓN (COSTO)
                        </div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-foreground">
                          RD$ {selectedProfitInfo.cost.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground mt-1.5">
                          {selectedProfitInfo.costPct.toFixed(1)}% de la venta
                        </div>
                      </div>

                      <div className="p-5 bg-emerald-500/10">
                        <div className="text-[10px] font-extrabold uppercase text-emerald-500 dark:text-emerald-400 tracking-wider mb-1.5">
                          GANANCIA NETA
                        </div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-emerald-500 dark:text-emerald-400">
                          RD$ {selectedProfitInfo.profit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                          {selectedProfitInfo.profitPct.toFixed(1)}% de la venta
                        </div>
                      </div>
                    </div>
                    {selectedProfitInfo.cost === 0 && getSessionTotalSales(selectedSession) > 0 && (
                      <div className="px-5 py-2.5 bg-amber-500/10 border-t border-amber-500/20 text-amber-500 text-xs font-medium">
                        ⚠️ Nota: Los productos vendidos en este turno no tienen costo de compra registrado en el inventario.
                      </div>
                    )}
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
          );
        })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
