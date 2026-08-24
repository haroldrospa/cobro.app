// Wrapper tipado sobre el plugin nativo Capacitor "BluetoothPrinter"
// (android/app/src/main/java/com/cobro/app/plugins/BluetoothPrinterPlugin.kt).
//
// Este es el único camino que realmente envía bytes ESC/POS a una impresora
// térmica Bluetooth conectada al dispositivo. Solo funciona dentro de la app
// nativa de Android — en web/Electron usar los flujos existentes
// (window.print() / electronPrinter.ts).

import { registerPlugin } from '@capacitor/core';
import type { InvoiceData, CompanyData } from './generateCleanInvoiceHTML';
import { isAndroidNative } from './platform';

export { isAndroidNative };

export interface PairedPrinter {
  name: string;
  address: string;
  isDefault: boolean;
  isConnected: boolean;
}

export type PrinterConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'PRINTING' | 'ERROR';

export interface PrinterStatusInfo {
  status: PrinterConnectionStatus;
  printerName: string;
  address: string;
}

export interface TicketItem {
  name: string;
  qty: number;
  price: number;
  /** Total de la línea (qty × price, ya con descuento de línea aplicado si
   *  corresponde) — viene precalculado de InvoiceData.items[].total en vez
   *  de recalcularlo acá, para no desincronizarse si hay descuentos por
   *  ítem que qty×price solo no reflejaría. */
  total: number;
  discount?: number;
}

export interface TicketPayload {
  businessName?: string;
  logoBase64?: string;
  address?: string;
  rnc?: string;
  phone?: string;
  customer?: string;
  cashier?: string;
  invoiceNumber?: string;
  /** true = e-NCF (comprobante electrónico, DGII) — cambia el rótulo de la
   *  caja de NCF y decide el QR/código de barras (ver más abajo). */
  isElectronic?: boolean;
  date?: string;
  time?: string;
  items: TicketItem[];
  subtotal?: number;
  tax?: number;
  /** Porcentaje de ITBIS a mostrar en la línea de impuesto (ej. 18). Si no
   *  se manda, el nativo asume 18 por compatibilidad con tickets viejos. */
  taxRatePercent?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  amountPaid?: number;
  change?: number;
  // Código de barras (NCF regular) y QR (e-NCF/DGII) son mutuamente
  // excluyentes por regla de negocio — ver isElectronic en
  // buildTicketFromInvoice. No mandar ambos.
  barcode?: string;
  qrData?: string;
  /** Mensaje de pie configurable (Ajustes > Facturación > Texto de pie). */
  footerText?: string;
  /** Términos de pago en días (Ajustes > Facturación), p.ej. "15". */
  paymentTermsDays?: string;
  // Ancho de papel en mm (58 u 80). Si no se envía, el nativo usa el último
  // configurado en el propio dispositivo — mejor mandarlo siempre para que
  // coincida con la config de la app (ver Settings > Tamaño de Papel).
  paperWidthMm?: number;
}

interface BluetoothPrinterNativePlugin {
  printTicket(options: { ticket: TicketPayload }): Promise<{ success: boolean }>;
  printTestPage(): Promise<void>;
  connectPrinter(options: { address: string }): Promise<{ connected: boolean; address: string }>;
  disconnectPrinter(): Promise<void>;
  getPrinterStatus(): Promise<PrinterStatusInfo>;
  // El nativo devuelve un JSON *serializado como string* (ver
  // BluetoothPrinterManager.getPairedPrinters), no un array — hay que
  // parsearlo. Ver getPairedPrinters() más abajo.
  getPairedPrinters(): Promise<{ printers: string }>;
  selectPrinter(options: { address: string }): Promise<void>;
  openCashDrawer(): Promise<void>;
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
}

const BluetoothPrinterNative = registerPlugin<BluetoothPrinterNativePlugin>('BluetoothPrinter');

export async function getPairedPrinters(): Promise<PairedPrinter[]> {
  const { printers } = await BluetoothPrinterNative.getPairedPrinters();
  try {
    const parsed = JSON.parse(printers);
    return Array.isArray(parsed) ? (parsed as PairedPrinter[]) : [];
  } catch {
    return [];
  }
}

export async function selectPrinter(address: string): Promise<void> {
  await BluetoothPrinterNative.selectPrinter({ address });
}

export async function connectPrinter(address: string): Promise<{ connected: boolean; address: string }> {
  return BluetoothPrinterNative.connectPrinter({ address });
}

export async function disconnectPrinter(): Promise<void> {
  await BluetoothPrinterNative.disconnectPrinter();
}

