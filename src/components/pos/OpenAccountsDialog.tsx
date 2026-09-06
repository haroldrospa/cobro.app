import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, ShoppingCart, Check, Trash2, Calendar, User, Package, Printer, Merge, X, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/types/pos';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { useUserStore } from '@/hooks/useUserStore';
import { generatePreCheckPDF } from '@/utils/invoicePdfGenerator';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { cn } from '@/lib/utils';

// Al guardar un pedido (SaveOrderDialog) se le agrega al final de las notas
// una etiqueta técnica entre corchetes (ej. "[COMPRA AQUÍ]") para que otras
// pantallas (Cocina, Delivery) sepan el tipo de pedido sin una columna
// dedicada. Acá solo mostramos la nota al cajero -- si se muestra tal cual,
// una nota vacía se ve como el puro tag técnico "[COMPRA AQUÍ]" suelto.
const displayNotes = (notes?: string | null) => (notes || '')
  .replace(/\[COMER AQUÍ\]/g, '')
  .replace(/\[PARA LLEVAR\]/g, '')
  .replace(/\[COMPRA AQUÍ\]/g, '')
  .replace(/\[DELIVERY\]/g, '')
  .trim();

interface OpenAccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadToCart?: (items: CartItem[], orderId: string, customerName: string, orderNumber: string, source: 'pos' | 'web', notes?: string) => void;
  currentLoadedOrderId?: string | null;
}

