import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Search,
  Plus,
  Link2,
  Unlink,
  Pencil,
  DollarSign,
  TrendingUp,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { Supplier } from '@/hooks/useSuppliers';
import { useProductsOffline, Product } from '@/hooks/useProductsOffline';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import ProductForm from '@/components/ProductForm';

interface SupplierProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const SupplierProductsDialog: React.FC<SupplierProductsDialogProps> = ({
  open,
  onOpenChange,
  supplier,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allProducts = [] } = useProductsOffline();

  const [searchTerm, setSearchTerm] = useState('');
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [linkingSearch, setLinkingSearch] = useState('');
  const [linkingFilter, setLinkingFilter] = useState<'unassigned' | 'all'>('unassigned');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Estados para crear / editar producto directamente desde el diálogo
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  // Productos de este proveedor
  const supplierProducts = useMemo(() => {
    if (!supplier) return [];
    return allProducts.filter((p) => p.supplier_id === supplier.id);
  }, [allProducts, supplier]);

  // Filtrado por buscador interno
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return supplierProducts;
    const q = searchTerm.toLowerCase().trim();
    return supplierProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q))
    );
  }, [supplierProducts, searchTerm]);

  // Métricas rápidas
  const totalUnits = useMemo(() => {
    return supplierProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  }, [supplierProducts]);

  const totalCostValue = useMemo(() => {
    return supplierProducts.reduce(
      (sum, p) => sum + Number(p.stock || 0) * Number(p.cost || 0),
      0
    );
  }, [supplierProducts]);

  // Candidatos a vincular
  const candidateProducts = useMemo(() => {
    if (!supplier) return [];
    let list = allProducts.filter((p) => p.supplier_id !== supplier.id);

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
  }, [allProducts, supplier, linkingFilter, linkingSearch]);

  // Desvincular un producto
  const handleUnlinkProduct = async (product: Product) => {
    if (!supplier) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ supplier_id: null })
        .eq('id', product.id);

      if (error) throw error;

      // Actualizar en IndexedDB
      const updated = { ...product, supplier_id: null, supplier: undefined };
      await offlineDB.put(OfflineStore.PRODUCTS, updated);

      // Invalidar consultas
      await queryClient.invalidateQueries({ queryKey: ['products'] });

      toast({
        title: 'Producto desvinculado',
        description: `"${product.name}" ya no está asignado a ${supplier.name}.`,
      });
    } catch (error: any) {
      console.error('Error al desvincular producto:', error);
      toast({
        title: 'Error al desvincular',
        description: error.message || 'No se pudo desvincular el producto.',
        variant: 'destructive',
      });
    }
  };

  // Guardar vinculación masiva
  const handleSaveLinking = async () => {
    if (!supplier || selectedProductIds.size === 0) return;
    setIsSaving(true);
    try {
      const idsArray = Array.from(selectedProductIds);

      const { error } = await supabase
        .from('products')
        .update({ supplier_id: supplier.id })
        .in('id', idsArray);

      if (error) throw error;

      // Actualizar en IndexedDB
      for (const id of idsArray) {
        const prod = allProducts.find((p) => p.id === id);
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
        description: `Se han vinculado ${idsArray.length} producto(s) a ${supplier.name} correctamente.`,
      });

      setSelectedProductIds(new Set());
      setIsLinkingModalOpen(false);
    } catch (error: any) {
      console.error('Error al vincular productos:', error);
      toast({
        title: 'Error al vincular',
        description: error.message || 'No se pudieron vincular los productos.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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

  if (!supplier) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/60 bg-background">
          {/* Header */}
          <div className="p-5 sm:p-6 bg-muted/40 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0 border border-primary/20">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-xl font-black text-foreground">
                      Productos de {supplier.name}
                    </DialogTitle>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">
                      {supplierProducts.length} {supplierProducts.length === 1 ? 'artículo' : 'artículos'}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Catálogo de artículos asociados y comprados a este proveedor
                  </DialogDescription>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedProductIds(new Set());
                    setLinkingSearch('');
                    setIsLinkingModalOpen(true);
                  }}
                  className="rounded-xl h-9 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular Productos
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingProduct(undefined);
                    setIsProductFormOpen(true);
                  }}
                  className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Producto
                </Button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-background/60 border border-border/40 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Productos</span>
                  <span className="text-sm font-black text-foreground">{supplierProducts.length} artículos</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background/60 border border-border/40 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Stock en Inventario</span>
                  <span className="text-sm font-black text-foreground">{totalUnits} unidades</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background/60 border border-border/40 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Valor Total al Costo</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    RD$ {totalCostValue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Search filter if there are products */}
            {supplierProducts.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en los productos de este proveedor (nombre, código, categoría)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50 text-sm"
                />
              </div>
            )}

            {/* Empty State or Table */}
            {supplierProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                <div className="h-16 w-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Package className="h-8 w-8" />
                </div>
                <h4 className="text-base font-bold text-foreground">Sin productos asignados</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
                  Aún no has vinculado productos a {supplier.name}. Puedes vincular productos que ya existen en tu inventario o registrar uno nuevo.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      setSelectedProductIds(new Set());
                      setLinkingSearch('');
                      setIsLinkingModalOpen(true);
                    }}
                    className="rounded-xl text-xs font-bold gap-1.5 h-9"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Vincular Productos del Inventario
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingProduct(undefined);
                      setIsProductFormOpen(true);
                    }}
                    className="rounded-xl text-xs font-bold gap-1.5 h-9"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear Producto
                  </Button>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 px-4 bg-muted/10 rounded-2xl border border-border/30">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">Sin resultados</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No se encontraron productos que coincidan con "{searchTerm}".
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-2xl border border-border/50 bg-card">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow className="border-b border-border/50">
                      <TableHead className="text-xs font-bold">Producto</TableHead>
                      <TableHead className="text-xs font-bold">Categoría</TableHead>
                      <TableHead className="text-right text-xs font-bold">Costo</TableHead>
                      <TableHead className="text-right text-xs font-bold">Precio Venta</TableHead>
                      <TableHead className="text-center text-xs font-bold">Margen</TableHead>
                      <TableHead className="text-center text-xs font-bold">Stock</TableHead>
                      <TableHead className="text-right text-xs font-bold pr-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((prod) => {
                      const cost = Number(prod.cost || 0);
                      const price = Number(prod.price || 0);
                      const margin = cost > 0 ? (((price - cost) / cost) * 100).toFixed(0) : null;
                      const isLowStock = prod.stock <= (prod.min_stock || 0);

                      return (
                        <TableRow key={prod.id} className="hover:bg-muted/20 border-b border-border/30">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="h-9 w-9 rounded-xl object-cover border border-border/50 shrink-0"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
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
                            {prod.category?.name || <span className="text-muted-foreground/40">—</span>}
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
                          <TableCell className="text-right py-3 pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setIsProductFormOpen(true);
                                }}
                                title="Editar producto"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                onClick={() => handleUnlinkProduct(prod)}
                                title="Desvincular de este proveedor"
                              >
                                <Unlink className="h-3.5 w-3.5" />
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
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-MODAL: Vincular Productos del Inventario */}
      <Dialog open={isLinkingModalOpen} onOpenChange={setIsLinkingModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/60 bg-background">
          <div className="p-5 bg-muted/40 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    Vincular Productos a {supplier.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Selecciona los productos de tu inventario que le compras a este proveedor
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre, código o categoría..."
                  value={linkingSearch}
                  onChange={(e) => setLinkingSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-background text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setLinkingFilter('unassigned')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    linkingFilter === 'unassigned'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sin proveedor ({allProducts.filter((p) => !p.supplier_id).length})
                </button>
                <button
                  type="button"
                  onClick={() => setLinkingFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    linkingFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Todos ({allProducts.length})
                </button>
              </div>
            </div>
          </div>

          {/* Candidate list */}
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between py-2 px-1 text-xs text-muted-foreground border-b border-border/40">
              <button
                type="button"
                onClick={toggleSelectAllCandidates}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {selectedProductIds.size === candidateProducts.length && candidateProducts.length > 0
                  ? 'Desmarcar todos'
                  : `Seleccionar todos (${candidateProducts.length})`}
              </button>
              <span className="font-bold text-foreground">
                {selectedProductIds.size} seleccionado(s)
              </span>
            </div>

            <ScrollArea className="flex-1 max-h-[380px] mt-2 pr-2">
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
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary/40 shadow-xs'
                            : 'bg-card border-border/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
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
          <div className="p-4 bg-muted/30 border-t border-border/40 flex items-center justify-between">
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
                disabled={selectedProductIds.size === 0 || isSaving}
                onClick={handleSaveLinking}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Vincular {selectedProductIds.size > 0 ? `(${selectedProductIds.size})` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-form: Crear o Editar Producto con este proveedor asignado */}
      {isProductFormOpen && (
        <ProductForm
          product={editingProduct}
          prefilledValues={{ supplier_id: supplier.id }}
          onClose={() => setIsProductFormOpen(false)}
          onSuccess={() => {
            setIsProductFormOpen(false);
          }}
        />
      )}
    </>
  );
};
