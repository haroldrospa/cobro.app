import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/types/pos';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateTotals } from '@/utils/posCalculations';
import { useUserStore } from '@/hooks/useUserStore';
import { useBusinessType } from '@/hooks/useBusinessType';
import { Customer } from '@/hooks/useCustomers';
import { Bike, Search, Check, ChevronsUpDown, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface SaveOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onSaved: () => void;
  orderSource?: 'pos' | 'web';
  initialCustomerName?: string;
  initialNotes?: string;
  existingOrderId?: string | null;
  existingOrderNumber?: string | null;
  posOrderType?: 'dine-in' | 'takeout';
  customers?: Customer[];
  initialCustomerId?: string;
}

const SaveOrderDialog: React.FC<SaveOrderDialogProps> = ({
  isOpen,
  onClose,
  cart,
  onSaved,
  orderSource = 'pos',
  initialCustomerName = '',
  initialNotes = '',
  existingOrderId = null,
  existingOrderNumber = null,
  posOrderType = 'takeout',
  customers = [],
  initialCustomerId = ''
}) => {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  const { orderTypeTags, isStore, isSupermarket } = useBusinessType();
  const isDelivery = posOrderType === 'takeout' && (isStore || isSupermarket);

  // Update values when initial values change
  React.useEffect(() => {
    setCustomerName(initialCustomerName);
  }, [initialCustomerName]);

  React.useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  React.useEffect(() => {
    setSelectedCustomerId(initialCustomerId);
    if (initialCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || '');
        setCustomerAddress(customer.address || '');
      }
    }
  }, [initialCustomerId, customers]);

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerAddress(customer.address || '');
    setIsCustomerPopoverOpen(false);
  };

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const totals = calculateTotals(cart, { value: 0, type: 'percentage' });

      // If we have an existing order, update it
      const orderTypeTag = orderTypeTags[posOrderType];
      const cleanNotes = (notes || '')
        .replace(/\[COMER AQUÍ\]/g, '')
        .replace(/\[PARA LLEVAR\]/g, '')
        .replace(/\[COMPRA AQUÍ\]/g, '')
        .replace(/\[DELIVERY\]/g, '')
        .trim();
      const finalNotes = cleanNotes ? `${cleanNotes}\n${orderTypeTag}` : orderTypeTag;

      if (existingOrderId) {
        // 1. Obtenemos estado actual e ítems actuales
        const { data: currentOrder, error: fetchError } = await supabase
          .from('open_orders')
          .select('order_status, notes, order_number')
          .eq('id', existingOrderId)
          .single();

        const isOrderMissing = !!fetchError || !currentOrder;

        const { data: currentItems } = !isOrderMissing
          ? await supabase
              .from('open_order_items')
              .select('product_id, quantity')
              .eq('order_id', existingOrderId)
          : { data: [] };

        let isReopened = false;
        if (
          currentOrder &&
          currentOrder.order_status !== 'preparing' &&
          currentOrder.order_status !== 'pending'
        ) {
          isReopened = true;
        }

        // 2. Determinar ítems añadidos (Delta)
        const deltaItems: CartItem[] = [];
        let hasNewOrModifiedItems = false;

        cart.forEach(item => {
          const matchingOld = currentItems?.find(old => old.product_id === item.id);
          const oldQty = matchingOld ? matchingOld.quantity : 0;
          if (item.quantity > oldQty) {
            hasNewOrModifiedItems = true;
            deltaItems.push({
              ...item,
              quantity: item.quantity - oldQty
            });
          }
        });

        const updatePayload: any = {
          customer_name: customerName || 'Cliente',
          customer_phone: customerPhone || null,
          customer_address: customerAddress || null,
          customer_id: selectedCustomerId || null,
          subtotal: parseFloat(totals.subtotal),
          discount_total: parseFloat(totals.discount),
          tax_total: parseFloat(totals.tax),
          total: parseFloat(totals.total),
          notes: finalNotes,
          updated_at: new Date().toISOString()
        };

        // Crear ticket delta si hay ítems nuevos (en cualquier estado)
        const shouldCreateDeltaOrder = hasNewOrModifiedItems;

        if (isDelivery) {
          // Para supermercados/tiendas, el delivery va directo a despacho (no hay cocina)
          updatePayload.order_status = 'shipped';
        } else if (!isReopened) {
          // Sigue en cocina: solo refrescamos el timer si hay productos nuevos/modificados
          updatePayload.order_status = 'preparing';
          if (hasNewOrModifiedItems) {
            updatePayload.created_at = new Date().toISOString();
          }
        } else {
          // Ya estaba completada: mantenemos su estado, no la re-enviamos a cocina
          updatePayload.order_status = currentOrder?.order_status || 'preparing';
        }

        let orderIdToUse = existingOrderId;
        let orderNumberToUse = currentOrder?.order_number;
        let finalOrderResult: any = null;

        if (isOrderMissing) {
          // Si el pedido no existe (por ejemplo, ya fue cobrado o eliminado), lo creamos como nuevo
          const { data: orderNumber, error: orderNumberError } = await supabase
            .rpc('generate_order_number', { order_source: orderSource });

          if (orderNumberError) throw orderNumberError;

          orderNumberToUse = orderNumber;
          orderIdToUse = crypto.randomUUID();

          const { data: order, error: insertError } = await supabase
            .from('open_orders')
            .insert({
              id: orderIdToUse,
              order_number: orderNumberToUse,
              customer_name: customerName || 'Cliente',
              customer_phone: customerPhone || null,
              customer_address: customerAddress || null,
              customer_id: selectedCustomerId || null,
              payment_method: 'pending',
              subtotal: parseFloat(totals.subtotal),
              discount_total: parseFloat(totals.discount),
              tax_total: parseFloat(totals.tax),
              total: parseFloat(totals.total),
              notes: finalNotes,
              source: orderSource,
              order_status: isDelivery ? 'shipped' : 'preparing',
              payment_status: 'pending',
              profile_id: user?.id || null,
              store_id: userStore?.id || null
            })
            .select()
            .single();

          if (insertError) throw insertError;
          finalOrderResult = order;
        } else {
          // 3. Actualizamos la orden principal (Para que facture completo)
          const { data: order, error: orderError } = await supabase
            .from('open_orders')
            .update(updatePayload)
            .eq('id', existingOrderId)
            .select()
            .single();

          if (orderError) throw orderError;
          finalOrderResult = order;
        }

        const { error: deleteError } = await supabase
          .from('open_order_items')
          .delete()
          .eq('order_id', orderIdToUse);

        if (deleteError) throw deleteError;

        const orderItems = cart.map(item => {
          const taxRate = item.tax || 0.18;
          const itemTotalRaw = item.price * item.quantity;
          let subtotal, taxAmount, total;

          if (item.cost_includes_tax) {
            total = itemTotalRaw;
            subtotal = total / (1 + taxRate);
            taxAmount = total - subtotal;
          } else {
            subtotal = itemTotalRaw;
            taxAmount = subtotal * taxRate;
            total = subtotal + taxAmount;
          }

          return {
            order_id: orderIdToUse,
            product_id: item.id,
            product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
            quantity: item.quantity,
            unit_price: item.price,
            tax_percentage: taxRate * 100,
            tax_amount: taxAmount,
            subtotal: subtotal,
            total: total,
            cost_includes_tax: item.cost_includes_tax || false
          };
        });

        const { error: itemsError } = await supabase
          .from('open_order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // 4. Crear Ticket Delta para Cocina
        if (shouldCreateDeltaOrder && !isOrderMissing && currentOrder) {
          const deltaNotes = `[ACTUALIZADO]\nPedido actualizado de: ${customerName || 'Cliente'} (#${orderNumberToUse})\n${finalNotes}`;

          const { data: deltaOrder, error: deltaOrderError } = await supabase
            .from('open_orders')
            .insert({
              order_number: String(900000 + (Date.now() % 99999)),
              customer_name: customerName || 'Cliente',
              payment_method: 'pending',
              subtotal: 0,
              discount_total: 0,
              tax_total: 0,
              total: 0,
              notes: deltaNotes,
              source: 'pos',
              order_status: 'preparing',
              payment_status: 'paid',
              profile_id: user?.id || null,
              store_id: userStore?.id || null
            })
            .select()
            .single();

          if (deltaOrderError) throw deltaOrderError;

          const deltaOrderItems = deltaItems.map(item => {
            const taxRate = item.tax || 0.18;
            const itemTotalRaw = item.price * item.quantity;
            let subtotal, taxAmount, total;

            if (item.cost_includes_tax) {
              total = itemTotalRaw;
              subtotal = total / (1 + taxRate);
              taxAmount = total - subtotal;
            } else {
              subtotal = itemTotalRaw;
              taxAmount = subtotal * taxRate;
              total = subtotal + taxAmount;
            }

            return {
              order_id: deltaOrder.id,
              product_id: item.id,
              product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
              quantity: item.quantity,
              unit_price: 0, // 0 para el ticket
              tax_percentage: taxRate * 100,
              tax_amount: 0,
              subtotal: 0,
              total: 0,
              cost_includes_tax: item.cost_includes_tax || false
            };
          });

          await supabase.from('open_order_items').insert(deltaOrderItems);
        }

        return finalOrderResult;
      }

      // Resolve store ID with fallbacks
      const effectiveStoreId = userStore?.id || localStorage.getItem('cobro_last_store_id') || null;

      // Create new order with store_id
      let orderNumberToUse = `ORD-${Date.now().toString().slice(-6)}`;
      try {
        const { data: orderNumber, error: orderNumberError } = await supabase
          .rpc('generate_order_number', { order_source: orderSource });
        if (!orderNumberError && orderNumber) {
          orderNumberToUse = orderNumber;
        }
      } catch (err) {
        console.warn('generate_order_number fallback applied:', err);
      }

      const { data: order, error: orderError } = await supabase
        .from('open_orders')
        .insert({
          order_number: orderNumberToUse,
          customer_name: customerName || 'Cliente',
          customer_phone: customerPhone || null,
          customer_address: customerAddress || null,
          customer_id: selectedCustomerId || null,
          payment_method: 'pending',
          subtotal: parseFloat(totals.subtotal),
          discount_total: parseFloat(totals.discount),
          tax_total: parseFloat(totals.tax),
          total: parseFloat(totals.total),
          notes: finalNotes,
          source: orderSource,
          order_status: isDelivery ? 'shipped' : 'preparing',
          payment_status: 'pending',
          profile_id: user?.id || null,
          store_id: effectiveStoreId
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        const taxRate = item.tax || 0.18;
        const itemTotalRaw = item.price * item.quantity;

        let subtotal, taxAmount, total;

        if (item.cost_includes_tax) {
          // Si el precio incluye impuesto
          total = itemTotalRaw;
          subtotal = total / (1 + taxRate);
          taxAmount = total - subtotal;
        } else {
          // Si el precio NO incluye impuesto
          subtotal = itemTotalRaw;
          taxAmount = subtotal * taxRate;
          total = subtotal + taxAmount;
        }

        return {
          order_id: order.id,
          product_id: item.id,
          product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_percentage: taxRate * 100,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total: total,
          cost_includes_tax: item.cost_includes_tax || false
        };
      });

      const { error: itemsError } = await supabase
        .from('open_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.refetchQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      toast({
        title: existingOrderId ? "Pedido actualizado" : "Pedido guardado",
        description: `Pedido ${order.order_number} ${existingOrderId ? 'actualizado' : 'guardado'} correctamente`
      });
      setCustomerName('');
      setSelectedCustomerId('');
      setCustomerPhone('');
      setCustomerAddress('');
      setNotes('');
      onSaved();
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "No se pudo guardar el pedido"
      });
      console.error('Error saving order:', error);
    }
  });

  const handleSave = () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El carrito está vacío"
      });
      return;
    }
    saveOrderMutation.mutate();
  };

  const isEditing = !!existingOrderId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border border-border p-0 overflow-hidden rounded-2xl shadow-2xl">
        <div className="relative">
          {/* Header Area */}
          <div className="p-4 sm:p-5 pb-3 border-b border-border/60">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between mb-1">
                <div className="bg-muted/80 text-foreground p-2 rounded-xl w-fit">
                  <Save className="h-4 w-4 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight uppercase">
                {isEditing ? 'Actualizar Pedido' : 'Guardar Pedido'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {isEditing
                  ? `Actualizando pedido ${existingOrderNumber}`
                  : 'Guarda el pedido actual para cobrarlo después'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-4 sm:p-5 space-y-3.5 text-left">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground ml-0.5">Cliente</Label>
              <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCustomerPopoverOpen}
                    className="w-full justify-between bg-background border-border text-xs text-foreground hover:bg-muted rounded-xl h-10 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {selectedCustomerId 
                          ? customers.find(c => c.id === selectedCustomerId)?.name 
                          : customerName || "Seleccionar o escribir cliente..."}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border rounded-xl shadow-xl z-[150]" align="start">
                  <Command className="bg-transparent text-foreground">
                    <CommandInput placeholder="Buscar cliente..." className="border-b border-border text-xs" />
                    <CommandList className="max-h-[180px] overflow-y-auto p-1 scrollbar-thin">
                      <CommandEmpty className="text-muted-foreground text-xs py-4 text-center">No se encontró cliente.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.phone || ''} ${customer.id}`}
                            onSelect={() => handleCustomerSelect(customer)}
                            className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer rounded-lg py-2 text-xs"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 text-primary shrink-0",
                                selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-xs truncate">{customer.name}</span>
                              {customer.phone && (
                                <span className="text-[10px] text-muted-foreground">{customer.phone}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {!selectedCustomerId && (
              <div className="space-y-1.5">
                <Label htmlFor="customerName" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground ml-0.5">Nombre Manual</Label>
                <Input
                  id="customerName"
                  placeholder="Nombre del cliente..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-background border-border text-xs text-foreground placeholder:text-muted-foreground/60 rounded-xl h-10"
                  autoComplete="off"
                />
              </div>
            )}

            {isDelivery && (
              <div className="grid grid-cols-1 gap-3 border border-border/80 p-3 rounded-xl bg-muted/20">
                <div className="space-y-1.5">
                  <Label htmlFor="customerPhone" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground ml-0.5">Teléfono de Delivery</Label>
                  <Input
                    id="customerPhone"
                    placeholder="Ej: 809-555-0123"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-background border-border text-xs text-foreground placeholder:text-muted-foreground/60 rounded-xl h-10"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customerAddress" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground ml-0.5">Ubicación / Dirección</Label>
                  <Textarea
                    id="customerAddress"
                    placeholder="Dirección completa del cliente..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="bg-background border-border text-xs text-foreground placeholder:text-muted-foreground/60 rounded-xl resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground ml-0.5">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background border-border text-xs text-foreground placeholder:text-muted-foreground/60 rounded-xl resize-none"
                rows={3}
              />
            </div>

            <div className="bg-muted/40 border border-border/60 rounded-xl p-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Productos en el carrito</span>
              <span className="font-bold text-xs text-foreground bg-background px-2.5 py-0.5 rounded-lg border border-border/60 shadow-xs">
                {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>

            <DialogFooter className="flex flex-row gap-2 pt-2 !mt-4 sm:justify-end">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="flex-1 h-10 rounded-xl font-bold text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveOrderMutation.isPending || cart.length === 0}
                className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all gap-2"
              >
                {isDelivery ? <Bike className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {isDelivery ? 'Enviar Pedido' : (isEditing ? 'Actualizar' : 'Guardar') + ' Pedido'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveOrderDialog;