import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2,
  Phone,
  Landmark,
  Copy,
  Receipt,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  FileText,
  ExternalLink,
  Check,
  Calendar,
  MessageCircle,
  Eye,
  Package,
  Search,
  Link2,
  Unlink,
  CheckCircle,
  Loader2,
  FlaskConical,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Supplier } from '@/hooks/useSuppliers';
import { SupplierDebt } from '@/hooks/useSupplierDebts';
import { Expense } from '@/hooks/useExpenses';
import { useRestaurantIngredients } from '@/hooks/useRestaurantInventory';
import { useProductsOffline, Product } from '@/hooks/useProductsOffline';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import ProductForm from '@/components/ProductForm';

interface SupplierDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  debts: SupplierDebt[];
  expenses: Expense[];
  initialTab?: 'overview' | 'debts' | 'expenses' | 'products';
  onOpenEdit: (supplier: Supplier) => void;
  onOpenAddDebt: (supplier: Supplier) => void;
  onOpenPayDebt: (debt: SupplierDebt) => void;
  onDeleteDebt: (debtId: string, description: string) => Promise<any>;
}

export const SupplierDetailsDialog: React.FC<SupplierDetailsDialogProps> = ({
  open,
  onOpenChange,
  supplier,
  debts,
  expenses,
  initialTab = 'overview',
  onOpenEdit,
  onOpenAddDebt,
  onOpenPayDebt,
  onDeleteDebt,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProductsOffline();
  const { data: allIngredients = [] } = useRestaurantIngredients();
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'overview' | 'debts' | 'expenses' | 'products'>(initialTab);
  const [productSearch, setProductSearch] = useState('');

  // Estados para vincular productos del inventario y formulario
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [linkingSearch, setLinkingSearch] = useState('');
  const [linkingFilter, setLinkingFilter] = useState<'unassigned' | 'all'>('unassigned');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSavingLinking, setIsSavingLinking] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setCurrentTab(initialTab);
      setProductSearch('');
    }
  }, [open, initialTab]);

  if (!supplier) return null;

  const supplierDebts = debts.filter((d) => d.supplier_id === supplier.id);
  const totalDebt = supplierDebts.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalPaid = supplierDebts.reduce((sum, d) => sum + Number(d.amount_paid || 0), 0);
  const outstandingDebt = Math.max(0, totalDebt - totalPaid);
  const hasDebt = outstandingDebt > 0;

  const supplierExpenses = expenses.filter(
    (e) =>
      e.supplier_id === supplier.id ||
      (e.supplier_name && e.supplier_name.toLowerCase().trim() === supplier.name.toLowerCase().trim())
  );
  const totalExpensesAmount = supplierExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const supplierProducts = useMemo(() => {
    if (!supplier) return [];
    return products.filter((p) => p.supplier_id === supplier.id);
  }, [products, supplier]);

  const supplierIngredients = useMemo(() => {
    if (!supplier) return [];
    return allIngredients.filter((i) => i.supplier_id === supplier.id);
  }, [allIngredients, supplier]);

  const filteredSupplierProducts = useMemo(() => {
    if (!productSearch.trim()) return supplierProducts;
    const q = productSearch.toLowerCase().trim();
    return supplierProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q))
    );
  }, [supplierProducts, productSearch]);

  const supplierInventoryValue = useMemo(() => {
    return supplierProducts.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.cost || 0), 0);
  }, [supplierProducts]);

  // Candidatos a vincular desde inventario general
  const candidateProducts = useMemo(() => {
    if (!supplier) return [];
    let list = products.filter((p) => p.supplier_id !== supplier.id);

    if (linkingFilter === 'unassigned') {
      list = list.filter((p) => !p.supplier_id);
    }

    if (linkingSearch.trim()) {
      const q = linkingSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.internal_code && p.internal_code.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, supplier, linkingFilter, linkingSearch]);

  const handleUnlinkProduct = async (product: Product) => {
    if (!supplier) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ supplier_id: null })
        .eq('id', product.id);

      if (error) throw error;

      const updated = { ...product, supplier_id: null, supplier: undefined };
      await offlineDB.put(OfflineStore.PRODUCTS, updated);
      await queryClient.invalidateQueries({ queryKey: ['products'] });

      toast({
        title: 'Producto desvinculado',
        description: `"${product.name}" ya no está asignado a ${supplier.name}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al desvincular',
        description: error.message || 'No se pudo desvincular el producto.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveLinking = async () => {
    if (!supplier || selectedProductIds.size === 0) return;
    setIsSavingLinking(true);
    try {
      const idsArray = Array.from(selectedProductIds);
      const { error } = await supabase
        .from('products')
        .update({ supplier_id: supplier.id })
        .in('id', idsArray);

      if (error) throw error;

      for (const id of idsArray) {
        const prod = products.find((p) => p.id === id);
        if (prod) {
          const updated = {
            ...prod,
            supplier_id: supplier.id,
            supplier: { id: supplier.id, name: supplier.name },
          };
          await offlineDB.put(OfflineStore.PRODUCTS, updated);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });

      toast({
        title: 'Productos vinculados',
        description: `Se han vinculado ${idsArray.length} producto(s) a ${supplier.name}.`,
      });

      setSelectedProductIds(new Set());
      setIsLinkingModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error al vincular',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingLinking(false);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCandidates = () => {
    if (selectedProductIds.size === candidateProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(candidateProducts.map((p) => p.id)));
    }
  };

  const isTransfer = (supplier.payment_method || 'transfer') === 'transfer';

  const handleCopyAccount = () => {
    if (!supplier.bank_account_number) return;
    navigator.clipboard.writeText(supplier.bank_account_number);
    setCopiedAccount(true);
    toast({
      title: "Cuenta copiada",
      description: `Número ${supplier.bank_account_number} copiado al portapapeles.`,
    });
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[780px] max-h-[88vh] overflow-y-auto rounded-3xl border border-border/60 p-0 overflow-hidden bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>{supplier.name}</DialogTitle>
            <DialogDescription>Ficha completa del proveedor, productos asociados y deudas</DialogDescription>
          </DialogHeader>
          {/* Header Banner */}
          <div className="p-5 sm:p-6 bg-muted/40 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`h-13 w-13 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 ${
                    hasDebt
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {supplier.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-foreground tracking-tight">{supplier.name}</h2>
                    {isTransfer ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] font-bold">
                        💳 Transferencia
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-bold">
                        💵 Efectivo
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>
                      RNC / Cédula: <strong className="font-mono text-foreground">{supplier.rnc || 'N/A'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Deuda Pendiente:{' '}
                      {hasDebt ? (
                        <span className="text-red-500 font-black">
                          RD$ {outstandingDebt.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-emerald-500 font-bold">Al Día (Sin Deuda)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenEdit(supplier);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-500" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="h-9 px-3.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white gap-1.5 shadow-sm"
                  onClick={() => onOpenAddDebt(supplier)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva Deuda
                </Button>
              </div>
            </div>

            {/* Quick Contact & Bank Bar */}
            <div className="mt-4 pt-3.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Phone Empresa */}
              <div className="flex items-center gap-2 bg-background/60 p-2.5 rounded-xl border border-border/40">
                <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Tel. Empresa</span>
                  <span className="font-bold truncate font-mono block text-xs">
                    {supplier.phone || 'No especificado'}
                  </span>
                </div>
                {supplier.phone && (
                  <div className="flex gap-1">
                    <a
                      href={`tel:${getCleanPhone(supplier.phone)}`}
                      className="p-1.5 bg-muted/60 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                      title="Llamar a Empresa"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${getCleanPhone(supplier.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-muted/60 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                      title="WhatsApp Empresa"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Contact & Contact Phone */}
              <div className="flex items-center gap-2 bg-background/60 p-2.5 rounded-xl border border-border/40">
                <MessageCircle className="h-4 w-4 text-teal-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Contacto: {supplier.contact || 'No registrado'}
                  </span>
                  <span className="font-bold truncate font-mono block text-xs">
                    {supplier.contact_phone || (supplier.contact ? 'Sin teléfono directo' : 'No especificado')}
                  </span>
                </div>
                {supplier.contact_phone && (
                  <div className="flex gap-1">
                    <a
                      href={`tel:${getCleanPhone(supplier.contact_phone)}`}
                      className="p-1.5 bg-muted/60 hover:bg-teal-500/10 text-teal-500 rounded-lg transition-colors"
                      title="Llamar al Contacto"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${getCleanPhone(supplier.contact_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-muted/60 hover:bg-teal-500/10 text-teal-500 rounded-lg transition-colors"
                      title="WhatsApp al Contacto"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Bank Account */}
              <div className="flex items-center gap-2 bg-background/60 p-2.5 rounded-xl border border-border/40">
                <Landmark className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cuenta Bancaria</span>
                  <span className="font-mono font-bold truncate block text-xs">
                    {supplier.bank_name ? `${supplier.bank_name} • ` : ''}
                    {supplier.bank_account_number || 'Sin cuenta'}
                  </span>
                </div>
                {supplier.bank_account_number && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] font-bold rounded-lg text-primary hover:bg-primary/10 gap-1 shrink-0"
                    onClick={handleCopyAccount}
                  >
                    {copiedAccount ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedAccount ? 'Copiado' : 'Copiar'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Body Tabs */}
          <div className="p-5 sm:p-6 space-y-4">
            <Tabs value={currentTab} onValueChange={(val) => setCurrentTab(val as any)} className="w-full">
              <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/40 h-9 w-fit flex items-center gap-1 mb-4 flex-wrap">
                <TabsTrigger value="overview" className="rounded-lg px-3.5 h-7 text-xs font-bold gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Productos y Deudas
                </TabsTrigger>
                <TabsTrigger value="products" className="rounded-lg px-3.5 h-7 text-xs font-bold gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  Productos {supplierIngredients.length > 0 ? `e Ingredientes (${supplierProducts.length + supplierIngredients.length})` : `(${supplierProducts.length})`}
                </TabsTrigger>
                <TabsTrigger value="debts" className="rounded-lg px-3.5 h-7 text-xs font-bold">
                  Solo Deudas ({supplierDebts.length})
                </TabsTrigger>
                <TabsTrigger value="expenses" className="rounded-lg px-3.5 h-7 text-xs font-bold">
                  Historial de Pagos ({supplierExpenses.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab Principal Unificado: Productos y Deudas Juntos */}
              <TabsContent value="overview" className="space-y-6 outline-none">
                {/* 1. SECCIÓN DE CUENTAS POR PAGAR (DEUDAS) */}
                <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-rose-500" />
                      <h3 className="text-sm font-black text-foreground">Cuentas por Pagar</h3>
                      {hasDebt ? (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-bold">
                          RD$ {outstandingDebt.toLocaleString('es-DO', { minimumFractionDigits: 2 })} Pendiente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-bold">
                          Al Día
                        </Badge>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenAddDebt(supplier)}
                      className="h-8 text-xs font-bold gap-1 rounded-xl text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
                    >
                      <Plus className="h-3.5 w-3.5" /> Registrar Deuda
                    </Button>
                  </div>

                  {supplierDebts.length === 0 ? (
                    <div className="p-3.5 bg-muted/20 rounded-xl border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>No hay deudas ni facturas pendientes registradas con este proveedor.</span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="text-xs font-bold py-2">Concepto / Vencimiento</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Monto</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Pagado</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Pendiente</TableHead>
                            <TableHead className="text-center text-xs font-bold py-2">Estado</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierDebts.map((debt) => {
                            const rem = Math.max(0, Number(debt.amount) - Number(debt.amount_paid));
                            const isPaid = debt.status === 'paid' || rem <= 0;
                            return (
                              <TableRow key={debt.id} className="hover:bg-muted/20">
                                <TableCell className="py-2 text-xs">
                                  <span className="font-bold text-foreground block">{debt.description}</span>
                                  <span className="text-[10px] text-muted-foreground">{debt.category}</span>
                                </TableCell>
                                <TableCell className="py-2 text-right text-xs font-mono font-semibold">
                                  ${Number(debt.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2 text-right text-xs font-mono text-emerald-500 font-semibold">
                                  ${Number(debt.amount_paid).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2 text-right text-xs font-mono text-red-500 font-black">
                                  ${rem.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  {isPaid ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold">
                                      Pagado
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-bold">
                                      Pendiente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  {!isPaid && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[10px] font-bold gap-1 rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                      onClick={() => onOpenPayDebt(debt)}
                                    >
                                      Pagar
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* 2. SECCIÓN DE PRODUCTOS ASOCIADOS */}
                <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-black text-foreground">Productos Asociados</h3>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                        {supplierProducts.length} {supplierProducts.length === 1 ? 'artículo' : 'artículos'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        • Valor stock: RD$ {supplierInventoryValue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProductIds(new Set());
                          setLinkingSearch('');
                          setIsLinkingModalOpen(true);
                        }}
                        className="h-8 text-xs font-bold gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Vincular Productos
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingProduct(undefined);
                          setIsProductFormOpen(true);
                        }}
                        className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Plus className="h-3.5 w-3.5" /> Nuevo Producto
                      </Button>
                    </div>
                  </div>

                  {/* Buscador de productos si hay artículos */}
                  {supplierProducts.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filtrar productos asociados (nombre, código, categoría)..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-8 h-8 rounded-xl bg-muted/30 border-border/40 text-xs"
                      />
                    </div>
                  )}

                  {supplierProducts.length === 0 ? (
                    <div className="p-6 text-center bg-muted/20 rounded-xl border border-dashed border-border/50">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-1.5" />
                      <p className="text-xs font-bold text-foreground">Sin productos vinculados a este proveedor</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 mb-3 max-w-sm mx-auto">
                        Selecciona productos que ya tienes en tu inventario para asignárselos a {supplier.name}.
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedProductIds(new Set());
                            setLinkingSearch('');
                            setIsLinkingModalOpen(true);
                          }}
                          className="rounded-xl text-xs font-bold gap-1.5 h-8"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Vincular Productos del Inventario
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProduct(undefined);
                            setIsProductFormOpen(true);
                          }}
                          className="rounded-xl text-xs font-bold gap-1.5 h-8"
                        >
                          <Plus className="h-3.5 w-3.5" /> Crear Producto
                        </Button>
                      </div>
                    </div>
                  ) : filteredSupplierProducts.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-muted/10 rounded-xl border border-border/30 text-xs text-muted-foreground">
                      No se encontraron productos con "{productSearch}"
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden max-h-[320px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-sm z-10">
                          <TableRow>
                            <TableHead className="text-xs font-bold py-2">Producto</TableHead>
                            <TableHead className="text-xs font-bold py-2">Categoría</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Costo</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2">Precio Venta</TableHead>
                            <TableHead className="text-center text-xs font-bold py-2">Margen</TableHead>
                            <TableHead className="text-center text-xs font-bold py-2">Stock</TableHead>
                            <TableHead className="text-right text-xs font-bold py-2 pr-3">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSupplierProducts.map((prod) => {
                            const cost = Number(prod.cost || 0);
                            const price = Number(prod.price || 0);
                            const margin = cost > 0 ? (((price - cost) / cost) * 100).toFixed(0) : null;
                            const isLowStock = prod.stock <= (prod.min_stock || 0);

                            return (
                              <TableRow key={prod.id} className="hover:bg-muted/20">
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-2">
                                    {prod.image_url ? (
                                      <img
                                        src={prod.image_url}
                                        alt={prod.name}
                                        className="h-7 w-7 rounded-lg object-cover border border-border/50 shrink-0"
                                      />
                                    ) : (
                                      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                        <Package className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <span className="font-bold text-xs text-foreground block truncate max-w-[180px]">
                                        {prod.name}
                                      </span>
                                      {(prod.barcode || prod.internal_code) && (
                                        <span className="text-[9px] text-muted-foreground font-mono block">
                                          {prod.barcode || prod.internal_code}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground">
                                  {prod.category?.name || '—'}
                                </TableCell>
                                <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                                  {cost > 0 ? `RD$ ${cost.toFixed(2)}` : '—'}
                                </TableCell>
                                <TableCell className="py-2 text-right font-mono font-bold text-xs text-foreground">
                                  RD$ {price.toFixed(2)}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  {margin !== null ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                    >
                                      +{margin}%
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] font-bold ${
                                      isLowStock
                                        ? 'border-red-500/30 text-red-500 bg-red-500/10'
                                        : 'border-border/60 text-foreground bg-muted/40'
                                    }`}
                                  >
                                    {prod.stock} uds
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2 text-right pr-3">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        setEditingProduct(prod);
                                        setIsProductFormOpen(true);
                                      }}
                                      title="Editar producto"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                      onClick={() => handleUnlinkProduct(prod)}
                                      title="Desvincular de este proveedor"
                                    >
                                      <Unlink className="h-3 w-3" />
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

                  {/* Ingredientes de restaurante vinculados */}
                  {supplierIngredients.length > 0 && (
                    <div className="mt-5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <FlaskConical className="h-3.5 w-3.5 text-emerald-500" />
                          Materia Prima / Ingredientes ({supplierIngredients.length})
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 overflow-hidden max-h-[220px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-sm z-10">
                            <TableRow>
                              <TableHead className="text-xs font-bold py-2">Ingrediente</TableHead>
                              <TableHead className="text-xs font-bold py-2">Categoría</TableHead>
                              <TableHead className="text-right text-xs font-bold py-2">Costo/Unidad</TableHead>
                              <TableHead className="text-center text-xs font-bold py-2">Stock Actual</TableHead>
                              <TableHead className="text-center text-xs font-bold py-2">Stock Mínimo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {supplierIngredients.map((ing) => (
                              <TableRow key={ing.id} className="hover:bg-muted/20">
                                <TableCell className="py-2 text-xs font-semibold text-foreground">
                                  {ing.name}
                                  {ing.notes && (
                                    <span className="block text-[10px] text-muted-foreground font-normal">
                                      {ing.notes}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground">
                                  {ing.category || 'General'}
                                </TableCell>
                                <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground">
                                  ${Number(ing.cost_per_unit || 0).toFixed(2)} / {ing.unit}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] font-bold ${
                                      ing.stock <= ing.min_stock
                                        ? 'border-red-500/30 text-red-500 bg-red-500/10'
                                        : 'border-border/60 text-foreground bg-muted/40'
                                    }`}
                                  >
                                    {ing.stock} {ing.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2 text-center text-xs text-muted-foreground font-mono">
                                  {ing.min_stock} {ing.unit}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Cuentas por Pagar */}
              <TabsContent value="debts" className="space-y-4 outline-none">
                {supplierDebts.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-muted/20 rounded-2xl border border-border/40">
                    <Receipt className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-semibold text-foreground">Sin Cuentas por Pagar</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Este proveedor no tiene facturas o deudas pendientes registradas.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-xs font-bold rounded-xl gap-1.5"
                      onClick={() => onOpenAddDebt(supplier)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Registrar Deuda
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Concepto / Fecha</TableHead>
                          <TableHead className="text-right text-xs font-bold">Monto</TableHead>
                          <TableHead className="text-right text-xs font-bold">Pagado</TableHead>
                          <TableHead className="text-right text-xs font-bold">Pendiente</TableHead>
                          <TableHead className="text-center text-xs font-bold">Estado</TableHead>
                          <TableHead className="text-right text-xs font-bold">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierDebts.map((debt) => {
                          const rem = Math.max(0, Number(debt.amount) - Number(debt.amount_paid));
                          const isPaid = debt.status === 'paid' || rem <= 0;
                          const isPartial = !isPaid && Number(debt.amount_paid) > 0;

                          return (
                            <TableRow key={debt.id} className="hover:bg-muted/20">
                              <TableCell className="py-3">
                                <span className="font-bold text-xs text-foreground block">{debt.description}</span>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                  <span>{debt.category}</span>
                                  {debt.due_date && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1 font-mono text-amber-500">
                                        <Calendar className="h-3 w-3" /> Vence: {debt.due_date}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs py-3 font-mono">
                                ${Number(debt.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs py-3 font-mono text-emerald-500">
                                ${Number(debt.amount_paid).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-black text-xs py-3 font-mono text-red-500">
                                ${rem.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {isPaid ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold">
                                    Pagado
                                  </Badge>
                                ) : isPartial ? (
                                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-bold">
                                    Parcial
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] font-bold">
                                    Pendiente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!isPaid && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] font-bold rounded-lg border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                                      onClick={() => onOpenPayDebt(debt)}
                                    >
                                      Abonar
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                                    onClick={() => onDeleteDebt(debt.id, debt.description)}
                                    title="Eliminar Deuda"
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
              </TabsContent>

              {/* Tab: Historial de Compras y Egresos */}
              <TabsContent value="expenses" className="space-y-4 outline-none">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Total gastado con este proveedor:{' '}
                    <strong className="font-bold text-foreground">
                      RD$ {totalExpensesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>

                {supplierExpenses.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-muted/20 rounded-2xl border border-border/40">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-semibold text-foreground">Sin Compras Registradas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Aún no se han asentado egresos o facturas pagadas a este proveedor.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Fecha</TableHead>
                          <TableHead className="text-xs font-bold">Concepto / Comprobante</TableHead>
                          <TableHead className="text-xs font-bold">Categoría</TableHead>
                          <TableHead className="text-right text-xs font-bold">Monto</TableHead>
                          <TableHead className="text-center text-xs font-bold">Comprobante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierExpenses.map((expense) => {
                          const dateObj = expense.date ? new Date(expense.date) : new Date(expense.created_at);
                          const dateLabel = isValid(dateObj) ? format(dateObj, 'dd/MM/yyyy', { locale: es }) : '-';

                          return (
                            <TableRow key={expense.id} className="hover:bg-muted/20">
                              <TableCell className="font-mono text-xs text-muted-foreground py-3">
                                {dateLabel}
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="font-bold text-xs text-foreground block">{expense.description}</span>
                                {expense.invoice_number && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    NCF/Factura: {expense.invoice_number}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                                  {expense.category}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-black text-xs py-3 font-mono text-foreground">
                                RD$ {Number(expense.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {expense.image_url ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/10 rounded-lg gap-1"
                                    onClick={() => setSelectedReceiptUrl(expense.image_url!)}
                                  >
                                    <Eye className="h-3 w-3" /> Ver
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Productos Comprados */}
              <TabsContent value="products" className="space-y-4 outline-none">
                {/* Métricas rápidas de productos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold">Productos Comprados</p>
                        <p className="text-lg font-black text-foreground">{supplierProducts.length} productos</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold">Valor Total en Stock (Costo)</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          RD$ {supplierInventoryValue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buscador de productos */}
                {supplierProducts.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar producto por nombre, código o categoría..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50 text-sm"
                    />
                  </div>
                )}

                {/* Lista o estado vacío */}
                {supplierProducts.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-muted/20 rounded-2xl border border-border/40">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-semibold text-foreground">Sin productos asignados</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Aún no has asignado productos a este proveedor. Puedes asignarlo editando o creando un producto en el inventario.
                    </p>
                  </div>
                ) : filteredSupplierProducts.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-muted/10 rounded-2xl border border-border/30">
                    <p className="text-xs font-semibold text-muted-foreground">No se encontraron productos con "{productSearch}"</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Producto</TableHead>
                          <TableHead className="text-xs font-bold">Categoría</TableHead>
                          <TableHead className="text-right text-xs font-bold">Costo</TableHead>
                          <TableHead className="text-right text-xs font-bold">Precio Venta</TableHead>
                          <TableHead className="text-center text-xs font-bold">Margen</TableHead>
                          <TableHead className="text-center text-xs font-bold">Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupplierProducts.map((prod) => {
                          const cost = Number(prod.cost || 0);
                          const price = Number(prod.price || 0);
                          const margin = cost > 0 ? (((price - cost) / cost) * 100).toFixed(0) : null;
                          const isLowStock = prod.stock <= (prod.min_stock || 0);

                          return (
                            <TableRow key={prod.id} className="hover:bg-muted/20">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2.5">
                                  {prod.image_url ? (
                                    <img
                                      src={prod.image_url}
                                      alt={prod.name}
                                      className="h-8 w-8 rounded-lg object-cover border border-border/50 shrink-0"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                      <Package className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-bold text-xs text-foreground block truncate max-w-[200px]">
                                      {prod.name}
                                    </span>
                                    {(prod.barcode || prod.internal_code) && (
                                      <span className="text-[10px] text-muted-foreground font-mono block">
                                        {prod.barcode || prod.internal_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 text-xs text-muted-foreground">
                                {prod.category?.name || '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-xs py-3 text-muted-foreground">
                                {cost > 0 ? `RD$ ${cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs py-3 text-foreground">
                                RD$ {price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {margin !== null ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                  >
                                    +{margin}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold ${
                                    isLowStock
                                      ? 'border-red-500/30 text-red-500 bg-red-500/10'
                                      : 'border-border/60 text-foreground bg-muted/40'
                                  }`}
                                >
                                  {prod.stock} uds
                                </Badge>
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
        </DialogContent>
      </Dialog>

      {/* Lightbox for receipt */}
      <Dialog open={!!selectedReceiptUrl} onOpenChange={(o) => !o && setSelectedReceiptUrl(null)}>
        <DialogContent className="sm:max-w-[600px] p-2 bg-black/90 border-none rounded-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprobante</DialogTitle>
            <DialogDescription>Visualización de la factura adjunta</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center">
            <img
              src={selectedReceiptUrl || ''}
              alt="Comprobante"
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
            <div className="w-full flex justify-end pt-2 pr-2">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs font-bold"
                onClick={() => setSelectedReceiptUrl(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para vincular productos del inventario general */}
      <Dialog open={isLinkingModalOpen} onOpenChange={setIsLinkingModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  Vincular Productos a {supplier.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Selecciona los productos de tu inventario que le compras a este proveedor
                </DialogDescription>
              </div>
            </div>

            {/* Filter controls */}
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre, código o categoría..."
                  value={linkingSearch}
                  onChange={(e) => setLinkingSearch(e.target.value)}
                  className="pl-8 h-8 rounded-xl bg-background text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-background p-0.5 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setLinkingFilter('unassigned')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    linkingFilter === 'unassigned'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sin proveedor ({products.filter((p) => !p.supplier_id).length})
                </button>
                <button
                  type="button"
                  onClick={() => setLinkingFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    linkingFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Todos ({products.length})
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Candidate list */}
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-2 px-1 text-xs text-muted-foreground border-b border-border/40">
              <button
                type="button"
                onClick={toggleSelectAllCandidates}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {selectedProductIds.size === candidateProducts.length && candidateProducts.length > 0
                  ? 'Desmarcar todos'
                  : `Seleccionar todos (${candidateProducts.length})`}
              </button>
              <span className="font-bold text-foreground text-xs">
                {selectedProductIds.size} seleccionado(s)
              </span>
            </div>

            <ScrollArea className="flex-1 max-h-[360px] mt-2 pr-2">
              {candidateProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No hay productos disponibles con los filtros actuales.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {candidateProducts.map((prod) => {
                    const isSelected = selectedProductIds.has(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => toggleSelectProduct(prod.id)}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary/40 shadow-xs'
                            : 'bg-card border-border/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectProduct(prod.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-foreground block truncate">
                              {prod.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                              {prod.barcode && <span>{prod.barcode}</span>}
                              {prod.category?.name && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                  {prod.category.name}
                                </Badge>
                              )}
                              {prod.supplier && (
                                <span className="text-amber-500">
                                  (Actual: {prod.supplier.name})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs text-foreground block">
                            RD$ {Number(prod.price || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            Stock: {prod.stock} uds
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-muted/30 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              {selectedProductIds.size} producto(s) listo(s) para vincular
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setIsLinkingModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={selectedProductIds.size === 0 || isSavingLinking}
                onClick={handleSaveLinking}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                {isSavingLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Vincular {selectedProductIds.size > 0 ? `(${selectedProductIds.size})` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-modal: Crear o Editar Producto con este proveedor asignado */}
      <Dialog open={isProductFormOpen} onOpenChange={setIsProductFormOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription>Formulario de producto</DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            prefilledValues={{ supplier_id: supplier.id }}
            onClose={() => setIsProductFormOpen(false)}
            onSuccess={() => {
              setIsProductFormOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
