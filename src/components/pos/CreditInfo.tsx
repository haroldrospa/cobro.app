import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { useCustomers } from '@/hooks/useCustomers';
import { AlertCircle, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { format } from 'date-fns';

interface CreditInfoProps {
  selectedCustomer: string;
  creditDays: number;
  onCreditDaysChange: (days: number) => void;
}

const CreditInfo: React.FC<CreditInfoProps> = ({
  selectedCustomer,
  creditDays,
  onCreditDaysChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: balance } = useCustomerBalance(selectedCustomer);
  const { data: customers = [] } = useCustomers();
  const { printSettings, companyInfo } = usePrintSettings();

  const customer = customers.find(c => c.id === selectedCustomer);

  const handlePrintStatement = async () => {
    try {
      toast.info("Preparando estado de cuenta...");

      const { handlePrint, injectPrintStyles, markContentAsPrintable } = await import('@/utils/printHandler');
      injectPrintStyles();

      let printFormat: '80mm' | '58mm' | 'A4' = '80mm';
      if (printSettings.paperSize === '58mm' || printSettings.paperSize === '58mm') {
        printFormat = '58mm';
      } else if (printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta') {
        printFormat = 'A4';
      }

      const isThermal = printFormat === '80mm' || printFormat === '58mm';
      const width = isThermal ? '100%' : '210mm';

      const pendingSales = balance?.pendingSales || [];
      const totalDebt = balance?.totalDebt || 0;

      const htmlContent = `
        <div class="invoice-container" style="font-family: monospace; width: ${width}; max-width: ${width}; margin: ${isThermal ? '0' : '0 auto'}; font-size: 12px; line-height: 1.2; padding: 5px; box-sizing: border-box; background: white;">
          <div style="text-align: center; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 5px;">
            ${companyInfo.logo ? `<img src="${companyInfo.logo}" style="width: ${companyInfo.logoInvoiceSize || companyInfo.logoSize || 80}px; height: auto; display: block; margin: 0 auto; object-fit: contain;"/>` : ''}
            <div style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; text-transform: uppercase;">${companyInfo.name || 'Mi Empresa'}</div>
            ${companyInfo.rnc ? `<div style="font-size: 11px;">RNC: ${companyInfo.rnc}</div>` : ''}
            ${companyInfo.phone ? `<div style="font-size: 11px;">Tel: ${companyInfo.phone}</div>` : ''}
            ${companyInfo.address ? `<div style="font-size: 11px;">${companyInfo.address}</div>` : ''}
          </div>
          
          <div style="margin: 8px 0; border: 1px solid #000; padding: 5px; text-align: center;">
            <div style="font-weight: bold; font-size: 14px; text-transform: uppercase;">ESTADO DE CUENTA</div>
            <div style="font-size: 11px;">Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          </div>
          
          <div style="margin-bottom: 8px; font-size: 11px;">
            <div><strong>CLIENTE:</strong> ${customer?.name}</div>
            ${customer?.rnc ? `<div><strong>RNC/Céd.:</strong> ${customer.rnc}</div>` : ''}
            ${customer?.phone ? `<div><strong>Tel.:</strong> ${customer.phone}</div>` : ''}
          </div>
          
          <div style="border: 1px solid #000; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #000; font-size: 10px; padding: 3px;">
              <span style="flex: 2;">FACTURA</span>
              <span style="flex: 1.5; text-align: right;">FECHA</span>
              <span style="flex: 1.5; text-align: right;">PEND.</span>
            </div>
            ${pendingSales.map((sale: any) => `
              <div style="display: flex; justify-content: space-between; font-size: 10px; padding: 3px; border-bottom: 1px dotted #ccc;">
                <span style="flex: 2;">${sale.invoice_number}</span>
                <span style="flex: 1.5; text-align: right;">${format(new Date(sale.created_at), 'dd/MM/yy')}</span>
                <span style="flex: 1.5; text-align: right; font-weight: bold;">$${sale.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            `).join('')}
          </div>
          
          <div style="border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
            <span>DEUDA TOTAL:</span>
            <span>$${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div style="text-align: center; margin-top: 20px; font-size: 10px; font-style: italic;">
            <div>Favor saldar este balance a la brevedad posible.</div>
          </div>
        </div>
      `;

      let printContainer = document.getElementById('temp-print-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'temp-print-container';
        document.body.appendChild(printContainer);
      }

      printContainer.innerHTML = htmlContent;
      markContentAsPrintable('temp-print-container');

      await new Promise(resolve => setTimeout(resolve, 50));
      await handlePrint(printFormat);

      setTimeout(() => {
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Error printing debt receipt:', error);
      toast.error('Error al imprimir el estado de cuenta');
    }
  };

  // Debug logs
  React.useEffect(() => {
    if (selectedCustomer && balance) {
      console.log('🔍 CreditInfo Debug:', {
        customerId: selectedCustomer,
        customerName: customer?.name,
        balance,
        hasPendingSales: !!(balance.pendingSales && balance.pendingSales.length > 0),
        pendingSalesCount: balance.pendingSales?.length || 0,
        totalDebt: balance.totalDebt
      });
    }
  }, [selectedCustomer, balance, customer]);

  if (!selectedCustomer) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Debe seleccionar un cliente para ventas a crédito
        </AlertDescription>
      </Alert>
    );
  }

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-2 [@media(max-height:580px)]:space-y-1">
      <div className="bg-muted p-2 rounded-lg space-y-1 [@media(max-height:580px)]:p-1 [@media(max-height:580px)]:space-y-0.5">
        <div className="flex justify-between items-center text-xs [@media(max-height:580px)]:text-[10px]">
          <span className="font-medium text-muted-foreground">Cliente:</span>
          <span className="font-semibold text-foreground">{customer?.name}</span>
        </div>
        <div className="flex justify-between items-center text-xs [@media(max-height:580px)]:text-[10px]">
          <span className="font-medium text-muted-foreground">Deuda Total:</span>
          <div className="flex items-center gap-2 [@media(max-height:580px)]:gap-1">
            <span className="font-bold text-blue-500">
              ${(balance?.totalDebt || 0).toFixed(2)}
            </span>
            {balance?.totalDebt && balance.totalDebt > 0 ? (
              <Button size="icon" variant="outline" className="h-6 w-6 rounded-sm bg-background/50 hover:bg-background shadow-xs hover:text-primary transition-colors border-primary/20 [@media(max-height:580px)]:h-5 [@media(max-height:580px)]:w-5" onClick={(e) => { e.preventDefault(); handlePrintStatement(); }} title="Imprimir Estado de Cuenta">
                <Printer className="h-3 w-3 [@media(max-height:580px)]:h-2.5 [@media(max-height:580px)]:w-2.5" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Show pending sales if there are any OR if there's debt but no sales (debug) */}
        {balance?.totalDebt && balance.totalDebt > 0 && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between p-1 h-auto hover:bg-muted/50"
              >
                <span className="text-[10px] font-medium">
                  Facturas Pendientes: ({balance.pendingSales?.length || 0})
                </span>
                {isOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-1 border-t border-border mt-1">
                {balance.pendingSales && balance.pendingSales.length > 0 ? (
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {balance.pendingSales.map((sale: any) => {
                      const daysRemaining = sale.due_date ? getDaysRemaining(sale.due_date) : null;
                      const isOverdue = daysRemaining !== null && daysRemaining < 0;
                      return (
                        <div key={sale.id} className="text-[10px] flex justify-between items-center">
                          <span>{sale.invoice_number || 'Sin NCF'}</span>
                          <span className="flex items-center gap-1">
                            <span>${(sale.total || 0).toFixed(2)}</span>
                            {daysRemaining !== null && (
                              <span className={isOverdue ? 'text-amber-500 font-medium' : 'text-muted-foreground'}>
                                {isOverdue ? `${Math.abs(daysRemaining)}d ⚠️` : `${daysRemaining}d`}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground text-center py-2">
                    No se encontraron facturas pendientes
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="[@media(max-height:580px)]:flex [@media(max-height:580px)]:items-center [@media(max-height:580px)]:justify-between [@media(max-height:580px)]:gap-2">
        <label className="text-xs font-medium mb-1 block [@media(max-height:580px)]:text-[10px] [@media(max-height:580px)]:mb-0 [@media(max-height:580px)]:flex-shrink-0">Días de Crédito:</label>
        <Input
          type="number"
          value={creditDays}
          onChange={(e) => onCreditDaysChange(parseInt(e.target.value) || 0)}
          min="1"
          max="180"
          placeholder="15"
          className="h-8 text-sm [@media(max-height:580px)]:h-7 [@media(max-height:580px)]:text-xs"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5 [@media(max-height:580px)]:hidden">
          Vence: {new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};


export default CreditInfo;
