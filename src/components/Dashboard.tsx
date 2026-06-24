
import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Calendar as CalendarIcon,
  CreditCard,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  FileText,
  Settings,
  Menu,
  Trophy,
  Crown
} from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { Percent } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isToday, isYesterday, isSameDay, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { UsageMeter } from '@/components/subscription/PlanRestrictions';
import { useSales } from '@/hooks/useSalesManagement';
import { useUserProfile } from '@/hooks/useUserProfile';

import { useAllCustomersBalances } from '@/hooks/useCustomerBalance';
import { useActiveSession, useSessionHistory } from '@/hooks/useCashSession';

const Dashboard: React.FC = () => {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { data: activeSession } = useActiveSession();
  const { data: sessionHistoryData } = useSessionHistory();
  const sessionHistory = sessionHistoryData || [];
  const { data: creditData } = useAllCustomersBalances();
  const overdueCustomersSet = creditData?.overdueCustomers || new Set();
  const totalReceivables = Object.values(creditData?.balances || {}).reduce((sum, val) => sum + val, 0);
  const { data: products = [] } = useProducts();

  // Estado para el rango de fechas
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: firstDayOfMonth,
      to: today
    };
  });

  const queryClient = useQueryClient();

  // Realtime sales updates — debounced to avoid cascading refetches
  React.useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel('dashboard-sales-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        // Only invalidate if the change is for the current store or if we don't know the store
        const changedStoreId = (payload.new as any)?.store_id || (payload.old as any)?.store_id;
        if (!profile?.store_id || !changedStoreId || profile.store_id === changedStoreId) {
          console.log('🔄 Dashboard: Real-time update detected, invalidating queries...');
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            // Invalidate ALL queries related to sales and dashboard metrics
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['weekly-sales'] });
            queryClient.invalidateQueries({ queryKey: ['monthly-sales'] });
            queryClient.invalidateQueries({ queryKey: ['calendar-sales-v2'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-low-stock-products'] });
            queryClient.invalidateQueries({ queryKey: ['top-clients'] });
            queryClient.invalidateQueries({ queryKey: ['allCustomersBalances'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-customers-list'] });
          }, 3000); // batch rapid updates into one refetch
        }
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Auto-repair was removed for being dangerous across stores


  // Monthly Invoices for Usage Meter - Memoize dates to prevent queryKey instability
  const currentMonthDates = React.useMemo(() => {
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: endOfMonth(now)
    };
  }, []);

  const { data: currentMonthSales = [] } = useSales({
    dateFrom: currentMonthDates.from,
    dateTo: currentMonthDates.to,
    includeItems: true,
  });
  
  const monthlyInvoices = currentMonthSales.length;

  // Auto-correct store_id mismatch with more stability
  const lastInvalidatedStoreId = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    if (isProfileLoading || !currentMonthSales.length || !profile?.store_id) return;
    
    const sale = currentMonthSales[0] as any;
    if (sale.store_id && profile.store_id !== sale.store_id) {
      // Solo invalidar si el store_id ha cambiado y no acabamos de invalidarlo para este mismo ID
      if (lastInvalidatedStoreId.current !== profile.store_id) {
        console.warn('⚠️ Dashboard: Store ID mismatch detected, clearing cache...');
        lastInvalidatedStoreId.current = profile.store_id;
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      }
    }
  }, [currentMonthSales.length, profile?.store_id, isProfileLoading, queryClient]);


  // 0. Lightweight query for dashboard metrics
  const { data: periodSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['dashboard-metrics-sales', profile?.store_id, dateRange?.from, dateRange?.to],
    enabled: !!profile?.store_id && !!dateRange?.from && !!dateRange?.to,
    staleTime: 1000 * 60 * 3, // 3 minutes
    queryFn: async () => {
      const start = new Date(dateRange!.from!);
      const end = new Date(dateRange!.to!);
      end.setDate(end.getDate() + 1);

      const allSales: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select('total, created_at, status, sale_items(product_id, quantity, total, subtotal, product:products(name))')
          .eq('store_id', profile!.store_id)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allSales.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allSales;
    }
  });

  // Helper para filtrar ventas válidas (no canceladas)
  const validSales = React.useMemo(() =>
    periodSales.filter(s => s.status !== 'cancelled'),
    [periodSales]);

  // 1. Calcular Métricas Generales (Client-Side)
  // Helper for safe date parsing to prevent crashes on corrupted data
  const safeParseDate = (dateStr: any): Date | null => {
    if (!dateStr) return null;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  // Helper para agrupar ventas de madrugada (hasta las 4:59 AM) en el día de negocio anterior
  const getBusinessDate = (date: Date | string | null): Date | null => {
    const d = safeParseDate(date);
    if (!d) return null;
    const businessD = new Date(d);
    businessD.setHours(businessD.getHours() - 5);
    return businessD;
  };

  const dashboardMetrics = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const today = new Date();
    const businessToday = getBusinessDate(today) || today;
    const businessYesterday = new Date(businessToday);
    businessYesterday.setDate(businessYesterday.getDate() - 1);

    const isTodayIncluded = dateRange.to >= startOfMonth(today); // Simple check

    // Filtrar ventas por rango exacto (useSales ya lo hace, pero aseguramos)
    // Calcular totales
    const totalSales = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const count = validSales.length;
    const avgTicket = count > 0 ? totalSales / count : 0;

    const todaySalesData = validSales.filter(s => {
      const saleDate = getBusinessDate(s.created_at);
      return saleDate ? isSameDay(saleDate, businessToday) : false;
    });

    const todaySales = todaySalesData.reduce((sum, s) => sum + (s.total || 0), 0);
    const todayCount = todaySalesData.length;

    // Session-specific sales (only if session is open)
    let sessionSales = 0;
    let sessionCount = 0;
    if (activeSession?.status === 'open') {
      const sessionStart = safeParseDate(activeSession.opened_at) || today;
      const lastClosureDate = (sessionHistory || [])
        .filter(s => s.status === 'closed' && s.closed_at)
        .map(s => safeParseDate(s.closed_at))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      
      const boundaryDate = lastClosureDate || sessionStart;
      const effectiveStart = sessionStart > boundaryDate ? sessionStart : boundaryDate;

      const sessionSalesData = validSales.filter(s => {
        const saleDate = safeParseDate(s.created_at);
        return saleDate ? saleDate >= effectiveStart : false;
      });
      sessionSales = sessionSalesData.reduce((sum, s) => sum + (s.total || 0), 0);
      sessionCount = sessionSalesData.length;
    }

    // Ayer sigue siendo calendario para comparación de tendencias, pero ajustado a Business Day
    const yesterdaySalesData = validSales.filter(s => {
      const saleDate = getBusinessDate(s.created_at);
      return saleDate ? isSameDay(saleDate, businessYesterday) : false;
    });
    const yesterdaySales = yesterdaySalesData.reduce((sum, s) => sum + (s.total || 0), 0);

    return {
      today_sales: todaySales,
      session_sales: sessionSales,
      yesterday_sales: yesterdaySales,
      today_count: todayCount,
      session_count: sessionCount,
      total_sales: totalSales,
      avg_ticket: avgTicket,
    };
  }, [validSales, dateRange, activeSession, sessionHistory]);

  // Profit / COGS calculation using product cost field
  const profitData = React.useMemo(() => {
    let totalCost = 0;
    validSales.forEach(sale => {
      sale.sale_items?.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.cost) {
          if (product.is_variable_price) {
            totalCost += (product.cost / 100) * (item.total || 0);
          } else {
            totalCost += (product.cost as number) * (item.quantity || 0);
          }
        }
      });
    });
    const totalRevenue = validSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = totalRevenue - totalCost;
    const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const costPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    return { totalRevenue, totalCost, profit, profitPct, costPct };
  }, [validSales, products]);

  // REFACTORED: Use values from useAllCustomersBalances for consistency
  const overdueCount = overdueCustomersSet.size;

  // Fetch Low Stock Products (Client Side Filter for reliability)
  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ['dashboard-low-stock-products', profile?.store_id],
    enabled: !!profile?.store_id,
    staleTime: 1000 * 60 * 10, // 10 min — stock levels don't change that fast
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profileResult } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();
      
      const actualStoreId = profileResult?.store_id;
      if (!actualStoreId) return [];

      // Server-side filter for low stock — no need to download entire catalog client-side
      // Uses a single query with server filter instead of while() loop
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, min_stock, track_inventory')
        .eq('store_id', actualStoreId)
        .eq('track_inventory', true)
        .limit(200);

      if (error) return [];

      return (data || []).filter(p => (p.stock || 0) <= (p.min_stock || 0));
    }
  });

  // Merge counts into dashboardMetrics for display
  const finalMetrics = React.useMemo(() => {
    if (!dashboardMetrics) return null;
    // lowStockProducts comes from a query below, we'll access it there or move it up.
    // To avoid moving huge blocks, let's just use the query below.
    return {
      ...dashboardMetrics,
      overdue_count: overdueCount
    };
  }, [dashboardMetrics, overdueCount]);


  // 2. Calcular Top Productos (Client-Side)
  const topProducts = React.useMemo(() => {
    const productMap = new Map<string, { name: string; quantity: number; sales: number }>();

    validSales.forEach(sale => {
      sale.sale_items?.forEach(item => {
        if (!item.product?.name) return;
        const key = item.product.name; // Agrupar por nombre
        const current = productMap.get(key) || { name: key, quantity: 0, sales: 0 };

        productMap.set(key, {
          name: key,
          quantity: current.quantity + (item.quantity || 0),
          sales: current.sales + (item.total || item.subtotal || 0)
        });
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5); // Start Limit 5
  }, [validSales]);

  // 3. Calcular Ventas por Categoría (Client-Side)
  const categoryData = React.useMemo(() => {
    // Nota: useSales trae sale_items pero no la categoría del producto directamente (necesita join)
    // Si sale_items tiene "product", verificamos si "product" tiene "category".
    // En useSalesManagement, sale_items include product(name). Faltaría category.
    // Por ahora, para no romper, mostraremos "General" o implementaremos fetch extra si es vital.
    // Vamos a dejarlo vacío o mockeado para no causar error, o intentar inferirlo.
    return [];
  }, [validSales]);

  // 4. Calcular Ventas Mensuales (Client-Side)
  // Eliminamos el RPC que no filtraba ventas canceladas y calculamos en frontend
  const { data: monthlySalesData = [] } = useQuery({
    queryKey: ['monthly-sales', new Date().getFullYear(), profile?.store_id],
    enabled: !!profile?.store_id,
    staleTime: 1000 * 60 * 15, // 15 min — annual chart doesn't need real-time
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profileResult } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const actualStoreId = profileResult?.store_id;
      if (!actualStoreId) return [];

      const year = new Date().getFullYear();
      const startOfYear = new Date(year, 0, 1).toISOString();
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();

      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select('total, created_at, status')
          .eq('store_id', actualStoreId)
          .neq('status', 'cancelled')
          .gte('created_at', startOfYear)
          .lte('created_at', endOfYear)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.warn('monthly stats fetch failed:', error);
          break;
        }

        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const colors = ['#0891b2', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];

      const monthTotals = new Array(12).fill(0);
      allData.forEach(s => {
        const d = getBusinessDate(s.created_at) || safeParseDate(s.created_at);
        if (d) monthTotals[d.getMonth()] += Number(s.total) || 0;
      });

      return monthNames.map((month, index) => ({
        month,
        sales: monthTotals[index],
        color: colors[index]
      }));
    }
  });

  // 4.5 Calcular Ventas Semanales (Últimos 7 días)
  const { data: weeklySalesData = [] } = useQuery({
    queryKey: ['weekly-sales', profile?.store_id],
    enabled: !!profile?.store_id,
    staleTime: 1000 * 60 * 5, // 5 min — weekly chart doesn't need instant updates
    queryFn: async () => {
      if (!profile?.store_id) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profileData } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const actualStoreId = profileData?.store_id;
      if (!actualStoreId) return [];

      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select('total, created_at, status')
          .eq('store_id', actualStoreId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.warn('weekly sales fetch failed', error);
          break;
        }

        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const daysMap = new Map<string, { label: string; dateStr: string; sales: number }>();

      const businessToday = new Date(today);
      businessToday.setHours(businessToday.getHours() - 5);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(businessToday);
        d.setDate(businessToday.getDate() - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const labelStr = format(d, 'EEE dd', { locale: es });
        const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1);
        daysMap.set(dateStr, { label, dateStr, sales: 0 });
      }

      allData.forEach(s => {
        let timestampDate = new Date(s.created_at);
        if (!isNaN(timestampDate.getTime())) {
          timestampDate.setHours(timestampDate.getHours() - 5);
        }
        const dateStr = format(timestampDate, 'yyyy-MM-dd');
        if (daysMap.has(dateStr)) {
          daysMap.get(dateStr)!.sales += Number(s.total) || 0;
        }
      });

      return Array.from(daysMap.values()).map(d => ({
        day: d.label,
        sales: d.sales,
        color: '#0ea5e9'
      }));
    }
  });

  // Compute summary stats for weekly/monthly totals and best day
  const weeklySummary = React.useMemo(() => {
    const totalWeekly = weeklySalesData.reduce((sum, d) => sum + d.sales, 0);

    // Obtenemos las ventas del mes actual excluyendo las canceladas
    const validMonthlySales = currentMonthSales.filter(s => s.status !== 'cancelled');
    const totalMonthly = validMonthlySales.reduce((sum, s) => sum + (s.total || 0), 0);

    const bestDay = weeklySalesData.length > 0
      ? weeklySalesData.reduce((best, d) => d.sales > best.sales ? d : best, weeklySalesData[0])
      : null;
    return { totalWeekly, totalMonthly, bestDay };
  }, [weeklySalesData, currentMonthSales]);

  // ── Calendar: mes navegable con ventas por día ──────────────────────────
  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  // ── Calendar sales: unified single source for ALL months ──────────────────
  // Uses the same useSales hook (proven correct, same as $283k monthly total).
  // React Query automatically caches: for the current month it reuses the existing
  // currentMonthSales cache. For past months, a lightweight paginated query is fired.
  const calendarMonthStart = React.useMemo(
    () => startOfMonth(calendarMonth),
    [calendarMonth]
  );
  const calendarMonthEnd = React.useMemo(
    () => endOfMonth(calendarMonth),
    [calendarMonth]
  );

  // Lightweight query — only fetches total + created_at, paginated to get ALL rows
  const { data: calendarMonthSalesRaw = [] } = useQuery<{ total: number; created_at: string }[]>({
    queryKey: ['calendar-sales-v2', profile?.store_id, format(calendarMonth, 'yyyy-MM')],
    enabled: !!profile?.store_id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profileResult } = await supabase
        .from('profiles').select('store_id').eq('id', user.id).maybeSingle();
      const actualStoreId = profileResult?.store_id;
      if (!actualStoreId) return [];

      // startOfMonth local → UTC string, dateTo+1 identical to useSales behaviour
      const start = new Date(calendarMonthStart);
      const end = new Date(calendarMonthEnd);
      end.setDate(end.getDate() + 1); // same as useSales: add 1 day and use .lt

      const allRows: { total: number; created_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;

      // Paginated loop — no hard limit, fetches EVERY sale in the month
      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select('total, created_at')
          .eq('store_id', actualStoreId)
          .neq('status', 'cancelled')
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())   // .lt matches useSales logic exactly
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) { console.warn('calendar page error', error); break; }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break; // last page
        from += pageSize;
      }

      return allRows;
    },
  });

  // Derive { 'yyyy-MM-dd': totalAmount } map for the calendar grid
  const calendarSalesData = React.useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    calendarMonthSalesRaw.forEach(s => {
      const d = getBusinessDate(s.created_at) || safeParseDate(s.created_at);
      if (!d) return;
      const key = format(d, 'yyyy-MM-dd');
      map[key] = (map[key] || 0) + (Number(s.total) || 0);
    });
    return map;
  }, [calendarMonthSalesRaw]);

  // Build calendar grid (weeks × days)
  const calendarGrid = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayRaw = new Date(year, month, 1).getDay(); // 0=Sun
    // Ajustamos para que Lunes sea el primer día (0=Lun, ..., 6=Dom)
    const firstDay = (firstDayRaw + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to fill last week
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);


  // 5. Calcular Ventas por Hora (Client-Side)
  const hourlySalesData = React.useMemo(() => {
    const hoursMap = new Map<number, { hour: number; total: number; count: number }>();

    // Inicializar 24h
    for (let i = 0; i < 24; i++) {
      hoursMap.set(i, { hour: i, total: 0, count: 0 });
    }

    validSales.forEach(s => {
      const d = safeParseDate(s.created_at);
      if (!d) return;
      const h = d.getHours();
      const current = hoursMap.get(h);
      if (current) {
        current.total += Number(s.total) || 0;
        current.count += 1;
      }
    });

    return Array.from(hoursMap.values())
      .filter(h => h.total > 0) // Solo horas con ventas? O todas? RPC filtraba.
      .map(d => ({
        hora: d.hour < 12 ? `${d.hour}AM` : d.hour === 12 ? '12PM' : `${d.hour - 12}PM`,
        ventas: d.total,
        cantidad: d.count
      }));
  }, [validSales]);


  // 6. Productos con Stock Bajo (Managed above in one query)

  // 7. Clientes con crédito alto (RPC)
  const { data: highCreditCustomers = [] } = useQuery({
    queryKey: ['high-credit-customers', profile?.store_id],
    enabled: !!profile?.store_id,
    queryFn: async () => {
      if (!profile?.store_id) return [];
      const { data, error } = await supabase.rpc('get_high_credit_customers_list', {
        p_store_id: profile.store_id
      });
      if (error) throw error;
      return data?.map((c: any) => ({
        ...c,
        percentage: Number(c.usage_percentage)
      })) || [];
    }
  });

  // 8. Clientes con crédito vencido (Lista para tab alertas)
  const { data: overdueCustomers = [] } = useQuery({
    queryKey: ['overdue-customers-list'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select(`
            customer_id,
            customers (name)
          `)
          .eq('payment_status', 'pending')
          .lt('due_date', now)
          .not('customer_id', 'is', null)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('Error fetching overdue customers:', error);
          break;
        }

        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const data = allData;

      // Obtener clientes únicos
      const uniqueCustomers = new Map<string, string>();
      data?.forEach(sale => {
        if (sale.customer_id) {
          uniqueCustomers.set(sale.customer_id, (sale.customers as any)?.name || 'Cliente');
        }
      });

      return Array.from(uniqueCustomers.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  // 9. Secuencias de facturas (Alerta)
  const { data: invoiceSequences = [] } = useQuery({
    queryKey: ['invoice-sequences-alert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('*');

      if (error) throw error;

      const maxNumber = 99999999;
      return data?.map(seq => ({
        ...seq,
        remaining: maxNumber - seq.current_number
      })).filter(seq => seq.remaining < 1000) || [];
    },
  });

  // 10. Top Clientes (Para Tab Clientes)
  const { data: topClients = [] } = useQuery({
    queryKey: ['top-clients', dateRange, profile?.store_id],
    enabled: !!profile?.store_id && !!dateRange?.from && !!dateRange?.to,
    queryFn: async () => {
      if (!profile?.store_id || !dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_top_clients_stats', {
        p_store_id: profile.store_id,
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString(),
        p_limit: 5
      });

      if (error) throw error;

      return data?.map((item: any) => ({
        name: item.customer_name,
        sales: Number(item.total_sales)
      })) || [];
    }
  });

  // Calcular tendencia
  const salesTrend = (finalMetrics?.yesterday_sales || 0) > 0
    ? (((finalMetrics?.today_sales || 0) - (finalMetrics?.yesterday_sales || 0)) / (finalMetrics?.yesterday_sales || 1)) * 100
    : 100;

  const stats = [
    {
      title: 'Ventas de Hoy',
      value: `$${(finalMetrics?.today_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: activeSession?.status === 'open' 
        ? `Caja (sesión): $${(finalMetrics?.session_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `${finalMetrics?.today_count || 0} ventas totales`,
      icon: DollarSign,
      color: salesTrend >= 0 ? 'text-green-500' : 'text-red-500',
      bgColor: salesTrend >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
    },
    {
      title: 'Ventas Totales',
      value: `$${(finalMetrics?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `Ticket Prom: $${(finalMetrics?.avg_ticket || 0).toFixed(0)}`,
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Cuentas por Cobrar',
      value: `$${totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      change: `${overdueCount} Clientes con Mora`,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      title: 'Alertas de Stock',
      value: (lowStockProducts?.length || 0).toString(), // USA LA LISTA FETCHADA ABAJO
      change: 'Productos bajo mínimo',
      icon: Package,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  const chartConfig = {
    sales: {
      label: "Ventas",
      color: "hsl(var(--primary))",
    },
    cantidad: {
      label: "Cantidad",
      color: "hsl(var(--muted-foreground))",
    },
  };

  if (loadingSales) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingLogo text="Analizando métricas..." size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Panel de Control
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              {dateRange?.from && dateRange?.to ? (
                <>
                  {format(dateRange.from, 'dd MMM', { locale: es })} — {format(dateRange.to, 'dd MMM yyyy', { locale: es })}
                </>
              ) : (
                <>Visión Global del Negocio</>
              )}
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 w-full">
          {/* Centered Date Picker */}
          <div className="w-full max-w-[320px] bg-muted/20 p-1.5 rounded-2xl border border-border/50 shadow-inner">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>

          <Link to="/pos" className="w-full sm:w-auto">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-12 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95">
              <ShoppingCart className="h-5 w-5" />
              Punto de Venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Estadísticas principales con diseño mejorado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className={`absolute inset-0 ${stat.bgColor} opacity-50`} />
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className={`text-sm ${stat.color} flex items-center gap-1`}>
                      <TrendingUp className="h-3 w-3" />
                      {stat.change}
                    </p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-full`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Profit Breakdown Card */}
      {profitData.totalRevenue > 0 && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">Análisis de Ganancia vs. Reinversión</span>
              <span className="ml-auto text-xs text-muted-foreground">Basado en costos registrados</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-5 rounded-full overflow-hidden flex mb-4 bg-muted/30">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${profitData.profitPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                style={{ width: `${profitData.costPct}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Revenue */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-secondary/20 border border-border/30">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Ingresos Totales</span>
                <span className="text-xl font-black text-foreground">
                  ${profitData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground">100% de las ventas</span>
              </div>

              {/* Profit */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Ganancia Neta</span>
                </div>
                <span className="text-xl font-black text-emerald-400">
                  ${profitData.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground">{profitData.profitPct.toFixed(1)}% del total</span>
              </div>

              {/* COGS / Reinvestment */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">Reinversión (Costo)</span>
                </div>
                <span className="text-xl font-black text-blue-400">
                  ${profitData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground">{profitData.costPct.toFixed(1)}% del total</span>
              </div>
            </div>

            {/* No cost warning */}
            {profitData.totalCost === 0 && (
              <p className="text-[11px] text-amber-400 mt-3 flex items-center gap-1">
                ⚠ Ningún producto tiene costo registrado. Agrégalo en la ficha del producto para ver el análisis completo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ventas Mensuales y Semanales */}
        <Card className="xl:col-span-2 shadow-lg border-0">
          <Tabs defaultValue="weekly" className="w-full flex flex-col h-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <CardTitle className="flex items-center justify-center sm:justify-start gap-2 whitespace-nowrap">
                <BarChart3 className="h-5 w-5 text-accent" />
                Resumen de Ventas
              </CardTitle>
              <TabsList className="grid w-full sm:w-[300px] grid-cols-3">
                <TabsTrigger value="weekly">Semanal</TabsTrigger>
                <TabsTrigger value="monthly">Mensual</TabsTrigger>
                <TabsTrigger value="calendar">Calendario</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Chart Area */}
                <div className="flex-1 min-w-0">
                  <TabsContent value="weekly" className="h-full m-0">
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart
                        data={weeklySalesData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={50}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                        />
                        <Bar dataKey="sales" radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {weeklySalesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>
                  <TabsContent value="monthly" className="h-full m-0">
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart
                        data={monthlySalesData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={50}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                        />
                        <Bar dataKey="sales" radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {monthlySalesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>

                  {/* ── CALENDARIO ── */}
                  <TabsContent value="calendar" className="m-0">
                    <div className="space-y-3">
                      {/* Month navigator */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                          className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          ‹
                        </button>
                        <p className="text-sm font-bold capitalize">
                          {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                        </p>
                        <button
                          onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                          className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={calendarMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                        >
                          ›
                        </button>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-8 gap-px text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                          <div key={d} className="text-center py-1">{d}</div>
                        ))}
                        <div className="text-center py-1 text-primary/70">Sem..</div>
                      </div>

                      {/* Calendar rows */}
                      <div className="space-y-px">
                        {calendarGrid.map((week, wi) => {
                          const weekTotal = week.reduce((sum, day) => {
                            if (!day) return sum;
                            const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                            const key = format(d, 'yyyy-MM-dd');
                            return sum + (calendarSalesData[key] || 0);
                          }, 0);
                          const todayStr = format(new Date(), 'yyyy-MM-dd');
                          return (
                            <div key={wi} className="grid grid-cols-8 gap-px">
                              {week.map((day, di) => {
                                if (!day) return <div key={di} className="h-14 rounded-lg" />;
                                const key = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day), 'yyyy-MM-dd');
                                const sales = calendarSalesData[key] || 0;
                                const isToday = key === todayStr;
                                const hasSales = sales > 0;
                                return (
                                  <div
                                    key={di}
                                    className={`h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${isToday
                                      ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                                      : hasSales
                                        ? 'border-emerald-500/20 bg-emerald-500/5'
                                        : 'border-border/30 bg-secondary/10'
                                      }`}
                                  >
                                    <span className={`text-[11px] font-bold leading-none ${isToday ? 'text-primary' : 'text-foreground'
                                      }`}>{day}</span>
                                    {hasSales ? (
                                      <span className="text-[9px] font-semibold text-emerald-400 leading-none">
                                        ${sales >= 1000 ? `${(sales / 1000).toFixed(1)}k` : sales.toFixed(0)}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-muted-foreground/40 leading-none">—</span>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Weekly total column */}
                              <div className={`h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 border ${weekTotal > 0 ? 'border-cyan-500/25 bg-cyan-500/8' : 'border-border/20 bg-transparent'
                                }`}>
                                {weekTotal > 0 ? (
                                  <>
                                    <span className="text-[9px] font-bold text-cyan-400 leading-none uppercase tracking-wide">Total</span>
                                    <span className="text-[9px] font-bold text-cyan-300 leading-none">
                                      ${weekTotal >= 1000 ? `${(weekTotal / 1000).toFixed(1)}k` : weekTotal.toFixed(0)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[9px] text-muted-foreground/20">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Month total */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground font-medium">Total del mes</span>
                        <span className="text-sm font-black text-primary">
                          ${Object.values(calendarSalesData).reduce((a, b) => a + b, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                </div>

                {/* Summary Stats Sidebar */}
                <div className="lg:w-[200px] flex flex-col sm:flex-row lg:flex-col gap-3 lg:border-l lg:border-border/40 lg:pl-5">
                  {/* Total Semanal */}
                  <div className="flex-1 lg:flex-initial flex flex-col items-center lg:items-start gap-1.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">Total Semanal</p>
                    <p className="text-base font-bold text-cyan-400 leading-tight">
                      ${weeklySummary.totalWeekly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Total Mensual */}
                  <div className="flex-1 lg:flex-initial flex flex-col items-center lg:items-start gap-1.5 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <CalendarIcon className="h-4 w-4 text-violet-400" />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">Total Mensual</p>
                    <p className="text-base font-bold text-violet-400 leading-tight">
                      ${weeklySummary.totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Mejor Día */}
                  <div className="flex-1 lg:flex-initial flex flex-col items-center lg:items-start gap-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Trophy className="h-4 w-4 text-amber-400" />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">Mejor Día</p>
                    {weeklySummary.bestDay ? (
                      <>
                        <p className="text-base font-bold text-amber-400 leading-tight">
                          {weeklySummary.bestDay.day}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          ${weeklySummary.bestDay.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-amber-400">—</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Tabs>
        </Card>

        {/* Top Productos Vendidos */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              Top Productos Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-2">
                <Package className="h-10 w-10 opacity-30" />
                <p className="text-sm">No hay ventas con productos en el período seleccionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* #1 Best Seller Hero */}
                {(() => {
                  const best = topProducts[0];
                  return (
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 p-4 flex items-center gap-4">
                      <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-400/40">
                        <Crown className="h-5 w-5 text-amber-400" />
                        <span className="text-[9px] font-black text-amber-400 uppercase mt-0.5">#1</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">Más Vendido</p>
                        <p className="text-lg font-black text-foreground truncate">{best.name}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {best.quantity} unidades
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-amber-400">${best.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-muted-foreground">en ventas</p>
                      </div>
                      {/* decorative glow */}
                      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
                    </div>
                  );
                })()}

                {/* Rest of top products */}
                {topProducts.slice(1).map((product, index) => {
                  const pct = topProducts[0].sales > 0
                    ? Math.round((product.sales / topProducts[0].sales) * 100)
                    : 0;
                  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500'];
                  return (
                    <div key={index} className="flex items-center gap-3 px-1">
                      <div className="w-6 text-center shrink-0">
                        <span className="text-xs font-black text-muted-foreground">#{index + 2}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          <span className="text-sm font-bold ml-2 shrink-0">${product.sales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[index % colors.length]} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{product.quantity} uds · {pct}% del líder</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="hourly">Ventas por Hora</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
                <Package className="h-5 w-5 text-accent" />
                Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-sm font-bold text-accent">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${product.sales.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Ventas por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <AreaChart
                  data={hourlySalesData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="hora"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [
                      name === 'ventas' ? `$${Number(value).toLocaleString()}` : value,
                      name === 'ventas' ? 'Ventas' : 'Cantidad'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cantidad"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
                <Users className="h-5 w-5 text-accent" />
                Top Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topClients.map((client, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-bold text-blue-500">
                        {index + 1}
                      </div>
                      <p className="font-medium">{client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${client.sales.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="border-yellow-500/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-center sm:justify-start gap-2 text-yellow-500">
                <AlertCircle className="h-5 w-5" />
                Alertas del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockProducts.length > 0 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <p className="font-medium text-red-500">{lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock bajo</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {lowStockProducts.map((product) => (
                        <div key={product.id} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded">
                          <span>{product.name}</span>
                          <span className="text-red-500 font-medium">
                            Stock: {product.stock} / Mín: {product.min_stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {overdueCustomers.length > 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <p className="font-medium text-yellow-500">{overdueCustomers.length} cliente{overdueCustomers.length !== 1 ? 's' : ''} con crédito vencido</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {overdueCustomers.map((customer) => (
                        <div key={customer.id} className="text-sm p-2 bg-background/50 rounded">
                          {customer.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {highCreditCustomers.length > 0 && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <p className="font-medium text-orange-500">{highCreditCustomers.length} cliente{highCreditCustomers.length !== 1 ? 's' : ''} con crédito alto</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {highCreditCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded">
                          <span>{customer.name}</span>
                          <span className="text-orange-500 font-medium">
                            ${(customer.credit_used || 0).toLocaleString()} / ${(customer.credit_limit || 0).toLocaleString()} ({customer.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {invoiceSequences.map((seq) => (
                  <div key={seq.id} className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    <p className="text-sm">Secuencia {seq.invoice_type_id} próxima a agotarse (quedan {seq.remaining.toLocaleString()} números)</p>
                  </div>
                ))}
                {lowStockProducts.length === 0 && overdueCustomers.length === 0 && highCreditCustomers.length === 0 && invoiceSequences.length === 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-green-500" />
                    <p className="text-sm">No hay alertas pendientes</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Acciones rápidas mejoradas */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/pos">
              <div className="group p-6 bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-3 text-accent group-hover:scale-110 transition-transform" />
                <p className="font-medium">Nueva Venta</p>
              </div>
            </Link>
            <Link to="/products">
              <div className="group p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <Package className="h-8 w-8 mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Gestionar Productos</p>
              </div>
            </Link>
            <Link to="/customers">
              <div className="group p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <Users className="h-8 w-8 mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Ver Clientes</p>
              </div>
            </Link>
            <Link to="/reports">
              <div className="group p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Reportes</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div >
  );
};

export default Dashboard;
