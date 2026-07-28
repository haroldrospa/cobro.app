
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomers } from '@/hooks/useCustomers';
import { useUpdateSale, Sale } from '@/hooks/useSalesManagement';
import { useToast } from '@/hooks/use-toast';

interface EditInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

const EditInvoiceDialog: React.FC<EditInvoiceDialogProps> = ({
  isOpen,
  onClose,
  sale,
}) => {
  const [customerId, setCustomerId] = useState('general');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: customers = [] } = useCustomers();
  const updateSale = useUpdateSale();
  const { toast } = useToast();

  console.log('EditInvoiceDialog - Sale data:', sale);
  console.log('EditInvoiceDialog - isOpen:', isOpen);

  useEffect(() => {
    if (sale) {
      console.log('Setting form values with sale:', sale);
      setCustomerId(sale.customer_id || 'general');
      setPaymentMethod(sale.payment_method || 'cash');
      setStatus(sale.status || 'completed');
      setAmountReceived(sale.amount_received?.toString() || '');
      setChangeAmount(sale.change_amount?.toString() || '');

      if (sale.due_date) {
        setDueDate(sale.due_date.split('T')[0]);
      } else {
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 15);
        setDueDate(defaultDue.toISOString().split('T')[0]);
      }
    }
  }, [sale]);

  const handleSave = async () => {
    if (!sale) {
      console.error('No sale data available for update');
      return;
    }

    console.log('Attempting to save sale with ID:', sale.id);
    
    try {
      const updates: any = {
        id: sale.id,
        customer_id: customerId === 'general' ? null : customerId,
        payment_method: paymentMethod,
        status: status,
      };

      if (amountReceived && !isNaN(parseFloat(amountReceived))) {
        updates.amount_received = parseFloat(amountReceived);
      }

      if (changeAmount && !isNaN(parseFloat(changeAmount))) {
        updates.change_amount = parseFloat(changeAmount);
      }

      if (paymentMethod === 'credit') {
        updates.payment_status = status === 'completed' ? 'paid' : 'pending';
        if (dueDate) {
          updates.due_date = new Date(dueDate + 'T12:00:00').toISOString();
        }
      }

      console.log('Update payload:', updates);

      await updateSale.mutateAsync(updates);

      toast({
        title: "Factura actualizada",
        description: "Los cambios se han guardado correctamente.",
      });

      onClose();
    } catch (error) {
      console.error('Error actualizando factura:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la factura. " + (error?.message || ''),
      });
    }
  };

  const calculateChange = () => {
    const received = parseFloat(amountReceived) || 0;
    const total = sale?.total || 0;
    const change = received - total;
    setChangeAmount(change > 0 ? change.toFixed(2) : '0');
  };

  if (!sale) {
    console.log('No sale data, not rendering dialog');
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Editar Factura: {sale.invoice_number}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="customer">Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Cliente General</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.rnc && `(${customer.rnc})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment-method">Método de Pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Pagada</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === 'credit' && (
            <div>
              <Label htmlFor="due-date">Fecha de Vencimiento de Crédito</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          {paymentMethod === 'cash' && (
            <>
              <div>
                <Label htmlFor="amount-received">Monto Recibido</Label>
                <Input
                  id="amount-received"
                  type="number"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  onBlur={calculateChange}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="change-amount">Cambio</Label>
                <Input
                  id="change-amount"
                  type="number"
                  step="0.01"
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(e.target.value)}
                  placeholder="0.00"
                  readOnly
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2">
              Total de la factura: <span className="font-semibold">${sale.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateSale.isPending}>
            {updateSale.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditInvoiceDialog;
