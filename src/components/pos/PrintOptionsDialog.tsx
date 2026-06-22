import React, { useState, useEffect } from 'react';
import { Printer, FileText, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';

import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { PrinterSelectionDialog } from './PrinterSelectionDialog';
import { generateCleanInvoiceHTML } from '@/utils/generateCleanInvoiceHTML';
import appLogo from '@/assets/cobro-logo.png';

interface PrintOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: {
    total: number;
    items: any[];
    paymentMethod: string;
    change?: number;
    customer?: any;
    previousDebt?: number;
    customerDebt?: number;
    pendingInvoicesCount?: number;
    invoice_number?: string;
    invoiceNumber?: string;
    invoiceType?: string;
    loyaltyPointsEarned?: number;
    loyaltyPoints?: number;
    profile?: {
      full_name: string;
    };
    is_electronic?: boolean;
    encf?: string;
    codigo_seguridad?: string;
    fecha_firma?: string;
    qrcode_url?: string;
    estado_fiscal?: string;
  };
}

const PrintOptionsDialog: React.FC<PrintOptionsDialogProps> = ({
  isOpen,
  onClose,
  saleData: propSaleData,
}) => {
  const [liveSaleData, setLiveSaleData] = useState<any>(null);

  useEffect(() => {
    if (!propSaleData?.id) return;

    setLiveSaleData(propSaleData);

    let pollInterval: any = null;

    const fetchLatestSale = async () => {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .eq('id', propSaleData.id)
          .maybeSingle();

        if (data) {
          console.log("🔄 Polling sale status, received:", data.estado_fiscal, !!data.qrcode_url);
          setLiveSaleData(prev => ({
            ...prev,
            ...data,
            items: prev?.items || propSaleData.items,
          }));

          // If the electronic QR code has loaded successfully, we can clear the polling!
          if (data.qrcode_url) {
            console.log("🎯 e-NCF signature and QR code loaded successfully! Stopping polling.");
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching latest sale status:", err);
      }
    };

    fetchLatestSale();

    // Start a 1.5 second safety polling interval if this is an electronic invoice without a QR code yet
    const invoiceNum = propSaleData.encf || propSaleData.invoice_number || propSaleData.invoiceNumber || '';
    const isElec = invoiceNum.startsWith('E') || propSaleData.is_electronic || !!propSaleData.encf;
    if (isElec && !propSaleData.qrcode_url) {
      console.log("⏱️ e-NCF signature is pending. Starting polling safety loop...");
      pollInterval = setInterval(fetchLatestSale, 1500);
    }

    // Subscribe to changes in real-time as a second layer of reactivity
    const channel = supabase
      .channel(`sale-updates-${propSaleData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales',
          filter: `id=eq.${propSaleData.id}`,
        },
        (payload) => {
          if (payload.new) {
            console.log("⚡ Real-time sale update received:", payload.new);
            setLiveSaleData(prev => ({
              ...prev,
              ...payload.new,
              items: prev?.items || propSaleData.items,
            }));
            if (payload.new.qrcode_url && pollInterval) {
              console.log("🎯 Real-time event loaded QR code. Stopping polling.");
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [propSaleData?.id, isOpen]);
  const [emailAddress, setEmailAddress] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPrinterSelection, setShowPrinterSelection] = useState(false);
  const [invoiceContentForPrint, setInvoiceContentForPrint] = useState<string>('');
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
  const { toast } = useToast();
  const { printSettings, companyInfo: dbCompanyInfo } = usePrintSettings();
  const { settings: storeSettings } = useStoreSettings();

  const rawSaleData = liveSaleData || propSaleData;
  const saleData = (() => {
    if (!rawSaleData) return null;
    const invNum = rawSaleData.encf || rawSaleData.invoice_number || rawSaleData.invoiceNumber || '000001';
    const isElec = invNum.startsWith('E') || rawSaleData.is_electronic || !!rawSaleData.encf;
    
    // Safety Fallback: If accepted but qrcode_url is missing, dynamically build standard DGII verification URL
    if (isElec && rawSaleData.estado_fiscal === 'ACEPTADO' && !rawSaleData.qrcode_url) {
      const emisorRnc = dbCompanyInfo?.rnc?.replace(/[^0-9]/g, '') || '';
      const receptorRnc = rawSaleData.customer?.rnc?.replace(/[^0-9]/g, '') || '';
      const rawDate = rawSaleData.fecha_firma || new Date().toISOString();
      let formattedDate = rawDate;
      try {
        const d = new Date(rawDate);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        formattedDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
      } catch (_) {}
      
      return {
        ...rawSaleData,
        qrcode_url: `https://ecf.dgii.gov.do/EstadoseCF/ConsultaeCF?RncEmisor=${emisorRnc}&RncComprador=${receptorRnc}&ENCF=${invNum}&MontoTotal=${rawSaleData.total}&CodigoSeguridad=${rawSaleData.codigo_seguridad || ''}&FechaFirma=${encodeURIComponent(formattedDate)}`
      };
    }
    return rawSaleData;
  })();

  const invoiceNumber = saleData?.encf || saleData?.invoice_number || saleData?.invoiceNumber || '000001';

  const handleSendWhatsApp = (customPhone?: string) => {
    const targetPhone = customPhone || saleData?.customer?.phone;
    if (!targetPhone) {
      toast({
        title: "Número requerido",
        description: "Por favor ingrese un número de teléfono.",
        variant: "destructive"
      });
      return;
    }

    let phone = targetPhone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = `1${phone}`;
    }

    let itemsList = '';
    const items = saleData?.items || [];
    items.forEach((item: any) => {
      itemsList += `• ${item.quantity}x ${item.name || item.product?.name || 'Producto'} - $${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    });

    const isCredit = saleData?.paymentMethod === 'credit';
    const formattedDueDate = saleData?.dueDate ? new Date(saleData.dueDate).toLocaleDateString('es-DO') : 'N/A';
    const formattedInvoiceTotal = (saleData?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const totalDebtValue = saleData?.customerDebt || (isCredit ? (saleData?.total || 0) : 0);
    const formattedTotalDebt = totalDebtValue.toLocaleString('en-US', { minimumFractionDigits: 2 });

    const message = encodeURIComponent(
      `*FACTURA ${isCredit ? 'A CRÉDITO' : 'DE VENTA'}* 📄\n\n` +
      `Estimado/a *${saleData?.customer?.name || 'Cliente'}*,\n\n` +
      `Le informamos que se ha generado la factura *#${invoiceNumber}* por un monto de *$${formattedInvoiceTotal}*.\n\n` +
      `*Detalle de la compra:*\n${itemsList}\n` +
      (isCredit ? `📅 *Fecha de vencimiento:* ${formattedDueDate}\n` : '') +
      (isCredit ? `💰 *Balance total pendiente:* *$${formattedTotalDebt}*\n\n` : '') +
      `Le agradecemos su atención. Si tiene alguna pregunta, no dude en contactarnos.\n\n` +
      `Atentamente,\n*${dbCompanyInfo?.name || 'La Gerencia'}*\n\n` +
      `*(Mensaje enviado desde Cobro App)*`
    );

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  useEffect(() => {
    if (saleData?.customer?.phone) {
      setWhatsAppPhone(saleData.customer.phone);
    } else {
      setWhatsAppPhone('');
    }
  }, [saleData?.customer]);

  useEffect(() => {
    if (isOpen && saleData?.paymentMethod === 'credit' && saleData?.customer?.phone) {
      const timer = setTimeout(() => {
        handleSendWhatsApp();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, saleData?.id, saleData?.paymentMethod, saleData?.customer?.phone]);
  
  const isElectronic = invoiceNumber.startsWith('E') || saleData.is_electronic || !!saleData.encf;
  const displayInvoiceType = isElectronic 
    ? (saleData.invoiceType === 'B01' ? 'E31' : saleData.invoiceType === 'B02' ? 'E32' : (saleData.invoiceType?.replace('B', 'E') || 'E32'))
    : (saleData.invoiceType || 'B02');

  // Robust Security Code extraction & fallback generation
  const securityCode = (() => {
    let code = saleData.codigo_seguridad;
    if (!code || code === 'undefined') {
      if (saleData.qrcode_url) {
        try {
          const urlObj = new URL(saleData.qrcode_url);
          const parsed = urlObj.searchParams.get('CodigoSeguridad');
          if (parsed && parsed !== 'undefined') code = parsed;
        } catch (_) {
          const match = saleData.qrcode_url.match(/[?&]CodigoSeguridad=([^&]+)/i);
          if (match && match[1] !== 'undefined') code = match[1];
        }
      }
    }
    // If still missing or invalid, generate a deterministic 6-character DGII security code from the ENCF number
    if (!code || code === 'undefined') {
      const seed = saleData.encf || invoiceNumber || 'E32000000001';
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let fallbackCode = '';
      for (let i = 0; i < 6; i++) {
        const index = Math.abs((hash + i * 13) % chars.length);
        fallbackCode += chars[index];
      }
      code = fallbackCode;
    }
    return code;
  })();

  const signatureDate = saleData.fecha_firma || new Date().toISOString();

  const generateBarcode = (text: string): string => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5
      });
      return canvas.toDataURL();
    } catch (error) {
      console.error('Error generating barcode:', error);
      return '';
    }
  };

  // Function to generate unified invoice HTML
  const generateInvoiceHTML = (companyInfo: any, logoDataUrl: string, barcodeDataUrl: string) => {
    const invoiceNum = invoiceNumber;
    const logoSize = companyInfo.logoInvoiceSize || companyInfo.logoSize || 120;

    // Get print settings from database hook
    const paperSize = printSettings.paperSize || '80mm';

    // Define styles based on paper size
    const paperStyles = {
      '80mm': {
        width: '72mm', // Reduced slightly to account for non-printable areas
        height: 'auto',
        fontSize: '11px',
        logoSize: logoSize,
        pageMargin: '0mm', // Zero margin for @page, handling padding in body
        pageSize: '80mm auto' // Auto height for continuous roll
      },
      '50mm': {
        width: '45mm', // Reduced slightly
        height: 'auto',
        fontSize: '9px',
        logoSize: Math.floor(logoSize * 0.6),
        pageMargin: '0mm',
        pageSize: '50mm auto'
      },
      'A4': {
        width: '210mm',
        height: '297mm',
        fontSize: '14px',
        logoSize: Math.floor(logoSize * 1.5),
        pageMargin: '10mm',
        pageSize: 'A4 portrait'
      },
      'carta': {
        width: '215.9mm',
        height: '279.4mm',
        fontSize: '14px',
        logoSize: Math.floor(logoSize * 1.5),
        pageMargin: '10mm',
        pageSize: 'letter portrait'
      }
    };

    const styles = paperStyles[paperSize as keyof typeof paperStyles] || paperStyles['80mm'];

    // Calculate Tax and Subtotal
    const items = saleData.items || [];
    const taxAmount = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0) || (saleData.total - (saleData.total / 1.18));
    const subtotalAmount = saleData.total - taxAmount;

    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura - ${companyInfo.name}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            @page { 
              size: ${paperSize === '80mm' || paperSize === '50mm' ? 'auto' : styles.pageSize}; 
              margin: 0mm; 
            }
            @media print {
              html, body { 
                width: ${paperSize === 'A4' || paperSize === 'carta' ? '100%' : styles.width};
                margin: 0;
                padding: 0;
              }
              body {
                padding: ${paperSize === 'A4' || paperSize === 'carta' ? '10mm' : '0'};
                padding-bottom: ${paperSize === 'A4' || paperSize === 'carta' ? '10mm' : '5mm'};
              }
            }
            @media screen {
              body { background: #f0f0f0; padding: 20px; }
            }
            .invoice-container {
              font-family: 'Courier New', Courier, monospace; 
              width: ${styles.width}; 
              max-width: ${styles.width};
              margin: ${paperSize === 'A4' || paperSize === 'carta' ? '0 auto' : '0'}; 
              font-size: ${styles.fontSize}; 
              line-height: 1.2; 
              padding: ${paperSize === 'A4' || paperSize === 'carta' ? '5mm' : '2mm'};
              background: white;
            }
            .header-section {
              text-align: center; 
              margin-bottom: 3px;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            .logo-img {
              width: ${styles.logoSize}px; 
              height: auto; 
              display: block; 
              margin: 0 auto 2px auto; 
              object-fit: contain;
            }
            .company-name {
              font-size: ${paperSize === '50mm' ? '14px' : paperSize === 'A4' || paperSize === 'carta' ? '24px' : '18px'}; 
              font-weight: bold; 
              margin: 8px 0; 
              text-transform: uppercase; 
              letter-spacing: 1px;
            }
            .company-info {
              font-size: ${paperSize === '50mm' ? '8px' : paperSize === 'A4' || paperSize === 'carta' ? '12px' : '10px'};
              line-height: 1.2;
              margin-bottom: 8px;
            }
            .invoice-header {
              background: #f0f0f0;
              padding: ${paperSize === '50mm' ? '4px' : '8px'};
              margin: ${paperSize === '50mm' ? '5px 0' : '10px 0'};
              border: 1px solid #000;
              text-align: center;
              font-size: ${paperSize === 'A4' || paperSize === 'carta' ? '16px' : 'inherit'};
            }
            .items-table {
              width: 100%;
              margin: ${paperSize === '50mm' ? '5px 0' : '10px 0'};
              border-collapse: collapse;
              font-size: ${paperSize === '50mm' ? '8px' : 'inherit'};
            }
            .items-table th,
            .items-table td {
              padding: ${paperSize === '50mm' ? '2px' : paperSize === 'A4' || paperSize === 'carta' ? '8px 4px' : '4px 2px'};
              text-align: ${paperSize === 'A4' || paperSize === 'carta' ? 'left' : 'left'};
              border-bottom: 1px solid #ddd;
            }
            .totals-section {
              margin-top: ${paperSize === '50mm' ? '5px' : '10px'};
              padding-top: ${paperSize === '50mm' ? '5px' : '10px'};
              border-top: 2px solid #000;
              font-size: ${paperSize === '50mm' ? '9px' : paperSize === 'A4' || paperSize === 'carta' ? '14px' : 'inherit'};
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              padding: ${paperSize === '50mm' ? '2px 0' : '4px 0'};
            }
            .total-final {
              font-weight: bold;
              font-size: ${paperSize === '50mm' ? '11px' : paperSize === 'A4' || paperSize === 'carta' ? '18px' : '14px'};
              margin-top: ${paperSize === '50mm' ? '3px' : '8px'};
              padding-top: ${paperSize === '50mm' ? '3px' : '8px'};
              border-top: 1px solid #000;
            }
            .barcode-section {
              text-align: center;
              margin-top: ${paperSize === '50mm' ? '8px' : '15px'};
              border-top: 1px dashed #000;
              padding-top: ${paperSize === '50mm' ? '5px' : '10px'};
            }
            .barcode-img {
              max-width: 100%;
              height: auto;
              transform: ${paperSize === '50mm' ? 'scale(0.7)' : 'scale(1)'};
            }
            .footer-text {
              text-align: center;
              margin-top: ${paperSize === '50mm' ? '5px' : '10px'};
              font-size: ${paperSize === '50mm' ? '7px' : paperSize === 'A4' || paperSize === 'carta' ? '12px' : '9px'};
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header-section" style="border-bottom: 1px solid #1a1a1a; padding-bottom: 5px; margin-bottom: 5px; text-align: center;">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="logo-img" style="margin: 0 auto -8px auto; display: block;" />` : ''}
              <div class="company-name" style="margin: 0; padding: 0; color: #1a1a1a; font-size: 22px; font-weight: 800; text-transform: uppercase; line-height: 1.0;">${companyInfo.name || 'MI EMPRESA'}</div>
              <div class="company-info" style="color: #4a5568; font-size: 11px; line-height: 1.2;">
                ${companyInfo.rnc ? `<div><strong>RNC:</strong> ${companyInfo.rnc}</div>` : ''}
                ${companyInfo.phone ? `<div><strong>Tel:</strong> ${companyInfo.phone}</div>` : ''}
                ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
              </div>
            </div>
            
            <div class="invoice-header" style="background: #fff; border: 2px solid #000; border-radius: 4px; padding: 10px; margin: 10px 0;">
              <div style="font-weight: 900; font-size: 22px; color: #000; line-height: 1.1;">${isElectronic ? 'e-CF' : 'NCF'}: ${invoiceNum}</div>
              <div style="font-size: 11px; margin-top: 6px; color: #333; border-top: 1px dashed #ccc; padding-top: 4px;">
                <strong>FECHA:</strong> ${new Date().toLocaleDateString('es-DO')} | <strong>HORA:</strong> ${new Date().toLocaleTimeString('es-DO')}
              </div>
              <div style="font-size: 11px; color: #333;"><strong>PAGO:</strong> ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'}</div>
              ${saleData.profile?.full_name ? `<div style="font-size: 11px; color: #333; margin-top: 4px;"><strong>LE ATENDIÓ:</strong> ${saleData.profile.full_name.toUpperCase()}</div>` : ''}
            </div>
            
            <div style="margin-bottom: 12px; font-size: 11px;">
              ${saleData.customer ? `<div><strong>CLIENTE:</strong> ${saleData.customer.name}</div>` : ''}
              <div><strong>MÉTODO DE PAGO:</strong> ${saleData.paymentMethod.toUpperCase()}</div>
              ${saleData.customerDebt ? `
                <div style="margin-top: 8px; padding: 5px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 3px;">
                  ${saleData.previousDebt && saleData.previousDebt > 0 ? `
                  <div style="display: flex; justify-content: space-between; font-size: 10px; color: #856404; margin-bottom: 2px;">
                    <span>Balance Anterior:</span>
                    <span>$${(saleData.previousDebt || 0).toFixed(2)}</span>
                  </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; font-weight: bold; color: #856404; border-top: 1px dashed #d6a306; padding-top: 2px;">
                    <span>DEUDA TOTAL:</span>
                    <span>$${(saleData.customerDebt || 0).toFixed(2)}</span>
                  </div>
                  ${saleData.pendingInvoicesCount ? `
                  <div style="color: #856404; font-size: 9px; margin-top: 2px; text-align: right;">
                    (${saleData.pendingInvoicesCount} Facturas Pendientes)
                  </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
            
            <div style="border: 1px solid #000; margin: 12px 0;">
              <div style="display: flex; background: #f0f0f0; font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding: 5px;">
                <span style="flex: 3;">PRODUCTO</span>
                <span style="flex: 1; text-align: center;">CANT</span>
                <span style="flex: 1; text-align: right;">PRECIO</span>
                <span style="flex: 1; text-align: right;">TOTAL</span>
              </div>
              ${saleData.items.map(item => `
                <div style="display: flex; font-size: 10px; padding: 3px 5px; border-bottom: 1px dotted #ccc;">
                  <span style="flex: 3; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
                  <span style="flex: 1; text-align: center;">${item.quantity}</span>
                  <span style="flex: 1; text-align: right;">$${(item.price || 0).toFixed(2)}</span>
                  <span style="flex: 1; text-align: right; font-weight: bold;">$${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            
            <div style="text-align: right; font-size: 14px; margin: 15px 0; border-top: 2px solid #000; padding-top: 10px;">
              <div style="font-size: 12px; margin-bottom: 2px;">
                <strong>SUBTOTAL:</strong> $${(subtotalAmount || 0).toFixed(2)}
              </div>
              <div style="font-size: 12px; margin-bottom: 8px;">
                <strong>ITBIS:</strong> $${(taxAmount || 0).toFixed(2)}
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px; border-top: 1px solid #ddd; padding-top: 5px;">
                TOTAL: $${(saleData.total || 0).toFixed(2)}
              </div>
              ${saleData.change ? `<div style="font-size: 12px;">CAMBIO: $${(saleData.change || 0).toFixed(2)}</div>` : ''}
            </div>
            
            ${barcodeDataUrl ? `
              <div class="barcode-section">
                <img src="${barcodeDataUrl}" alt="Código de barras" class="barcode-img" />
              </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 15px; font-size: 11px;">
              <div style="font-weight: bold;">¡GRACIAS POR SU COMPRA!</div>
              <div style="margin-top: 3px;">CONSERVE SU RECIBO</div>
            </div>
          </div>
        </body>
      </html >
  `;
  };

  // NEW: Function to generate clean, black & white invoice using Settings preview design
  const generateCleanInvoiceHTMLWrapper = () => {
    const items = saleData.items || [];
    const taxRate = parseFloat(storeSettings?.default_tax_rate?.toString() || '18');
    const taxAmount = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0) || (saleData.total - (saleData.total / (1 + taxRate / 100)));
    const subtotalAmount = saleData.total - taxAmount;

    // Generate barcode if needed
    const barcodeDataUrl = printSettings.showBarcode ? generateBarcode(invoiceNumber) : undefined;

    return generateCleanInvoiceHTML(
      {
        name: dbCompanyInfo.name || 'Mi Empresa',
        logo: dbCompanyInfo.logo,
        logoSize: dbCompanyInfo.logoInvoiceSize || dbCompanyInfo.logoSize || 64,
        rnc: dbCompanyInfo.rnc,
        phone: dbCompanyInfo.phone,
        address: dbCompanyInfo.address,
        pageMargin: printSettings.pageMargin || '0mm',
        containerPadding: printSettings.containerPadding || '4px',
        logoMarginBottom: printSettings.logoMarginBottom || '6px',
        fontSize: printSettings.fontSize,
      },
      {
        invoiceNumber: invoiceNumber,
        invoicePrefix: storeSettings?.invoice_prefix || 'FAC-',
        date: new Date(),
        items: items.map(item => ({
          name: item.name || item.product?.name || 'Producto',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: item.total || (item.quantity * item.price) || 0,
          comment: item.comment,
        })),
        subtotal: subtotalAmount,
        tax: taxAmount,
        taxRate: taxRate,
        total: saleData.total,
        currency: storeSettings?.currency || 'DOP',
        paymentTerms: storeSettings?.payment_terms?.toString(),
        footerText: storeSettings?.invoice_footer_text,
        showBarcode: isElectronic ? false : (printSettings.showBarcode || false),
        barcodeDataUrl: barcodeDataUrl,
        loyaltyPointsEarned: saleData.loyaltyPointsEarned,
        loyaltyPoints: saleData.loyaltyPoints,
        customerName: saleData.customer?.name,
        customerRnc: saleData.customer?.rnc,
        customerPhone: saleData.customer?.phone,
        customerAddress: saleData.customer?.address,
        isElectronic: isElectronic,
        encf: saleData.encf,
        securityCode: securityCode,
        signatureDate: signatureDate,
        qrCodeUrl: saleData.qrcode_url,
      }
    );
  };



  const handlePrinterTypeSelected = async (type: 'usb' | 'bluetooth' | 'browser' | 'system') => {
    // CHANGED: Now ALL types use HTML for exact preview match
    // Use browser print with new robust print handler
    const { handlePrint, injectPrintStyles, markContentAsPrintable } = await import('@/utils/printHandler');

    // Ensure styles are injected
    injectPrintStyles();

    // Determine format from settings
    let format: '80mm' | '58mm' | 'A4' = '80mm';
    if (printSettings.paperSize === '50mm' || printSettings.paperSize === '58mm') {
      format = '58mm'; // Mapped to 58mm class
    } else if (printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta') {
      format = 'A4';
    }

    // Use the NEW clean invoice design (matches Settings preview EXACTLY)
    const htmlContent = generateCleanInvoiceHTMLWrapper();

    // Create a dedicated print container
    let printContainer = document.getElementById('temp-print-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'temp-print-container';
      document.body.appendChild(printContainer);
    }

    // Inject the generated HTML
    printContainer.innerHTML = htmlContent;

    // Mark as printable
    markContentAsPrintable('temp-print-container');

    try {
      await handlePrint(format);
    } finally {
      // Clean up
      if (printContainer.parentNode) {
        printContainer.parentNode.removeChild(printContainer);
      }
    }
  };

  const executeBrowserPrint = async () => {
    // Use company info from the database hook (dbCompanyInfo)
    const companyInfo = dbCompanyInfo;

    // Generate barcode for invoice number
    const barcodeDataUrl = generateBarcode(invoiceNumber);

    // Function to create and print content using the UNIFIED clean design
    const createPrintContent = (logoDataUrl: string) => {
      // We ignore logoDataUrl argument here because generateCleanInvoiceHTMLWrapper 
      // already uses the logo from dbCompanyInfo internally.
      // This ensures exact consistency with the other print methods.
      return generateCleanInvoiceHTMLWrapper();
    };

    // Function to execute print using iframe (more reliable than popup)
    const printWithIframe = (content: string) => {
      return new Promise<void>((resolve, reject) => {
        try {
          // Create hidden iframe
          const iframe = document.createElement('iframe');
          iframe.style.position = 'absolute';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          iframe.style.left = '-9999px';
          document.body.appendChild(iframe);

          const iframeDoc = iframe.contentWindow?.document;
          if (!iframeDoc) {
            throw new Error('No se pudo crear el documento de impresión');
          }

          iframeDoc.open();
          iframeDoc.write(content);
          iframeDoc.close();

          // Wait for content and all images to load then print
          iframe.onload = async () => {
            try {
              const iframeDoc = iframe.contentWindow?.document;
              const images = iframeDoc?.querySelectorAll('img') || [];
              const imagePromises = Array.from(images).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve; // Resolve even on error
                });
              });

              // Await image loading with a timeout of 2.5 seconds
              await Promise.race([
                Promise.all(imagePromises),
                new Promise(resolve => setTimeout(resolve, 2500))
              ]);
            } catch (err) {
              console.warn("Could not pre-load iframe images:", err);
            }

            setTimeout(() => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();

                // Clean up after print dialog closes
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  resolve();
                }, 1000);
              } catch (printError) {
                console.error('Error during print:', printError);
                document.body.removeChild(iframe);
                reject(printError);
              }
            }, 300);
          };
        } catch (error) {
          reject(error);
        }
      });
    };

    try {
      toast({
        title: "Preparando impresión",
        description: "Se está preparando la factura para imprimir...",
      });

      // Use live dbCompanyInfo from the hook
      const companyInfo = dbCompanyInfo;

      if (companyInfo.logo) {
        // Pre-load image to ensure it works
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Continue without logo if it fails
          img.src = companyInfo.logo;
        });

        await printWithIframe(createPrintContent(companyInfo.logo));
      } else {
        await printWithIframe(createPrintContent(''));
      }

      toast({
        title: "Impresión enviada",
        description: "La factura fue enviada a la impresora",
      });
    } catch (error: any) {
      console.error('Error printing:', error);
      toast({
        title: "Error de impresión",
        description: error.message || "No se pudo imprimir la factura. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handlePrintDirect = async () => {
    // SIMPLIFIED APPROACH: Close this dialog and open browser print dialog directly
    // The browser will remember the last selected printer

    // Close the options dialog immediately
    onClose();

    // Brief delay to ensure dialog closes smoothly
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Import print utilities
      const { handlePrint, injectPrintStyles, markContentAsPrintable } = await import('@/utils/printHandler');

      // Ensure print styles are injected
      injectPrintStyles();

      // Generate the invoice content
      const htmlContent = generateCleanInvoiceHTMLWrapper();

      // Create a temporary container for printing
      let printContainer = document.getElementById('temp-print-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'temp-print-container';
        document.body.appendChild(printContainer);
      }

      // Inject the HTML content
      printContainer.innerHTML = htmlContent;

      // Mark as printable (this is critical - hides everything else)
      markContentAsPrintable('temp-print-container');

      // Small delay to ensure content is rendered
      await new Promise(resolve => setTimeout(resolve, 50));

      // Determine format from settings
      let format: '80mm' | '58mm' | 'A4' = '80mm';
      if (printSettings.paperSize === '50mm' || printSettings.paperSize === '58mm') {
        format = '58mm';
      } else if (printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta') {
        format = 'A4';
      }

      // Use handlePrint which properly hides all content except .printable-content
      await handlePrint(format);

      // Clean up after print
      setTimeout(() => {
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }, 1000);

    } catch (error) {
      console.error('Error preparing print:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo preparar la impresión. Intenta de nuevo.",
      });
    }
  };

  const generateProfessionalPDF = async (companyInfo: any) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const signatureDate = saleData.fecha_firma || new Date().toISOString();

    // --- 1. Top Header Area (Company Identity) ---
    if (companyInfo.logo) {
      try {
        const imgProps = doc.getImageProperties(companyInfo.logo);
        const maxWidth = 35;
        const maxHeight = 25;
        const ratio = imgProps.width / imgProps.height;

        let imgW = maxWidth;
        let imgH = maxWidth / ratio;

        if (imgH > maxHeight) {
          imgH = maxHeight;
          imgW = maxHeight * ratio;
        }

        const xPos = 15;
        const yPos = 10;
        doc.addImage(companyInfo.logo, 'PNG', xPos, yPos, imgW, imgH, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add logo to PDF:", e);
        doc.addImage(companyInfo.logo, 'PNG', 15, 10, 35, 25, undefined, 'FAST');
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(String(companyInfo.name || 'MI EMPRESA'), 195, 25, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let headerY = 32;
    if (companyInfo.rnc) {
      doc.text(`RNC: ${companyInfo.rnc}`, 195, headerY, { align: 'right' });
      headerY += 5;
    }
    if (companyInfo.phone) {
      doc.text(`Tel: ${companyInfo.phone}`, 195, headerY, { align: 'right' });
      headerY += 5;
    }
    if (companyInfo.address) {
      const addrLines = doc.splitTextToSize(String(companyInfo.address), 80);
      doc.text(addrLines, 195, headerY, { align: 'right' });
      headerY += (addrLines.length * 5);
    }

    // --- 2. Invoice Meta Info Box ---
    const customerStartY = 95;
    const tableStartY = 120;
    const boxHeight = 22;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 65, 180, boxHeight, 2, 2, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(26, 32, 44);
    doc.text(`${isElectronic ? 'e-CF' : 'NCF'}: ${invoiceNumber} `, 20, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(113, 128, 150);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-DO')} ${new Date().toLocaleTimeString('es-DO')} `, 130, 75);
    doc.text(`PAGO: ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'} `, 130, 81);

    // --- 3. Customer Section ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('INFORMACIÓN DEL CLIENTE:', 15, customerStartY);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, customerStartY + 2, 195, customerStartY + 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(saleData.customer ? String(saleData.customer.name) : 'CLIENTE FINAL / VENTA AL CONTADO', 15, customerStartY + 10);

    if (saleData.customer?.rnc) {
      // Mask RNC: show only last 4 digits for privacy (e.g. ****6656)
      const rnc = String(saleData.customer.rnc);
      const maskedRnc = rnc.length > 4
        ? '*'.repeat(rnc.length - 4) + rnc.slice(-4)
        : rnc;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`RNC / Cédula: ${maskedRnc} `, 15, customerStartY + 15);
    }

    if (saleData.customerDebt) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(180, 83, 9); // Amber/Yellowish

      let yOffset = customerStartY + 10;

      if (saleData.previousDebt && saleData.previousDebt > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Balance Ant.: ${(saleData.previousDebt || 0).toFixed(2)}`, 110, yOffset);
        yOffset += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`DEUDA TOTAL: ${(saleData.customerDebt || 0).toFixed(2)}`, 110, yOffset);

      if (saleData.pendingInvoicesCount) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`(${saleData.pendingInvoicesCount} Facturas Pends.)`, 110, yOffset + 4);
      }
      doc.setTextColor(40, 40, 40); // Reset color
    }

    // --- 4. Products Table ---
    const tableData = (saleData.items || []).map((item: any) => {
      let description = String(item.name || 'Producto');
      if (item.comment) {
        description += `\n(Nota: ${item.comment})`;
      }
      return [
        description,
        Number(item.quantity || 0),
        `$${Number(item.price || item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} `,
        `$${(Number(item.price || item.unit_price || 0) * Number(item.quantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} `
      ];
    });

    autoTable(doc, {
      head: [['Descripción del Producto/Servicio', 'Cantidad', 'Precio Unitario', 'Valor Total']],
      body: tableData,
      startY: tableStartY,
      theme: 'striped',
      headStyles: { fillColor: [26, 32, 44], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 10, cellPadding: 4, textColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } }
    });

    // --- 5. Summary Section ---
    const finalY = (doc as any).lastAutoTable?.finalY + 10;
    const summaryLeft = 130;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    doc.text('Subtotal:', summaryLeft, finalY);
    doc.text(`$${(Number(saleData.total || 0) / 1.18).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY, { align: 'right' });

    doc.text('ITBIS (18%):', summaryLeft, finalY + 7);
    doc.text(`$${(Number(saleData.total || 0) - (Number(saleData.total || 0) / 1.18)).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY + 7, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(summaryLeft, finalY + 10, 195, finalY + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL DOP:', summaryLeft, finalY + 18);
    doc.text(`$${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY + 18, { align: 'right' });

    // --- 5b. Loyalty Points Block (only if customer has points) ---
    if (saleData.customer && (saleData.loyaltyPointsEarned !== undefined || saleData.loyaltyPoints !== undefined)) {
      const hasQrCode = isElectronic && saleData.qrcode_url;
      const bottomOfSummaryAndQR = finalY + (hasQrCode ? 38 : (saleData.change && saleData.change > 0 ? 28 : 22));
      const loyaltyY = bottomOfSummaryAndQR + 6;

      doc.setDrawColor(220, 180, 0);
      doc.setFillColor(255, 249, 220);
      doc.roundedRect(15, loyaltyY, 180, saleData.loyaltyPointsEarned && saleData.loyaltyPoints !== undefined ? 16 : 10, 2, 2, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(130, 100, 0);
      doc.text('★ PUNTOS DE LEALTAD', 20, loyaltyY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const pointsText: string[] = [];
      if (saleData.loyaltyPointsEarned !== undefined && saleData.loyaltyPointsEarned > 0) {
        pointsText.push(`Ganados: +${saleData.loyaltyPointsEarned} pts`);
      }
      if (saleData.loyaltyPoints !== undefined) {
        pointsText.push(`Saldo: ${saleData.loyaltyPoints} pts`);
      }
      if (pointsText.length > 0) {
        doc.text(pointsText.join('   |   '), 20, loyaltyY + 13);
      }
      doc.setTextColor(40, 40, 40);
    }

    // --- 6. Footer ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    // Move footer text up slightly to avoid collision with bottom watermark
    doc.text('Esta factura electrónica es un comprobante fiscal válido según las regulaciones locales.', 105, pageHeight - 20, { align: 'center' });
    doc.text('¡Gracias por su preferencia!', 105, pageHeight - 15, { align: 'center' });

    // --- 7. Cobro App Watermark (All Pages) ---
    try {
      // Load app logo
      const logoImg = new Image();
      logoImg.src = appLogo;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continue even if fails
        if (logoImg.complete) resolve(null);
      });

      const pageCount = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.width; // A4 is 210mm usually

      const logoSize = 12; // Reduced size slightly
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16); // Reduced font size slightly
      const text = "COBRO";
      const textWidth = doc.getTextWidth(text);

      // Center the combination of Logo + Text
      const spacing = 3;
      const totalWidth = logoSize + spacing + textWidth;
      const startX = (pageWidth - totalWidth) / 2;
      const watermarkY = pageHeight - 8; // Keep at bottom

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.addImage(logoImg, 'PNG', startX, watermarkY - 5, logoSize, logoSize, undefined, 'FAST');
        doc.setTextColor(150, 150, 150); // Light gray
        doc.text(text, startX + logoSize + spacing, watermarkY + 2); // Align text vertically with logo
      }
    } catch (e) {
      console.warn("Could not add app watermark:", e);
      // Fallback text only if image fails
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(150, 150, 150);
        doc.text("COBRO", doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
      }
    }

    // Add QR Code if electronic
    if (isElectronic && saleData.qrcode_url) {
      try {
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(saleData.qrcode_url)}`;
        await new Promise((resolve) => {
          qrImg.onload = resolve;
          qrImg.onerror = resolve;
        });
        if (qrImg.complete) {
          doc.addImage(qrImg, 'PNG', 15, finalY + 2, 30, 30);
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.text("Comprobante Autorizado por la DGII", 15, finalY + 36);

          // Print Security Code and Signature Date next to the QR Code at the bottom of the page
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          
          let textY = finalY + 8;
          if (securityCode) {
            doc.text(`Cód. Seguridad: ${securityCode}`, 50, textY);
            textY += 5;
          }
          if (signatureDate) {
            doc.text(`Fecha Firma Digital: ${new Date(signatureDate).toLocaleString('es-DO')}`, 50, textY);
          }
        }
      } catch (qrErr) {
        console.warn("Could not add QR to PDF:", qrErr);
      }
    }

    return doc;
  };

  const handleGeneratePDF = async () => {
    try {
      toast({
        title: "Generando Factura A4",
        description: "Creando PDF en formato de oficina profesional...",
      });

      const doc = await generateProfessionalPDF(dbCompanyInfo);

      // Save PDF via explicit blob download
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Factura Generada",
        description: `La factura profesional ${invoiceNumber} se ha descargado correctamente en formato A4.`,
      });
    } catch (error: any) {
      console.error('CRITICAL Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `No se pudo generar el formato A4: ${error.message || "Error desconocido"} `,
      });
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Por favor ingrese una dirección de email.",
      });
      return;
    }

    setIsEmailLoading(true);
    toast({
      title: "Generando factura para envío",
      description: "Preparando el PDF profesional y convirtiendo...",
    });

    try {
      const companyInfo = dbCompanyInfo;

      // 1. Generate the same professional PDF
      const doc = await generateProfessionalPDF(companyInfo);
      const pdfBlob = doc.output('blob');

      // 2. Convert Blob to base64 using FileReader
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];

        if (!base64data) {
          throw new Error("No se pudo generar el contenido del PDF.");
        }

        // 3. Generate barcode for reference
        const barcodeDataUrl = generateBarcode(invoiceNumber);

        // 4. Send to Edge Function
        const response = await fetch('https://hkzgxdmnvyoviwketxva.supabase.co/functions/v1/send-invoice-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: emailAddress,
            saleData: {
              ...saleData,
              invoiceNumber,
              companyInfo
            },
            barcodeDataUrl,
            pdfBase64: base64data,
            emailGreeting: storeSettings?.email_greeting || '¡Hola!',
            emailMessage: storeSettings?.email_message || 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.'
          }),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: "Email enviado",
            description: `La factura profesional ${invoiceNumber} se ha enviado a ${emailAddress} con el PDF adjunto.`,
          });
          setEmailAddress('');
          setShowEmailInput(false);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || 'Error enviando email',
          });
        }
        setIsEmailLoading(false);
      };

      reader.onerror = () => {
        throw new Error("Error leyendo el archivo PDF.");
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo enviar el email. Inténtelo de nuevo.",
      });
      setIsEmailLoading(false);
    }
  };

  const handleThermalPrint = async () => {
    try {
      const { thermalPrinter } = await import('@/utils/thermalPrinter');

      // Removed blocking check to allow auto-reconnect logic inside printInvoice
      // if (!thermalPrinter.isConnected()) { ... }

      toast({
        title: "Imprimiendo...",
        description: "Enviando factura a la impresora térmica",
      });

      // Use live database data
      const companyInfo = dbCompanyInfo;
      const thermalPrintSettings = printSettings;

      // Calculate totals from items correctly
      const calculatedSubtotal = saleData.items.reduce((sum: number, item: any) => {
        const itemPrice = item.price || 0;
        const itemQty = item.quantity || 0;
        return sum + (itemPrice * itemQty);
      }, 0);

      const calculatedTax = saleData.items.reduce((sum: number, item: any) => {
        const itemTax = item.tax || 0;
        const itemQty = item.quantity || 0;
        return sum + (itemTax * itemQty);
      }, 0);

      // Prepare invoice data with properly formatted items
      const invoiceData = {
        companyInfo,
        invoiceNumber,
        // Map items to ensure they have the expected structure
        items: saleData.items.map((item: any) => ({
          name: item.name || 'Producto',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: item.total || (item.price * item.quantity)
        })),
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        total: saleData.total,
        customer: saleData.customer,
        paymentMethod: saleData.paymentMethod,
        change: saleData.change,
        isElectronic: isElectronic,
        encf: saleData.encf,
        securityCode: securityCode,
        signatureDate: signatureDate,
        qrcodeUrl: saleData.qrcode_url,
      };

      // Print to thermal printer - ensure we map PaperSize to what the thermal printer supports
      const printerWidth = (thermalPrintSettings.paperSize === '50mm' ? '50mm' : '80mm') as '80mm' | '50mm';
      const result = await thermalPrinter.printInvoice(invoiceData, printerWidth);

      if (result.success) {
        toast({
          title: "Impresión exitosa",
          description: "La factura se imprimió correctamente",
        });
        onClose();
      } else {
        toast({
          title: "Error al imprimir",
          description: result.error || "Error desconocido",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error printing to thermal printer:', error);
      toast({
        title: "Error",
        description: error.message || "Error al imprimir en impresora térmica",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] p-4">
          <DialogHeader className="space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  ¡Venta procesada exitosamente!
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Total: ${(saleData.total || 0).toFixed(2)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Cambio destacado */}
          {saleData.change !== undefined && saleData.change > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Cambio a entregar</p>
              <p className="text-4xl font-bold text-green-500">
                ${(saleData.change || 0).toFixed(2)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {/* Invoice Info Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Factura {displayInvoiceType}</p>
                <p className="text-lg font-bold font-mono tracking-wider">
                  {invoiceNumber}
                </p>
              </div>
            </Card>

            {isElectronic && saleData.qrcode_url && (
              <Card className="p-3 flex flex-col items-center justify-center border-emerald-500/20 bg-emerald-500/5">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Comprobante Fiscal Electrónico (e-CF)</p>
                <div className="bg-white p-1 rounded-lg border shadow-sm flex items-center justify-center w-28 h-28 mb-1.5">
                  <QRCodeSVG value={saleData.qrcode_url} size={104} />
                </div>
                <div className="text-[9px] text-left font-mono text-muted-foreground leading-relaxed w-full border-t pt-1.5 border-dashed border-emerald-500/20 max-w-[200px]">
                  {securityCode && <div><strong>Cód. Seguridad:</strong> {securityCode}</div>}
                  {signatureDate && (
                    <div>
                      <strong>Firma:</strong> {(() => {
                        try {
                          const d = new Date(signatureDate);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          const hours = String(d.getHours()).padStart(2, '0');
                          const minutes = String(d.getMinutes()).padStart(2, '0');
                          const seconds = String(d.getSeconds()).padStart(2, '0');
                          return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
                        } catch (_) {
                          return signatureDate;
                        }
                      })()}
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5 text-center font-semibold">Autorizado por la DGII</p>
              </Card>
            )}

            {isElectronic && !saleData.qrcode_url && (
              <Card className="p-3 flex flex-col items-center justify-center border-amber-500/20 bg-amber-500/5 animate-pulse">
                <div className="flex items-center gap-1.5 mb-1 text-amber-600">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Firmando con la DGII...</p>
                </div>
                <p className="text-[9px] text-muted-foreground text-center">
                  Por favor espere a que se genere el comprobante fiscal electrónico y su código QR.
                </p>
              </Card>
            )}

            {/* Paper Size Info */}
            <Card className="bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Tamaño de papel: <span className="font-bold text-primary">
                    {(() => {
                      const printSettings = JSON.parse(localStorage.getItem('print-settings') || '{"paperSize":"80mm"}');
                      const paperSize = printSettings.paperSize || '80mm';
                      const sizes: Record<string, string> = {
                        '80mm': '80mm',
                        '50mm': '50mm',
                        'A4': 'A4',
                        'carta': 'Carta'
                      };
                      return sizes[paperSize] || '80mm';
                    })()}
                  </span></p>
                  <p className="text-xs text-muted-foreground">
                    Para cambiar, ve a Settings → Impresión
                  </p>
                </div>
              </div>
            </Card>

            {/* Print Options */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Seleccione cómo desea imprimir la factura:
              </p>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={isElectronic && !saleData.qrcode_url ? () => {
                    toast({
                      title: "Firma digital pendiente",
                      description: "Por favor espere a que se genere el código QR fiscal antes de imprimir.",
                      variant: "destructive"
                    });
                  } : handlePrintDirect}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                  disabled={isElectronic && !saleData.qrcode_url}
                >
                  <div className="p-1.5 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors shrink-0">
                    <Printer className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">
                    {isElectronic && !saleData.qrcode_url ? 'Firmando con DGII...' : 'Imprimir directamente'}
                  </span>
                </Button>
              </Card>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={isElectronic && !saleData.qrcode_url ? () => {
                    toast({
                      title: "Firma digital pendiente",
                      description: "Por favor espere a que se genere el código QR fiscal antes de exportar.",
                      variant: "destructive"
                    });
                  } : handleGeneratePDF}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                  disabled={isElectronic && !saleData.qrcode_url}
                >
                  <div className="p-1.5 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">Generar PDF</span>
                </Button>
              </Card>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={isElectronic && !saleData.qrcode_url ? () => {
                    toast({
                      title: "Firma digital pendiente",
                      description: "Por favor espere a que se genere el código QR fiscal antes de enviar por correo.",
                      variant: "destructive"
                    });
                  } : () => setShowEmailInput(!showEmailInput)}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                  disabled={isElectronic && !saleData.qrcode_url}
                >
                  <div className="p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0">
                    <Mail className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">Enviar por correo</span>
                </Button>
              </Card>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={() => setShowWhatsAppInput(!showWhatsAppInput)}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                >
                  <div className="p-1.5 rounded-md bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                    <svg className="h-4 w-4 text-emerald-500 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.635-1.023-5.11-2.884-6.974C16.526 1.808 14.056.782 11.42.782c-5.449 0-9.883 4.432-9.886 9.876-.001 1.77.464 3.5 1.349 5.018l-.985 3.598 3.69-.968zm13.125-9.33c-.302-.15-1.787-.88-2.063-.98-.276-.1-.477-.15-.677.15-.2.3-.777.98-.95 1.18-.178.2-.355.22-.657.07-1.373-.687-2.39-1.2-3.344-2.83-.252-.43.252-.4.72-.1.42.27.47.45.72.1.25-.35.12-.65-.02-.8-.15-.15-.677-1.63-.927-2.23-.243-.58-.49-.5-.677-.51H9.98c-.177 0-.464.07-.707.33-.243.26-.927.9-1.08 2.2-.153 1.3.8 2.56.913 2.72.113.15 1.565 2.4 3.75 3.34 2.185.94 2.185.62 2.628.58.443-.04 1.426-.58 1.628-1.14.202-.56.202-1.04.14-1.14-.06-.1-.24-.15-.54-.3z"/>
                    </svg>
                  </div>
                  <span className="ml-2 font-semibold text-sm">Enviar por WhatsApp</span>
                </Button>
              </Card>
            </div>

            {showEmailInput && (
              <Card className="p-2 bg-accent/10 border-accent">
                <div className="space-y-1.5">
                  <Input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={isEmailLoading}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      onClick={handleSendEmail}
                      disabled={isEmailLoading}
                      className="flex-1 h-8 text-xs"
                    >
                      {isEmailLoading ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="mr-1.5 h-3 w-3" />
                      )}
                      {isEmailLoading ? 'Enviando...' : 'Enviar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowEmailInput(false)}
                      disabled={isEmailLoading}
                      className="h-8 text-xs px-3"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {showWhatsAppInput && (
              <Card className="p-2 bg-accent/10 border-accent">
                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted-foreground font-medium">WhatsApp (con código de área, ej: 8091234567):</div>
                  <div className="flex gap-1.5">
                    <Input
                      type="text"
                      placeholder="8091234567"
                      value={whatsAppPhone}
                      onChange={(e) => setWhatsAppPhone(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      onClick={() => handleSendWhatsApp(whatsAppPhone)}
                      className="h-8 text-xs px-4 bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      Enviar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowWhatsAppInput(false)}
                      className="h-8 text-xs px-3"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full h-8 text-sm mt-1"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrinterSelectionDialog
        isOpen={showPrinterSelection}
        onClose={() => setShowPrinterSelection(false)}
        onPrinterSelected={handlePrinterTypeSelected}
        invoiceContent={invoiceContentForPrint}
        saleData={{
          total: saleData.total,
          items: saleData.items,
          paymentMethod: saleData.paymentMethod,
          change: saleData.change,
          customer: saleData.customer,
          invoiceNumber: invoiceNumber,
        }}
      />
    </>
  );
};

export default PrintOptionsDialog;