const OpenAccountsDialog: React.FC<OpenAccountsDialogProps> = ({ isOpen, onClose, onLoadToCart, currentLoadedOrderId }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: userStore } = useUserStore();
  const { companyInfo, printSettings } = usePrintSettings();

  // ─── Merge mode state ───
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);   // destination order
  const [mergeSources, setMergeSources] = useState<string[]>([]);         // orders to absorb
  const [confirmMerge, setConfirmMerge] = useState(false);

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['pos-open-orders', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return [];

      const { data, error } = await supabase
        .from('open_orders')
        .select(`
          *,
          open_order_items(
            id,
            quantity,
            unit_price,
            total,
            product_name,
            product_id,
            tax_percentage,
            tax_amount,
            subtotal,
            products(cost_includes_tax)
          )
        `)
        .eq('store_id', userStore.id)
        .eq('source', 'pos')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      // Excluir los tickets delta de cocina (notas que empiezan con [ACTUALIZADO])
      return (data || []).filter((order: any) => !order.notes?.startsWith('[ACTUALIZADO]'));

    },
    enabled: isOpen && !!userStore?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Filter out the currently loaded order
  const filteredOrders = orders.filter((order: any) => String(order.id) !== String(currentLoadedOrderId));

  // ─── Realtime Subscription ───
  React.useEffect(() => {
    if (!isOpen || !userStore?.id) return;

    const channel = supabase
      .channel(`pos-open-orders-realtime-${userStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'open_orders',
          filter: `store_id=eq.${userStore.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'open_order_items',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userStore?.id, queryClient]);

  // ─── Delete mutation ───
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemsError } = await supabase
        .from('open_order_items')
        .delete()
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from('open_orders')
        .delete()
        .eq('id', orderId);
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      toast({ title: "Pedido eliminado", description: "El pedido ha sido eliminado correctamente" });
      setOrderToDelete(null);
      setSelectedOrderId(null);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el pedido" });
      console.error('Error deleting order:', error);
    }
  });

  // ─── Delete All mutation ───
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!userStore?.id) return;
      const { data: storeOrders } = await supabase
        .from('open_orders')
        .select('id')
        .eq('store_id', userStore.id)
        .eq('source', 'pos')
        .eq('payment_status', 'pending');

      if (storeOrders && storeOrders.length > 0) {
        const ids = storeOrders.map((o: any) => o.id);
        const { error: itemsError } = await supabase
          .from('open_order_items')
          .delete()
          .in('order_id', ids);
        if (itemsError) throw itemsError;

        const { error: ordersError } = await supabase
          .from('open_orders')
          .delete()
          .in('id', ids);
        if (ordersError) throw ordersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      toast({ title: "Pedidos eliminados", description: "Se han eliminado todos los pedidos guardados correctamente" });
      setConfirmDeleteAll(false);
      setSelectedOrderId(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error?.message || "No se pudieron eliminar los pedidos" });
      console.error('Error deleting all orders:', error);
    }
  });

  // ─── Merge mutation ───
  const mergeOrdersMutation = useMutation({
    mutationFn: async ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) => {
      // 1. Collect all items from source orders
      const sourceOrders = filteredOrders.filter((o: any) => sourceIds.includes(o.id));
      const targetOrder = filteredOrders.find((o: any) => o.id === targetId);
      if (!targetOrder) throw new Error('Cuenta destino no encontrada');

      // 2. Move all items to the target order
      for (const sourceOrder of sourceOrders) {
        for (const item of (sourceOrder.open_order_items || [])) {
          const { error } = await supabase
            .from('open_order_items')
            .update({ order_id: targetId })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      // 3. Calculate new total for target order
      const allItems = [
        ...(targetOrder.open_order_items || []),
        ...sourceOrders.flatMap((o: any) => o.open_order_items || [])
      ];
      const newTotal = allItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

      const { error: updateError } = await supabase
        .from('open_orders')
        .update({ total: newTotal, updated_at: new Date().toISOString() })
        .eq('id', targetId);
      if (updateError) throw updateError;

      // 4. Delete source orders (items already moved)
      for (const sourceId of sourceIds) {
        const { error } = await supabase
          .from('open_orders')
          .delete()
          .eq('id', sourceId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      toast({
        title: "✅ Cuentas unidas",
        description: `${mergeSources.length} cuenta(s) fusionadas correctamente`
      });
      setMergeMode(false);
      setMergeTarget(null);
      setMergeSources([]);
      setConfirmMerge(false);
      setSelectedOrderId(null);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error al unir cuentas", description: "No se pudieron unir las cuentas. Intenta de nuevo." });
      console.error('Merge error:', error);
      setConfirmMerge(false);
    }
  });

  const handleLoadToCart = (order?: any) => {
    const orderToLoad = order || filteredOrders.find((o: any) => o.id === selectedOrderId);
    if (!orderToLoad) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un pedido para cargar" });
      return;
    }
    const cartItems: CartItem[] = orderToLoad.open_order_items.map((item: any) => {
      let name = item.product_name;
      let comment = '';
      const match = name.match(/^(.*) \((.*)\)$/);
      if (match) { name = match[1]; comment = match[2]; }
      return {
        id: item.product_id, name, price: item.unit_price, quantity: item.quantity,
        tax: (item.tax_percentage || 18) / 100,
        cost_includes_tax: item.products?.cost_includes_tax || false,
        comment: comment || undefined
      };
    });
    if (onLoadToCart) {
      onLoadToCart(cartItems, orderToLoad.id, orderToLoad.customer_name, orderToLoad.order_number, 'pos', orderToLoad.notes);
    }
    setSelectedOrderId(null);
    onClose();
  };

  const handleRowDoubleClick = (order: any) => handleLoadToCart(order);

  const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setOrderToDelete(orderId);
  };

  const handlePrint = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      const doc = await generatePreCheckPDF(companyInfo, order, printSettings.paperSize);
      const pdfBlob = doc.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    } catch (error) {
      console.error("Error printing:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar la pre-cuenta" });
    }
  };

  // ─── Merge mode click handler ───
  const handleMergeClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (!mergeMode) return;

    if (!mergeTarget) {
      // First click = set as destination
      setMergeTarget(orderId);
      toast({ title: "🎯 Cuenta destino seleccionada", description: "Ahora selecciona las cuentas a fusionar en ella." });
    } else if (orderId === mergeTarget) {
      // Click on target = deselect
      setMergeTarget(null);
      setMergeSources([]);
    } else {
      // Toggle source
      setMergeSources(prev =>
        prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
      );
    }
  };

  const resetMergeMode = () => {
    setMergeMode(false);
    setMergeTarget(null);
    setMergeSources([]);
    setConfirmMerge(false);
  };

  const targetOrder = filteredOrders.find((o: any) => o.id === mergeTarget);
  const sourceOrders = filteredOrders.filter((o: any) => mergeSources.includes(o.id));
  const selectedOrder = filteredOrders.find((o: any) => o.id === selectedOrderId);
  const totalAmount = filteredOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);

  // ─── Merge badge for an order ───
  const getMergeLabel = (orderId: string) => {
    if (!mergeMode) return null;
    if (orderId === mergeTarget) return <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 shadow-sm">Destino</Badge>;
    if (mergeSources.includes(orderId)) return <Badge className="text-[10px] px-2 py-0.5 bg-orange-500 text-white shadow-sm">Fusionar</Badge>;
    if (mergeTarget) return <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground border-dashed">+ Unir</Badge>;
    return <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground border-dashed">Elegir destino</Badge>;
  };

  const renderOrderRow = (order: any) => {
    const isTarget = order.id === mergeTarget;
    const isSource = mergeSources.includes(order.id);
    const isSelected = selectedOrderId === order.id;

    let borderClass = 'border-border/50 hover:border-border hover:bg-muted/30 bg-card';
    if (mergeMode) {
      if (isTarget) borderClass = 'border-primary ring-2 ring-primary/30 bg-primary/5';
      else if (isSource) borderClass = 'border-orange-500 ring-2 ring-orange-500/30 bg-orange-500/5';
    } else if (isSelected) {
      borderClass = 'border-primary ring-2 ring-primary/20 bg-primary/[0.04] shadow-sm';
    }

    const itemCount = order.open_order_items?.length || 0;
    const notesText = displayNotes(order.notes);

    return (
      <div
        key={order.id}
        onClick={mergeMode ? (e) => handleMergeClick(e, order.id) : () => setSelectedOrderId(order.id)}
        onDoubleClick={!mergeMode ? () => handleRowDoubleClick(order) : undefined}
        className={cn(
          "group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all duration-150 cursor-pointer gap-3",
          borderClass
        )}
      >
        {/* Left / Main Info */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* Status / Selection Indicator */}
          <div className="flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            {mergeMode ? (
              getMergeLabel(order.id)
            ) : (
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center transition-colors border text-xs",
                isSelected 
                  ? "bg-primary border-primary text-primary-foreground font-bold shadow-sm" 
                  : "border-border/60 group-hover:border-primary/50 text-transparent"
              )}>
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary/80 text-foreground border border-border/40">
                {order.order_number}
              </span>

              <span className="font-semibold text-sm text-foreground truncate max-w-[200px] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {order.customer_name || 'Cliente sin nombre'}
              </span>

              {notesText && (
                <span className="text-[11px] text-muted-foreground/90 bg-muted/60 px-2 py-0.5 rounded truncate max-w-[180px]">
                  {notesText}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 opacity-70" />
                {format(new Date(order.created_at), 'dd/MM/yyyy • HH:mm', { locale: es })}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 opacity-70" />
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>
          </div>
        </div>

        {/* Right / Total & Quick Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <div className="text-left sm:text-right">
            <div className="text-xs text-muted-foreground font-medium hidden sm:block">Total</div>
            <div className="text-base sm:text-lg font-bold text-primary tabular-nums">
              ${(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {!mergeMode && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
                onClick={(e) => handlePrint(e, order)}
                title="Imprimir Pre-cuenta"
              >
                <Printer className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                onClick={(e) => handleDeleteClick(e, order.id)}
                title="Eliminar pedido"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant={isSelected ? "default" : "secondary"}
                className="h-8 px-3 text-xs font-medium gap-1.5 rounded-lg ml-1 shadow-none hidden sm:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadToCart(order);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Cargar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-4xl w-full h-[88vh] sm:h-[82vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/60 shadow-2xl">
          {/* Minimalist Top Header */}
          <DialogHeader className="px-5 py-4 border-b border-border/40 bg-card/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Title & Count */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <span>Pedidos Guardados</span>
                    {filteredOrders.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {filteredOrders.length}
                      </span>
                    )}
                    {mergeMode && (
                      <Badge className="bg-orange-500 text-white text-[10px] ml-1">Modo Unir</Badge>
                    )}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground pl-10">
                  {mergeMode
                    ? mergeTarget
                      ? `Destino: ${targetOrder?.customer_name || '...'} — Selecciona cuentas a fusionar`
                      : 'Toca la cuenta DESTINO (que recibirá los productos)'
                    : 'Toca para seleccionar o doble clic para cargar directo'}
                </DialogDescription>
              </div>

              {/* Actions & Summary Header Badge */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {filteredOrders.length > 0 && !mergeMode && (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/40 text-xs">
                      <span className="text-muted-foreground font-medium">Total:</span>
                      <span className="font-bold text-primary">
                        ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {filteredOrders.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium gap-1.5 border-border/60 hover:bg-secondary rounded-lg"
                        onClick={() => setMergeMode(true)}
                        title="Unir Cuentas"
                      >
                        <Merge className="h-3.5 w-3.5 text-orange-500" />
                        <span className="hidden sm:inline">Unir</span>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg px-2"
                      onClick={() => setConfirmDeleteAll(true)}
                      title="Eliminar todos los pedidos"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}

                {mergeMode && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-muted-foreground hover:bg-secondary rounded-lg gap-1"
                    onClick={resetMergeMode}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancelar unión
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 sm:p-5 bg-background/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 text-muted-foreground gap-2">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Cargando pedidos guardados...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3 text-muted-foreground">
                  <ClipboardList className="h-7 w-7 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No hay pedidos guardados</h3>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  Cuando pongas cuentas o ventas en espera desde el POS, aparecerán listadas aquí.
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1 -mr-2 pr-3">
                <div className="space-y-2.5 pb-2">
                  {filteredOrders.map((order: any) => renderOrderRow(order))}
                </div>
              </ScrollArea>
            )}

            {/* ─── Merge summary bar ─── */}
            {mergeMode && mergeTarget && mergeSources.length > 0 && (
              <div className="mt-3 p-3 rounded-xl border border-orange-500/30 bg-orange-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-foreground flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-orange-500">{sourceOrders.length} cuenta(s)</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-primary">{targetOrder?.customer_name}</span>
                  <span className="text-muted-foreground">
                    (Nuevo total: ${(
                      (targetOrder?.total || 0) +
                      sourceOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
                    ).toFixed(2)})
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs gap-1.5 rounded-lg shrink-0"
                  onClick={() => setConfirmMerge(true)}
                  disabled={mergeOrdersMutation.isPending}
                >
                  <Merge className="h-3.5 w-3.5" />
                  Confirmar Unión
                </Button>
              </div>
            )}
          </div>

          {/* Minimalist Bottom Footer */}
          {!mergeMode && filteredOrders.length > 0 && (
            <div className="px-5 py-3.5 border-t border-border/40 bg-card/80 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground truncate">
                {selectedOrder ? (
                  <span>
                    Seleccionado: <strong className="text-foreground">{selectedOrder.order_number}</strong> ({selectedOrder.customer_name})
                  </span>
                ) : (
                  <span>Selecciona un pedido para cargarlo</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={onClose} className="h-9 px-3 text-xs rounded-lg">
                  Cerrar
                </Button>
                <Button
                  onClick={() => handleLoadToCart()}
                  disabled={!selectedOrder}
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold gap-1.5 rounded-lg shadow-sm"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Cargar al POS
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation ─── */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pedido será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => orderToDelete && deleteOrderMutation.mutate(orderToDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Merge confirmation ─── */}
      <AlertDialog open={confirmMerge} onOpenChange={setConfirmMerge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-orange-500" />
              ¿Unir cuentas?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Se moverán todos los ítems de las siguientes cuentas a <strong>{targetOrder?.customer_name}</strong>:</p>
                <ul className="space-y-1">
                  {sourceOrders.map((o: any) => (
                    <li key={o.id} className="flex justify-between bg-muted/50 rounded px-3 py-1.5">
                      <span className="font-medium">{o.customer_name}</span>
                      <span className="text-muted-foreground">{o.open_order_items?.length || 0} ítems — ${(o.total || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-destructive font-medium">Las cuentas fusionadas serán eliminadas. Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmMerge(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => mergeTarget && mergeOrdersMutation.mutate({ targetId: mergeTarget, sourceIds: mergeSources })}
            >
              {mergeOrdersMutation.isPending ? 'Uniendo...' : 'Unir Cuentas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ─── Delete ALL confirmation ─── */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar todos los pedidos guardados?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente <strong>{filteredOrders.length} pedido(s)</strong> guardado(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteAll(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Eliminando...' : 'Sí, eliminar todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OpenAccountsDialog;