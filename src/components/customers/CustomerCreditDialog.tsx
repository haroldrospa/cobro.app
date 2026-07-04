import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, Receipt, AlertTriangle, CheckCircle, DollarSign, Calendar, Loader2, Printer, X, Pencil, Check, Mail, Download, MessageCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { useUpdateCustomer, useCustomers, Customer } from '@/hooks/useCustomers';
import { useCreateCashMovement } from '@/hooks/useCashMovements';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { sendEvolutionWhatsAppMessage } from '@/utils/evolutionApi';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/hooks/useUserStore';
import InvoiceDetailsDialog from '@/components/invoices/InvoiceDetailsDialog';

interface PaymentReceipt {
  customerName: string;
  invoicesPaid: Array<{ invoice_number: string; amountPaid: number; fullyPaid: boolean }>;
  totalPaid: number;
  remainingDebt: number;
  paymentDate: Date;
  receiptNumber: string;
}

interface CustomerCreditDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomerCreditDialog: React.FC<CustomerCreditDialogProps> = ({
  customer: initialCustomer,
  open,
  onOpenChange,
}) => {
  const { data: customersList } = useCustomers();
  const customer = customersList?.find(c => c.id === initialCustomer?.id) || initialCustomer;

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Email state - Recibo de pago
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  // Email state - Estado de cuenta
  const [isStatementEmailOpen, setIsStatementEmailOpen] = useState(false);
  const [statementEmail, setStatementEmail] = useState('');
  const [isSendingStatement, setIsSendingStatement] = useState(false);

  // Invoice Details state
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');

  const handleDownloadPDF = async () => {
    if (!paymentReceipt) return;

    try {
      toast.info("Generando PDF...");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // 1. Modern Header (Premium Black Theme)
      doc.setFillColor(20, 20, 20); // Dark/Black background
      doc.rect(0, 0, pageWidth, 45, 'F');

      // 2. Load Company Logo
      if (companyInfo?.logo) {
        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";

          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            img.onload = () => { clearTimeout(timeout); resolve(); };
            img.onerror = () => { clearTimeout(timeout); resolve(); };
            img.src = companyInfo.logo;
          });

          if (img.width > 0) {
            const maxSize = 30;
            const aspect = img.width / img.height;
            let w = maxSize, h = maxSize / aspect;
            if (h > maxSize) { h = maxSize; w = maxSize * aspect; }
            const y = 7.5 + (maxSize - h) / 2;
            doc.addImage(img, 'PNG', 15, y, w, h);
          }
        } catch (e) { console.warn('Logo error', e); }
      }

      // 3. Header Text (White)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo?.name || 'Cobro App', companyInfo?.logo ? 50 : 15, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200);
      doc.text(`Generado el: ${format(new Date(), 'PPpp', { locale: es })}`, companyInfo?.logo ? 50 : 15, 28);

      // 4. Receipt Info Title
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 45, pageWidth, 30, 'F');

      doc.setTextColor(20, 20, 20);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("RECIBO DE PAGO", pageWidth / 2, 58, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`No. ${paymentReceipt.receiptNumber}`, pageWidth / 2, 66, { align: 'center' });

      // 5. Line Separator
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(1);
      doc.line(15, 75, pageWidth - 15, 75);

      // 6. Customer & Summary Info
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("DATOS DEL CLIENTE:", 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nombre: ${paymentReceipt.customerName}`, 15, 91);
      doc.text(`Fecha de Pago: ${format(paymentReceipt.paymentDate, 'dd/MM/yyyy HH:mm')}`, 15, 96);

      // 7. Table of Invoices
      const head = [['Factura #', 'Concepto', 'Monto Pagado']];
      const body = paymentReceipt.invoicesPaid.map(inv => [
        inv.invoice_number,
        inv.fullyPaid ? 'Saldado' : 'Abono Parcial',
        `$${inv.amountPaid.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 105,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 2: { halign: 'right' } }
      });

      // 8. Totals Area
      let finalY = (doc as any).lastAutoTable.finalY + 15;
      if (finalY + 30 > pageHeight) { doc.addPage(); finalY = 20; }

      // Total Paid Box
      doc.setFillColor(248, 248, 250);
      doc.rect(pageWidth - 110, finalY - 8, 95, 12, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("TOTAL PAGADO:", pageWidth - 105, finalY);
      doc.setTextColor(22, 163, 74); // Vibrant Green
      doc.text(`$${paymentReceipt.totalPaid.toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

      // Remaining Debt
      finalY += 10;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("Balance Pendiente:", pageWidth - 105, finalY);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`$${paymentReceipt.remainingDebt.toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

      // 9. Watermark & Footer (Standardized)
      let logoImg: HTMLImageElement | null = null;
      try {
        logoImg = new Image();
        logoImg.src = `${window.location.origin}/cobro-logo.png`;
        logoImg.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
          logoImg!.onload = resolve;
          logoImg!.onerror = () => resolve(null);
          if (logoImg!.complete) resolve(null);
        });
      } catch (e) { }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        const footerY = pageHeight - 15;
        doc.text("Gracias por su preferencia", 15, footerY);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, footerY, { align: 'right' });

        // Watermark "COBRO" logic
        const watermarkY = pageHeight - 8;
        const logoSize = 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(180, 180, 180);
        const text = "COBRO";
        const textWidth = doc.getTextWidth(text);
        const startX = (pageWidth - (logoSize + 4 + textWidth)) / 2;

        if (logoImg) {
          try { doc.addImage(logoImg, 'PNG', startX, watermarkY - 5, logoSize, logoSize, undefined, 'FAST'); } catch (e) { }
        }
        doc.text(text, startX + logoSize + 4, watermarkY);
      }

      doc.save(`Recibo_Pago_${paymentReceipt.receiptNumber}.pdf`);
      toast.success("Recibo PDF generado con éxito");

    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Error al generar el recibo PDF");
    }
  };

  const handleSendEmail = () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      toast.error('Correo inválido');
      return;
    }
    if (!paymentReceipt) return;
    const subject = encodeURIComponent(`Recibo de pago - ${paymentReceipt.receiptNumber}`);
    const body = encodeURIComponent(
      `Estimado/a ${paymentReceipt.customerName},\n\nAdjunto su recibo de pago No. ${paymentReceipt.receiptNumber}.\n\nTotal pagado: $${paymentReceipt.totalPaid.toLocaleString()}\nBalance pendiente: $${paymentReceipt.remainingDebt.toLocaleString()}\n\nGracias por su pago.`
    );
    window.open(`mailto:${emailAddress}?subject=${subject}&body=${body}`, '_blank');
    toast.success(`Correo preparado para ${emailAddress}`);
    setIsEmailDialogOpen(false);
    setEmailAddress('');
  };

  const handleSendStatementEmail = async () => {
    if (!statementEmail || !statementEmail.includes('@')) {
      toast.error('Correo inválido');
      return;
    }
    setIsSendingStatement(true);
    try {
      const subject = encodeURIComponent(`Estado de Cuenta - ${customer?.name}`);
      const invoiceLines = (pendingSales || []).map(s =>
        `  • ${s.invoice_number} — ${format(new Date(s.created_at), 'dd/MM/yy')} — $${s.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ).join('\n');
      const body = encodeURIComponent(
        `Estimado/a ${customer?.name},\n\n` +
        `Le enviamos su estado de cuenta al ${format(new Date(), 'dd/MM/yyyy')}:\n\n` +
        `${invoiceLines}\n\n` +
        `DEUDA TOTAL: $${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
        `Favor saldar este balance a la brevedad posible.\n\nGracias.`
      );
      window.open(`mailto:${statementEmail}?subject=${subject}&body=${body}`, '_blank');
      toast.success(`Correo preparado para ${statementEmail}`);
      setIsStatementEmailOpen(false);
      setStatementEmail('');
    } catch (e) {
      toast.error('Error al preparar el correo');
    } finally {
      setIsSendingStatement(false);
    }
  };

  const handleDownloadStatementPDF = async () => {
    try {
      toast.info('Generando PDF...');
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.width;

      // ── Header bar ──
      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, pageWidth, 42, 'F');

      // Logo
      if (companyInfo?.logo) {
        try {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          await new Promise<void>(resolve => {
            const t = setTimeout(() => resolve(), 3000);
            img.onload = () => { clearTimeout(t); resolve(); };
            img.onerror = () => { clearTimeout(t); resolve(); };
            img.src = companyInfo.logo;
          });
          if (img.width > 0) {
            const maxH = 28, aspect = img.width / img.height;
            const w = maxH * aspect, h = maxH;
            doc.addImage(img, 'PNG', 14, 7, w, h);
          }
        } catch (e) { console.warn('logo', e); }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(companyInfo?.name || 'Mi Empresa', pageWidth - 14, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      if (companyInfo?.phone) doc.text(`Tel: ${companyInfo.phone}`, pageWidth - 14, 27, { align: 'right' });
      if (companyInfo?.address) doc.text(String(companyInfo.address), pageWidth - 14, 32, { align: 'right' });

      // ── Title Box ──
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 42, pageWidth, 20, 'F');
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('ESTADO DE CUENTA', pageWidth / 2, 55, { align: 'center' });

      // ── Customer info ──
      let y = 72;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text('CLIENTE:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(customer?.name || '', 40, y);
      y += 6;
      if (customer?.rnc) { doc.text(`RNC/Cédula: ${customer.rnc}`, 14, y); y += 6; }
      if (customer?.phone) { doc.text(`Tel: ${customer.phone}`, 14, y); y += 6; }
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, y);
      y += 10;

      // ── Invoices Table ──
      const tableBody = (pendingSales || []).map(sale => [
        sale.invoice_number,
        format(new Date(sale.created_at), 'dd/MM/yyyy'),
        sale.due_date ? format(new Date(sale.due_date), 'dd/MM/yyyy') : '-',
        `$${sale.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        sale.amount_paid > 0 ? `$${sale.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
        `$${sale.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      ]);

      autoTable(doc, {
        head: [['Factura', 'Fecha', 'Vencimiento', 'Total', 'Abonado', 'Pendiente']],
        body: tableBody,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [15, 15, 15], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { halign: 'center', cellWidth: 28 },
          2: { halign: 'center', cellWidth: 28 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });

      const finalY = (doc as any).lastAutoTable?.finalY + 8;

      // ── Total Box ──
      doc.setFillColor(15, 15, 15);
      doc.roundedRect(pageWidth - 80, finalY, 66, 14, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('DEUDA TOTAL:', pageWidth - 76, finalY + 9);
      doc.text(`$${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 9, { align: 'right' });

      // ── Footer ──
      const ph = doc.internal.pageSize.height;
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Favor saldar este balance a la brevedad posible. Gracias por su preferencia.', pageWidth / 2, ph - 12, { align: 'center' });
      doc.text('COBRO', pageWidth / 2, ph - 6, { align: 'center' });

      doc.save(`Estado_Cuenta_${customer?.name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('PDF descargado');
    } catch (e) {
      console.error(e);
      toast.error('Error generando el PDF');
    }
  };


  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');

  const handleUpdateLimit = async () => {
    const limit = parseFloat(newCreditLimit);
    if (isNaN(limit) || limit < 0) {
      toast.error("Límite inválido");
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_limit: limit
      });
      toast.success("Límite de crédito actualizado");
      setIsEditingLimit(false);
    } catch (e) {
      console.error(e);
      toast.error("Error actualizando límite");
    }
  };

  const { data: balanceData, isLoading } = useCustomerBalance(customer?.id);
  const updateCustomer = useUpdateCustomer();
  const createCashMovement = useCreateCashMovement();
  const queryClient = useQueryClient();
  const { userStore } = useUserStore();
  const { settings: storeSettings } = useStoreSettings();
  const { companyInfo } = usePrintSettings();
  
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const { data: userData } = useUserStore();

  if (!customer) return null;

  const { totalDebt, pendingSales } = balanceData || { totalDebt: 0, pendingSales: [] };

  const handleSendWhatsApp = () => {
    if (!customer?.phone) {
      toast.error('El cliente no tiene un número de teléfono registrado');
      return;
    }

    if (!pendingSales || pendingSales.length === 0) {
      toast.error('No hay facturas pendientes para enviar');
      return;
    }

    let phone = customer.phone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = `1${phone}`;
    }

    let invoicesList = '';
    pendingSales.forEach(sale => {
      invoicesList += `• Factura *${sale.invoice_number}*: *$${sale.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}*\n`;
    });

    const message = `Estimado/a ${customer.name},\n\n` +
      `Esperamos que se encuentre muy bien.\n\n` +
      `Le contactamos de manera cordial de parte de *${companyInfo?.name || 'nuestra empresa'}* para comunicarle que su balance total pendiente es de *$${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}*.\n\n` +
      `A continuación, le detallamos las facturas correspondientes:\n` +
      `${invoicesList}\n` +
      `Le agradecemos profundamente su pronta atención a este estado de cuenta. Si ya realizó el pago, por favor omita este mensaje.\n\n` +
      `¡Que tenga un excelente día!\n\n` +
      `Atentamente,\n*${companyInfo?.name || 'La Gerencia'}*\n\n` +
      `*(Este es un mensaje automático de Cobro App)*`;
    
    if (storeSettings?.evolution_enabled && storeSettings?.evolution_api_url && storeSettings?.evolution_instance_name && storeSettings?.evolution_api_key) {
      setIsSendingWhatsApp(true);
      toast('Enviando estado de cuenta por WhatsApp...', { description: 'El mensaje se está enviando en segundo plano.' });
      
      sendEvolutionWhatsAppMessage(phone, message, {
        url: storeSettings.evolution_api_url,
        instanceName: storeSettings.evolution_instance_name,
        apiKey: storeSettings.evolution_api_key
      }).then(() => {
        toast.success('Estado de cuenta enviado por WhatsApp');
      }).catch((err: any) => {
        toast.error('Error al enviar WhatsApp automático', { description: err.message || 'Verifica la conexión con Evolution API.' });
      }).finally(() => {
        setIsSendingWhatsApp(false);
      });
    } else {
      toast.error('WhatsApp Automático no configurado', { description: 'Debes configurar Evolution API en los Ajustes del sistema.' });
    }
  };

  const selectedTotal = pendingSales
    .filter(sale => selectedInvoices.includes(sale.id))
    .reduce((sum, sale) => sum + sale.balance, 0);

  // Get invoice numbers for display
  const pendingInvoiceNumbers = pendingSales.map(sale => sale.invoice_number).join(', ');

  const handleToggleInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === pendingSales.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(pendingSales.map(sale => sale.id));
    }
  };

  const getDaysOverdue = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REC-${timestamp}-${random}`;
  };

  const handlePaySelected = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Selecciona al menos una factura para pagar');
      return;
    }

    setIsProcessing(true);
    try {
      // Get the invoices being paid for the receipt (pay remaining balance)
      const invoicesPaid = pendingSales
        .filter(sale => selectedInvoices.includes(sale.id))
        .map(sale => ({
          invoice_number: sale.invoice_number,
          amountPaid: sale.balance,
          fullyPaid: true
        }));

      // Update selected invoices to paid (set amount_paid = total)
      for (const invoiceId of selectedInvoices) {
        const sale = pendingSales.find(s => s.id === invoiceId);
        if (sale) {
          const { error } = await supabase
            .from('sales')
            .update({
              payment_status: 'paid',
              amount_paid: sale.total,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoiceId);
          if (error) throw error;
        }
      }

      // Update customer's credit_used
      const newCreditUsed = Math.max(0, (customer.credit_used || 0) - selectedTotal);
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_used: newCreditUsed,
      });

      // Generate receipt
      const receiptNo = generateReceiptNumber();

      // Ensure the payment appears in the POS daily sales (Ventas del dia)
      const { data: authData } = await supabase.auth.getUser();
      const profileId = authData.user?.id;
      
      let storeId = null;
      let invoiceTypeId = null;
      if (profileId) {
        const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', profileId).maybeSingle();
        storeId = profile?.store_id;
      }
      
      const { data: invoiceType } = await supabase.from('invoice_types').select('id').eq('code', 'B02').maybeSingle();
      invoiceTypeId = invoiceType?.id;
      
      const receiptSaleId = crypto.randomUUID();
      
      // We insert a sale representing this payment so it appears in "Ventas del Día" 
      await supabase.from('sales').insert({
        id: receiptSaleId,
        invoice_number: receiptNo,
        customer_id: customer.id,
        invoice_type_id: invoiceTypeId,
        subtotal: selectedTotal,
        tax_total: 0,
        discount_total: 0,
        total: selectedTotal,
        payment_method: paymentMethod,
        amount_received: selectedTotal,
        payment_status: 'paid',
        profile_id: profileId,
        store_id: storeId
      });

      await supabase.from('sale_items').insert({
        sale_id: receiptSaleId,
        product_name: `Abono de Deuda (Facturas: ${invoicesPaid.map(i => i.invoice_number).join(', ')})`,
        quantity: 1,
        unit_price: selectedTotal,
        subtotal: selectedTotal,
        total: selectedTotal,
        tax_percentage: 0,
        tax_amount: 0
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      // Generate receipt
      setPaymentReceipt({
        customerName: customer.name,
        invoicesPaid,
        totalPaid: selectedTotal,
        remainingDebt: Math.max(0, totalDebt - selectedTotal),
        paymentDate: new Date(),
        receiptNumber: generateReceiptNumber(),
      });

      toast.success(`Se pagaron ${selectedInvoices.length} factura(s) por $${selectedTotal.toLocaleString()}`);
      setSelectedInvoices([]);
      setPaymentAmount('');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayAll = async () => {
    if (pendingSales.length === 0) {
      toast.error('No hay facturas pendientes');
      return;
    }

    setIsProcessing(true);
    try {
      const invoicesPaid = pendingSales.map(sale => ({
        invoice_number: sale.invoice_number,
        amountPaid: sale.balance,
        fullyPaid: true
      }));

      // Update all invoices to paid with amount_paid = total
      for (const sale of pendingSales) {
        const { error } = await supabase
          .from('sales')
          .update({
            payment_status: 'paid',
            amount_paid: sale.total,
            updated_at: new Date().toISOString()
          })
          .eq('id', sale.id);
        if (error) throw error;
      }

      // Update customer's credit_used to 0
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_used: 0,
      });

      // Generate receipt
      const receiptNo = generateReceiptNumber();

      // Ensure the payment appears in the POS daily sales (Ventas del dia)
      const { data: authData } = await supabase.auth.getUser();
      const profileId = authData.user?.id;
      
      let storeId = null;
      let invoiceTypeId = null;
      if (profileId) {
        const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', profileId).maybeSingle();
        storeId = profile?.store_id;
      }
      
      const { data: invoiceType } = await supabase.from('invoice_types').select('id').eq('code', 'B02').maybeSingle();
      invoiceTypeId = invoiceType?.id;
      
      const receiptSaleId = crypto.randomUUID();
      
      // We insert a sale representing this payment so it appears in "Ventas del Día" 
      await supabase.from('sales').insert({
        id: receiptSaleId,
        invoice_number: receiptNo,
        customer_id: customer.id,
        invoice_type_id: invoiceTypeId,
        subtotal: totalDebt,
        tax_total: 0,
        discount_total: 0,
        total: totalDebt,
        payment_method: paymentMethod,
        amount_received: totalDebt,
        payment_status: 'paid',
        profile_id: profileId,
        store_id: storeId
      });

      await supabase.from('sale_items').insert({
        sale_id: receiptSaleId,
        product_name: `Saldar Deuda Total (Varias Facturas)`,
        quantity: 1,
        unit_price: totalDebt,
        subtotal: totalDebt,
        total: totalDebt,
        tax_percentage: 0,
        tax_amount: 0
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      setPaymentReceipt({
        customerName: customer.name,
        invoicesPaid,
        totalPaid: totalDebt,
        remainingDebt: 0,
        paymentDate: new Date(),
        receiptNumber: generateReceiptNumber(),
      });

      toast.success(`Se pagó la deuda total de $${totalDebt.toLocaleString()}`);
      setSelectedInvoices([]);
      setPaymentAmount('');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo de Pago</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .info { margin-bottom: 15px; }
            .info p { margin: 5px 0; font-size: 12px; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 5px; text-align: left; }
            th { border-bottom: 1px solid #ccc; }
            .total { font-weight: bold; font-size: 14px; margin-top: 15px; text-align: right; }
            .remaining { font-size: 12px; margin-top: 5px; text-align: right; color: #dc2626; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
            .app-watermark { 
              margin-top: 20px; 
              padding-top: 15px; 
              border-top: 1px dotted #ccc;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              gap: 8px; 
              opacity: 0.5; 
            }
            .app-watermark img { 
              height: 16px; 
              width: auto; 
              filter: grayscale(100%); 
            }
            .app-watermark span { 
              font-size: 11px; 
              font-weight: 600; 
              color: #999; 
              text-transform: uppercase; 
              letter-spacing: 1px; 
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

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
            ${(pendingSales || []).map(sale => `
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

  const creditLimit = customer.credit_limit || 0;
  // Use real-time totalDebt as the authority for credit used, rather than the potentially stale database field
  const creditUsed = totalDebt;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const creditPercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

  // If showing receipt
  if (paymentReceipt) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setPaymentReceipt(null);
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recibo de Pago
            </DialogTitle>
          </DialogHeader>

          <div ref={receiptRef} className="space-y-4 p-4 bg-card rounded-lg border">
            <div className="header text-center">
              <h1 className="text-lg font-bold">RECIBO DE PAGO</h1>
              <p className="text-sm text-muted-foreground">No. {paymentReceipt.receiptNumber}</p>
            </div>

            <div className="info space-y-1">
              <p className="text-sm"><strong>Cliente:</strong> {paymentReceipt.customerName}</p>
              <p className="text-sm"><strong>Fecha:</strong> {format(paymentReceipt.paymentDate, 'PPP', { locale: es })}</p>
              <p className="text-sm"><strong>Hora:</strong> {format(paymentReceipt.paymentDate, 'HH:mm:ss')}</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold mb-2">Facturas Pagadas:</p>
              <div className="space-y-1">
                {paymentReceipt.invoicesPaid.map((invoice, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      {invoice.invoice_number}
                      {!invoice.fullyPaid && <span className="text-xs text-muted-foreground ml-1">(abono)</span>}
                    </span>
                    <span>${invoice.amountPaid.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">TOTAL PAGADO:</span>
              <span className="text-xl font-bold text-green-500">
                ${paymentReceipt.totalPaid.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium text-muted-foreground">Balance Pendiente:</span>
              <span className="text-sm font-bold text-red-500">
                ${paymentReceipt.remainingDebt.toLocaleString()}
              </span>
            </div>

            <div className="footer text-center text-xs text-muted-foreground mt-4">
              <p>Gracias por su pago</p>
              <div className="app-watermark" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dotted #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                <img src={`${typeof window !== 'undefined' ? window.location.origin : ''}/cobro-logo.png`} alt="Cobro" style={{ height: '16px', width: 'auto', filter: 'grayscale(100%)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Cobro</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button onClick={handlePrintReceipt} className="flex-1" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" className="flex-1" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => setIsEmailDialogOpen(true)} variant="outline" className="flex-1" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Enviar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPaymentReceipt(null)}
              className="flex-1"
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Email Dialog
  if (isEmailDialogOpen && paymentReceipt) {
    return (
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enviar Recibo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enviar recibo {paymentReceipt.receiptNumber} por correo.
            </p>
            <Input
              placeholder="correo@ejemplo.com"
              value={emailAddress}
              onChange={e => setEmailAddress(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSendEmail}><Mail className="h-4 w-4 mr-2" /> Enviar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Email Dialog - Statement
  if (isStatementEmailOpen) {
    return (
      <Dialog open={isStatementEmailOpen} onOpenChange={setIsStatementEmailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Enviar Estado de Cuenta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold">{customer?.name}</p>
              <p className="text-muted-foreground">{pendingSales.length} factura(s) pendiente(s)</p>
              <p className="text-muted-foreground font-bold">
                Deuda total: ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input
                type="email"
                placeholder="cliente@ejemplo.com"
                value={statementEmail}
                onChange={e => setStatementEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendStatementEmail()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Se abrirá tu cliente de correo con el estado de cuenta listo para enviar.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIsStatementEmailOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSendStatementEmail}
                disabled={isSendingStatement || !statementEmail}
                className="gap-2"
              >
                {isSendingStatement
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mail className="h-4 w-4" />
                }
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] flex flex-col p-0 gap-0 outline-none overflow-hidden">
        <div className="p-4 sm:p-6 pb-2">
          <DialogHeader className="pr-8 sm:pr-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold truncate">Gestión de Crédito - {customer.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Button size="sm" variant="outline" onClick={handlePrintStatement} className="h-9 sm:h-8 shadow-sm gap-1.5 px-3">
                  <Printer className="h-4 w-4" />
                  <span className="hidden xs:inline">Imprimir</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadStatementPDF} className="h-9 sm:h-8 shadow-sm gap-1.5 px-3">
                  <Download className="h-4 w-4" />
                  <span className="hidden xs:inline">PDF</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setStatementEmail(customer?.email || '');
                  setIsStatementEmailOpen(true);
                }} className="h-9 sm:h-8 shadow-sm gap-1.5 px-3">
                  <Mail className="h-4 w-4" />
                  <span className="hidden xs:inline">Enviar</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleSendWhatsApp} className="h-9 sm:h-8 shadow-sm gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 px-3">
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden xs:inline">WhatsApp</span>
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Información de Crédito y Pago (6 cols on lg) */}
            <div className="lg:col-span-6 space-y-4">
              {/* Resumen de crédito */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-red-500">${totalDebt.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Deuda Total</p>
                    {pendingSales.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate" title={pendingInvoiceNumbers}>
                        {pendingSales.length} factura(s)
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-yellow-500">${creditUsed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Crédito Usado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-green-500">${creditAvailable.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Disponible</p>
                  </CardContent>
                </Card>
              </div>

              {/* Show pending invoice numbers */}
              {pendingSales.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Facturas pendientes:</p>
                  <p className="text-sm font-medium">{pendingInvoiceNumbers}</p>
                </div>
              )}

              {/* Barra de crédito */}
              <div className="space-y-1">
                <div className="flex justify-between items-end text-xs text-muted-foreground mb-1 h-8">
                  {isEditingLimit ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <span className="font-medium text-foreground whitespace-nowrap">Nuevo Límite:</span>
                      <div className="relative">
                        <DollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          value={newCreditLimit}
                          onChange={e => setNewCreditLimit(e.target.value)}
                          className="h-7 w-28 text-xs pl-5"
                          placeholder="0.00"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateLimit();
                            if (e.key === 'Escape') setIsEditingLimit(false);
                          }}
                        />
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleUpdateLimit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setIsEditingLimit(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span>Límite de crédito: <span className="font-medium text-foreground">${creditLimit.toLocaleString()}</span></span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-muted"
                        onClick={() => {
                          setNewCreditLimit(creditLimit.toString());
                          setIsEditingLimit(true);
                        }}
                        title="Editar límite de crédito"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <span>{creditPercentage.toFixed(0)}% utilizado</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ease-out ${creditPercentage >= 90 ? 'bg-red-500' : creditPercentage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${Math.min(creditPercentage, 100)}%` }}
                  />
                </div>
              </div>

              {customer.credit_due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Vencimiento de crédito: {format(new Date(customer.credit_due_date), 'PPP', { locale: es })}</span>
                </div>
              )}

              <Separator />

              {/* Opciones de pago */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Procesar Pago
                  </span>
                  <div className="flex items-center gap-2 text-sm font-normal">
                    <span className="text-muted-foreground mr-2">Método de Pago:</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'transfer')}
                      className="bg-card border rounded-md text-sm px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>
                </h3>

                {/* Pay All Button - Prominent */}
                <Button
                  onClick={handlePayAll}
                  disabled={pendingSales.length === 0 || isProcessing}
                  className="w-full h-12 text-lg"
                  variant="default"
                >
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <DollarSign className="h-5 w-5 mr-2" />
                  )}
                  Pagar Todo - ${totalDebt.toLocaleString()}
                </Button>

                {/* Abonar section */}
                <Card className="border-primary/50">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium">Abonar a la deuda</p>
                    <p className="text-xs text-muted-foreground">
                      El abono se aplicará a las facturas más antiguas primero
                    </p>
                    {/* Quick amount buttons */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {totalDebt > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentAmount(totalDebt.toFixed(2))}
                            className="text-xs"
                          >
                            Exacto (${totalDebt.toLocaleString()})
                          </Button>
                          {[500, 1000, 2000, 5000].filter(amt => amt <= totalDebt).map(amt => (
                            <Button
                              key={amt}
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentAmount(amt.toString())}
                              className="text-xs"
                            >
                              ${amt.toLocaleString()}
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Monto a abonar"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={async () => {
                          const amount = parseFloat(paymentAmount);
                          if (isNaN(amount) || amount <= 0) {
                            toast.error('Ingresa un monto válido');
                            return;
                          }
                          if (amount > totalDebt) {
                            toast.error('El monto no puede ser mayor que la deuda total');
                            return;
                          }

                          setIsProcessing(true);
                          try {
                            let remainingAmount = amount;
                            const invoicesPaidDetails: Array<{ invoice_number: string; amountPaid: number; fullyPaid: boolean }> = [];

                            // Sort by due date (oldest first) and pay invoices
                            const sortedSales = [...pendingSales].sort((a, b) =>
                              new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime()
                            );

                            for (const sale of sortedSales) {
                              if (remainingAmount <= 0) break;

                              const currentBalance = sale.balance; // remaining balance on this invoice
                              const paymentForThisInvoice = Math.min(remainingAmount, currentBalance);
                              const newAmountPaid = sale.amount_paid + paymentForThisInvoice;
                              const fullyPaid = newAmountPaid >= sale.total;

                              // Update the invoice
                              const { error } = await supabase
                                .from('sales')
                                .update({
                                  amount_paid: newAmountPaid,
                                  payment_status: fullyPaid ? 'paid' : 'pending',
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', sale.id);

                              if (error) throw error;

                              invoicesPaidDetails.push({
                                invoice_number: sale.invoice_number,
                                amountPaid: paymentForThisInvoice,
                                fullyPaid
                              });

                              remainingAmount -= paymentForThisInvoice;
                            }

                            // Update customer's credit_used
                            const newCreditUsed = Math.max(0, (customer.credit_used || 0) - amount);
                            await updateCustomer.mutateAsync({
                              id: customer.id,
                              credit_used: newCreditUsed,
                            });

                            queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
                            queryClient.invalidateQueries({ queryKey: ['sales'] });

                            // Generate receipt
                            const receiptNo = generateReceiptNumber();

                            // Ensure the payment appears in the POS daily sales (Ventas del dia)
                            const { data: authData } = await supabase.auth.getUser();
                            const profileId = authData.user?.id;
                            
                            let storeId = null;
                            let invoiceTypeId = null;
                            if (profileId) {
                              const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', profileId).maybeSingle();
                              storeId = profile?.store_id;
                            }
                            
                            const { data: invoiceType } = await supabase.from('invoice_types').select('id').eq('code', 'B02').maybeSingle();
                            invoiceTypeId = invoiceType?.id;
                            
                            const receiptSaleId = crypto.randomUUID();
                            
                            await supabase.from('sales').insert({
                              id: receiptSaleId,
                              invoice_number: receiptNo,
                              customer_id: customer.id,
                              invoice_type_id: invoiceTypeId,
                              subtotal: amount,
                              tax_total: 0,
                              discount_total: 0,
                              total: amount,
                              payment_method: paymentMethod,
                              amount_received: amount,
                              payment_status: 'paid',
                              profile_id: profileId,
                              store_id: storeId
                            });

                            await supabase.from('sale_items').insert({
                              sale_id: receiptSaleId,
                              product_name: `Abono Parcial a Deuda`,
                              quantity: 1,
                              unit_price: amount,
                              subtotal: amount,
                              total: amount,
                              tax_percentage: 0,
                              tax_amount: 0
                            });

                            setPaymentReceipt({
                              customerName: customer.name,
                              invoicesPaid: invoicesPaidDetails,
                              totalPaid: amount,
                              remainingDebt: Math.max(0, totalDebt - amount),
                              paymentDate: new Date(),
                              receiptNumber: receiptNo,
                            });

                            const fullyPaidCount = invoicesPaidDetails.filter(i => i.fullyPaid).length;
                            const partialCount = invoicesPaidDetails.filter(i => !i.fullyPaid).length;
                            let message = `Se abonaron $${amount.toLocaleString()}`;
                            if (fullyPaidCount > 0) message += ` (${fullyPaidCount} factura(s) pagadas)`;
                            if (partialCount > 0) message += ` (${partialCount} abono(s) parcial(es))`;
                            toast.success(message);

                            setPaymentAmount('');
                          } catch (error) {
                            console.error('Error processing payment:', error);
                            toast.error('Error al procesar el abono');
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={!paymentAmount || isProcessing}
                        className="min-w-[100px]"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Abonar'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">O pagar facturas seleccionadas</p>
                  <Button
                    onClick={handlePaySelected}
                    disabled={selectedInvoices.length === 0 || isProcessing}
                    className="w-full"
                    variant="secondary"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Pagar Seleccionadas - ${selectedTotal.toLocaleString()}
                  </Button>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Facturas Pendientes (6 cols on lg) */}
            <div className="lg:col-span-6 space-y-4">
              {/* Facturas pendientes */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Facturas Pendientes ({pendingSales.length})
                  </h3>
                  {pendingSales.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                      {selectedInvoices.length === pendingSales.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </Button>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : pendingSales.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-muted-foreground">No hay facturas pendientes</p>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="h-[55vh] pr-2">
                    <div className="space-y-2">
                      {pendingSales.map((sale) => {
                        const daysOverdue = getDaysOverdue(sale.due_date);
                        const isOverdue = daysOverdue > 0;
                        const isSelected = selectedInvoices.includes(sale.id);

                        return (
                          <Card
                            key={sale.id}
                            className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => handleToggleInvoice(sale.id)}
                            onDoubleClick={() => setViewingSaleId(sale.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleInvoice(sale.id)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{sale.invoice_number}</span>
                                    <div className="text-right">
                                      <span className="font-bold">${sale.balance.toLocaleString()}</span>
                                      {sale.amount_paid > 0 && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          (de ${sale.total.toLocaleString()})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                    <span>
                                      {format(new Date(sale.created_at), 'dd/MM/yyyy')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {sale.amount_paid > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          Abonado: ${sale.amount_paid.toLocaleString()}
                                        </Badge>
                                      )}
                                      {sale.due_date && (
                                        <span className="flex items-center gap-1">
                                          Vence: {format(new Date(sale.due_date), 'dd/MM/yyyy')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isOverdue && (
                                  <Badge variant="destructive" className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {daysOverdue} días
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {viewingSaleId && (
        <InvoiceDetailsDialog
          isOpen={true}
          onClose={() => setViewingSaleId(null)}
          saleId={viewingSaleId}
        />
      )}
    </Dialog >
  );
};

export default CustomerCreditDialog;
