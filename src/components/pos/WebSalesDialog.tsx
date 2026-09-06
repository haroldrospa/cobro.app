import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Store,
  ShoppingCart,
  Check,
  Trash2,
  Calendar,
  User,
  Package,
  Phone,
  MapPin,
  ChefHat,
  Truck,
  Printer,
  MessageCircle,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Landmark,
  Clock,
  ExternalLink,
  Receipt,
  Sparkles,
  MessageSquare
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'shipped' | 'completed'>('all');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: userStore } = useUserStore();
  const { isStore, isSupermarket } = useBusinessType();
  const { companyInfo, printSettings } = usePrintSettings();
  const isMarket = isStore || isSupermarket;

  const { data: orders = [], isLoading, isFetching, refetch } = useQuery({
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

  // Search & Status filtering
  const filteredOrders = useMemo(() => {
    return validOrders.filter((order: any) => {
      const matchesStatus = statusFilter === 'all' || order.order_status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesStatus;

      const matchesQuery =
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query) ||
        order.customer_address?.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [validOrders, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      all: validOrders.length,
      pending: validOrders.filter((o: any) => o.order_status === 'pending').length,
      preparing: validOrders.filter((o: any) => o.order_status === 'preparing' || o.order_status === 'confirmed').length,
      shipped: validOrders.filter((o: any) => o.order_status === 'shipped').length,
      completed: validOrders.filter((o: any) => o.order_status === 'completed').length,
    };
  }, [validOrders]);

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
        description: "Haz clic en un pedido para cargarlo al carrito del POS"
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
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Completado
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Esperando
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            <Check className="h-3 w-3 text-blue-500" />
            Confirmado
          </Badge>
        );
      case 'preparing':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            <ChefHat className="h-3 w-3 text-orange-500" />
            {isMarket ? 'Preparando' : 'En cocina'}
          </Badge>
        );
      case 'shipped':
        return (
          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            <Truck className="h-3 w-3 text-sky-500" />
            En camino
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            Procesando
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-destructive/10 text-destructive border border-destructive/30 gap-1.5 font-medium px-2.5 py-0.5 shadow-none">
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentBadge = (method?: string) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded font-medium">
            <Banknote className="h-3 w-3 text-emerald-600" /> Efectivo
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded font-medium">
            <Landmark className="h-3 w-3 text-sky-600" /> Transf.
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded font-medium">
            <CreditCard className="h-3 w-3 text-indigo-600" /> Tarjeta
          </span>
        );
      default:
        return null;
    }
  };

  const selectedOrder = validOrders.find((o: any) => o.id === selectedOrderId);

  const openWhatsApp = (e: React.MouseEvent, phone: string, orderNumber: string) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(`¡Hola! Te contactamos de ${userStore?.store_name || 'nuestro negocio'} respecto a tu pedido #${orderNumber}.`);
    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  };

  const renderOrderItemsPreview = (order: any) => {
    const items = order.open_order_items || [];
    return (
      <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50 text-xs space-y-2 mt-2">
        <div className="flex items-center justify-between font-semibold text-muted-foreground pb-1 border-b border-border/40">
          <span>Detalle de productos ({items.length})</span>
          <span>Precio / Subtotal</span>
        </div>
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                  {item.quantity}x
                </span>
                <span className="font-medium text-foreground">{item.product_name}</span>
              </div>
              <span className="font-mono text-muted-foreground">
                ${Number(item.total || item.unit_price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="pt-2 border-t border-border/40 flex items-start gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/5 p-2 rounded-lg">
            <span className="font-semibold">Nota:</span>
            <span className="italic">{order.notes}</span>
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
        className={`cursor-pointer transition-all duration-200 border ${
          isSelected
            ? 'ring-2 ring-primary border-primary bg-primary/[0.03] shadow-sm'
            : 'hover:border-border/80 hover:bg-muted/30 bg-card'
        } ${order.order_status === 'completed' ? 'opacity-70' : ''}`}
        onClick={() => setSelectedOrderId(order.id)}
        onDoubleClick={() => handleRowDoubleClick(order)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xs bg-muted px-2.5 py-1 rounded-md border text-foreground">
                #{order.order_number}
              </span>
              {getOrderStatusBadge(order.order_status)}
              {getPaymentBadge(order.payment_method)}
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                ${Number(order.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Customer & Info */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </div>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Clock className="h-3 w-3" />
                {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: es })}
              </span>
            </div>

            {order.customer_phone && (
              <div className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span>{order.customer_phone}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-[11px] gap-1"
                  onClick={(e) => openWhatsApp(e, order.customer_phone, order.order_number)}
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </Button>
              </div>
            )}

            {order.customer_address && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{order.customer_address}</span>
              </div>
            )}
          </div>

          {/* Products Toggle */}
          <div className="pt-1">
            <button
              type="button"
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedOrderId(isExpanded ? null : order.id);
              }}
            >
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                {order.open_order_items?.length || 0} producto(s)
              </span>
              <span className="text-primary text-[11px] flex items-center gap-0.5">
                {isExpanded ? 'Ocultar' : 'Ver productos'}
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>
            {isExpanded && renderOrderItemsPreview(order)}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
            {order.order_status === 'pending' && (
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
                }}
              >
                <ChefHat className="h-3.5 w-3.5" /> Aceptar pedido
              </Button>
            )}
            {order.order_status === 'preparing' && (
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
                }}
              >
                <Truck className="h-3.5 w-3.5" /> Despachar
              </Button>
            )}
            {order.order_status === 'shipped' && (
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadToCart(order);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Cobrar en POS
              </Button>
            )}
            {order.order_status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 font-medium text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadToCart(order);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Recargar al POS
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => handlePrint(e, order)}
              title="Imprimir Pre-cuenta"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-primary hover:bg-primary/10 relative"
              onClick={(e) => { e.stopPropagation(); setActiveChatOrderId(order.id); }}
              title="Chat con cliente"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {unreadCounts[order.id] > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background animate-pulse">
                  {unreadCounts[order.id]}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => handleDeleteClick(e, order.id)}
              title="Eliminar pedido"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDesktopTable = () => (
    <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
            <TableHead className="w-[45px]"></TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Pedido</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Fecha</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] min-w-[180px]">Cliente</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Productos</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Estado</TableHead>
            <TableHead className="text-right font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-[110px]">Total</TableHead>
            <TableHead className="w-[230px] text-center font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Acciones</TableHead>
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
                    isSelected
                      ? 'bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary'
                      : 'hover:bg-muted/40'
                  } ${order.order_status === 'completed' ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  onDoubleClick={() => handleRowDoubleClick(order)}
                >
                  <TableCell className="py-3 px-2 text-center">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center mx-auto transition-colors ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 font-mono font-semibold">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs border text-foreground">
                      #{order.order_number}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                    <div className="font-medium text-foreground">
                      {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(new Date(order.created_at), 'hh:mm a', { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground/80 flex-shrink-0" />
                      <span>{order.customer_name}</span>
                    </div>
                    {order.customer_phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" />
                        <span>{order.customer_phone}</span>
                        <button
                          type="button"
                          className="text-emerald-600 hover:text-emerald-700 ml-1 hover:underline text-[11px]"
                          onClick={(e) => openWhatsApp(e, order.customer_phone, order.order_number)}
                          title="Abrir WhatsApp"
                        >
                          (WhatsApp)
                        </button>
                      </div>
                    )}
                    {order.customer_address && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{order.customer_address}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium bg-muted/60 hover:bg-muted px-2 py-1 rounded-md transition-colors border border-border/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedOrderId(isExpanded ? null : order.id);
                      }}
                      title="Clic para ver detalle"
                    >
                      <Package className="h-3.5 w-3.5 text-primary" />
                      <span>{order.open_order_items?.length || 0} items</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1 items-start">
                      {getOrderStatusBadge(order.order_status)}
                      {getPaymentBadge(order.payment_method)}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right font-bold text-base text-emerald-600 dark:text-emerald-400">
                    ${Number(order.total || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {order.order_status === 'pending' && (
                        <Button
                          size="sm"
                          className="h-8 px-2.5 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs whitespace-nowrap shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' });
                          }}
                        >
                          <ChefHat className="h-3.5 w-3.5" /> Aceptar
                        </Button>
                      )}
                      {order.order_status === 'preparing' && (
                        <Button
                          size="sm"
                          className="h-8 px-2.5 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs whitespace-nowrap shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' });
                          }}
                        >
                          <Truck className="h-3.5 w-3.5" /> Despachar
                        </Button>
                      )}
                      {order.order_status === 'shipped' && (
                        <Button
                          size="sm"
                          className="h-8 px-2.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs whitespace-nowrap shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadToCart(order);
                          }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Cobrar
                        </Button>
                      )}
                      {order.order_status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 gap-1.5 font-medium text-xs whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadToCart(order);
                          }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Cargar
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                        onClick={(e) => handlePrint(e, order)}
                        title="Imprimir Pre-cuenta"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/10 relative rounded-lg"
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

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={(e) => handleDeleteClick(e, order.id)}
                        title="Eliminar pedido"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={8} className="p-4 pt-1">
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
          className="max-w-[95vw] sm:max-w-4xl lg:max-w-5xl w-full max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b bg-muted/20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      Pedidos Web
                    </DialogTitle>
                    {validOrders.length > 0 && (
                      <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5 rounded-full">
                        {validOrders.length} {validOrders.length === 1 ? 'pedido' : 'pedidos'}
                      </Badge>
                    )}
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      En vivo
                    </span>
                  </div>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {activeChatOrderId
                      ? 'Conversación directa con el cliente'
                      : 'Gestiona, acepta y factura los pedidos recibidos desde tu tienda online'}
                  </DialogDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                title="Actualizar lista de pedidos"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </Button>
            </div>

            {/* Controls Bar (Filter tabs + Search) */}
            {!activeChatOrderId && validOrders.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
                {/* Status tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <Button
                    size="sm"
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg px-3 gap-1.5"
                    onClick={() => setStatusFilter('all')}
                  >
                    Todos
                    <span className="opacity-70 text-[11px]">({statusCounts.all})</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg px-3 gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    onClick={() => setStatusFilter('pending')}
                  >
                    Esperando
                    <span className="opacity-70 text-[11px]">({statusCounts.pending})</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'preparing' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg px-3 gap-1.5 text-orange-600 dark:text-orange-400 border-orange-500/30"
                    onClick={() => setStatusFilter('preparing')}
                  >
                    {isMarket ? 'Preparando' : 'Cocina'}
                    <span className="opacity-70 text-[11px]">({statusCounts.preparing})</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'shipped' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg px-3 gap-1.5 text-sky-600 dark:text-sky-400 border-sky-500/30"
                    onClick={() => setStatusFilter('shipped')}
                  >
                    En camino
                    <span className="opacity-70 text-[11px]">({statusCounts.shipped})</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'completed' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg px-3 gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    onClick={() => setStatusFilter('completed')}
                  >
                    Completados
                    <span className="opacity-70 text-[11px]">({statusCounts.completed})</span>
                  </Button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pedido, cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg bg-background"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Body */}
          <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeChatOrderId ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveChatOrderId(null)}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Volver a la lista de pedidos
                  </Button>
                </div>
                <div className="flex-1 min-h-0 border rounded-xl overflow-hidden shadow-inner">
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
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Cargando pedidos web...</span>
              </div>
            ) : validOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 border">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">No hay pedidos web registrados</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mt-1">
                  Cuando tus clientes hagan pedidos desde tu catálogo online, aparecerán aquí en tiempo real para ser procesados y facturados.
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No se encontraron pedidos</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  No hay pedidos que coincidan con los filtros o búsqueda actuales.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-xs"
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 pr-1">
                {isMobile ? (
                  <div className="space-y-3 pb-2">
                    {filteredOrders.map((order: any) => renderMobileCard(order))}
                  </div>
                ) : (
                  renderDesktopTable()
                )}
              </ScrollArea>
            )}
          </div>

          {/* Footer */}
          {!activeChatOrderId && validOrders.length > 0 && (
            <div className="p-4 sm:p-5 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground text-center sm:text-left">
                {selectedOrder ? (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Seleccionado: <strong className="font-mono">#{selectedOrder.order_number}</strong> — {selectedOrder.customer_name} (${Number(selectedOrder.total || 0).toFixed(2)})
                  </span>
                ) : (
                  <span className="hidden sm:inline">
                    💡 Selecciona un pedido o haz doble clic para cargarlo directamente al POS
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 sm:flex-none text-xs h-9 px-4 rounded-lg"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => handleLoadToCart()}
                  disabled={!selectedOrder}
                  className="flex-1 sm:flex-none gap-2 text-xs h-9 px-5 rounded-lg font-medium shadow-sm"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Cargar al POS
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmación de eliminación */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido web?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pedido seleccionado y sus productos asociados serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
              onClick={() => orderToDelete && deleteOrderMutation.mutate(orderToDelete)}
            >
              Eliminar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WebSalesDialog;