export async function getPrinterStatus(): Promise<PrinterStatusInfo> {
  return BluetoothPrinterNative.getPrinterStatus();
}

export async function printTicket(ticket: TicketPayload): Promise<void> {
  const { success } = await BluetoothPrinterNative.printTicket({ ticket });
  if (!success) throw new Error('La impresora no confirmó la impresión');
}

/**
 * Descarga una imagen (la URL pública del logo, típicamente de Supabase
 * Storage) y la convierte a base64 puro (sin el prefijo
 * "data:image/...;base64,") para mandarla al plugin nativo, que la decodifica
 * con android.util.Base64.decode() del lado de Kotlin.
 *
 * Devuelve null si falla la descarga/conversión — la impresión sigue
 * andando igual, solo que sin el logo, en vez de romper todo el ticket.
 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') { resolve(null); return; }
        // "data:image/png;base64,AAAA..." → "AAAA..."
        resolve(result.split(',')[1] || null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('No se pudo descargar el logo para el ticket térmico:', err);
    return null;
  }
}

export async function printTestPage(): Promise<void> {
  await BluetoothPrinterNative.printTestPage();
}

export async function openCashDrawer(): Promise<void> {
  await BluetoothPrinterNative.openCashDrawer();
}

export async function isBluetoothEnabled(): Promise<boolean> {
  const { enabled } = await BluetoothPrinterNative.isBluetoothEnabled();
  return enabled;
}

/**
 * Ancho de papel (mm) a partir del mismo campo `paperSize` que ya usa
 * generateCleanInvoiceHTML.ts. A4/Carta no aplica a una impresora térmica
 * Bluetooth — en ese caso se devuelve null para indicar "no imprimible por
 * esta vía" (el llamador debe usar el flujo de PDF en su lugar).
 */
export function thermalPaperWidthMm(paperSize: CompanyData['paperSize']): 58 | 80 | null {
  const norm = (paperSize || '80mm').toLowerCase();
  if (norm === '58mm') return 58;
  if (norm === '80mm') return 80;
  return null; // a4 / carta / letter
}

/**
 * Arma el `ticket` que espera BluetoothPrinterManager.printTicket a partir
 * de los mismos InvoiceData/CompanyData que ya arma
 * generateCleanInvoiceHTML.ts — para no recalcular estos datos dos veces, y
 * para que el ticket térmico refleje el mismo diseño/datos que la vista
 * previa de Ajustes > Facturación (texto de pie, términos de pago, y la
 * regla QR-si-es-electrónica / código de barras-si-no-lo-es).
 * El logo se deja fuera a propósito (requeriría convertir la imagen a
 * base64; el ticket nativo lo trata como opcional).
 */
export function buildTicketFromInvoice(
  company: CompanyData,
  invoice: InvoiceData,
  paperWidthMm: 58 | 80
): TicketPayload {
  // Sin prefijo: igual que displayNCF en generateCleanInvoiceHTML.ts (la
  // vista previa nunca antepone invoicePrefix al NCF/comprobante mostrado
  // en la caja — invoice.invoiceNumber, p.ej. "B02-00300411", YA es el
  // valor completo). Concatenar invoicePrefix acá antes causaba un
  // "FAC-B02-00300411" que no coincidía con la vista previa ni con la
  // factura real.
  const invoiceNumber = invoice.invoiceNumber || undefined;

  return {
    businessName: company.name,
    address: company.address,
    rnc: company.rnc,
    phone: company.phone,
    customer: invoice.customerName,
    cashier: invoice.cashierName,
    invoiceNumber,
    isElectronic: invoice.isElectronic,
    date: invoice.date.toLocaleDateString('es-DO'),
    time: invoice.date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    items: invoice.items.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.price,
      total: item.total,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    taxRatePercent: invoice.taxRate,
    total: invoice.total,
    paymentMethod: invoice.paymentMethod,
    amountPaid: invoice.amountPaid,
    change: invoice.change,
    // Mismo criterio que generateCleanInvoiceHTML.ts y la vista previa de
    // Ajustes: QR solo en electrónicas (verificable por la DGII), código de
    // barras solo en NCF regular — nunca los dos juntos.
    qrData: invoice.isElectronic ? invoice.qrCodeUrl : undefined,
    barcode: !invoice.isElectronic && invoice.showBarcode ? invoiceNumber : undefined,
    footerText: invoice.footerText,
    paymentTermsDays: invoice.paymentTerms,
    paperWidthMm,
  };
}
