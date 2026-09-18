import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  Landmark,
  Copy,
  Receipt,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  TrendingDown,
  DollarSign,
  Loader2,
  X,
  MessageCircle,
  Download,
  LayoutGrid,
  List,
  CreditCard,
  User,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSuppliers, Supplier } from '@/hooks/useSuppliers';
import { useSupplierDebts, SupplierDebt } from '@/hooks/useSupplierDebts';
import { useExpenses } from '@/hooks/useExpenses';
import { useToast } from '@/hooks/use-toast';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { SupplierDebtDialog } from '@/components/suppliers/SupplierDebtDialog';
import { SupplierPayDialog } from '@/components/suppliers/SupplierPayDialog';
import { SupplierDetailsDialog } from '@/components/suppliers/SupplierDetailsDialog';

export const Suppliers: React.FC = () => {
  const { toast } = useToast();

  // Queries and mutations
  const {
    suppliers,
    isLoading: loadingSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();

  const {
    supplierDebts,
    isLoading: loadingDebts,
    createSupplierDebt,
    paySupplierDebt,
    deleteSupplierDebt,
  } = useSupplierDebts();

  const { expenses } = useExpenses();

  // State: Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debtFilter, setDebtFilter] = useState<'all' | 'with_debt' | 'no_debt'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // State: Dialogs
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [selectedSupplierForDebt, setSelectedSupplierForDebt] = useState<Supplier | null>(null);

  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<SupplierDebt | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedSupplierForDetails, setSelectedSupplierForDetails] = useState<Supplier | null>(null);

  // Helper: Get outstanding debt for a supplier
  const getSupplierOutstandingDebt = (supplierId: string) => {
    const debts = supplierDebts.filter((d) => d.supplier_id === supplierId);
    return debts.reduce((sum, d) => sum + Math.max(0, Number(d.amount || 0) - Number(d.amount_paid || 0)), 0);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    let withDebtCount = 0;
    let totalOutstanding = 0;

    suppliers.forEach((s) => {
      const debt = getSupplierOutstandingDebt(s.id);
      if (debt > 0) {
        withDebtCount++;
        totalOutstanding += debt;
      }
    });

    // Total expenses with suppliers
    const totalSpentWithSuppliers = expenses.reduce((sum, e) => {
      if (e.supplier_id || (e.supplier_name && e.supplier_name !== 'Sin Proveedor' && e.supplier_name !== 'N/A')) {
        return sum + Number(e.amount || 0);
      }
      return sum;
    }, 0);

    return {
      totalSuppliers,
      withDebtCount,
      totalOutstanding,
      totalSpentWithSuppliers,
    };
  }, [suppliers, supplierDebts, expenses]);

  // Filtered suppliers list
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return suppliers
      .filter((s) => {
        const matchesSearch =
          !term ||
          s.name?.toLowerCase().includes(term) ||
          (s.rnc || '').toLowerCase().includes(term) ||
          (s.contact || '').toLowerCase().includes(term) ||
          (s.phone || '').toLowerCase().includes(term) ||
          (s.contact_phone || '').toLowerCase().includes(term) ||
          (s.bank_name || '').toLowerCase().includes(term) ||
          (s.bank_account_number || '').toLowerCase().includes(term);

        if (!matchesSearch) return false;

        const debt = getSupplierOutstandingDebt(s.id);
        if (debtFilter === 'with_debt') return debt > 0;
        if (debtFilter === 'no_debt') return debt === 0;

        return true;
      })
      .sort((a, b) => {
        // Suppliers with debt first, then alphabetical
        const debtA = getSupplierOutstandingDebt(a.id);
        const debtB = getSupplierOutstandingDebt(b.id);
        if (debtB !== debtA) return debtB - debtA;
        return a.name.localeCompare(b.name);
      });
  }, [suppliers, supplierDebts, searchTerm, debtFilter]);

  // Actions
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setIsSupplierDialogOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsSupplierDialogOpen(true);
  };

  const handleSaveSupplier = async (supplierData: Omit<Supplier, 'id' | 'created_at'>) => {
    if (editingSupplier) {
      await updateSupplier({ id: editingSupplier.id, ...supplierData });
    } else {
      await createSupplier(supplierData);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    const outstanding = getSupplierOutstandingDebt(supplier.id);
    if (outstanding > 0) {
      if (
        !window.confirm(
          `¡Atención! "${supplier.name}" tiene una deuda pendiente de RD$ ${outstanding.toLocaleString()}. ¿Realmente deseas eliminar este proveedor?`
        )
      ) {
        return;
      }
    } else {
      if (!window.confirm(`¿Estás seguro de que deseas eliminar al proveedor "${supplier.name}"?`)) {
        return;
      }
    }

    try {
      await deleteSupplier(supplier.id);
    } catch (error: any) {
      console.error('Error al borrar proveedor:', error);
    }
  };

  const handleOpenAddDebt = (supplier: Supplier) => {
    setSelectedSupplierForDebt(supplier);
    setIsDebtDialogOpen(true);
  };

  const handleOpenPayDebt = (debt: SupplierDebt) => {
    setSelectedDebtForPayment(debt);
    setIsPayDialogOpen(true);
  };

  const handleOpenViewDetails = (supplier: Supplier) => {
    setSelectedSupplierForDetails(supplier);
    setIsDetailsDialogOpen(true);
  };

  const handleCopyBankAccount = (accountNum: string) => {
    navigator.clipboard.writeText(accountNum);
    toast({
      title: "Cuenta copiada",
      description: `Número ${accountNum} copiado al portapapeles.`,
    });
  };

  const cleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
  };

  const handleExportCSV = () => {
    if (filteredSuppliers.length === 0) {
      toast({ title: "No hay datos", description: "No hay proveedores para exportar.", variant: "destructive" });
      return;
    }

    const headers = ['Nombre', 'RNC', 'Tel. Empresa', 'Contacto', 'Tel. Contacto', 'Método Pago', 'Banco', 'No. Cuenta', 'Tipo Cuenta', 'Deuda Pendiente'];
    const rows = filteredSuppliers.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.rnc || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.contact || '').replace(/"/g, '""')}"`,
      `"${(s.contact_phone || '').replace(/"/g, '""')}"`,
      s.payment_method === 'transfer' ? 'Transferencia' : 'Efectivo',
      `"${(s.bank_name || '').replace(/"/g, '""')}"`,
      `"${(s.bank_account_number || '').replace(/"/g, '""')}"`,
      s.bank_account_type || '',
      getSupplierOutstandingDebt(s.id).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `proveedores_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Archivo exportado", description: "El catálogo de proveedores fue descargado." });
  };

  const isLoading = loadingSuppliers || loadingDebts;

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-7xl mx-auto px-3 sm:px-5">
      {/* Centered Premium Header (Estilo Inventario) */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6 sm:gap-8 py-4 sm:py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Proveedores
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Gestión de Catálogo y Cuentas por Pagar
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-8 sm:px-12 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95"
            onClick={handleOpenCreateSupplier}
          >
            <Plus className="h-5 w-5" />
            Nuevo Proveedor
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleExportCSV}
            className="rounded-2xl h-14 px-6 text-xs font-black uppercase tracking-widest gap-2 border-border/60 hover:bg-muted"
            title="Exportar proveedores a CSV"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Proveedores */}
        <Card
          onClick={() => setDebtFilter('all')}
          className={`bg-card/70 border-border/50 backdrop-blur-sm shadow-xs rounded-2xl cursor-pointer hover:border-emerald-500/40 transition-all ${
            debtFilter === 'all' ? 'ring-1 ring-emerald-500/40 border-emerald-500/40 bg-emerald-500/[0.03]' : ''
          }`}
        >
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total
              </span>
              <div className="p-1.5 bg-muted/80 rounded-xl text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground mt-1">
              {stats.totalSuppliers}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Empresas registradas</p>
          </CardContent>
        </Card>

        {/* Con Deuda Pendiente */}
        <Card
          onClick={() => setDebtFilter('with_debt')}
          className={`bg-card/70 border-border/50 backdrop-blur-sm shadow-xs rounded-2xl cursor-pointer hover:border-rose-500/40 transition-all ${
            debtFilter === 'with_debt' ? 'ring-1 ring-rose-500/40 border-rose-500/40 bg-rose-500/[0.03]' : ''
          }`}
        >
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                stats.withDebtCount > 0 ? 'text-rose-500' : 'text-muted-foreground'
              }`}>
                Con Deuda
              </span>
              <div className={`p-1.5 rounded-xl ${
                stats.withDebtCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-muted/80 text-muted-foreground'
              }`}>
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className={`text-2xl font-black tracking-tight mt-1 ${
              stats.withDebtCount > 0 ? 'text-rose-500' : 'text-foreground'
            }`}>
              {stats.withDebtCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.withDebtCount > 0 ? 'Con saldo pendiente' : 'Sin saldos pendientes'}
            </p>
          </CardContent>
        </Card>

        {/* Deuda Total Acumulada */}
        <Card
          onClick={() => setDebtFilter('with_debt')}
          className={`bg-card/70 border-border/50 backdrop-blur-sm shadow-xs rounded-2xl cursor-pointer hover:border-amber-500/40 transition-all ${
            debtFilter === 'with_debt' ? 'ring-1 ring-amber-500/40 border-amber-500/40 bg-amber-500/[0.03]' : ''
          }`}
        >
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                stats.totalOutstanding > 0 ? 'text-amber-500' : 'text-muted-foreground'
              }`}>
                Por Pagar
              </span>
              <div className={`p-1.5 rounded-xl ${
                stats.totalOutstanding > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                {stats.totalOutstanding > 0 ? <TrendingDown className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight mt-1 font-mono truncate ${
              stats.totalOutstanding > 0 ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              RD$ {stats.totalOutstanding.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.totalOutstanding > 0 ? 'Monto pendiente' : 'Al día'}
            </p>
          </CardContent>
        </Card>

        {/* Compras / Egresos Realizados */}
        <Card className="bg-card/70 border-border/50 backdrop-blur-sm shadow-xs rounded-2xl">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Pagado
              </span>
              <div className="p-1.5 bg-blue-500/10 rounded-xl text-blue-500">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-blue-500 font-mono mt-1 truncate">
              RD$ {stats.totalSpentWithSuppliers.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Compras amortizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls: Search, Filters, and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedor, RNC, banco o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-9 h-10 bg-card border-border/60 rounded-xl text-xs font-medium focus-visible:ring-emerald-500/30"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters and View Switch */}
        <div className="flex items-center gap-2 justify-between sm:justify-start">
          {/* Status Filter Pills */}
          <div className="inline-flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 text-xs">
            <button
              onClick={() => setDebtFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                debtFilter === 'all'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({suppliers.length})
            </button>
            <button
              onClick={() => setDebtFilter('with_debt')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                debtFilter === 'with_debt'
                  ? 'bg-rose-500/10 text-rose-500 shadow-xs'
                  : 'text-muted-foreground hover:text-rose-500'
              }`}
            >
              Con Deuda ({stats.withDebtCount})
            </button>
            <button
              onClick={() => setDebtFilter('no_debt')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                debtFilter === 'no_debt'
                  ? 'bg-emerald-500/10 text-emerald-500 shadow-xs'
                  : 'text-muted-foreground hover:text-emerald-500'
              }`}
            >
              Al Día ({suppliers.length - stats.withDebtCount})
            </button>
          </div>

          {/* View Mode Toggle (Cards vs Table) */}
          <div className="hidden sm:inline-flex items-center p-1 bg-muted/50 rounded-xl border border-border/50">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista en tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista en tabla"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
          <p className="text-xs font-semibold">Cargando proveedores...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-muted/20 border border-border/40 rounded-3xl">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No se encontraron proveedores</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchTerm || debtFilter !== 'all'
              ? 'Prueba con otros términos de búsqueda o restablece los filtros.'
              : 'Aún no has registrado ningún proveedor. Agrega el primero ahora.'}
          </p>
          {searchTerm || debtFilter !== 'all' ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs font-bold"
              onClick={() => {
                setSearchTerm('');
                setDebtFilter('all');
              }}
            >
              Restablecer Filtros
            </Button>
          ) : (
            <Button
              size="sm"
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-2"
              onClick={handleOpenCreateSupplier}
            >
              <Plus className="h-4 w-4" /> Agregar Primer Proveedor
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= VISTA DE TARJETAS (MÓVIL & DEFAULT) ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredSuppliers.map((supplier) => {
            const outstanding = getSupplierOutstandingDebt(supplier.id);
            const hasDebt = outstanding > 0;
            const isTransfer = (supplier.payment_method || 'transfer') === 'transfer';

            return (
              <div
                key={supplier.id}
                onClick={() => handleOpenViewDetails(supplier)}
                className="bg-card border border-border/50 hover:border-emerald-500/40 rounded-2xl p-4 shadow-xs transition-all hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Accent top line if has debt */}
                {hasDebt && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
                )}

                <div>
                  {/* Top: Avatar, Name, Badges and Debt Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-base font-black shadow-xs ${
                          hasDebt
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}
                      >
                        {supplier.name?.charAt(0).toUpperCase() || 'P'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-foreground group-hover:text-emerald-500 transition-colors truncate">
                          {supplier.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {isTransfer ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              Transferencia
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Efectivo
                            </span>
                          )}

                          {supplier.rnc && (
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                              RNC: {supplier.rnc}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0 text-right">
                      {hasDebt ? (
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-rose-500 font-mono bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20">
                            RD$ {outstanding.toLocaleString('es-DO', { minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mt-1">
                            Por Pagar
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                          <CheckCircle className="h-3 w-3" /> Al Día
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Info: Bank & Contacts */}
                  <div className="mt-3.5 space-y-2">
                    {/* Bank Account Info Box */}
                    {(supplier.bank_name || supplier.bank_account_number) && (
                      <div
                        className="bg-muted/40 rounded-xl p-2.5 border border-border/40 flex items-center justify-between text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground text-[11px] truncate block">
                              {supplier.bank_name || 'Cuenta Bancaria'}
                            </span>
                            {supplier.bank_account_number && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {supplier.bank_account_number}
                                {supplier.bank_account_type ? ` (${supplier.bank_account_type})` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {supplier.bank_account_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyBankAccount(supplier.bank_account_number!)}
                            className="h-7 px-2 rounded-lg text-[10px] font-bold gap-1 text-muted-foreground hover:text-foreground shrink-0 ml-2"
                            title="Copiar número de cuenta"
                          >
                            <Copy className="h-3 w-3" /> Copiar
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Contact & Phone */}
                    {(supplier.phone || supplier.contact || supplier.contact_phone) && (
                      <div
                        className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {supplier.contact ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
                              <User className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate font-medium text-foreground">{supplier.contact}</span>
                            </div>
                          ) : supplier.phone ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span>{supplier.phone}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Direct Contact Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {(supplier.phone || supplier.contact_phone) && (
                            <>
                              <a
                                href={`tel:${cleanPhone(supplier.contact_phone || supplier.phone)}`}
                                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                title="Llamar"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${cleanPhone(supplier.contact_phone || supplier.phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div
                  className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAddDebt(supplier)}
                      className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 text-rose-500 border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/30"
                    >
                      <Plus className="h-3 w-3" /> Deuda
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenViewDetails(supplier)}
                      className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 text-foreground hover:bg-muted"
                    >
                      <Eye className="h-3 w-3 text-emerald-500" /> Ficha
                    </Button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenEditSupplier(supplier)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                      title="Editar proveedor"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                      title="Eliminar proveedor"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= VISTA DE TABLA (DESKTOP) ================= */
        <div className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-xs">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/40">
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 pl-4">
                  Proveedor
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3">
                  RNC / Cédula
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3">
                  Contacto / Teléfono
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 text-right">
                  Cuentas por Pagar
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 text-center pr-4">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
                const outstanding = getSupplierOutstandingDebt(supplier.id);
                const hasDebt = outstanding > 0;
                const isTransfer = (supplier.payment_method || 'transfer') === 'transfer';

                return (
                  <TableRow
                    key={supplier.id}
                    onClick={() => handleOpenViewDetails(supplier)}
                    className="hover:bg-muted/30 transition-colors border-b border-border/30 group cursor-pointer"
                  >
                    {/* Nombre y Datos Bancarios */}
                    <TableCell className="py-3.5 pl-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-xs ${
                            hasDebt
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}
                        >
                          {supplier.name?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground group-hover:text-emerald-500 transition-colors">
                              {supplier.name}
                            </span>
                            {isTransfer ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Transferencia
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Efectivo
                              </span>
                            )}
                          </div>

                          {(supplier.bank_name || supplier.bank_account_number) && (
                            <div
                              className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Landmark className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                              <span className="truncate">
                                {supplier.bank_name || 'Banco'}{' '}
                                {supplier.bank_account_number ? `• ${supplier.bank_account_number}` : ''}
                              </span>
                              {supplier.bank_account_number && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyBankAccount(supplier.bank_account_number!)}
                                  className="p-1 hover:text-emerald-500 transition-colors"
                                  title="Copiar cuenta bancaria"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* RNC */}
                    <TableCell className="py-3.5 font-mono text-xs text-muted-foreground">
                      {supplier.rnc || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Contacto y Teléfono */}
                    <TableCell className="py-3.5 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground font-mono flex items-center gap-1 text-[11px]">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {supplier.phone}
                            </span>
                            <a
                              href={`tel:${cleanPhone(supplier.phone)}`}
                              className="p-1 hover:text-emerald-500 transition-colors"
                              title="Llamar"
                            >
                              <Phone className="h-3 w-3" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhone(supplier.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:text-emerald-500 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        {supplier.contact && (
                          <span className="text-[11px] font-medium text-foreground truncate max-w-[180px]">
                            {supplier.contact}
                          </span>
                        )}

                        {!supplier.phone && !supplier.contact && (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Cuentas por Pagar (Deuda) */}
                    <TableCell className="py-3.5 text-right">
                      {hasDebt ? (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 text-sm font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-xl font-mono">
                            RD$ {outstanding.toLocaleString('es-DO', { minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-0.5">
                            Por Pagar
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl">
                          <CheckCircle className="h-3.5 w-3.5" /> Al Día
                        </span>
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-3.5 pr-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-rose-500 hover:bg-rose-500/10"
                          onClick={() => handleOpenAddDebt(supplier)}
                          title="Registrar Cuenta por Pagar"
                        >
                          <Plus className="h-3.5 w-3.5" /> Deuda
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-foreground hover:bg-muted"
                          onClick={() => handleOpenViewDetails(supplier)}
                          title="Ver Ficha Completa e Historial"
                        >
                          <Eye className="h-3.5 w-3.5 text-emerald-500" /> Ficha
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10"
                          onClick={() => handleOpenEditSupplier(supplier)}
                          title="Editar Proveedor"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSupplier(supplier)}
                          title="Eliminar Proveedor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* MODALS */}
      {/* 1. Create / Edit Supplier Dialog */}
      <SupplierDialog
        open={isSupplierDialogOpen}
        onOpenChange={setIsSupplierDialogOpen}
        supplierToEdit={editingSupplier}
        onSave={handleSaveSupplier}
      />

      {/* 2. Add Debt Dialog */}
      <SupplierDebtDialog
        open={isDebtDialogOpen}
        onOpenChange={setIsDebtDialogOpen}
        supplier={selectedSupplierForDebt}
        onSaveDebt={createSupplierDebt}
      />

      {/* 3. Pay Debt Dialog */}
      <SupplierPayDialog
        open={isPayDialogOpen}
        onOpenChange={setIsPayDialogOpen}
        debt={selectedDebtForPayment}
        onPayDebt={paySupplierDebt}
      />

      {/* 4. Complete Supplier Sheet / Details Dialog */}
      <SupplierDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        supplier={selectedSupplierForDetails}
        debts={supplierDebts}
        expenses={expenses}
        onOpenEdit={(s) => {
          setEditingSupplier(s);
          setIsSupplierDialogOpen(true);
        }}
        onOpenAddDebt={(s) => {
          setSelectedSupplierForDebt(s);
          setIsDebtDialogOpen(true);
        }}
        onOpenPayDebt={(d) => {
          setSelectedDebtForPayment(d);
          setIsPayDialogOpen(true);
        }}
        onDeleteDebt={deleteSupplierDebt}
      />
    </div>
  );
};

export default Suppliers;
