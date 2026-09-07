import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Store,
  ShoppingCart,
  Check,
  Trash2,
  Printer,
  MessageCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Truck,
  Phone
} from 'lucide-react';
import OrderChatPanel from './OrderChatPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: userStore } = useUserStore();
  const { isStore, isSupermarket } = useBusinessType();
  const { companyInfo, printSettings } = usePrintSettings();
  const isMarket = isStore || isSupermarket;

  const { data: orders = [], isLoading } = useQuery({
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
        .limit(30);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!userStore?.id,
    staleTime: 10000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Filter out the currently loaded order
  const validOrders = useMemo(() => {
    return orders.filter((order: any) => String(order.id) !== String(currentLoadedOrderId));
  }, [orders, currentLoadedOrderId]);

  // Search filtering
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return validOrders;

    return validOrders.filter((order: any) => {
      return (
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query) ||
        order.customer_address?.toLowerCase().includes(query)
      );
    });
  }, [validOrders, searchQuery]);

  const { data: unreadCounts = {} } = useUnreadCounts(
    validOrders.map((o: any) => o.id),
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
    const orderToLoad = order || validOrders.find((o: any) => o.id === selectedOrderId);

    if (!orderToLoad) {
      toast({
        variant: "destructive",
        title: "Selecciona un pedido",
        description: "Haz clic en un pedido para cargarlo al POS"
      });
      return;
    }

    const cartItems: CartItem[] = (orderToLoad.open_order_items || []).map((item: any) => ({
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

  const handlePrint = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      const doc = await generatePreCheckPDF(companyInfo, order, printSettings.paperSize);
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
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-medium text-xs">Completado</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none font-medium text-xs">Esperando</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-none font-medium text-xs">Confirmado</Badge>;
      case 'preparing':
        return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-none font-medium text-xs">{isMarket ? 'Preparando' : 'En cocina'}</Badge>;
      case 'shipped':
        return <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-none font-medium text-xs">En camino</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const selectedOrder = validOrders.find((o: any) => o.id === selectedOrderId);

  const openWhatsApp = (e: React.MouseEvent, phone: string, orderNumber: string) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(`¡Hola! Te contactamos respecto a tu pedido #${orderNumber}.`);
    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  };

  const renderOrderItemsPreview = (order: any) => {
    const items = order.open_order_items || [];
    return (
      <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-1.5 my-2 border border-border/40">
        <div className="font-medium text-muted-foreground pb-1 border-b border-border/30 flex justify-between">
          <span>Productos ({items.length})</span>
          <span>Importe</span>
        </div>
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center py-0.5">
            <span>
              <strong className="text-foreground font-semibold">{item.quantity}x</strong> {item.product_name}
            </span>
            <span className="text-muted-foreground font-mono">
              ${Number(item.total || item.unit_price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        {order.notes && (
          <div className="pt-1.5 text-muted-foreground border-t border-border/30">
            <span className="font-semibold text-foreground">Nota:</span> {order.notes}
          </div>
        )}
      </div>
    );
  };

  const renderMobileCard = (order: any) => {
    const isSelected = selectedOrderId === order.id;
    const isExpanded = expandedOrderId === order.id;

    return (
      <Card
        key={order.id}
        className={`cursor-pointer transition-all border ${
          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
        }`}
        onClick={() => setSelectedOrderId(order.id)}
      >
        <CardContent className="p-3.5 space-y-2.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">#{order.order_number}</span>
              {getOrderStatusBadge(order.order_status)}
            </div>
            <span className="font-bold text-sm text-foreground">
              ${Number(order.total || 0).toFixed(2)}
            </span>
          </div>

          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="font-medium text-foreground">{order.customer_name}</div>
            <div className="flex justify-between items-center">
              <span>{order.customer_phone || format(new Date(order.created_at), 'dd/MM HH:mm', { locale: es })}</span>
              <button
                type="button"
                className="text-primary text-xs hover:underline flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOrderId(isExpanded ? null : order.id);
                }}
              >
                {order.open_order_items?.length || 0} items
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {isExpanded && renderOrderItemsPreview(order)}

          <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
            {order.order_status === 'pending' && (
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
                }}
              >
                Aceptar
              </Button>
            )}
            {order.order_status === 'preparing' && (
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
                }}
              >
                Despachar
              </Button>
            )}
            <Button
              size="sm"
              variant={order.order_status === 'pending' || order.order_status === 'preparing' ? 'outline' : 'default'}
              className="h-7 text-xs flex-1"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadToCart(order);
              }}
            >
              Cargar al POS
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={(e) => handlePrint(e, order)}
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground relative"
              onClick={(e) => { e.stopPropagation(); setActiveChatOrderId(order.id); }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {unreadCounts[order.id] > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={(e) => handleDeleteClick(e, order.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDesktopTable = () => (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30 text-xs">
            <TableHead className="w-[36px]"></TableHead>
            <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
            <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
            <TableHead className="font-medium text-muted-foreground min-w-[160px]">Cliente</TableHead>
            <TableHead className="font-medium text-muted-foreground">Items</TableHead>
            <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
            <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
            <TableHead className="w-[200px] text-right font-medium text-muted-foreground pr-4">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order: any) => {
            const isSelected = selectedOrderId === order.id;
            const isExpanded = expandedOrderId === order.id;

            return (
              <React.Fragment key={order.id}>
                <TableRow
                  className={`cursor-pointer transition-colors text-sm ${
                    isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setSelectedOrderId(order.id)}
                  onDoubleClick={() => handleRowDoubleClick(order)}
                >
                  <TableCell className="py-2.5 px-2 text-center">
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary mx-auto" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" />
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 font-medium text-foreground text-xs">
                    #{order.order_number}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(order.created_at), 'dd/MM/yy · HH:mm', { locale: es })}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="font-medium text-foreground text-xs">{order.customer_name}</div>
                    {order.customer_phone && (
                      <div className="text-[11px] text-muted-foreground">
                        {order.customer_phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedOrderId(isExpanded ? null : order.id);
                      }}
                    >
                      {order.open_order_items?.length || 0} prod.
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {getOrderStatusBadge(order.order_status)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-semibold text-xs text-foreground">
                    ${Number(order.total || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2.5 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      {order.order_status === 'pending' && (
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
                          }}
                        >
                          Aceptar
                        </Button>
                      )}
                      {order.order_status === 'preparing' && (
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
                          }}
                        >
                          Despachar
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handlePrint(e, order)}
                        title="Imprimir Pre-cuenta"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground relative"
                        onClick={(e) => { e.stopPropagation(); setActiveChatOrderId(order.id); }}
                        title="Chat"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {unreadCounts[order.id] > 0 && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </Button>

                      {order.customer_phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={(e) => openWhatsApp(e, order.customer_phone, order.order_number)}
                          title="WhatsApp"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteClick(e, order.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/15 hover:bg-muted/15">
                    <TableCell colSpan={8} className="p-3">
                      {renderOrderItemsPreview(order)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-3xl lg:max-w-4xl w-full max-h-[85vh] flex flex-col p-6 rounded-xl border bg-background shadow-xl"
        >
          {/* Header */}
          <DialogHeader className="pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-muted-foreground" />
                <DialogTitle className="text-lg font-semibold">
                  Pedidos Web
                </DialogTitle>
                {validOrders.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {validOrders.length}
                  </Badge>
                )}
              </div>

              {!activeChatOrderId && validOrders.length > 2 && (
                <div className="relative w-48 hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-8 text-xs bg-muted/40"
                  />
                </div>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {activeChatOrderId
                ? 'Conversación con el cliente'
                : 'Selecciona un pedido para cargarlo al POS o gestiona su estado.'}
            </DialogDescription>
          </DialogHeader>

          {/* Content */}
          <div className="py-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeChatOrderId ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveChatOrderId(null)}
                    className="gap-1 px-0 text-xs text-muted-foreground hover:bg-transparent"
                  >
                    ← Volver a la lista
                  </Button>
                </div>
                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
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
              <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                Cargando pedidos...
              </div>
            ) : validOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Store className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">No hay pedidos web registrados</p>
                <p className="text-xs opacity-75 mt-0.5">Los nuevos pedidos aparecerán aquí automáticamente.</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <p className="text-xs">No se encontraron pedidos con "{searchQuery}"</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs mt-1"
                >
                  Limpiar búsqueda
                </Button>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                {isMobile ? (
                  <div className="space-y-2.5 pb-2">
                    {filteredOrders.map((order: any) => renderMobileCard(order))}
                  </div>
                ) : (
                  renderDesktopTable()
                )}
              </ScrollArea>
            )}
          </div>

          {/* Footer */}
          {!activeChatOrderId && (
            <div className="pt-3 border-t flex justify-end gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs h-8"
              >
                Cerrar
              </Button>
              <Button
                size="sm"
                onClick={() => handleLoadToCart()}
                disabled={!selectedOrder}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Cargar al POS
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmación de eliminación */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta acción no se puede deshacer. El pedido será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
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