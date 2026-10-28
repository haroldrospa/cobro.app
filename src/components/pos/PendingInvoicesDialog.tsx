import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Clock,
  CheckCircle2,
  Printer,
  MessageCircle,
  Calendar,
  User,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { cn } from '@/lib/utils';
import { formatSafe } from '@/lib/dateUtils';

interface PendingInvoicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storeId?: string;
  onSelectSaleForPrint?: (sale: any) => void;
}

export const PendingInvoicesDialog: React.FC<PendingInvoicesDialogProps> = ({
  isOpen,
  onClose,
  storeId,
  onSelectSaleForPrint,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: storeSettings } = useStoreSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [payingSaleId, setPayingSaleId] = useState<string | null>(null);

  // Fetch pending sales using valid Supabase schema relations
  const { data: pendingSales = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pending-sales-list', storeId],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          total,
          subtotal,
          tax_total,
          amount_paid,
          amount_received,
          payment_status,
          payment_method,
          status,
          due_date,
          created_at,
          customer_id,
          store_id,
          customer:customers(id, name, phone, rnc, email),
          invoice_type:invoice_types(name, code),
          sale_items:sale_items(
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            tax_amount,
            total,
            product:products(name)
          )
        `)
        .neq('status', 'cancelled');

      // Filter by store_id if a valid store is provided
      if (storeId && storeId !== '00000000-0000-0000-0000-000000000000') {
        query = query.or(`store_id.eq.${storeId},store_id.is.null`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching pending sales:', error);
        throw error;
      }

      // Robust filter for pending payment records
      const pending = (data || []).filter((s: any) => {
        if (s.status === 'cancelled') return false;
        if (s.payment_status === 'paid') return false;
        const total = Number(s.total) || 0;
        const paid = Number(s.amount_paid) || 0;
        const remaining = total - paid;
        return (
          s.payment_status === 'pending' ||
          s.payment_status === 'partial' ||
          s.payment_method === 'credit' ||
          s.payment_method === 'pending' ||
          remaining > 0.01
        );
      });

      return pending;
    },
    enabled: isOpen,
    staleTime: 1000 * 15,
  });

  // Filtered sales by search input
  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return pendingSales;
    const term = searchTerm.toLowerCase();
    return pendingSales.filter((s: any) => {
      const inv = (s.invoice_number || '').toLowerCase();
      const cName = (s.customer?.name || '').toLowerCase();
      const cPhone = (s.customer?.phone || '').toLowerCase();
      const cRnc = (s.customer?.rnc || '').toLowerCase();
      return (
        inv.includes(term) ||
        cName.includes(term) ||
        cPhone.includes(term) ||
        cRnc.includes(term)
      );
    });
  }, [pendingSales, searchTerm]);

  // Total pending sum
  const totalPendingAmount = useMemo(() => {
    return pendingSales.reduce((acc, s: any) => {
      const total = Number(s.total) || 0;
      const paid = Number(s.amount_paid) || 0;
      const remaining = Math.max(0, total - paid);
      return acc + (remaining > 0 ? remaining : total);
    }, 0);
  }, [pendingSales]);

  // Mark sale as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (sale: any) => {
      setPayingSaleId(sale.id);
      const { error } = await supabase
        .from('sales')
        .update({
          payment_status: 'paid',
          amount_paid: sale.total,
        })
        .eq('id', sale.id);

      if (error) throw error;
      return {
        ...sale,
        payment_status: 'paid',
        amount_paid: sale.total,
      };
    },
    onSuccess: (updatedSale) => {
      toast({
        title: "¡Factura saldada!",
        description: `La factura #${updatedSale.invoice_number} ha sido marcada como Pagada.`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['pending-sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-sales-count'] });
      queryClient.invalidateQueries({ queryKey: ['customerBalance'] });
      queryClient.invalidateQueries({ queryKey: ['allCustomersBalances'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      // Dar la opción de imprimir y compartir la factura recién cobrada
      handlePrintSale(updatedSale, 'paid');
    },
    onError: (err: any) => {
      toast({
        title: "Error al actualizar factura",
        description: err.message || "No se pudo marcar como pagada.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPayingSaleId(null);
    }
  });

  const handleWhatsAppReminder = (sale: any) => {
    const phone = (sale.customer?.phone || '').replace(/\D/g, '');
    if (!phone) {
      toast({
        title: "Sin teléfono",
        description: "Este cliente no tiene número de teléfono registrado.",
        variant: "destructive"
      });
      return;
    }

    const businessName = storeSettings?.name || 'Cobro App';
    const invCode = sale.invoice_number || 'N/A';
    const total = Number(sale.total) || 0;
    const paid = Number(sale.amount_paid) || 0;
    const remaining = total - paid > 0 ? total - paid : total;
    const amountStr = remaining.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const text = encodeURIComponent(
      `Hola *${sale.customer?.name || 'Estimado/a cliente'}*, le saludamos de *${businessName}*.\n\nLe recordamos que tiene pendiente de pago la factura *#${invCode}* por un monto total de *RD$ ${amountStr}*.\n\nFavor de notificar cuando realice el pago o transferencia. ¡Muchas gracias!`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handlePrintSale = (sale: any, overrideStatus?: 'paid' | 'pending') => {
    if (!onSelectSaleForPrint) return;
    const cName = sale.customer?.name || 'Cliente Ocasional';
    const cPhone = sale.customer?.phone || '';
    const cRnc = sale.customer?.rnc || '';
    const items = (sale.sale_items && sale.sale_items.length > 0)
      ? sale.sale_items.map((si: any) => ({
          id: si.id,
          name: si.product?.name || 'Servicio / Concepto',
          product_name: si.product?.name || 'Servicio / Concepto',
          price: Number(si.unit_price) || 0,
          unit_price: Number(si.unit_price) || 0,
          quantity: Number(si.quantity) || 1,
          tax_amount: Number(si.tax_amount) || 0,
          subtotal: Number(si.subtotal) || 0,
          total: Number(si.total) || 0,
        }))
      : [];

    const effectiveStatus = overrideStatus || sale.payment_status || 'pending';
    const isPending = effectiveStatus !== 'paid';

    const saleForPrint = {
      ...sale,
      customer_name: cName,
      customer_phone: cPhone,
      customer_rnc: cRnc,
      customer: sale.customer || { name: cName, phone: cPhone, rnc: cRnc },
      items,
      invoiceType: sale.invoice_type?.code || (sale.invoice_number ? sale.invoice_number.slice(0, 3) : 'FAC'),
      paymentMethod: sale.payment_method,
      payment_status: effectiveStatus,
      is_pending_payment: isPending,
      amount_paid: isPending ? (sale.amount_paid || 0) : (sale.total || 0),
      is_service: true,
    };

    onSelectSaleForPrint(saleForPrint);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent centerVertically className="max-w-[95vw] sm:max-w-3xl p-0 overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>Facturas Pendientes de Pago</span>
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-xs font-black">
                    {pendingSales.length}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Ventas emitidas pendientes de cobro o confirmación de transferencia.
                </DialogDescription>
              </div>
            </div>

            {/* Total Balance Pill */}
            <div className="flex items-center gap-2 bg-background border border-border/80 px-3 py-1.5 rounded-xl shadow-xs self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Total Pendiente:</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                RD$ {totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Search bar & Refresh */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, comprobante o teléfono..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background/80 border-border/60"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Refrescar listado"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
              <span className="hidden sm:inline">Refrescar</span>
            </Button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-[220px]">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <span className="text-xs">Cargando facturas pendientes...</span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {searchTerm ? 'No se encontraron facturas con esa búsqueda' : '¡Excelente! No hay facturas pendientes de pago'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchTerm ? 'Intenta con otro término o comprobante' : 'Todas las cuentas emitidas se encuentran al día.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSales.map((sale: any) => {
                const isPayingThis = payingSaleId === sale.id;
                const formattedDate = sale.created_at ? formatSafe(sale.created_at, 'dd/MM/yyyy hh:mm a') : 'Fecha no disp.';
                const code = sale.invoice_number || 'N/A';
                const total = Number(sale.total) || 0;
                const paid = Number(sale.amount_paid) || 0;
                const remaining = total - paid > 0 ? total - paid : total;
                const cName = sale.customer?.name || 'Cliente Ocasional';
                const cPhone = sale.customer?.phone || '';

                return (
                  <div
                    key={sale.id}
                    className="p-3 sm:p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    {/* Left: Info */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {code}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold uppercase">
                          Pendiente de pago
                        </Badge>
                        {sale.payment_method && (
                          <span className="text-[10px] text-muted-foreground font-medium uppercase bg-muted/60 px-1.5 py-0.5 rounded">
                            {sale.payment_method === 'transfer' ? 'Transferencia' : sale.payment_method === 'credit' ? 'Crédito' : sale.payment_method}
                          </span>
                        )}
                        {sale.invoice_type?.name && (
                          <span className="text-[10px] text-muted-foreground/80 font-medium">
                            • {sale.invoice_type.name}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-foreground font-semibold truncate flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{cName}</span>
                        {cPhone && (
                          <span className="text-muted-foreground text-[11px] font-normal">
                            • {cPhone}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground/70" />
                          {formattedDate}
                        </span>
                        {sale.due_date && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            • Vence: {formatSafe(sale.due_date, 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                          {paid > 0 ? 'Balance pendiente' : 'Monto a cobrar'}
                        </div>
                        <div className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                          RD$ {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {paid > 0 && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Total: RD$ {total.toFixed(2)} • Abonado: RD$ {paid.toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* WhatsApp reminder */}
                        {cPhone && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleWhatsAppReminder(sale)}
                            className="h-8 w-8 text-emerald-500 hover:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                            title="Enviar recordatorio por WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}

                        {/* View / Print */}
                        {onSelectSaleForPrint && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handlePrintSale(sale)}
                            className="h-8 w-8 text-foreground/80 hover:text-foreground border-border/60 hover:bg-muted rounded-lg cursor-pointer"
                            title="Ver o Imprimir factura"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Mark as paid button */}
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPayingThis || markAsPaidMutation.isPending}
                          onClick={() => markAsPaidMutation.mutate(sale)}
                          className="h-8 px-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          {isPayingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Cobrar</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/60 bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
          <span>{filteredSales.length} factura{filteredSales.length !== 1 ? 's' : ''} mostrada{filteredSales.length !== 1 ? 's' : ''}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-xs"
          >
            Cerrar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default PendingInvoicesDialog;
