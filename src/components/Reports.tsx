import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  Mail,
  Printer,
  ChevronRight,
  LayoutDashboard,
  Wallet,
  FileSpreadsheet,
  Filter,
  XCircle,
  CalendarDays,
  Clock,
  ArrowUpDown,
  TrendingDown,
  Tag,
  BadgeDollarSign,
  Percent,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useSales, Sale } from '@/hooks/useSalesManagement';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useDailyClosings, DailyClosing } from '@/hooks/useDailyClosings';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useCategories } from '@/hooks/useCategories';
import { useEmployees } from '@/hooks/useEmployees';
import { useAllCustomersBalances } from '@/hooks/useCustomerBalance';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import appLogo from '@/assets/cobro-logo.png';

// --- CONFIGURATION ---
const REPORT_TYPES = [
  { id: 'dashboard', label: 'Resumen General', icon: LayoutDashboard, description: 'Visión global del negocio' },
  { id: 'sales-daily', label: 'Ventas Diarias', icon: CalendarDays, description: 'Evolución de ventas día por día' },
  { id: 'sales-hourly', label: 'Ventas por Hora', icon: Clock, description: 'Análisis de horas pico' },
  { id: 'products-sold', label: 'Productos Vendidos', icon: Package, description: 'Ranking de productos más vendidos' },
  { id: 'sales-b01', label: 'Facturas B01 (Crédito Fiscal)', icon: FileText, description: 'Reporte de comprobantes fiscales B01' },
  { id: 'sales-b02', label: 'Facturas B02 (Consumo Final)', icon: FileText, description: 'Reporte de comprobantes fiscales B02' },
  { id: 'all-invoices', label: 'Reporte de Facturas', icon: FileSpreadsheet, description: 'Listado general de todas las facturas (B01 y B02)' },
  { id: 'closings', label: 'Cierres de Caja', icon: Wallet, description: 'Historial de sesiones y cierres de caja' },
  { id: 'receivables', label: 'Cuentas por Cobrar', icon: Users, description: 'Clientes con deudas pendientes' },
  { id: 'inventory', label: 'Inventario Valorizado', icon: Package, description: 'Valoración de stock actual' },
  { id: 'movements', label: 'Movimientos de Efectivo', icon: RefreshCw, description: 'Entradas y salidas de caja' },
  { id: 'profit', label: 'Porcentaje de Ganancia', icon: TrendingUp, description: 'Análisis de utilidad estimada vs costo' },
];

const COLORS = ['hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))', 'hsl(var(--primary))'];

const Reports = () => {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState('dashboard');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // Filter States
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  const { data: sales = [], isFetching: isFetchingSales } = useSales({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    includeItems: true
  });
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const { data: closings = [] } = useDailyClosings();
  const { data: movements = [] } = useCashMovements(undefined);
  const { data: categories = [] } = useCategories();

  const { data: employees = [] } = useEmployees();
  const { data: customerBalancesInfo } = useAllCustomersBalances();
  const { settings: companySettings } = useCompanySettings();

  // Dialog States
  const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedDailySalesDate, setSelectedDailySalesDate] = useState<string | null>(null);
  const [selectedActionSale, setSelectedActionSale] = useState<Sale | null>(null); // New state for Action Modal
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [selectedCustomerForDebt, setSelectedCustomerForDebt] = useState<any | null>(null);

  // Products-sold filter
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSortBy, setProductSortBy] = useState<'quantity' | 'revenue' | 'profit'>('quantity');
  const [drillDownProduct, setDrillDownProduct] = useState<string | null>(null); // product name for drill-down

  // --- FILTERING HELPERS ---
  const isDateInRange = (dateStr: string) => {
    const date = new Date(dateStr);
    if (!dateRange) return true;
    if (dateRange.from && date < dateRange.from) return false;
    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      if (date > endOfDay) return false;
    }
    return true;
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>();
    sales.forEach(s => { if (s.payment_method) methods.add(s.payment_method); });
    return Array.from(methods);
  }, [sales]);

  const clearFilters = () => {
    setFilterCustomer('all');
    setFilterPaymentMethod('all');
    setFilterCategory('all');
    setFilterUser('all');
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date()
    });
  };

  // Hash maps for O(1) lookups to fix performance bottlenecks
  const productsMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const categoriesMap = useMemo(() => {
    const map = new Map();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // --- DATA DERIVATIONS ---
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // 1. Date Check (Still done locally for accuracy and to cover edge cases, even though DB filters it)
      if (!isDateInRange(s.created_at)) return false;

      // 2. Ignore cancelled sales in reports
      if (s.status === 'cancelled') return false;

      // 3. Customer Filter
      if (filterCustomer !== 'all' && s.customer_id !== filterCustomer) return false;

      // 3. Payment Method Filter
      if (filterPaymentMethod !== 'all' && s.payment_method !== filterPaymentMethod) return false;

      // 4. User Filter
      if (filterUser !== 'all' && s.profile_id !== filterUser) return false;

      // 5. Category Filter (Check if ANY item in sale belongs to category)
      if (filterCategory !== 'all') {
        const hasCategoryItem = s.sale_items?.some(item => {
          const product = productsMap.get(item.product_id);
          return product?.category_id === filterCategory;
        });
        if (!hasCategoryItem) return false;
      }

      return true;
    });
  }, [sales, dateRange, filterCustomer, filterPaymentMethod, filterUser, filterCategory, productsMap]);

  const salesB01 = useMemo(() => filteredSales.filter(s => s.invoice_type?.code === '01' || (s.invoice_number || '').startsWith('B01') || (s.invoice_number || '').startsWith('E31')), [filteredSales]);
  const salesB02 = useMemo(() => filteredSales.filter(s => s.invoice_type?.code === '02' || (s.invoice_number || '').startsWith('B02') || (s.invoice_number || '').startsWith('E32')), [filteredSales]);
  const allInvoices = useMemo(() => filteredSales.filter(s =>
    s.invoice_type?.code === '01' || (s.invoice_number || '').startsWith('B01') || (s.invoice_number || '').startsWith('E31') ||
    s.invoice_type?.code === '02' || (s.invoice_number || '').startsWith('B02') || (s.invoice_number || '').startsWith('E32')
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [filteredSales]);

  // New: Daily Sales Aggregation
  const dailySalesData = useMemo(() => {
    const grouped: Record<string, { key: string, date: string, rawDate: Date, total: number, count: number }> = {};

    filteredSales.forEach(sale => {
      // Use raw Date object for sorting, string for grouping
      const dateObj = new Date(sale.created_at);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          key: dateKey,
          date: format(dateObj, 'dd MMM', { locale: es }),
          rawDate: dateObj,
          total: 0,
          count: 0
        };
      }
      grouped[dateKey].total += sale.total;
      grouped[dateKey].count += 1;
    });

    return Object.values(grouped).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [filteredSales]);

  const daySales = useMemo(() => {
    if (!selectedDailySalesDate) return [];
    return filteredSales.filter(s => format(new Date(s.created_at), 'yyyy-MM-dd') === selectedDailySalesDate);
  }, [filteredSales, selectedDailySalesDate]);

  const dayProducts = useMemo(() => {
    const products: Record<string, { name: string, quantity: number, total: number }> = {};
    daySales.forEach(sale => {
      (sale.sale_items || []).forEach(item => {
        const productName = item.product?.name || item.product_name || 'Producto Desconocido';
        const key = item.product_id || productName;
        if (!products[key]) {
          products[key] = { name: productName, quantity: 0, total: 0 };
        }
        products[key].quantity += item.quantity || 0;
        products[key].total += item.total || 0;
      });
    });
    return Object.values(products).sort((a, b) => b.quantity - a.quantity);
  }, [daySales]);

  // New: Hourly Sales Aggregation
  const hourlySalesData = useMemo(() => {
    // Initialize all 24 hours
    const grouped = Array(24).fill(0).map((_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      total: 0,
      count: 0
    }));

    filteredSales.forEach(sale => {
      const hour = new Date(sale.created_at).getHours();
      grouped[hour].total += sale.total;
      grouped[hour].count += 1;
    });

    return grouped;
  }, [filteredSales]);


  const filteredClosings = useMemo(() => closings.filter(c => isDateInRange(c.closing_time || c.created_at)), [closings, dateRange]);
  const filteredInventory = useMemo(() => {
    if (filterCategory === 'all') return products;
    return products.filter(p => p.category_id === filterCategory);
  }, [products, filterCategory]);

  const filteredMovements = useMemo(() => movements.filter(m => isDateInRange(m.created_at)), [movements, dateRange]);

  const customerBalances = useMemo(() => customerBalancesInfo?.balances || {}, [customerBalancesInfo]);
  const receivables = useMemo(() => {
    let filtered = customers.filter(c => (customerBalances[c.id] || c.credit_used || 0) > 0);
    if (filterCustomer !== 'all') {
      filtered = filtered.filter(c => c.id === filterCustomer);
    }
    return filtered.map(c => ({
      ...c,
      credit_used: customerBalances[c.id] || c.credit_used || 0
    }));
  }, [customers, customerBalances, filterCustomer]);

  const customerPendingSales = useMemo(() => {
    if (!selectedCustomerForDebt) return [];
    return sales.filter(s =>
      s.customer_id === selectedCustomerForDebt.id &&
      s.payment_status !== 'paid' &&
      s.status !== 'cancelled' &&
      (s.total - (s.amount_paid || 0) > 0)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [sales, selectedCustomerForDebt]);

  const inventoryValue = useMemo(() => filteredInventory.reduce((sum, p) => sum + ((p.stock || 0) * p.price), 0), [filteredInventory]);
  const inventoryCost = useMemo(() => filteredInventory.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0), [filteredInventory]);

  // Profit Calculation
  const profitData = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    filteredSales.forEach(sale => {
      totalRevenue += (sale.total || 0) - (sale.tax_total || 0);

      sale.sale_items?.forEach(item => {
        const product = productsMap.get(item.product_id);
        if (product && product.cost) {
          if (product.is_variable_price) {
            totalCost += (product.cost / 100) * (item.total || 0);
          } else {
            totalCost += product.cost * item.quantity;
          }
        }
      });
    });

    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, profit, margin };
  }, [filteredSales, productsMap]);

  // --- Productos Vendidos ---
  const soldProductsData = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number; cost: number; profit: number; category: string; categoryId: string }> = {};

    filteredSales.forEach(sale => {
      (sale.sale_items || []).forEach((item: any) => {
        const name = item.product?.name || item.product_name || 'Desconocido';
        const key = item.product_id || name;
        const product = productsMap.get(item.product_id);
        const catName = product ? (categoriesMap.get(product.category_id)?.name || 'Sin categoría') : 'Sin categoría';
        const catId = product?.category_id || 'none';
        const itemCost = product?.is_variable_price
          ? ((product.cost || 0) / 100) * (item.total || 0)
          : (product?.cost || 0) * (item.quantity || 0);
        const itemRevenue = item.total || 0;
        if (!map[key]) map[key] = { name, quantity: 0, revenue: 0, cost: 0, profit: 0, category: catName, categoryId: catId };
        map[key].quantity += item.quantity || 0;
        map[key].revenue += itemRevenue;
        map[key].cost += itemCost;
        map[key].profit += itemRevenue - itemCost;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.quantity - a.quantity);
  }, [filteredSales, productsMap, categoriesMap]);


  // --- HELPERS: CLOSING MOVEMENTS ---
  const getClosingMovements = (closing: DailyClosing) => {
    const startTime = new Date(closing.created_at);
    const endTime = closing.closing_time ? new Date(closing.closing_time) : new Date();
    return movements.filter(m => {
      const mDate = new Date(m.created_at);
      return mDate >= startTime && mDate <= endTime;
    });
  };

  // --- GENERATE PDF ---
  const generatePDF = async () => {
    console.log("Starting PDF generation for:", activeReport);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      const activeReportObj = REPORT_TYPES.find(r => r.id === activeReport);
      const title = activeReportObj?.label || 'Reporte';

      // Modern Header with dark background (Premium Black Theme)
      doc.setFillColor(20, 20, 20); // Dark/Black background
      doc.rect(0, 0, pageWidth, 45, 'F');

      // Add company logo if available
      if (companySettings?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";

          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              resolve();
            }, 3000); // 3s Timeout safety

            img.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              resolve();
            };

            img.src = companySettings.logo_url!;
            if (img.complete) {
              clearTimeout(timeout);
              resolve();
            }
          });

          if (img.width > 0 && img.height > 0) {
            const maxSize = 30;
            const aspect = img.width / img.height;
            let w = maxSize;
            let h = maxSize / aspect;

            if (h > maxSize) {
              h = maxSize;
              w = maxSize * aspect;
            }

            const y = 7.5 + (maxSize - h) / 2;
            doc.addImage(img, 'PNG', 15, y, w, h);
          }
        } catch (error) {
          console.log('Could not load logo in PDF');
        }
      }

      // Company name and app name in white
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(companySettings?.company_name || 'Cobro App', companySettings?.logo_url ? 50 : 15, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200); // Light gray for date
      doc.text(`Generado el: ${format(new Date(), 'PPpp', { locale: es })}`, companySettings?.logo_url ? 50 : 15, 28);

      // Report title on white background with dark bottom border
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 45, pageWidth, 30, 'F');

      // Title
      doc.setTextColor(20, 20, 20); // Black text
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 58, { align: 'center' });

      // Date range
      if (dateRange?.from) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80); // Dark gray
        const dateText = dateRange.to
          ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
          : format(dateRange.from, 'dd/MM/yyyy');
        doc.text(`Período: ${dateText}`, pageWidth / 2, 67, { align: 'center' });
      }

      // Accent line (Black)
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(1);
      doc.line(15, 74, pageWidth - 15, 74);

      // Body
      let head: string[][] = [];
      let body: string[][] = [];

      if (activeReport === 'sales-daily') {
        head = [['Fecha', 'Cant. Transacciones', 'Total Ventas']];
        body = dailySalesData.map(d => [d.date, d.count.toString(), `$${d.total.toLocaleString()}`]);
      } else if (activeReport === 'sales-hourly') {
        head = [['Hora', 'Cant. Transacciones', 'Total Ventas']];
        body = hourlySalesData.map(d => [d.label, d.count.toString(), `$${d.total.toLocaleString()}`]);
      } else if (activeReport === 'sales-b01') {
        head = [['Fecha', 'NCF', 'Cliente', 'RNC', 'Total', 'Impuesto']];
        body = salesB01.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', s.customer?.rnc || 'N/A', `$${s.total.toLocaleString()}`, `$${s.tax_total.toLocaleString()}`]);
      } else if (activeReport === 'sales-b02') {
        head = [['Fecha', 'NCF', 'Cliente', 'Total']];
        body = salesB02.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', `$${s.total.toLocaleString()}`]);
      } else if (activeReport === 'all-invoices') {
        head = [['Fecha', 'NCF', 'Cliente', 'RNC', 'Total', 'Impuesto']];
        body = allInvoices.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', s.customer?.rnc || 'N/A', `$${s.total.toLocaleString()}`, `$${s.tax_total.toLocaleString()}`]);
        // Add summary row to PDF
        const totalSum = allInvoices.reduce((sum, s) => sum + s.total, 0);
        const totalTax = allInvoices.reduce((sum, s) => sum + (s.tax_total || 0), 0);
        body.push(['', '', '', 'TOTAL GENERAL', `$${totalSum.toLocaleString()}`, `$${totalTax.toLocaleString()}`]);
      } else if (activeReport === 'closings') {
        head = [['Apertura', 'Cierre', 'Usuario', 'Esperado', 'Real', 'Diferencia']];
        body = filteredClosings.map(c => [format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'), c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO', c.profile?.full_name || 'N/A', `$${(c.expected_cash || 0).toLocaleString()}`, `$${(c.actual_cash || 0).toLocaleString()}`, `$${(c.difference || 0).toLocaleString()}`]);
      } else if (activeReport === 'receivables') {
        head = [['Cliente', 'Teléfono', 'Deuda', 'Límite']];
        body = receivables.map(c => [c.name, c.phone || '-', `$${(c.credit_used || 0).toLocaleString()}`, `$${(c.credit_limit || 0).toLocaleString()}`]);
      } else if (activeReport === 'inventory') {
        head = [['Producto', 'Stock', 'Costo', 'Precio', 'Valor Venta']];
        body = filteredInventory.map(p => [p.name, p.stock.toString(), `$${(p.cost || 0).toLocaleString()}`, `$${p.price.toLocaleString()}`, `$${(p.stock * p.price).toLocaleString()}`]);
      } else if (activeReport === 'movements') {
        head = [['Fecha', 'Tipo', 'Motivo', 'Monto']];
        body = filteredMovements.map(m => [format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'), m.type === 'deposit' ? 'Entrada' : 'Salida', m.reason, `$${m.amount.toLocaleString()}`]);
      } else if (activeReport === 'products-sold') {
        const selectedProd = products.find(p => selectedProducts.includes(p.id));
        if (selectedProd) {
          head = [['Fecha', 'Factura', 'Cliente', 'Cant.', 'Precio', 'Total']];
          
          let totalQty = 0;
          let totalRev = 0;

          filteredSales.forEach(sale => {
            (sale.sale_items || []).forEach((item: any) => {
              const itemNameMatch = item.product?.name || item.product_name || '';
              if (item.product_id === selectedProd.id || itemNameMatch === selectedProd.name) {
                const qty = item.quantity || 0;
                const price = item.unit_price || 0;
                const rowTotal = qty * price;
                totalQty += qty;
                totalRev += rowTotal;
                body.push([
                  format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
                  sale.invoice_number || 'S/N',
                  sale.customer?.name || 'Cliente Final',
                  qty.toString(),
                  `$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  `$${rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                ]);
              }
            });
          });

          body.push(['', '', 'TOTAL', totalQty.toString(), '', `$${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
        } else {
          head = [['Producto', 'Categoría', 'Cant.', 'Ingresos']];
          const query = productSearch.trim().toLowerCase();
          const rankingList = query ? soldProductsData.filter(p => p.name.toLowerCase().includes(query)) : soldProductsData;
          rankingList.forEach(p => {
            body.push([
              p.name,
              p.category,
              p.quantity.toString(),
              `$${p.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            ]);
          });
        }
      } else if (activeReport === 'profit') {
        head = [['Concepto', 'Monto']];
        body = [
          ['Ingresos Totales', `$${profitData.totalRevenue.toLocaleString()}`],
          ['Costos Totales', `$${profitData.totalCost.toLocaleString()}`],
          ['Utilidad Bruta', `$${profitData.profit.toLocaleString()}`],
          ['Margen %', `${profitData.margin.toFixed(2)}%`]
        ];
      } else if (activeReport === 'dashboard') {
        // Dashboard summary report
        head = [['Métrica', 'Valor']];
        const totalSales = filteredSales.reduce((a, b) => a + b.total, 0);
        const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
        const totalCredit = receivables.reduce((a, c) => a + (c.credit_used || 0), 0);

        body = [
          ['Ventas Totales', `$${totalSales.toLocaleString()}`],
          ['Transacciones', filteredSales.length.toString()],
          ['Ticket Promedio', `$${avgTicket.toFixed(2)}`],
          ['Crédito Pendiente', `$${totalCredit.toLocaleString()}`],
          ['Utilidad Estimada', `$${profitData.profit.toLocaleString()}`],
          ['Margen de Ganancia', `${profitData.margin.toFixed(1)}%`]
        ];
      }

      if (head.length > 0) {
        // 1. Draw Table FIRST
        autoTable(doc, {
          startY: 85,
          head,
          body,
          theme: 'grid', // Cleaner grid theme
          headStyles: {
            fillColor: [20, 20, 20],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            cellPadding: 3
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [50, 50, 50],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 248, 250]
          },
          margin: { left: 15, right: 15 },
          styles: {
            lineColor: [230, 230, 230],
            lineWidth: 0.1,
            valign: 'middle'
          }
        });

        // 2. Calculate position for Chart (using lastAutoTable.finalY)
        let finalY = (doc as any).lastAutoTable.finalY || 150;

        // --- CHART GENERATION (Below Table) ---
        if (((activeReport === 'sales-daily' || activeReport === 'dashboard') && dailySalesData.length > 0) || (activeReport === 'sales-hourly' && hourlySalesData.some(d => d.total > 0))) {

          // Check if we need a new page for the chart
          if (finalY + 70 > pageHeight) {
            doc.addPage();
            finalY = 20; // Reset Y on new page
          } else {
            finalY += 15; // Spacer
          }

          const chartData = (activeReport === 'sales-daily' || activeReport === 'dashboard') ? dailySalesData : hourlySalesData;
          const maxVal = Math.max(...chartData.map(d => d.total)) || 1;
          const avgVal = chartData.reduce((a, b) => a + b.total, 0) / (chartData.length || 1);

          // Chart Config
          const chartX = 35; // Shift right to make room for Y-Axis Labels
          const chartY = finalY + 15;
          const chartWidth = pageWidth - 55;
          const chartHeight = 50;
          const barWidth = (chartWidth / chartData.length) * 0.55;
          const spacing = (chartWidth / chartData.length) * 0.45;

          // Chart Title
          doc.setFontSize(12);
          doc.setTextColor(20, 20, 20);
          doc.setFont('helvetica', 'bold');
          doc.text("Análisis Gráfico de Ventas", 35, finalY + 5);

          // Draw Chart Background
          doc.setDrawColor(240, 240, 240);
          doc.setFillColor(252, 252, 255);
          doc.roundedRect(chartX - 5, chartY - 5, chartWidth + 10, chartHeight + 35, 3, 3, 'F');

          // Draw Grid Lines & Y-Axis Labels
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.1);
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'normal');

          for (let i = 0; i <= 4; i++) {
            const y = chartY + (chartHeight * (i / 4));
            doc.line(chartX, y, chartX + chartWidth, y);

            // Y-Axis Labels (inverted logic because y grows downwards)
            const val = maxVal * (1 - (i / 4));
            const label = val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
            doc.text(`$${label}`, chartX - 2, y + 2, { align: 'right' });
          }

          // Draw Average Line (Dashed)
          if (avgVal > 0) {
            const avgY = chartY + chartHeight - ((avgVal / maxVal) * chartHeight);
            doc.setDrawColor(255, 150, 0); // Orange for average
            doc.setLineWidth(0.5);
            doc.setLineDash([2, 2]); // Dashed line
            doc.line(chartX, avgY, chartX + chartWidth, avgY);
            doc.setLineDash([]); // Reset dash
            doc.setTextColor(255, 150, 0);
            doc.text(`Prom: $${avgVal >= 1000 ? (avgVal / 1000).toFixed(1) + 'k' : avgVal.toFixed(0)}`, chartX + chartWidth + 2, avgY + 2, { align: 'left' });
          }

          // Draw Bars
          doc.setFontSize(7);

          chartData.forEach((d, i) => {
            if (d.total <= 0) return;

            const barHeight = (d.total / maxVal) * chartHeight;
            const x = chartX + (i * (barWidth + spacing)) + (spacing / 2);
            const y = chartY + chartHeight - barHeight;

            // Modern Gradient-like Bar
            // Highlight Max Value
            if (d.total === maxVal) {
              doc.setFillColor(37, 99, 235); // Darker Blue for Peak
            } else {
              doc.setFillColor(96, 165, 250); // Lighter Blue for others
            }

            doc.rect(x, y, barWidth, barHeight, 'F');

            // Value Label (Only if space permits or it's the max)
            if (chartData.length < 20 || d.total === maxVal) {
              doc.setTextColor(50, 50, 50);
              const valText = d.total >= 1000 ? (d.total / 1000).toFixed(1) + 'k' : d.total.toFixed(0);
              doc.text(`${valText}`, x + barWidth / 2, y - 2, { align: 'center' });
            }

            // X-Axis Label (Date/Time)
            // Intelligent skipping to avoid overlap
            let step = 1;

            if (activeReport === 'sales-hourly') {
              // Show EVERY hour (00:00, 01:00, 02:00...)
              step = 1;
            } else {
              // For daily, dynamic based on total days (show ~10 labels max)
              step = Math.ceil(chartData.length / 10);
            }

            if (i % step === 0) {
              doc.setTextColor(50, 50, 50); // Darker, clearer text
              // Use smaller font for hourly to fit all 24 labels
              doc.setFontSize(activeReport === 'sales-hourly' ? 6 : 7);

              let label = '';
              if (activeReport === 'sales-daily' || activeReport === 'dashboard') {
                // Format date to '05 Ene'
                try {
                  const dateObj = (d as any).rawDate || new Date((d as any).date);
                  label = format(dateObj, 'd MMM', { locale: es });
                } catch (e) {
                  label = (d as any).date.split(' ')[0];
                }
              } else {
                label = (d as any).label; // "09:00", "10:00" etc.
              }

              doc.text(label, x + barWidth / 2, chartY + chartHeight + 8, { align: 'center' });
            }
          });
        }

        // Footer with page numbers and company info
        const totalPages = doc.getNumberOfPages();

        // Load app logo for watermark
        let logoImg: HTMLImageElement | null = null;
        try {
          logoImg = new Image();
          // Use absolute path from window.location for better reliability
          logoImg.src = `${window.location.origin}/cobro-logo.png`;
          logoImg.crossOrigin = 'Anonymous'; // Add this for CORS if needed
          await new Promise((resolve) => {
            logoImg!.onload = resolve;
            logoImg!.onerror = () => {
              console.warn("Logo failed to load from origin, falling back to imported asset if available");
              resolve(null);
            };
            if (logoImg!.complete) resolve(null);
          });
        } catch (e) {
          console.warn("Could not load app logo");
        }

        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);

          // Footer: Company Name (Left) and Page Number (Right) - Moved UP to avoid edge
          const footerY = pageHeight - 15;

          if (companySettings?.company_name) {
            doc.text(companySettings.company_name, 15, footerY);
          }

          doc.text(
            `Página ${i} de ${totalPages}`,
            pageWidth - 15, // Align right
            footerY,
            { align: 'right' }
          );

          // --- Watermark "COBRO" ---
          // Moved HIGHER to avoid cutting off
          const watermarkY = pageHeight - 8;
          const logoSize = 18; // Increased for better visibility

          doc.setFont("helvetica", "bold");
          doc.setFontSize(24); // Increased for prominence
          doc.setTextColor(80, 80, 80); // Slightly darker for better visibility

          const text = "COBRO";
          const textWidth = doc.getTextWidth(text);

          // Center the combination of Logo + Text
          const spacing = 3;
          const totalW = logoSize + spacing + textWidth;
          const startX = (pageWidth - totalW) / 2;

          if (logoImg) {
            try {
              // Icon aligned with text baseline (approx)
              doc.addImage(logoImg, 'PNG', startX, watermarkY - 7, logoSize, logoSize, undefined, 'FAST');
            } catch (e) { }
          }

          doc.text(text, startX + logoSize + spacing, watermarkY);
        }

        let pdfFileName = `reporte-${activeReport}`;
        if (activeReport === 'receivables') {
          const customerName = filterCustomer !== 'all'
            ? customers.find(c => c.id === filterCustomer)?.name?.replace(/[^a-z0-9]/gi, '_')
            : 'Todos_los_clientes';

          if (customerName) {
            pdfFileName += `-${customerName}`;
          }
        }

        doc.save(`${pdfFileName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({
          title: 'PDF Generado',
          description: 'El reporte PDF se ha descargado correctamente.'
        });
      } else {
        toast({ title: 'PDF no disponible', description: 'Este reporte no tiene plantilla de PDF configurada aún.' });
      }
    } catch (e: any) {
      console.error("PDF Generation failed:", e);
      toast({ title: 'Error', description: 'No se pudo generar el PDF. Revisa la consola.', variant: 'destructive' });
    }
  };

  // --- SINGLE INVOICE ACTIONS ---
  const generateInvoicePDF = (sale: Sale, returnBlob = false): any => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.company_name || 'Factura de Venta', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companySettings?.rnc_number) doc.text(`RNC: ${companySettings.rnc_number}`, pageWidth / 2, 26, { align: 'center' });
    if (companySettings?.phone) doc.text(`Tel: ${companySettings.phone}`, pageWidth / 2, 31, { align: 'center' });
    doc.text(`Fecha: ${format(new Date(sale.created_at), 'dd/MM/yyyy hh:mm a')}`, pageWidth / 2, 36, { align: 'center' });

    // Separator
    doc.line(10, 42, pageWidth - 10, 42);

    // Client Info
    doc.setFontSize(11);
    doc.text(`Factura #: ${sale.invoice_number || 'S/N'}`, 15, 52);
    doc.text(`Cliente: ${sale.customer?.name || 'Consumidor Final'}`, 15, 58);
    if (sale.customer?.rnc) doc.text(`RNC/Cédula: ${sale.customer.rnc}`, 15, 64);

    // Items Table
    const head = [['Cant.', 'Descripción', 'Precio', 'Total']];
    const body = sale.sale_items?.map(item => [
      item.quantity.toString(),
      item.product?.name || 'Producto',
      `$${item.unit_price.toLocaleString()}`,
      `$${item.total.toLocaleString()}`
    ]) || [];

    autoTable(doc, {
      startY: 75,
      head: head,
      body: body,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text(`Subtotal:`, pageWidth - 60, finalY);
    doc.text(`$${(sale.subtotal || 0).toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

    doc.text(`Impuestos:`, pageWidth - 60, finalY + 6);
    doc.text(`$${(sale.tax_total || 0).toLocaleString()}`, pageWidth - 15, finalY + 6, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL:`, pageWidth - 60, finalY + 14);
    doc.text(`$${sale.total.toLocaleString()}`, pageWidth - 15, finalY + 14, { align: 'right' });

    if (returnBlob) {
      return doc.output('blob');
    } else {
      doc.save(`Factura-${sale.invoice_number || 'ref'}.pdf`);
      toast({ title: 'PDF Descargado', description: 'La factura se ha guardado correctamente.' });
    }
  };

  const handlePrintInvoice = (sale: Sale) => {
    const pdfBlob = generateInvoicePDF(sale, true);
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(pdfUrl);
      };
    } else {
      toast({ title: 'Error', description: 'Habilita las ventanas emergentes para imprimir.', variant: 'destructive' });
    }
  };

  const handleEmailInvoice = (sale: Sale) => {
    // Mock email sending
    toast({ title: 'Enviando Correo...', description: `Enviando factura ${sale.invoice_number || ''} al cliente.` });
    setTimeout(() => {
      toast({ title: 'Correo Enviado', description: 'La factura ha sido enviada exitosamente.' });
    }, 1500);
  };

  const generateCustomerDebtPDF = async (customer: any, pendingSales: Sale[], returnBlob = false): Promise<any> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // 1. Modern Header with dark background (Premium Black Theme)
    doc.setFillColor(20, 20, 20); // Dark/Black background
    doc.rect(0, 0, pageWidth, 45, 'F');

    // 2. Add company logo if available
    if (companySettings?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 3000); // 3s Timeout safety

          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve();
          };

          img.src = companySettings.logo_url!;
          if (img.complete) {
            clearTimeout(timeout);
            resolve();
          }
        });

        if (img.width > 0 && img.height > 0) {
          const maxSize = 30;
          const aspect = img.width / img.height;
          let w = maxSize;
          let h = maxSize / aspect;

          if (h > maxSize) {
            h = maxSize;
            w = maxSize * aspect;
          }

          const y = 7.5 + (maxSize - h) / 2;
          doc.addImage(img, 'PNG', 15, y, w, h);
        }
      } catch (error) {
        console.log('Could not load logo in PDF');
      }
    }

    // 3. Company name and Generation Info
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.company_name || 'Cobro App', companySettings?.logo_url ? 50 : 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200); // Light gray for date
    doc.text(`Generado el: ${format(new Date(), 'PPpp', { locale: es })}`, companySettings?.logo_url ? 50 : 15, 28);

    // 4. Report title Section
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 45, pageWidth, 30, 'F');

    doc.setTextColor(20, 20, 20); // Black text
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE CUENTA / DEUDA PENDIENTE', pageWidth / 2, 58, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${customer.name}`, pageWidth / 2, 67, { align: 'center' });

    // 5. Accent line (Black)
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(1);
    doc.line(15, 74, pageWidth - 15, 74);

    // 6. Data Table
    const head = [['Fecha', 'Factura #', 'Total Factura', 'Abonado', 'Balance Restante']];
    const body = pendingSales.map(s => [
      format(new Date(s.created_at), 'dd/MM/yyyy'),
      s.invoice_number || 'S/N',
      `$${s.total.toLocaleString()}`,
      `$${(s.amount_paid || 0).toLocaleString()}`,
      `$${(s.total - (s.amount_paid || 0)).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 85,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [20, 20, 20],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        cellPadding: 3
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    // 7. Total Debt Summary
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY + 20 > pageHeight) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    const labelText = 'DEUDA TOTAL PENDIENTE:';
    const amountText = `$${(customer.credit_used || 0).toLocaleString()}`;

    // Draw a subtle background for the total
    doc.setFillColor(248, 248, 250);
    doc.rect(pageWidth - 110, finalY - 8, 95, 12, 'F');

    doc.text(labelText, pageWidth - 105, finalY);
    doc.setTextColor(220, 38, 38); // Clear Red for debt
    doc.text(amountText, pageWidth - 15, finalY, { align: 'right' });

    // 8. Watermark and Footers
    const totalPages = doc.getNumberOfPages();
    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = `${window.location.origin}/cobro-logo.png`;
      logoImg.crossOrigin = 'Anonymous';
      await new Promise((resolve) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = () => resolve(null);
        if (logoImg!.complete) resolve(null);
      });
    } catch (e) { }

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const footerY = pageHeight - 15;
      if (companySettings?.company_name) doc.text(companySettings.company_name, 15, footerY);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, footerY, { align: 'right' });

      // Watermark "COBRO" logic
      const watermarkY = pageHeight - 8;
      const logoSize = 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(80, 80, 80);
      const text = "COBRO";
      const textWidth = doc.getTextWidth(text);
      const spacing = 3;
      const totalW = logoSize + spacing + textWidth;
      const startX = (pageWidth - totalW) / 2;

      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', startX, watermarkY - 7, logoSize, logoSize, undefined, 'FAST');
        } catch (e) { }
      }
      doc.text(text, startX + logoSize + spacing, watermarkY);
    }

    if (returnBlob) return doc.output('blob');
    const safeName = customer.name.replace(/[^a-z0-9]/gi, '_');
    doc.save(`Estado_Cuenta_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handlePrintCustomerDebt = async (customer: any, pendingSales: Sale[]) => {
    const pdfBlob = await generateCustomerDebtPDF(customer, pendingSales, true);
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(pdfUrl);
      };
    } else {
      toast({ title: 'Error', description: 'Habilita las ventanas emergentes para imprimir.', variant: 'destructive' });
    }
  };

  // --- GENERATE EXCEL ---
  const generateExcel = () => {
    const activeReportObj = REPORT_TYPES.find(r => r.id === activeReport);
    const title = activeReportObj?.label || 'Reporte';
    let data: any[] = [];
    let fileName = `reporte-${activeReport}`;

    if (activeReport === 'sales-daily') {
      data = dailySalesData.map(d => ({
        Fecha: d.date,
        Transacciones: d.count,
        Total_Ventas: d.total
      }));
    } else if (activeReport === 'sales-hourly') {
      data = hourlySalesData.map(d => ({
        Hora: d.label,
        Transacciones: d.count,
        Total_Ventas: d.total
      }));
    } else if (activeReport === 'sales-b01') {
      data = salesB01.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        RNC: s.customer?.rnc || 'N/A',
        Impuesto: s.tax_total,
        Total: s.total
      }));
    } else if (activeReport === 'sales-b02') {
      data = salesB02.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        Total: s.total
      }));
    } else if (activeReport === 'all-invoices') {
      data = allInvoices.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        RNC: s.customer?.rnc || 'N/A',
        Impuesto: s.tax_total,
        Total: s.total
      }));
      const totalSum = allInvoices.reduce((sum, s) => sum + s.total, 0);
      data.push({
        Fecha: '', NCF: '', Cliente: '', RNC: 'TOTAL GENERAL', Impuesto: '', Total: totalSum
      });
    } else if (activeReport === 'closings') {
      data = filteredClosings.map(c => ({
        Apertura: format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
        Cierre: c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO',
        Responsable: c.profile?.full_name,
        Efectivo_Ventas: c.total_sales_cash,
        Entradas: c.total_cash_in,
        Salidas: c.total_cash_out,
        Esperado: c.expected_cash,
        Real: c.actual_cash,
        Diferencia: c.difference
      }));
    } else if (activeReport === 'receivables') {
      data = receivables.map(c => ({
        Cliente: c.name,
        Telefono: c.phone || 'N/A',
        Limite_Credito: c.credit_limit,
        Credito_Usado: c.credit_used,
        Disponible: (c.credit_limit || 0) - (c.credit_used || 0)
      }));
    } else if (activeReport === 'inventory') {
      data = filteredInventory.map(p => ({
        Producto: p.name,
        Categoria: p.category?.name,
        Stock: p.stock,
        Costo: p.cost || 0,
        Precio_Venta: p.price,
        Valor_Total_Stock: (p.stock || 0) * p.price
      }));
    } else if (activeReport === 'movements') {
      data = filteredMovements.map(m => ({
        Fecha: format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
        Tipo: m.type === 'deposit' ? 'Entrada' : 'Salida',
        Motivo: m.reason,
        Monto: m.amount
      }));
    } else if (activeReport === 'products-sold') {
      const selectedProd = products.find(p => selectedProducts.includes(p.id));
      if (selectedProd) {
        data = [];
        filteredSales.forEach(sale => {
          (sale.sale_items || []).forEach((item: any) => {
            const itemNameMatch = item.product?.name || item.product_name || '';
            if (item.product_id === selectedProd.id || itemNameMatch === selectedProd.name) {
              data.push({
                Fecha: format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
                Factura: sale.invoice_number || 'S/N',
                Cliente: sale.customer?.name || 'Cliente Final',
                Cantidad: item.quantity,
                Precio_Unitario: item.unit_price,
                Total: item.quantity * item.unit_price
              });
            }
          });
        });
        fileName = `ventas-producto-${selectedProd.name.replace(/[^a-z0-9]/gi, '_')}`;
      } else {
        const query = productSearch.trim().toLowerCase();
        const rankingList = query ? soldProductsData.filter(p => p.name.toLowerCase().includes(query)) : soldProductsData;
        data = rankingList.map(p => ({
          Producto: p.name,
          Categoria: p.category,
          Unidades_Vendidas: p.quantity,
          Ingresos_Ventas: p.revenue
        }));
        fileName = `ranking-productos-vendidos`;
      }
    } else if (activeReport === 'profit') {
      data = [
        { Concepto: 'Ingresos Totales', Monto: profitData.totalRevenue },
        { Concepto: 'Costos Totales', Monto: profitData.totalCost },
        { Concepto: 'Utilidad Bruta', Monto: profitData.profit },
        { Concepto: 'Margen %', Monto: `${profitData.margin.toFixed(2)}%` }
      ];
    } else if (activeReport === 'dashboard') {
      // Dashboard summary export
      const totalSales = filteredSales.reduce((a, b) => a + b.total, 0);
      const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
      const totalCredit = receivables.reduce((a, c) => a + (c.credit_used || 0), 0);

      data = [
        { Metrica: 'Ventas Totales', Valor: totalSales },
        { Metrica: 'Transacciones', Valor: filteredSales.length },
        { Metrica: 'Ticket Promedio', Valor: avgTicket.toFixed(2) },
        { Metrica: 'Crédito Pendiente', Valor: totalCredit },
        { Metrica: 'Utilidad Estimada', Valor: profitData.profit },
        { Metrica: 'Margen de Ganancia (%)', Valor: profitData.margin.toFixed(1) }
      ];
      fileName = 'resumen-dashboard';
    }

    if (activeReport === 'receivables') {
      const customerName = filterCustomer !== 'all'
        ? customers.find(c => c.id === filterCustomer)?.name?.replace(/[^a-z0-9]/gi, '_')
        : 'Todos_los_clientes';

      if (customerName) {
        fileName = `reporte-${activeReport}-${customerName}`;
      }
    }

    if (data.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay datos para exportar en este reporte.', variant: 'outline' });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    // Auto-width columns
    const cols = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 20) }));
    ws['!cols'] = cols;

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(wb, `${fileName}-${dateStr}.xlsx`);
    toast({
      title: 'Excel Generado',
      description: 'El archivo Excel se ha descargado correctamente.'
    });
  };

  const handleSendEmail = () => {
    // Improve email validation
    if (!emailAddress || !emailAddress.includes('@')) {
      toast({ title: 'Correo inválido', variant: 'destructive', description: 'Por favor ingrese un correo válido.' });
      return;
    }

    // Mock Sending
    setTimeout(() => {
      toast({
        title: 'Correo Enviado',
        description: `El reporte actual se ha enviado correctamente a ${emailAddress}`
      });
      setIsEmailDialogOpen(false);
      setEmailAddress('');
    }, 1000);
  };


  // --- RENDER CONTENT AREA ---
  const renderContent = () => {
    switch (activeReport) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Ventas Totales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">${filteredSales.reduce((a, b) => a + b.total, 0).toLocaleString()}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{filteredSales.length} transacciones</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Ticket Promedio</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">
                    ${filteredSales.length > 0 ? (filteredSales.reduce((a, b) => a + b.total, 0) / filteredSales.length).toFixed(2) : 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Crédito Pendiente</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold text-orange-600">${receivables.reduce((a, c) => a + (c.credit_used || 0), 0).toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Utilidad Estimada</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold text-green-600">${profitData.profit.toLocaleString()}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{profitData.margin.toFixed(1)}% Margen</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Tendencia de Ventas (Últimos Días)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySalesData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value) => `$${Number(value).toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                      itemStyle={{ color: 'black' }}
                      labelStyle={{ color: '#666' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#8884d8" fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-daily':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Ventas Diarias</CardTitle>
                <CardDescription>Resumen de ventas agrupadas por día.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySalesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                        contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                        itemStyle={{ color: 'black' }}
                        labelStyle={{ color: '#666' }}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Transacciones</TableHead>
                      <TableHead className="text-right">Total Vendido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailySalesData.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-6">No hay datos en este rango.</TableCell></TableRow> :
                      dailySalesData.map((d, i) => (
                        <TableRow 
                          key={i} 
                          className="cursor-pointer hover:bg-zinc-900/60 transition-colors"
                          onClick={() => setSelectedDailySalesDate(d.key)}
                        >
                          <TableCell className="font-medium text-white">{d.date}</TableCell>
                          <TableCell className="text-center">{d.count}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-400">${d.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-hourly':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Hora</CardTitle>
                <CardDescription>Identifica tus horas pico de mayor venta.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlySalesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" interval={2} />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                        contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                        itemStyle={{ color: 'black' }}
                        labelStyle={{ color: '#666' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead className="text-center">Transacciones</TableHead>
                        <TableHead className="text-right">Total Vendido</TableHead>
                        <TableHead className="text-right">Promedio / Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourlySalesData.map((d, i) => (
                        <TableRow key={i} className={d.total > 0 ? 'bg-muted/20' : ''}>
                          <TableCell className="font-medium">{d.label}</TableCell>
                          <TableCell className="text-center">{d.count}</TableCell>
                          <TableCell className="text-right font-bold text-primary">${d.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${d.count > 0 ? (d.total / d.count).toFixed(0) : 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-b01':
      case 'sales-b02':
      case 'all-invoices':
        const currentList = activeReport === 'sales-b01' ? salesB01 :
          activeReport === 'sales-b02' ? salesB02 : allInvoices;

        const title = activeReport === 'sales-b01' ? 'Facturas con Valor Fiscal (B01)' :
          activeReport === 'sales-b02' ? 'Facturas de Consumo (B02)' : 'Reporte General de Facturas';

        // Calculate totals for the footer
        const totalAmount = currentList.reduce((sum, s) => sum + s.total, 0);
        const totalTax = currentList.reduce((sum, s) => sum + (s.tax_total || 0), 0);

        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Mostrando {currentList.length} comprobantes emitidos en el periodo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">NCF</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Cliente</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4 hidden sm:table-cell">RNC/Cédula</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4 text-right hidden sm:table-cell">ITBIS</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4 text-right">Total</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4 text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentList.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No se encontraron facturas de este tipo.</TableCell></TableRow> :
                    currentList.map(s => (
                      <TableRow key={s.id} onClick={() => setSelectedSale(s)} className="cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/20 group">
                        <TableCell className="py-4 text-sm text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="py-4 text-xs font-mono text-muted-foreground tracking-tight">{s.invoice_number}</TableCell>
                        <TableCell className="py-4 text-sm font-medium">{s.customer?.name || 'Consumidor Final'}</TableCell>
                        <TableCell className="py-4 text-sm text-muted-foreground hidden sm:table-cell">{s.customer?.rnc || '-'}</TableCell>
                        <TableCell className="py-4 text-right text-sm text-muted-foreground hidden sm:table-cell">${(s.tax_total || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 text-right text-sm font-semibold">${s.total.toLocaleString()}</TableCell>
                        <TableCell className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors" onClick={() => setSelectedActionSale(s)} title="Opciones de Impresión">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors" onClick={() => handleEmailInvoice(s)} title="Enviar por Email">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => generateInvoicePDF(s)} title="Descargar PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
                <TableFooter className="bg-transparent border-t border-border/50">
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground py-6">Total General</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-muted-foreground hidden sm:table-cell">${totalTax.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-lg font-black text-primary">${totalAmount.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        );

      case 'closings':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Historial de Cierres de Caja</CardTitle>
              <CardDescription>Registro de aperturas y cierres de turno.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Apertura</TableHead>
                    <TableHead>Fecha Cierre</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosings.map(c => (
                    <TableRow key={c.id} onClick={() => setSelectedClosing(c)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO'}</TableCell>
                      <TableCell>{c.profile?.full_name}</TableCell>
                      <TableCell className="text-right">${(c.expected_cash || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">${(c.actual_cash || 0).toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${(c.difference || 0) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {(c.difference || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center"><Eye className="h-4 w-4 inline text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'receivables':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Cuentas por Cobrar</CardTitle>
              <CardDescription>Cartera de clientes con balance pendiente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Límite de Crédito</TableHead>
                    <TableHead className="text-right">Deuda Actual</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay clientes con deuda.</TableCell></TableRow> :
                    receivables.map(c => (
                      <TableRow key={c.id} onClick={() => setSelectedCustomerForDebt(c)} className="cursor-pointer hover:bg-muted/50" title="Ver facturas pendientes">
                        <TableCell className="font-medium text-primary">{c.name}</TableCell>
                        <TableCell>{c.phone || '-'}</TableCell>
                        <TableCell>${(c.credit_limit || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">${(c.credit_used || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">${((c.credit_limit || 0) - (c.credit_used || 0)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'inventory':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Costo Total Inventario</p>
                  <h3 className="text-2xl font-bold text-primary">${inventoryCost.toLocaleString()}</h3>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Valor de Venta Potencial</p>
                  <h3 className="text-2xl font-bold text-green-700">${inventoryValue.toLocaleString()}</h3>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Detalle de Inventario</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-right">Costo Unit.</TableHead>
                        <TableHead className="text-right">Precio Venta</TableHead>
                        <TableHead className="text-right">Valuación (Costo)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-center font-bold">{p.stock}</TableCell>
                          <TableCell className="text-right">${(p.cost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">${p.price.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${(p.stock * (p.cost || 0)).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'movements':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader><CardTitle>Historial de Movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8">No hay movimientos.</TableCell></TableRow> :
                    filteredMovements.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          {m.type === 'deposit' ? <span className="text-green-600 flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> Entrada</span> : <span className="text-red-600 flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> Salida</span>}
                        </TableCell>
                        <TableCell>{m.reason}</TableCell>
                        <TableCell className="text-right font-bold">RD$ {m.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'profit':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Análisis de Rentabilidad</CardTitle>
              <CardDescription>Calculado base Ventas Netas - Costo de Productos vendidos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-muted-foreground mb-2">Ingresos por Ventas</p>
                  <p className="text-2xl font-bold text-primary">${profitData.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-muted-foreground mb-2">Costo de Mercancía</p>
                  <p className="text-2xl font-bold text-red-600">${profitData.totalCost.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-accent/10">
                  <p className="text-muted-foreground mb-2">Utilidad Bruta</p>
                  <p className="text-3xl font-bold text-green-600">${profitData.profit.toLocaleString()}</p>
                  <p className="text-sm font-semibold text-green-700 mt-1">{profitData.margin.toFixed(2)}% Margen</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Ingresos', value: profitData.totalRevenue },
                    { name: 'Costos', value: profitData.totalCost },
                    { name: 'Utilidad', value: profitData.profit }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#22c55e" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      case 'products-sold': {
        const query = productSearch.trim().toLowerCase();
        
        let rankingList = soldProductsData;
        if (query) {
          rankingList = rankingList.filter(p => p.name.toLowerCase().includes(query));
        }

        const selectedProd = products.find(p => selectedProducts.includes(p.id));

        let totalQty = 0;
        let totalRev = 0;
        let totalCost = 0;
        const drillSales: { id: string; saleId: string; date: string; invoice: string; customer: string; qty: number; unitPrice: number; total: number }[] = [];

        if (selectedProd) {
          filteredSales.forEach(sale => {
            (sale.sale_items || []).forEach((item: any) => {
              const itemNameMatch = item.product?.name || item.product_name || '';
              if (item.product_id === selectedProd.id || itemNameMatch === selectedProd.name) {
                const qty = item.quantity || 0;
                const price = item.unit_price || 0;
                const rowTotal = qty * price;
                totalQty += qty;
                totalRev += rowTotal;
                totalCost += (selectedProd.cost || 0) * qty;
                drillSales.push({
                  id: item.id || Math.random().toString(),
                  saleId: sale.id,
                  date: sale.created_at,
                  invoice: sale.invoice_number || `#${sale.id.slice(0, 8)}`,
                  customer: sale.customer?.name || 'Cliente Final',
                  qty: qty,
                  unitPrice: price,
                  total: rowTotal,
                });
              }
            });
          });
        }

        return (
          <div className="space-y-5 animate-in fade-in duration-500">
            {!selectedProd ? (
              <Card className="border-primary/20">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Ranking de Productos Más Vendidos</CardTitle>
                    <CardDescription>Resumen de los productos con mayor número de ventas en este rango de fechas.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Package className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-12 text-base"
                        placeholder="Buscar en el ranking por nombre de producto..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                      />
                      {productSearch && (
                        <button 
                          onClick={() => setProductSearch('')}
                          className="absolute right-3 p-1 hover:bg-muted rounded-full"
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="border rounded-xl bg-card overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-20 shadow-sm border-b">
                          <TableRow>
                            <TableHead className="font-bold">Producto</TableHead>
                            <TableHead className="font-bold">Categoría</TableHead>
                            <TableHead className="text-right font-bold">Unidades Vendidas</TableHead>
                            <TableHead className="text-right font-bold pr-6">Ingresos Generados</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                No se encontraron productos vendidos con los filtros actuales.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rankingList.map((p, idx) => {
                              const productDoc = products.find(prod => prod.name === p.name || prod.id === p.name); // try matching ID first because key is ID or Name, but `soldProductsData` sets `p.name` visually
                              return (
                                <TableRow 
                                  key={idx} 
                                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                                  onClick={() => {
                                    if (productDoc) {
                                      setSelectedProducts([productDoc.id]);
                                      setProductSearch('');
                                    } else {
                                      const foundByName = products.find(prod => prod.name === p.name);
                                      if (foundByName) {
                                         setSelectedProducts([foundByName.id]);
                                         setProductSearch('');
                                      }
                                    }
                                  }}
                                  title="Haz clic para ver el historial de ventas"
                                >
                                  <TableCell className="font-semibold text-primary">{p.name}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground uppercase">{p.category}</TableCell>
                                  <TableCell className="text-right font-black text-emerald-600">{p.quantity}</TableCell>
                                  <TableCell className="text-right font-bold pr-6">
                                    ${p.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/20">
                <CardHeader className="pb-3 border-b bg-muted/10 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl">Historial de Ventas</CardTitle>
                    <CardDescription>Detalle de transacciones para el producto seleccionado.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    className="hover:bg-muted cursor-pointer shrink-0" 
                    onClick={() => setSelectedProducts([])}
                  >
                    Volver al Ranking
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="animate-in slide-in-from-top-4">
                    {/* Summary row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Producto</span>
                        <span className="font-black text-center leading-tight truncate w-full" title={selectedProd.name}>{selectedProd.name}</span>
                      </div>
                      <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-emerald-600/70 uppercase font-black tracking-widest mb-1">Unidades Vendidas</span>
                        <span className="font-black text-2xl text-emerald-600">{totalQty}</span>
                      </div>
                      <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-amber-600/70 uppercase font-black tracking-widest mb-1">Ingresos de Ventas</span>
                        <span className="font-black text-2xl text-amber-600">${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl border flex flex-col items-center justify-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total Transacciones</span>
                        <span className="font-black text-2xl">{drillSales.length}</span>
                      </div>
                    </div>

                    <div className="border rounded-xl bg-card overflow-hidden">
                      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                         <h3 className="font-semibold text-sm">Historial de Ventas</h3>
                         <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-full border">{drillSales.length} registros encontrados</span>
                      </div>
                      <ScrollArea className="h-[450px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-20 shadow-sm border-b-2">
                            <TableRow>
                              <TableHead className="w-10 text-center font-bold">#</TableHead>
                              <TableHead className="font-bold">Fecha</TableHead>
                              <TableHead className="font-bold">Factura</TableHead>
                              <TableHead className="font-bold md:w-1/3">Cliente</TableHead>
                              <TableHead className="text-right font-bold w-20">Cant.</TableHead>
                              <TableHead className="text-right font-bold w-28">Precio U.</TableHead>
                              <TableHead className="text-right font-bold w-32 pr-4">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {drillSales.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                  No hay ventas para este producto en el rango de fechas actual.
                                </TableCell>
                              </TableRow>
                            ) : (
                              drillSales.map((row, idx) => (
                                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                                  <TableCell className="text-muted-foreground text-xs text-center font-bold">{idx + 1}</TableCell>
                                  <TableCell className="text-[11px] whitespace-nowrap">
                                    {format(new Date(row.date), 'dd/MM/yy HH:mm', { locale: es })}
                                  </TableCell>
                                  <TableCell className="font-mono text-[11px] text-primary font-bold">{row.invoice}</TableCell>
                                  <TableCell className="text-[11px] font-semibold truncate max-w-[200px]" title={row.customer}>{row.customer}</TableCell>
                                  <TableCell className="text-right font-black text-xs">{row.qty}</TableCell>
                                  <TableCell className="text-right text-muted-foreground font-medium text-xs">
                                    ${row.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-right font-black text-emerald-600 text-[11px] pr-4">
                                    ${row.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      }

      default:
        return <div className="p-8 text-center text-muted-foreground">Seleccione un reporte del menú izquierdo.</div>;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-8rem)] overflow-hidden bg-background rounded-xl border border-border/50 shadow-sm mt-2">
      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden md:flex w-72 border-r bg-muted/10 flex-col shrink-0">
        <div className="p-5 border-b flex items-center gap-3 bg-card/50">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-black text-lg tracking-tight">Reportes</h2>
            <p className="text-[11px] text-muted-foreground font-medium">Panel de Analíticas</p>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1">
            {REPORT_TYPES.map(report => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs transition-all text-left group",
                  activeReport === report.id
                    ? "bg-primary text-primary-foreground shadow-md font-bold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <report.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", activeReport === report.id ? "text-primary-foreground" : "text-muted-foreground")} />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate leading-snug">{report.label}</p>
                </div>
                {activeReport === report.id && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative">
        
        {/* --- MOBILE HEADER (Optimized & Compact) --- */}
        <div className="md:hidden border-b bg-background/95 backdrop-blur-xl sticky top-0 z-30 p-3 space-y-3 shadow-sm">
          {/* Top Row: Report Select & Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Select value={activeReport} onValueChange={setActiveReport}>
                <SelectTrigger className="w-full h-11 bg-muted/30 border-border/40 rounded-xl font-bold text-sm">
                  <div className="flex items-center gap-2.5 truncate">
                    {React.createElement(REPORT_TYPES.find(r => r.id === activeReport)?.icon || LayoutDashboard, { className: "h-4 w-4 text-primary shrink-0" })}
                    <span className="truncate">{REPORT_TYPES.find(r => r.id === activeReport)?.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[70vh]">
                  {REPORT_TYPES.map(report => (
                    <SelectItem key={report.id} value={report.id} className="py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <report.icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-bold">{report.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Compact Action Buttons */}
            <div className="flex items-center gap-1 shrink-0 bg-muted/20 p-1 rounded-xl border border-border/40">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-lg" onClick={() => generatePDF()} title="Descargar PDF">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:bg-emerald-500/10 rounded-lg" onClick={() => generateExcel()} title="Descargar Excel">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-500/10 rounded-lg" onClick={() => setIsEmailDialogOpen(true)} title="Enviar por Correo">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Horizontal Scroll Pill Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs border-y border-border/30 py-2">
            {REPORT_TYPES.map(report => {
              const Icon = report.icon;
              const isActive = activeReport === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{report.label}</span>
                </button>
              );
            })}
          </div>

          {/* Date Picker & Quick Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9 flex-1 sm:w-36 text-xs font-bold bg-muted/20 border-border/40 rounded-xl">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos los Clientes</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger className="h-9 flex-1 sm:w-32 text-xs font-bold bg-muted/20 border-border/40 rounded-xl">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos los Métodos</SelectItem>
                  {uniquePaymentMethods.map(m => (
                    <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filterCustomer !== 'all' || filterPaymentMethod !== 'all' || filterCategory !== 'all' || filterUser !== 'all') && (
                <Button variant="ghost" size="icon" onClick={clearFilters} className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" title="Limpiar Filtros">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Loading Bar */}
          {isFetchingSales && (
            <div className="flex items-center justify-center gap-2 text-primary text-xs font-bold bg-primary/10 py-1.5 px-3 rounded-lg animate-pulse">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando datos...
            </div>
          )}
        </div>

        {/* --- DESKTOP HEADER --- */}
        <div className="hidden md:block border-b bg-background/80 backdrop-blur-xl sticky top-0 z-30 px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Title & Description */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight">
                  {REPORT_TYPES.find(r => r.id === activeReport)?.label}
                </h1>
                {isFetchingSales && (
                  <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Actualizando
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {REPORT_TYPES.find(r => r.id === activeReport)?.description}
              </p>
            </div>

            {/* Actions & Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />

              <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-xl border border-border/40">
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-transparent border-none w-36">
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos los Clientes</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="w-px h-5 bg-border/50" />

                <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-transparent border-none w-32">
                    <SelectValue placeholder="Método Pago" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos Métodos</SelectItem>
                    {uniquePaymentMethods.map(m => (
                      <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(filterCustomer !== 'all' || filterPaymentMethod !== 'all' || filterCategory !== 'all' || filterUser !== 'all') && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-[11px] font-bold text-destructive hover:bg-destructive/10">
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-muted/20 p-1 rounded-xl border border-border/40">
                <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg gap-1.5" onClick={() => generatePDF()} title="Descargar PDF">
                  <FileText className="h-4 w-4" />
                  <span className="hidden xl:inline">PDF</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 rounded-lg gap-1.5" onClick={() => generateExcel()} title="Descargar Excel">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden xl:inline">Excel</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-bold text-blue-600 hover:bg-blue-500/10 rounded-lg gap-1.5" onClick={() => setIsEmailDialogOpen(true)} title="Enviar por Correo">
                  <Mail className="h-4 w-4" />
                  <span className="hidden xl:inline">Email</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Display Area */}
        <ScrollArea className="flex-1 p-3 md:p-6 bg-muted/5">
          <div className="max-w-6xl mx-auto space-y-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>

      {/* --- Dialogs --- */}
      <Dialog open={!!selectedClosing} onOpenChange={(open) => !open && setSelectedClosing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalles de Cierre de Caja</DialogTitle>
            <DialogDescription>
              {selectedClosing && `Sesión: ${format(new Date(selectedClosing.created_at), 'dd/MM/yyyy hh:mm a')}`}
            </DialogDescription>
          </DialogHeader>
          {selectedClosing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Fondo Inicial</p>
                  <p className="font-bold">RD$ {selectedClosing.initial_cash?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Ventas Efectivo</p>
                  <p className="font-bold">RD$ {selectedClosing.total_sales_cash.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">Total Entradas</p>
                  <p className="font-bold text-green-700">RD$ {(selectedClosing.total_cash_in as number)?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-700">Total Salidas</p>
                  <p className="font-bold text-red-700">RD$ {(selectedClosing.total_cash_out as number)?.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Movimientos de esta Sesión
                </h4>
                <ScrollArea className="h-[250px] border rounded-md p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getClosingMovements(selectedClosing).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No hubo movimientos extras en esta sesión.
                          </TableCell>
                        </TableRow>
                      ) : (
                        getClosingMovements(selectedClosing).map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{format(new Date(m.created_at), 'hh:mm a')}</TableCell>
                            <TableCell>
                              {m.type === 'deposit' ?
                                <span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> Entrada</span> :
                                <span className="text-red-600 text-xs font-bold flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> Salida</span>
                              }
                            </TableCell>
                            <TableCell className="text-xs">{m.reason}</TableCell>
                            <TableCell className="text-xs font-bold text-right">RD$ {m.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Factura #{selectedSale?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              {selectedSale && format(new Date(selectedSale.created_at), 'PPP pp', { locale: es })}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">Cliente:</span>
                  <p>{selectedSale.customer?.name || 'Cliente Final'}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Atendido por:</span>
                  <p>{selectedSale.profile?.full_name || 'Desconocido'}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Método Pago:</span>
                  <p className="capitalize">{selectedSale.payment_method}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Estado:</span>
                  <p className="capitalize">{selectedSale.status}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.sale_items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">${item.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end space-y-1 flex-col items-end pt-2">
                <div className="flex justify-between w-48 text-sm">
                  <span>Subtotal:</span>
                  <span>${(selectedSale.subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-48 text-sm">
                  <span>Impuestos:</span>
                  <span>${(selectedSale.tax_total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-48 font-bold text-lg border-t pt-1 mt-1">
                  <span>Total:</span>
                  <span>${selectedSale.total.toLocaleString()}</span>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => handlePrintInvoice(selectedSale!)}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button variant="outline" onClick={() => generateInvoicePDF(selectedSale!)}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button onClick={() => setSelectedSale(null)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDailySalesDate} onOpenChange={(open) => !open && setSelectedDailySalesDate(null)}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 text-zinc-100 p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Resumen Diario: {selectedDailySalesDate && format(new Date(selectedDailySalesDate + 'T00:00:00'), "dd 'de' MMMM, yyyy", { locale: es })}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Desglose detallado de transacciones, métodos de pago y productos vendidos para este día.
            </DialogDescription>
          </DialogHeader>

          {selectedDailySalesDate && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Facturado</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                      ${daySales.reduce((acc, curr) => acc + curr.total, 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Transacciones</p>
                    <p className="text-xl sm:text-2xl font-black text-white mt-1">
                      {daySales.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ticket Promedio</p>
                    <p className="text-xl sm:text-2xl font-black text-teal-400 mt-1">
                      ${daySales.length > 0 
                        ? (daySales.reduce((acc, curr) => acc + curr.total, 0) / daySales.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                        : '0'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Impuestos (ITBIS)</p>
                    <p className="text-xl sm:text-2xl font-black text-zinc-300 mt-1">
                      ${daySales.reduce((acc, curr) => acc + (curr.tax_total || 0), 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: Payments & Top Products */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Payment Methods */}
                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold text-zinc-200">Métodos de Pago</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {(() => {
                        const payments = { cash: 0, card: 0, transfer: 0, other: 0 };
                        daySales.forEach(s => {
                          const m = s.payment_method?.toLowerCase() || 'cash';
                          if (m === 'cash' || m === 'efectivo') payments.cash += s.total;
                          else if (m === 'card' || m === 'tarjeta') payments.card += s.total;
                          else if (m === 'transfer' || m === 'transferencia') payments.transfer += s.total;
                          else payments.other += s.total;
                        });
                        const grandTotal = Object.values(payments).reduce((a, b) => a + b, 0) || 1;
                        
                        return (
                          <>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-400">Efectivo</span>
                                <span className="font-semibold text-white">${payments.cash.toLocaleString()} ({(payments.cash / grandTotal * 100).toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(payments.cash / grandTotal * 100)}%` }} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-400">Tarjeta</span>
                                <span className="font-semibold text-white">${payments.card.toLocaleString()} ({(payments.card / grandTotal * 100).toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(payments.card / grandTotal * 100)}%` }} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-400">Transferencia</span>
                                <span className="font-semibold text-white">${payments.transfer.toLocaleString()} ({(payments.transfer / grandTotal * 100).toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(payments.transfer / grandTotal * 100)}%` }} />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Top Products */}
                  <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold text-zinc-200">Productos Más Vendidos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                        {dayProducts.length === 0 ? (
                          <p className="text-xs text-zinc-500 text-center py-4">No hay datos de productos.</p>
                        ) : (
                          dayProducts.slice(0, 10).map((prod, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-zinc-900/60 rounded-lg border border-zinc-800/40">
                              <span className="truncate max-w-[150px] font-medium text-zinc-300">{prod.name}</span>
                              <div className="flex gap-4 items-center">
                                <span className="text-zinc-500">x{prod.quantity}</span>
                                <span className="font-bold text-zinc-200">${prod.total.toLocaleString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                </div>

                {/* Right side: Detailed Transaction List */}
                <div className="lg:col-span-7">
                  <Card className="bg-zinc-900/40 border-zinc-800 h-full">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold text-zinc-200 flex items-center justify-between">
                        <span>Listado de Facturas</span>
                        <span className="text-xs font-normal text-zinc-500">{daySales.length} comprobantes</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="max-h-[350px] overflow-y-auto pr-1">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-xs text-zinc-400 py-2">Factura</TableHead>
                              <TableHead className="text-xs text-zinc-400 py-2">Cliente</TableHead>
                              <TableHead className="text-xs text-zinc-400 py-2 text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {daySales.map((sale, sIdx) => (
                              <TableRow 
                                key={sIdx} 
                                className="border-zinc-800/60 hover:bg-zinc-900/60 cursor-pointer transition-colors"
                                onClick={() => setSelectedSale(sale)}
                              >
                                <TableCell className="py-2.5">
                                  <div className="font-semibold text-xs text-white">#{sale.invoice_number || 'N/A'}</div>
                                  <div className="text-[10px] text-zinc-500">{format(new Date(sale.created_at), 'hh:mm a')}</div>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-zinc-300">
                                  {sale.customer?.name || 'Cliente Final'}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-black text-xs text-emerald-400">
                                  ${sale.total.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCustomerForDebt} onOpenChange={(open) => !open && setSelectedCustomerForDebt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Facturas Pendientes: {selectedCustomerForDebt?.name}</DialogTitle>
            <DialogDescription>
              Deuda Total Calculada: <strong className="text-red-600">${(selectedCustomerForDebt?.credit_used || 0).toLocaleString()}</strong>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Total Factura</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Balance Restante</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerPendingSales.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay detalle de facturas (posible deuda antigua sin factura en sistema).</TableCell></TableRow>
                ) : (
                  customerPendingSales.map(s => {
                    const balance = s.total - (s.amount_paid || 0);
                    return (
                      <TableRow key={s.id} onClick={() => setSelectedSale(s)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{format(new Date(s.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{s.invoice_number}</TableCell>
                        <TableCell className="text-right">${s.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${(s.amount_paid || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">${balance.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10"
                              onClick={() => setSelectedSale(s)}
                              title="Ver Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handlePrintInvoice(s)}
                              title="Imprimir Factura"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => generateInvoicePDF(s)}
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter className="mt-4 border-t pt-4 flex justify-between items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => handlePrintCustomerDebt(selectedCustomerForDebt, customerPendingSales)}
              >
                <Printer className="mr-2 h-4 w-4" /> Imprimir Estado de Cuenta
              </Button>
              <Button
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => generateCustomerDebtPDF(selectedCustomerForDebt, customerPendingSales)}
              >
                <Download className="mr-2 h-4 w-4" /> Descargar Todo
              </Button>
            </div>
            <Button variant="outline" onClick={() => setSelectedCustomerForDebt(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Reporte por Correo</DialogTitle>
            <DialogDescription>
              Se enviará el reporte actual ({REPORT_TYPES.find(r => r.id === activeReport)?.label}) a la dirección indicada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                placeholder="ejemplo@empresa.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- INVOICE ACTION MODAL (New Design) --- */}
      <Dialog open={!!selectedActionSale} onOpenChange={(open) => !open && setSelectedActionSale(null)}>
        <DialogContent className="max-w-md bg-[#1a1f2e] text-white border-gray-800 p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1f2e] p-6 pb-2 border-b border-gray-800 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Printer className="h-5 w-5 text-green-500" />
                </div>
                Opciones de Factura
              </h2>
              <p className="text-gray-400 text-sm mt-1 ml-10">Seleccione una acción para continuar</p>
            </div>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10" onClick={() => setSelectedActionSale(null)}>
              <XCircle className="h-6 w-6" />
            </Button>
          </div>

          {selectedActionSale && (
            <div className="p-6 space-y-4">

              {/* Resumen Card */}
              <div className="bg-[#252a3b] rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm text-center mb-1">Total de la Factura</p>
                <p className="text-3xl font-bold text-green-500 text-center">${selectedActionSale.total.toLocaleString()}</p>
              </div>

              {/* Factura Info */}
              <div className="bg-[#252a3b] rounded-xl p-3 border border-gray-700 flex justify-between items-center px-6">
                <span className="text-gray-400 text-sm">Factura Nº</span>
                <span className="font-mono font-bold text-white text-lg tracking-wider">{selectedActionSale.invoice_number || '---'}</span>
              </div>

              {/* Printer Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <Printer className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-300">Tamaño de papel: <span className="text-green-500">80mm</span></p>
                  <p className="text-xs text-gray-500">Para cambiar, ve a Settings → Impresión</p>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="space-y-3 pt-2">
                <Button
                  className="w-full h-14 justify-start px-4 text-base bg-[#252a3b] hover:bg-[#2d3345] border border-green-500/30 hover:border-green-500 text-white group transition-all"
                  onClick={() => handlePrintInvoice(selectedActionSale)}
                >
                  <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center mr-4 group-hover:bg-green-500/30 transition-colors">
                    <Printer className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">Imprimir directamente</span>
                    <span className="text-xs text-gray-400 font-normal">Enviar a la impresora predeterminada</span>
                  </div>
                </Button>

                <Button
                  className="w-full h-14 justify-start px-4 text-base bg-[#252a3b] hover:bg-[#2d3345] border border-blue-500/30 hover:border-blue-500 text-white group transition-all"
                  onClick={() => generateInvoicePDF(selectedActionSale)}
                >
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center mr-4 group-hover:bg-blue-500/30 transition-colors">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">Generar PDF</span>
                    <span className="text-xs text-gray-400 font-normal">Descargar archivo digital</span>
                  </div>
                </Button>

                <Button
                  className="w-full h-14 justify-start px-4 text-base bg-[#252a3b] hover:bg-[#2d3345] border border-purple-500/30 hover:border-purple-500 text-white group transition-all"
                  onClick={() => {
                    setSelectedActionSale(null);
                    setIsEmailDialogOpen(true);
                  }}
                >
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center mr-4 group-hover:bg-purple-500/30 transition-colors">
                    <Mail className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">Enviar por correo</span>
                    <span className="text-xs text-gray-400 font-normal">Compartir con el cliente</span>
                  </div>
                </Button>
              </div>

              <Button variant="ghost" className="w-full text-gray-500 hover:text-white hover:bg-white/5" onClick={() => setSelectedActionSale(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;