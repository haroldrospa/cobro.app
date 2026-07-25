/**
 * rawbtPrinter.ts
 * 
 * Helper utility for printing ESC/POS thermal receipts on Mobile devices (Android / iOS)
 * using the RawBT Thermal Printer App via intent / scheme protocols (rawbt:base64,...).
 */

export interface RawBTCompanyInfo {
  name?: string;
  rnc?: string;
  phone?: string;
  address?: string;
  invoice_footer_text?: string;
}

export interface RawBTCustomerInfo {
  name?: string;
  rnc?: string;
  phone?: string;
}

export interface RawBTItem {
  name: string;
  quantity: number | string;
  price: number | string;
  total?: number | string;
}

export interface RawBTInvoiceData {
  companyInfo?: RawBTCompanyInfo;
  invoiceNumber?: string;
  items: RawBTItem[];
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  customer?: RawBTCustomerInfo | null;
  paymentMethod?: string;
  change?: number | string;
  isElectronic?: boolean;
  encf?: string;
  securityCode?: string;
  signatureDate?: string;
  qrcodeUrl?: string;
  date?: string;
}

const ESC = 0x1B;
const GS = 0x1D;

function textToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

function mergeBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let length = 0;
  for (const array of arrays) {
    result.set(array, length);
    length += array.length;
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatTwoColumns(left: string, right: string, width: number): string {
  const maxLeftWidth = width - right.length - 1;
  let truncatedLeft = left;
  if (truncatedLeft.length > maxLeftWidth) {
    truncatedLeft = truncatedLeft.substring(0, maxLeftWidth);
  }
  const spaces = Math.max(1, width - truncatedLeft.length - right.length);
  return truncatedLeft + ' '.repeat(spaces) + right;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export function sendToRawBT(bytes: Uint8Array): void {
  const base64 = bytesToBase64(bytes);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  if (isAndroid) {
    // Android Web Intent format for RawBT
    const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a404m.rawbtprinter;end;`;
    window.location.href = intentUrl;
  } else {
    // General rawbt: custom scheme
    window.location.href = `rawbt:base64,${base64}`;
  }
}

export function buildRawBTESCBYTES(
  data: RawBTInvoiceData,
  paperWidth: '80mm' | '58mm' = '80mm'
): Uint8Array {
  const widthChars = paperWidth === '58mm' ? 32 : 48;
  const lineSeparator = '-'.repeat(widthChars);
  const commands: Uint8Array[] = [];

  // 1. Initialize printer
  commands.push(new Uint8Array([ESC, 0x40]));

  // 2. Select Code Table (CP858 / Latin-1 compatible)
  commands.push(new Uint8Array([ESC, 0x74, 19]));

  // 3. Header - Company Info
  commands.push(new Uint8Array([ESC, 0x61, 1])); // Center
  commands.push(new Uint8Array([ESC, 0x45, 1])); // Bold On
  commands.push(new Uint8Array([GS, 0x21, 0x11])); // Double Height & Width
  commands.push(textToBytes(`${data.companyInfo?.name || 'COBRO APP'}\n`));
  
  commands.push(new Uint8Array([GS, 0x21, 0x00])); // Normal size
  commands.push(new Uint8Array([ESC, 0x45, 0])); // Bold Off

  if (data.companyInfo?.rnc) {
    commands.push(textToBytes(`RNC: ${data.companyInfo.rnc}\n`));
  }
  if (data.companyInfo?.phone) {
    commands.push(textToBytes(`Tel: ${data.companyInfo.phone}\n`));
  }
  if (data.companyInfo?.address) {
    commands.push(textToBytes(`${data.companyInfo.address}\n`));
  }

  commands.push(textToBytes(`${lineSeparator}\n`));

  // 4. Invoice & Date Details
  commands.push(new Uint8Array([ESC, 0x61, 0])); // Left
  commands.push(new Uint8Array([ESC, 0x45, 1])); // Bold
  const invoiceLabel = data.encf || data.invoiceNumber || 'FACTURA';
  commands.push(textToBytes(`Comprobante: ${invoiceLabel}\n`));
  commands.push(new Uint8Array([ESC, 0x45, 0]));
  
  const currentDate = data.date || new Date().toLocaleString('es-DO');
  commands.push(textToBytes(`Fecha: ${currentDate}\n`));

  if (data.paymentMethod) {
    const methodNames: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito',
      mixed: 'Mixto'
    };
    commands.push(textToBytes(`Metodo Pago: ${methodNames[data.paymentMethod] || data.paymentMethod}\n`));
  }

  // 5. Customer Details
  commands.push(textToBytes(`${lineSeparator}\n`));
  if (data.customer) {
    commands.push(new Uint8Array([ESC, 0x45, 1]));
    commands.push(textToBytes(`Cliente: ${data.customer.name || 'Consumidor Final'}\n`));
    commands.push(new Uint8Array([ESC, 0x45, 0]));
    if (data.customer.rnc) {
      commands.push(textToBytes(`RNC/Cedula: ${data.customer.rnc}\n`));
    }
    if (data.customer.phone) {
      commands.push(textToBytes(`Tel: ${data.customer.phone}\n`));
    }
  } else {
    commands.push(textToBytes(`Cliente: Consumidor Final\n`));
  }

  // 6. Items Table
  commands.push(textToBytes(`${lineSeparator}\n`));
  for (const item of data.items) {
    const priceNum = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
    const qtyNum = typeof item.quantity === 'string' ? parseInt(item.quantity) || 1 : item.quantity;
    const totalNum = typeof item.total !== 'undefined' 
      ? (typeof item.total === 'string' ? parseFloat(item.total) || 0 : item.total)
      : priceNum * qtyNum;

    const priceStr = `$${totalNum.toFixed(2)}`;
    const namePart = `${item.name || 'Producto'} x${qtyNum}`;
    commands.push(textToBytes(`${formatTwoColumns(namePart, priceStr, widthChars)}\n`));
  }

  // 7. Totals Block
  commands.push(textToBytes(`${lineSeparator}\n`));
  const subtotalVal = typeof data.subtotal === 'string' ? parseFloat(data.subtotal) || 0 : data.subtotal;
  const taxVal = typeof data.tax === 'string' ? parseFloat(data.tax) || 0 : data.tax;
  const totalVal = typeof data.total === 'string' ? parseFloat(data.total) || 0 : data.total;

  commands.push(textToBytes(`${formatTwoColumns("Subtotal:", `$${subtotalVal.toFixed(2)}`, widthChars)}\n`));
  commands.push(textToBytes(`${formatTwoColumns("ITBIS (18%):", `$${taxVal.toFixed(2)}`, widthChars)}\n`));
  commands.push(textToBytes(`${lineSeparator}\n`));

  commands.push(new Uint8Array([ESC, 0x45, 1])); // Bold
  commands.push(new Uint8Array([GS, 0x21, 0x01])); // Double Height
  commands.push(textToBytes(`${formatTwoColumns("TOTAL:", `$${totalVal.toFixed(2)}`, widthChars)}\n`));
  commands.push(new Uint8Array([GS, 0x21, 0x00])); // Normal
  commands.push(new Uint8Array([ESC, 0x45, 0]));

  if (typeof data.change !== 'undefined' && Number(data.change) > 0) {
    const changeVal = typeof data.change === 'string' ? parseFloat(data.change) || 0 : data.change;
    commands.push(textToBytes(`${formatTwoColumns("CAMBIO:", `$${changeVal.toFixed(2)}`, widthChars)}\n`));
  }

  // 8. Electronic Invoice / QR Code info
  if (data.isElectronic || data.qrcodeUrl) {
    commands.push(textToBytes(`${lineSeparator}\n`));
    commands.push(new Uint8Array([ESC, 0x61, 1])); // Center
    commands.push(textToBytes("Verificacion Comprobante Electronico:\n"));
    if (data.qrcodeUrl) {
      const cleanUrl = data.qrcodeUrl.replace(/^https?:\/\/(www\.)?/, '');
      commands.push(textToBytes(`${cleanUrl.substring(0, widthChars)}\n`));
    }
    if (data.securityCode) {
      commands.push(textToBytes(`Cod. Seguridad: ${data.securityCode}\n`));
    }
    if (data.signatureDate) {
      commands.push(textToBytes(`Fecha Firma: ${data.signatureDate}\n`));
    }
  }

  // 9. Footer
  commands.push(new Uint8Array([ESC, 0x61, 1])); // Center
  commands.push(textToBytes(`${lineSeparator}\n`));
  if (data.companyInfo?.invoice_footer_text) {
    commands.push(textToBytes(`${data.companyInfo.invoice_footer_text}\n`));
  } else {
    commands.push(textToBytes("Gracias por su preferencia!\n"));
  }
  commands.push(textToBytes("Terminos de pago: 30 dias\n"));

  // 10. Feed lines & Cut Paper
  commands.push(textToBytes("\n\n\n"));
  commands.push(new Uint8Array([GS, 0x56, 0x42, 0x00])); // Cut Paper

  return mergeBytes(...commands);
}

export function printInvoiceViaRawBT(
  data: RawBTInvoiceData,
  paperWidth: '80mm' | '58mm' = '80mm'
): void {
  const bytes = buildRawBTESCBYTES(data, paperWidth);
  sendToRawBT(bytes);
}

export function printTestReceiptViaRawBT(
  companyName: string = 'Mi Negocio',
  paperWidth: '80mm' | '58mm' = '80mm'
): void {
  const testData: RawBTInvoiceData = {
    companyInfo: {
      name: companyName,
      rnc: '101-00000-0',
      phone: '809-555-0000',
      address: 'Calle Principal #123',
      invoice_footer_text: 'Impresión de prueba RawBT'
    },
    invoiceNumber: 'TEST-000001',
    items: [
      { name: 'Producto Prueba 1', quantity: 1, price: 150.00, total: 150.00 },
      { name: 'Producto Prueba 2', quantity: 2, price: 50.00, total: 100.00 },
    ],
    subtotal: 250.00,
    tax: 45.00,
    total: 295.00,
    paymentMethod: 'cash',
    change: 5.00,
    date: new Date().toLocaleString('es-DO')
  };

  printInvoiceViaRawBT(testData, paperWidth);
}
