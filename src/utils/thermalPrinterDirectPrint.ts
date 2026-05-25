/**
 * Direct Thermal Printer Module using ESC/POS commands via Web Serial API
 * This module allows printing directly to thermal printers without showing the browser print dialog
 */

export interface ThermalPrintData {
    companyInfo: {
        name: string;
        rnc?: string;
        phone?: string;
        address?: string;
        logo?: string;
    };
    invoiceNumber: string;
    date: Date;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    change?: number;
    customer?: any;
    employee?: string;
}

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

const commands = {
    INIT: ESC + '@',                    // Initialize printer
    ALIGN_CENTER: ESC + 'a' + '1',      // Center alignment
    ALIGN_LEFT: ESC + 'a' + '0',        // Left alignment
    ALIGN_RIGHT: ESC + 'a' + '2',       // Right alignment
    BOLD_ON: ESC + 'E' + '1',           // Bold on
    BOLD_OFF: ESC + 'E' + '0',          // Bold off
    SIZE_NORMAL: GS + '!' + '\x00',     // Normal size
    SIZE_DOUBLE: GS + '!' + '\x11',     // Double size (width and height)
    SIZE_LARGE: GS + '!' + '\x22',      // Large size
    FEED_LINE: '\n',                    // Line feed
    CUT_PAPER: GS + 'V' + '\x41' + '\x03', // Cut paper
    DRAWER_KICK: ESC + 'p' + '\x00' + '\x19' + '\xFA', // Open cash drawer
};

/**
 * Convert string to appropriate encoding for thermal printer
 */
function encodeText(text: string): Uint8Array {
    // Use TextEncoder for UTF-8 encoding
    const encoder = new TextEncoder();
    return encoder.encode(text);
}

// Global port cache
let cachedPort: any = null;

/**
 * Print invoice to thermal printer using Web Serial API
 * Caches the port after first authorization to avoid repeated permission dialogs
 */
export async function printToThermalPrinter(data: ThermalPrintData): Promise<void> {
    try {
        let port = cachedPort;

        // If no cached port, request one (this will show dialog first time only)
        if (!port) {
            // Check if there are any previously authorized ports
            const ports = await (navigator as any).serial.getPorts();

            if (ports && ports.length > 0) {
                // Use the first authorized port
                port = ports[0];
                console.log('Using previously authorized port');
            } else {
                // No authorized ports, request user to select one
                console.log('Requesting new port...');
                port = await (navigator as any).serial.requestPort();
            }

            // Cache the port for future use
            cachedPort = port;
        }

        // If port is already open, close it first
        if (port.readable || port.writable) {
            try {
                await port.close();
            } catch (e) {
                // Port might already be closed, ignore
            }
        }

        // Open the port with standard thermal printer settings
        await port.open({
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });

        const writer = port.writable.getWriter();

        // Build the print data
        const printData: Uint8Array[] = [];

        // Initialize printer
        printData.push(encodeText(commands.INIT));

        // Header - Company Info
        printData.push(encodeText(commands.ALIGN_CENTER));
        printData.push(encodeText(commands.SIZE_DOUBLE));
        printData.push(encodeText(commands.BOLD_ON));
        printData.push(encodeText(data.companyInfo.name + '\n'));
        printData.push(encodeText(commands.BOLD_OFF));
        printData.push(encodeText(commands.SIZE_NORMAL));

        if (data.companyInfo.rnc) {
            printData.push(encodeText(`RNC: ${data.companyInfo.rnc}\n`));
        }
        if (data.companyInfo.phone) {
            printData.push(encodeText(`Tel: ${data.companyInfo.phone}\n`));
        }
        if (data.companyInfo.address) {
            printData.push(encodeText(`${data.companyInfo.address}\n`));
        }

        printData.push(encodeText(commands.FEED_LINE));
        printData.push(encodeText('--------------------------------\n'));

        // Invoice Number and Date
        printData.push(encodeText(commands.BOLD_ON));
        printData.push(encodeText(`NCF: ${data.invoiceNumber}\n`));
        printData.push(encodeText(commands.BOLD_OFF));
        printData.push(encodeText(`FECHA: ${data.date.toLocaleDateString('es-DO')}\n`));
        printData.push(encodeText(`HORA: ${data.date.toLocaleTimeString('es-DO')}\n`));
        printData.push(encodeText(`PAGO: ${data.paymentMethod.toUpperCase()}\n`));

        if (data.employee) {
            printData.push(encodeText(`ATENDIO: ${data.employee}\n`));
        }

        printData.push(encodeText('--------------------------------\n'));

        // Customer info
        if (data.customer) {
            printData.push(encodeText(`CLIENTE: ${data.customer.name}\n`));
            if (data.customer.rnc) {
                printData.push(encodeText(`RNC: ${data.customer.rnc}\n`));
            }
            printData.push(encodeText('--------------------------------\n'));
        }

        printData.push(encodeText(commands.FEED_LINE));

        // Items Header
        printData.push(encodeText(commands.ALIGN_LEFT));
        printData.push(encodeText(commands.BOLD_ON));
        printData.push(encodeText('PRODUCTO               CANT TOTAL\n'));
        printData.push(encodeText(commands.BOLD_OFF));
        printData.push(encodeText('--------------------------------\n'));

        // Items
        for (const item of data.items) {
            const name = item.name.substring(0, 20).padEnd(20);
            const qty = item.quantity.toString().padStart(4);
            const total = `$${item.total.toFixed(2)}`.padStart(8);

            printData.push(encodeText(`${name} ${qty} ${total}\n`));

            // If name is longer than 20 chars, print continuation
            if (item.name.length > 20) {
                printData.push(encodeText(`  ${item.name.substring(20)}\n`));
            }
        }

        printData.push(encodeText('--------------------------------\n'));

        // Totals
        printData.push(encodeText(commands.ALIGN_RIGHT));
        printData.push(encodeText(`SUBTOTAL: $${data.subtotal.toFixed(2)}\n`));
        printData.push(encodeText(`ITBIS: $${data.tax.toFixed(2)}\n`));
        printData.push(encodeText('--------------------------------\n'));

        printData.push(encodeText(commands.SIZE_DOUBLE));
        printData.push(encodeText(commands.BOLD_ON));
        printData.push(encodeText(`TOTAL: $${data.total.toFixed(2)}\n`));
        printData.push(encodeText(commands.BOLD_OFF));
        printData.push(encodeText(commands.SIZE_NORMAL));

        if (data.change && data.change > 0) {
            printData.push(encodeText(`CAMBIO: $${data.change.toFixed(2)}\n`));
        }

        printData.push(encodeText('--------------------------------\n'));
        printData.push(encodeText(commands.FEED_LINE));

        // Footer
        printData.push(encodeText(commands.ALIGN_CENTER));
        printData.push(encodeText(commands.BOLD_ON));
        printData.push(encodeText('GRACIAS POR SU COMPRA!\n'));
        printData.push(encodeText(commands.BOLD_OFF));
        printData.push(encodeText('CONSERVE SU RECIBO\n'));

        printData.push(encodeText(commands.FEED_LINE));
        printData.push(encodeText(commands.FEED_LINE));
        printData.push(encodeText(commands.FEED_LINE));

        // Cut paper
        printData.push(encodeText(commands.CUT_PAPER));

        // Send all data to printer
        for (const chunk of printData) {
            await writer.write(chunk);
        }

        // Release the writer and close the port
        writer.releaseLock();
        await port.close();

    } catch (error) {
        console.error('Error printing to thermal printer:', error);
        throw new Error('No se pudo imprimir en la impresora térmica. Verifica que esté conectada y encendida.');
    }
}
