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
            cost_includes_tax
          )
        `)
        .eq('store_id', userStore.id)
        .eq('source', 'pos')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching open orders in OpenAccountsDialog:', error);
        throw error;
      }
      
      console.log('OpenAccountsDialog fetched data:', data);
      
      // Excluir los tickets delta de cocina (notas que empiezan con [ACTUALIZADO])
      return (data || []).filter((order: any) => !order.notes?.startsWith('[ACTUALIZADO]'));

    },
    enabled: isOpen && !!userStore?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Filter out the currently loaded order
  const filteredOrders = orders.filter((order: any) => String(order.id) !== String(currentLoadedOrderId));

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
        cost_includes_tax: item.cost_includes_tax || false,
        comment: comment || undefined
      };
    });
    if (onLoadToCart) {
      onLoadToCart(cartItems, orderToLoad.id, orderToLoad.customer_name, orderToLoad.order_number, 'pos', orderToLoad.notes);
    }
    toast({ title: "Pedido cargado", description: `${cartItems.length} productos agregados al carrito` });
    setSelectedOrderId(null);
    onClose();
  };

  const handleRowDoubleClick = (order: any) => handleLoadToCart(order);

  const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setOrderToDelete(orderId);
  };

  const handlePrint = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      const doc = generatePreCheckPDF(companyInfo, order, printSettings.paperSize);
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
    if (orderId === mergeTarget) return <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5">DESTINO</Badge>;
    if (mergeSources.includes(orderId)) return <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 bg-orange-500 text-white">FUSIONAR</Badge>;
    if (mergeTarget) return <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 text-muted-foreground">+ Agregar</Badge>;
    return <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 text-muted-foreground">Seleccionar destino</Badge>;
  };

  const renderMobileCard = (order: any) => {
    const isTarget = order.id === mergeTarget;
    const isSource = mergeSources.includes(order.id);
    const cardHighlight = mergeMode
      ? isTarget ? 'ring-2 ring-primary bg-primary/10' : isSource ? 'ring-2 ring-orange-400 bg-orange-500/10' : 'hover:bg-muted/50'
      : selectedOrderId === order.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50';

    return (
      <Card
        key={order.id}
        className={`cursor-pointer transition-all ${cardHighlight}`}
        onClick={mergeMode ? (e) => handleMergeClick(e as any, order.id) : () => setSelectedOrderId(order.id)}
        onDoubleClick={!mergeMode ? () => handleRowDoubleClick(order) : undefined}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {!mergeMode && selectedOrderId === order.id && <Check className="h-4 w-4 text-primary" />}
              <span className="font-semibold text-primary">{order.order_number}</span>
              {getMergeLabel(order.id)}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">${(order.total || 0).toFixed(2)}</span>
              {!mergeMode && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => handlePrint(e, order)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteClick(e, order.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="truncate">{order.customer_name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{order.open_order_items?.length || 0} productos</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
            </div>
          </div>
          {order.notes && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">{order.notes}</div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Items</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="w-28"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrders.map((order: any) => {
          const isTarget = order.id === mergeTarget;
          const isSource = mergeSources.includes(order.id);
          const rowHighlight = mergeMode
            ? isTarget ? 'bg-primary/10 hover:bg-primary/15 cursor-pointer'
              : isSource ? 'bg-orange-500/10 hover:bg-orange-500/15 cursor-pointer'
                : 'hover:bg-muted/50 cursor-pointer'
            : selectedOrderId === order.id ? 'bg-primary/10 hover:bg-primary/15 cursor-pointer' : 'hover:bg-muted/50 cursor-pointer';

          return (
            <TableRow
              key={order.id}
              className={`transition-colors ${rowHighlight}`}
              onClick={mergeMode ? (e) => handleMergeClick(e, order.id) : () => setSelectedOrderId(order.id)}
              onDoubleClick={!mergeMode ? () => handleRowDoubleClick(order) : undefined}
            >
              <TableCell>
                {mergeMode ? getMergeLabel(order.id) : (selectedOrderId === order.id && <Check className="h-4 w-4 text-primary" />)}
              </TableCell>
              <TableCell className="font-medium">{order.order_number}</TableCell>
              <TableCell>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
              <TableCell>
                <div>{order.customer_name}</div>
                {order.notes && <div className="text-xs text-muted-foreground">{order.notes}</div>}
              </TableCell>
              <TableCell>{order.open_order_items?.length || 0} productos</TableCell>
              <TableCell className="text-right font-semibold">${(order.total || 0).toFixed(2)}</TableCell>
              <TableCell>
                {!mergeMode && (
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handlePrint(e, order)} title="Imprimir Pre-cuenta">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteClick(e, order.id)} title="Eliminar pedido">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-4xl h-[85vh]'} flex flex-col overflow-hidden`}>
          <DialogHeader className="pb-0 border-b border-border/40 bg-muted/10 p-4">
            <div className="flex flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Pedidos Guardados
                  {mergeMode && <Badge className="bg-orange-500 text-white text-xs ml-1">Modo Unir</Badge>}
                </DialogTitle>
                <DialogDescription className={isMobile ? 'text-xs' : ''}>
                  {mergeMode
                    ? mergeTarget
                      ? `Destino: ${targetOrder?.customer_name || '...'} — Selecciona las cuentas a fusionar`
                      : 'Toca la cuenta DESTINO primero (la que recibirá todos los ítems)'
                    : isMobile ? 'Toca para seleccionar' : 'Selecciona un pedido para facturarlo.'}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                {filteredOrders.length > 1 && !mergeMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-orange-400 text-orange-500 hover:bg-orange-500/10"
                    onClick={() => setMergeMode(true)}
                  >
                    <Merge className="h-4 w-4" />
                    {!isMobile && 'Unir Cuentas'}
                  </Button>
                )}
                {mergeMode && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetMergeMode} title="Cancelar">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {filteredOrders.length > 0 && !mergeMode && (
                  <div className="relative overflow-hidden bg-emerald-950/40 border border-emerald-500/20 px-5 py-2 rounded-xl flex flex-col items-end justify-center shrink-0 shadow-sm backdrop-blur-sm">
                    <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-widest leading-none mb-1">Total</span>
                    <span className="text-2xl font-black text-emerald-400 tabular-nums leading-none tracking-tight">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando pedidos...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4" />
              <p>No hay pedidos guardados</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 min-h-0">
                {isMobile ? (
                  <div className="space-y-3 pr-4 pb-2">
                    {filteredOrders.map((order: any) => renderMobileCard(order))}
                  </div>
                ) : renderDesktopTable()}
              </ScrollArea>

              {/* ─── Merge summary bar ─── */}
              {mergeMode && mergeTarget && mergeSources.length > 0 && (
                <div className="border-t border-orange-400/30 bg-orange-500/5 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 text-sm">
                    <span className="font-bold text-orange-400">{sourceOrders.length} cuenta(s)</span>
                    <ArrowRight className="inline h-4 w-4 mx-2 text-muted-foreground" />
                    <span className="font-bold text-primary">{targetOrder?.customer_name}</span>
                    <span className="text-muted-foreground ml-2">
                      (Total nuevo estimado: ${(
                        (targetOrder?.total || 0) +
                        sourceOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
                      ).toFixed(2)})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    onClick={() => setConfirmMerge(true)}
                    disabled={mergeOrdersMutation.isPending}
                  >
                    <Merge className="h-4 w-4" />
                    Confirmar Unión
                  </Button>
                </div>
              )}

              {/* ─── Action buttons ─── */}
              {!mergeMode && (
                <div className={`flex gap-2 pt-4 border-t mt-4 ${isMobile ? 'flex-col' : 'justify-end'}`}>
                  {isMobile ? (
                    <>
                      <Button onClick={() => handleLoadToCart()} disabled={!selectedOrder} className="gap-2 w-full" size="lg">
                        <ShoppingCart className="h-4 w-4" />
                        Cargar al POS
                      </Button>
                      <Button variant="outline" onClick={onClose} className="w-full">Cerrar</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={onClose}>Cerrar</Button>
                      <Button onClick={() => handleLoadToCart()} disabled={!selectedOrder} className="gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Cargar al POS
                      </Button>
                    </>
                  )}
                </div>
              )}
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
    </>
  );
};

export default OpenAccountsDialog;