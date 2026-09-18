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

    const headers = ['Nombre', 'RNC', 'Teléfono', 'Contacto', 'Método Pago', 'Banco', 'No. Cuenta', 'Tipo Cuenta', 'Deuda Pendiente'];
    const rows = filteredSuppliers.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.rnc || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.contact || '').replace(/"/g, '""')}"`,
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
    <div className="space-y-6 animate-fade-in pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Proveedores
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gestión de cuentas por pagar, compras, facturación y catálogo bancario.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl h-11 px-3.5 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted"
            title="Exportar a CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button
            onClick={handleOpenCreateSupplier}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11 px-5 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 gap-2 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Proveedores */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm shadow-xs hover:border-emerald-500/30 transition-all">
          <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Total Proveedores
            </CardTitle>
            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black tracking-tight text-foreground">{stats.totalSuppliers}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Empresas registradas</p>
          </CardContent>
        </Card>

        {/* Con Deuda Pendiente */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm shadow-xs hover:border-red-500/30 transition-all">
          <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-red-500">
              Con Cuentas por Pagar
            </CardTitle>
            <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black tracking-tight text-red-500">{stats.withDebtCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Proveedores con saldo</p>
          </CardContent>
        </Card>

        {/* Deuda Total Acumulada */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm shadow-xs hover:border-red-500/30 transition-all">
          <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-red-500">
              Deuda Total por Pagar
            </CardTitle>
            <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black tracking-tight text-red-500 font-mono">
              RD$ {stats.totalOutstanding.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pendiente de saldar</p>
          </CardContent>
        </Card>

        {/* Compras / Egresos Realizados */}
        <Card className="bg-card/60 border-border/40 backdrop-blur-sm shadow-xs hover:border-blue-500/30 transition-all">
          <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-blue-500">
              Total Compras Pagadas
            </CardTitle>
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black tracking-tight text-blue-500 font-mono">
              RD$ {stats.totalSpentWithSuppliers.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Egresos amortizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls: Search and Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, RNC, banco, número de cuenta o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-9 h-11 bg-card/70 border-border/50 rounded-2xl text-xs font-medium focus-visible:ring-emerald-500/30"
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

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/40 shrink-0 w-full sm:w-auto justify-center">
          <Button
            size="sm"
            variant={debtFilter === 'all' ? 'default' : 'ghost'}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all ${
              debtFilter === 'all'
                ? 'bg-background shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setDebtFilter('all')}
          >
            Todos ({suppliers.length})
          </Button>
          <Button
            size="sm"
            variant={debtFilter === 'with_debt' ? 'default' : 'ghost'}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all ${
              debtFilter === 'with_debt'
                ? 'bg-red-500/10 text-red-500 border border-red-500/30 shadow-xs'
                : 'text-muted-foreground hover:text-red-500'
            }`}
            onClick={() => setDebtFilter('with_debt')}
          >
            Con Deuda ({stats.withDebtCount})
          </Button>
          <Button
            size="sm"
            variant={debtFilter === 'no_debt' ? 'default' : 'ghost'}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all ${
              debtFilter === 'no_debt'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-xs'
                : 'text-muted-foreground hover:text-emerald-500'
            }`}
            onClick={() => setDebtFilter('no_debt')}
          >
            Al Día ({suppliers.length - stats.withDebtCount})
          </Button>
        </div>
      </div>

      {/* Directory Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
          <p className="text-xs font-semibold">Cargando directorio de proveedores...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-muted/20 border border-border/40 rounded-3xl">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No se encontraron proveedores</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchTerm || debtFilter !== 'all'
              ? 'Prueba con otros términos de búsqueda o ajusta los filtros seleccionados.'
              : 'Aún no has registrado ningún proveedor. Agrega el primero con el botón superior.'}
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
      ) : (
        <div className="rounded-3xl border border-border/50 overflow-hidden bg-card shadow-sm">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 pl-5">
                  Proveedor
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                  RNC / Cédula
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                  Contacto / Teléfono
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 text-right">
                  Cuentas por Pagar
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 text-center pr-5">
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
                    <TableCell className="py-4 pl-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black shadow-xs ${
                            hasDebt
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}
                        >
                          {supplier.name?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
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
                                  className="p-1 hover:text-primary transition-colors"
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
                    <TableCell className="py-4 font-mono text-xs text-muted-foreground">
                      {supplier.rnc || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Contacto y Teléfono */}
                    <TableCell className="py-4 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        {supplier.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground font-mono flex items-center gap-1">
                              <Phone className="h-3 w-3 text-emerald-500" />
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
                        ) : null}

                        {supplier.contact ? (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {supplier.contact}
                          </span>
                        ) : null}

                        {!supplier.phone && !supplier.contact && (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Cuentas por Pagar (Deuda) */}
                    <TableCell className="py-4 text-right">
                      {hasDebt ? (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 text-sm font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-xl font-mono">
                            ${outstanding.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider mt-0.5">
                            Por Pagar
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-xl">
                          <CheckCircle className="h-3.5 w-3.5" /> Al Día
                        </span>
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-4 pr-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-red-500 hover:bg-red-500/10"
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
                          <Eye className="h-3.5 w-3.5 text-primary" /> Ficha
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
