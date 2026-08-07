import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Store, ShoppingCart, Check, Trash2, Calendar, User, Package, Phone, MapPin, ChefHat, Truck, Printer, MessageCircle } from 'lucide-react';
import OrderChatPanel from './OrderChatPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/types/pos';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { useUserStore } from '@/hooks/useUserStore';
import { useBusinessType } from '@/hooks/useBusinessType';
import { generatePreCheckPDF } from '@/utils/invoicePdfGenerator';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';

interface WebSalesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadToCart?: (items: CartItem[], orderId: string, customerName: string, orderNumber: string, source: 'pos' | 'web', notes?: string) => void;
  currentLoadedOrderId?: string | null;
}

const WebSalesDialog: React.FC<WebSalesDialogProps> = ({ isOpen, onClose, onLoadToCart, currentLoadedOrderId }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: userStore } = useUserStore();
  const { isStore, isSupermarket } = useBusinessType();
  const { companyInfo, printSettings } = usePrintSettings();
  const isMarket = isStore || isSupermarket;

  const { data: orders = [], isLoading, isFetching } = useQuery({
    queryKey: ['web-orders', userStore?.id],
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
        .eq('source', 'web')
        .in('order_status', ['pending', 'confirmed', 'preparing', 'shipped', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!userStore?.id,
    staleTime: 10000,           // Consider data fresh for 10 seconds
    gcTime: 5 * 60 * 1000,      // Keep in cache for 5 minutes  
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: true,        // Always fetch on mount for latest data
  });

  // Filter out the currently loaded order
  const filteredOrders = orders.filter((order: any) => String(order.id) !== String(currentLoadedOrderId));

  const { data: unreadCounts = {} } = useUnreadCounts(
    filteredOrders.map((o: any) => o.id),
    'store'
  );

  // Escuchador Realtime dedicado para WebSalesDialog
  React.useEffect(() => {
    if (!isOpen || !userStore?.id) return;

    const channel = supabase
      .channel(`web-sales-dialog-realtime-${userStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'open_orders',
          filter: `store_id=eq.${userStore.id}`,
        },
        (payload) => {
          console.log('⚡ Evento Realtime recibido en WebSalesDialog:', payload);
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              queryClient.setQueryData(['web-orders', userStore.id], (old: any[] | undefined) =>
                (old || []).filter((o: any) => String(o.id) !== String(deletedId))
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            if (updated?.id) {
              queryClient.setQueryData(['web-orders', userStore.id], (old: any[] | undefined) =>
                (old || []).map((o: any) => String(o.id) === String(updated.id) ? { ...o, ...updated } : o)
              );
            }
          }
          queryClient.invalidateQueries({ queryKey: ['web-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userStore?.id, queryClient]);

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
    onMutate: async (orderId: string) => {
      await queryClient.cancelQueries({ queryKey: ['web-orders', userStore?.id] });
      const previousOrders = queryClient.getQueryData(['web-orders', userStore?.id]);

      queryClient.setQueryData(['web-orders', userStore?.id], (old: any[] | undefined) => {
        if (!old) return [];
        return old.filter((o: any) => String(o.id) !== String(orderId));
      });

      return { previousOrders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      queryClient.refetchQueries({ queryKey: ['web-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });
      toast({
        title: "Pedido eliminado",
        description: "El pedido ha sido eliminado correctamente"
      });
      setOrderToDelete(null);
      setSelectedOrderId(null);
    },
    onError: (error, _orderId, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['web-orders', userStore?.id], context.previousOrders);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el pedido"
      });
      console.error('Error deleting order:', error);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string, status: string }) => {
      const { error } = await supabase
        .from('open_orders')
        .update({ order_status: status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onMutate: async ({ orderId, status }: { orderId: string, status: string }) => {
      await queryClient.cancelQueries({ queryKey: ['web-orders', userStore?.id] });
      const previousOrders = queryClient.getQueryData(['web-orders', userStore?.id]);

      queryClient.setQueryData(['web-orders', userStore?.id], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map((o: any) => String(o.id) === String(orderId) ? { ...o, order_status: status } : o);
      });

      return { previousOrders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      queryClient.refetchQueries({ queryKey: ['web-orders'] });
      toast({
        title: "Estado actualizado",
        description: "El estado del pedido ha sido actualizado"
      });
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['web-orders', userStore?.id], context.previousOrders);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado del pedido"
      });
      console.error('Error updating status:', error);
    }
  });

  const handleLoadToCart = (order?: any) => {
    const orderToLoad = order || filteredOrders.find((o: any) => o.id === selectedOrderId);

    if (!orderToLoad) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selecciona un pedido para cargar"
      });
      return;
    }

    const cartItems: CartItem[] = orderToLoad.open_order_items.map((item: any) => ({
      id: item.product_id,
      name: item.product_name,
      price: item.unit_price,
      quantity: item.quantity,
      tax: (item.tax_percentage || 18) / 100,
      cost_includes_tax: item.products?.cost_includes_tax || false
    }));

    if (onLoadToCart) {
      onLoadToCart(cartItems, orderToLoad.id, orderToLoad.customer_name, orderToLoad.order_number, 'web', orderToLoad.notes);
    }

    toast({
      title: "Pedido cargado",
      description: `${cartItems.length} productos agregados al carrito`
    });

    setSelectedOrderId(null);
    onClose();
  };

  const handleRowDoubleClick = (order: any) => {
    handleLoadToCart(order);
  };

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
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar la pre-cuenta"
      });
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Esperando</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-1">
          <Check className="h-3 w-3" /> Confirmado
        </Badge>;
      case 'preparing':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 flex items-center gap-1">
          {isMarket ? null : <ChefHat className="h-3 w-3" />} {isMarket ? 'Preparando' : 'En cocina'}
        </Badge>;
      case 'shipped':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-1">
          <Truck className="h-3 w-3" /> En camino
        </Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Procesando</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedOrder = filteredOrders.find((o: any) => o.id === selectedOrderId);

  const renderMobileCard = (order: any) => (
    <Card
      key={order.id}
      className={`cursor-pointer transition-all ${selectedOrderId === order.id
        ? 'ring-2 ring-primary bg-primary/5'
        : 'hover:bg-muted/50'
        } ${order.order_status === 'completed' ? 'opacity-60' : ''}`}
      onClick={() => setSelectedOrderId(order.id)}
      onDoubleClick={() => handleRowDoubleClick(order)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {selectedOrderId === order.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
            <span className="font-semibold text-primary">{order.order_number}</span>
            {getOrderStatusBadge(order.order_status)}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => handlePrint(e, order)}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); setActiveChatOrderId(order.id); }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => handleDeleteClick(e, order.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="truncate font-medium text-foreground">{order.customer_name}</span>
          </div>

          {order.customer_phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>{order.customer_phone}</span>
            </div>
          )}

          {order.customer_address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{order.customer_address}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{order.open_order_items?.length || 0} productos</span>
            </div>
            <span className="text-lg font-bold">${order.total?.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            📝 {order.notes}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {order.order_status === 'pending' && (
            <Button
              size="sm"
              className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
              }}
            >
              <ChefHat className="h-4 w-4" /> {isMarket ? 'Aceptar → Preparar' : 'Aceptar → A Cocina'}
            </Button>
          )}
          {order.order_status === 'preparing' && (
            <Button
              size="sm"
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
              }}
            >
              <Truck className="h-4 w-4" /> Despachar
            </Button>
          )}
          {order.order_status === 'completed' && (
            <Button
              size="sm"
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadToCart(order);
              }}
            >
              <ShoppingCart className="h-4 w-4" /> Cobrar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-[50px]"></TableHead>
          <TableHead className="font-bold">Pedido</TableHead>
          <TableHead className="font-bold">Fecha</TableHead>
          <TableHead className="font-bold min-w-[150px]">Cliente</TableHead>
          <TableHead className="font-bold">Items</TableHead>
          <TableHead className="font-bold">Estado</TableHead>
          <TableHead className="text-right font-bold w-[120px]">Total</TableHead>
          <TableHead className="w-[200px] text-center font-bold">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrders.map((order: any) => (
          <TableRow
            key={order.id}
            className={`cursor-pointer transition-colors ${selectedOrderId === order.id
              ? 'bg-primary/10 hover:bg-primary/15'
              : 'hover:bg-muted/50'
              } ${order.order_status === 'completed' ? 'opacity-60' : ''}`}
            onClick={() => setSelectedOrderId(order.id)}
            onDoubleClick={() => handleRowDoubleClick(order)}
          >
            <TableCell>
              {selectedOrderId === order.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </TableCell>
            <TableCell className="font-medium">{order.order_number}</TableCell>
            <TableCell>
              {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </TableCell>
            <TableCell>
              <div className="font-medium">{order.customer_name}</div>
              {order.customer_phone && (
                <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
              )}
              {order.customer_address && (
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{order.customer_address}</div>
              )}
            </TableCell>
            <TableCell>
              {order.open_order_items?.length || 0} productos
            </TableCell>
            <TableCell>{getOrderStatusBadge(order.order_status)}</TableCell>
            <TableCell className="text-right font-bold text-lg">
              ${order.total?.toFixed(2)}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-center gap-2">
                {order.order_status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 gap-1.5 text-orange-600 border-orange-600/30 hover:bg-orange-50 hover:text-orange-700 font-medium whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
                    }}
                  >
                    <ChefHat className="h-3.5 w-3.5" /> {isMarket ? 'Aceptar' : 'Aceptar'}
                  </Button>
                )}
                {order.order_status === 'preparing' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 gap-1.5 text-blue-600 border-blue-600/30 hover:bg-blue-50 hover:text-blue-700 font-medium whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
                    }}
                  >
                    <Truck className="h-3.5 w-3.5" /> Despachar
                  </Button>
                )}
                {order.order_status === 'completed' && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 px-2 gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium whitespace-nowrap shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadToCart(order);
                    }}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Cobrar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => handlePrint(e, order)}
                  title="Imprimir Pre-cuenta"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => handleDeleteClick(e, order.id)}
                  title="Eliminar pedido"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:bg-primary/10 relative"
                  onClick={(e) => { e.stopPropagation(); setActiveChatOrderId(order.id); }}
                  title="Chat con cliente"
                >
                  <MessageCircle className="h-4 w-4" />
                  {unreadCounts[order.id] > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background animate-pulse">
                      {unreadCounts[order.id]}
                    </span>
                  )}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-4xl lg:max-w-6xl w-full h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Pedidos Web
            </DialogTitle>
            <DialogDescription className={isMobile ? 'text-xs' : ''}>
              {activeChatOrderId ? 'Conversación directa con el cliente' : (isMobile ? 'Toca para seleccionar, doble toque para cargar' : 'Selecciona un pedido para facturarlo (doble click para cargar rápido)')}
            </DialogDescription>
          </DialogHeader>

          {activeChatOrderId ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2">
                <Button variant="ghost" size="sm" onClick={() => setActiveChatOrderId(null)} className="gap-1 px-0 hover:bg-transparent">
                  ← Volver a la lista
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                {(() => {
                  const order = orders.find((o: any) => o.id === activeChatOrderId);
                  if (!order) return null;
                  return (
                    <OrderChatPanel
                      orderId={order.id}
                      storeId={order.store_id}
                      customerName={order.customer_name}
                      storeName={userStore?.store_name || 'Negocio'}
                    />
                  );
                })()}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando pedidos...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mb-4" />
              <p>No hay pedidos web registrados</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 min-h-0">
                {isMobile ? (
                  <div className="space-y-3 pr-4 pb-2">
                    {filteredOrders.map((order: any) => renderMobileCard(order))}
                  </div>
                ) : (
                  renderDesktopTable()
                )}
              </ScrollArea>

              <div className={`flex gap-2 pt-4 border-t mt-4 ${isMobile ? 'flex-col' : 'justify-end'}`}>
                {isMobile ? (
                  <>
                    <Button
                      onClick={() => handleLoadToCart()}
                      disabled={!selectedOrder}
                      className="gap-2 w-full"
                      size="lg"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Cargar al POS
                    </Button>
                    <Button variant="outline" onClick={onClose} className="w-full">
                      Cerrar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onClose}>
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => handleLoadToCart()}
                      disabled={!selectedOrder}
                      className="gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Cargar al POS
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </>
  );
};

export default WebSalesDialog;