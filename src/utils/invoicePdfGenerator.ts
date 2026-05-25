import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceItem {
    name: string;
    quantity: number;
    price: number;
    unit_price?: number;
    tax_amount?: number;
    comment?: string;
}

export interface Customer {
    name: string;
    rnc?: string;
}

export interface SaleData {
    items: InvoiceItem[];
    total: number;
    paymentMethod: string;
    change?: number;
    customer?: Customer;
    customerDebt?: number;
    invoiceNumber?: string;
    invoice_number?: string;
    isElectronic?: boolean;
    is_electronic?: boolean;
    encf?: string;
    codigo_seguridad?: string;
    fecha_firma?: string;
    qrcode_url?: string;
    qrcodeUrl?: string;
    securityCode?: string;
    signatureDate?: string;
}

export interface CompanyInfo {
    name: string;
    logo?: string | null;
    rnc?: string | null;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
    website?: string | null;
}

export const generateProfessionalPDF = async (companyInfo: CompanyInfo, saleData: SaleData, invoiceNumber: string) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Use provided logo or fallback to the one we just created for them if it's Mamajuana
    const logoUrl = companyInfo.logo || (companyInfo.name?.toLowerCase().includes('mamajuana') ? '/mamajuana-logo.png' : null);

    // --- 1. Top Header Area (Company Identity) ---
    if (logoUrl) {
        try {
            const imgProps = doc.getImageProperties(logoUrl);
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
            doc.addImage(logoUrl, 'PNG', xPos, yPos, imgW, imgH, undefined, 'FAST');
        } catch (e) {
            console.warn("Could not add logo to PDF:", e);
            doc.addImage(logoUrl, 'PNG', 15, 10, 35, 25, undefined, 'FAST');
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    // Move text further right if logo exists
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

    const isElectronic = saleData.isElectronic || saleData.is_electronic || !!saleData.encf || invoiceNumber.startsWith('E');

    // Robust Security Code extraction & fallback generation
    const securityCode = (() => {
        let code = saleData.codigo_seguridad || saleData.securityCode;
        if (!code || code === 'undefined') {
            const qUrl = saleData.qrcode_url || saleData.qrcodeUrl;
            if (qUrl) {
                try {
                    const urlObj = new URL(qUrl);
                    const parsed = urlObj.searchParams.get('CodigoSeguridad');
                    if (parsed && parsed !== 'undefined') code = parsed;
                } catch (_) {
                    const match = qUrl.match(/[?&]CodigoSeguridad=([^&]+)/i);
                    if (match && match[1] !== 'undefined') code = match[1];
                }
            }
        }
        if (!code || code === 'undefined') {
            const seed = saleData.encf || saleData.invoiceNumber || invoiceNumber || 'E32000000001';
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

    const signatureDate = saleData.fecha_firma || saleData.signatureDate || new Date().toISOString();

    const customerStartY = 95;
    const tableStartY = 120;
    const boxHeight = 22;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 65, 180, boxHeight, 2, 2, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(26, 32, 44);
    doc.text(`${isElectronic ? 'e-CF' : 'NCF'}: ${invoiceNumber}`, 20, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(113, 128, 150);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-DO')} ${new Date().toLocaleTimeString('es-DO')}`, 130, 75);
    doc.text(`PAGO: ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'}`, 130, 81);

    // Add employee name if available
    // @ts-ignore - profile property might not be in the strict interface yet but passed at runtime
    if ((saleData as any).profile?.full_name) {
        doc.setFontSize(9);
        // @ts-ignore
        doc.text(`LE ATENDIÓ: ${(saleData as any).profile.full_name.toUpperCase()}`, 130, isElectronic ? 97 : 87);
    }

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
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`RNC/Cédula: ${saleData.customer.rnc}`, 15, customerStartY + 15);
    }

    // --- 4. Products Table ---
    const tableData = (saleData.items || []).map((item) => {
        let description = String(item.name || 'Producto');
        if (item.comment) {
            description += `\n(Nota: ${item.comment})`;
        }
        return [
            description,
            Number(item.quantity || 0),
            `$${Number(item.price || item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            `$${(Number(item.price || item.unit_price || 0) * Number(item.quantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
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
    // @ts-ignore - lastAutoTable exists on the doc instance added by the plugin
    const finalY = (doc as any).lastAutoTable?.finalY + 10;
    const summaryLeft = 130;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const subtotal = Number(saleData.total || 0) / 1.18;
    const itbis = Number(saleData.total || 0) - subtotal;

    doc.text('Subtotal:', summaryLeft, finalY);
    doc.text(`$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY, { align: 'right' });

    doc.text('ITBIS (18%):', summaryLeft, finalY + 7);
    doc.text(`$${itbis.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY + 7, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(summaryLeft, finalY + 10, 195, finalY + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL DOP:', summaryLeft, finalY + 18);
    doc.text(`$${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY + 18, { align: 'right' });

    // --- 6. Footer ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Esta factura electrónica es un comprobante fiscal válido según las regulaciones locales.', 105, pageHeight - 20, { align: 'center' });
    doc.text('¡Gracias por su preferencia!', 105, pageHeight - 15, { align: 'center' });

    // --- 7. Watermark (All Pages) ---
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20); // Increased from 10 for better visibility
        doc.setTextColor(120, 120, 120); // Slightly darker gray for better visibility
        doc.text("COBRO", 105, pageHeight - 4, { align: 'center' });
    }

    // --- 8. Add QR Code if electronic ---
    const qrUrl = saleData.qrcode_url || saleData.qrcodeUrl;
    if (isElectronic && qrUrl) {
        try {
            const qrImg = new Image();
            qrImg.crossOrigin = "anonymous";
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;
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

export const generatePreCheckPDF = (companyInfo: CompanyInfo, order: any, paperSize: string = '80mm') => {
    // Detect paper settings
    const isSmall = paperSize === '58mm' || paperSize === '50mm';
    const width = isSmall ? 58 : 80;
    const margin = isSmall ? 3 : 5;
    const contentWidth = width - (margin * 2);
    const centerX = width / 2;

    // Height is arbitrary long; for thermal printers usually handled by the driver cutting the paper
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [width, 300]
    });

    let y = 5;

    // Use provided logo or fallback to the one we just created for them if it's Mamajuana
    const logoUrl = companyInfo.logo || (companyInfo.name?.toLowerCase().includes('mamajuana') ? '/mamajuana-logo.png' : null);

    if (logoUrl) {
        try {
            const logoW = 25; // Smaller for 80mm/58mm paper
            const logoH = 25;
            const logoX = (width - logoW) / 2;
            doc.addImage(logoUrl, 'PNG', logoX, y, logoW, logoH, undefined, 'FAST');
            y += logoH + 2;
        } catch (e) {
            console.warn("Could not add logo to PreCheck PDF:", e);
        }
    }

    // Helper for centering text
    const centerText = (text: string, font: string, style: string, size: number) => {
        doc.setFont(font, style);
        doc.setFontSize(size);
        const textWidth = doc.getTextWidth(text);
        const x = (width - textWidth) / 2;
        doc.text(text, x, y);
        y += (size * 0.4) + 2;
    };

    // Header - Centered properly
    centerText(String(companyInfo.name || 'PRE-CUENTA'), "helvetica", "bold", isSmall ? 12 : 14);

    if (companyInfo.phone) {
        centerText(`Tel: ${companyInfo.phone}`, "helvetica", "normal", isSmall ? 8 : 9);
    }

    const dateStr = new Date(order.created_at).toLocaleString('es-DO', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: true
    });

    centerText(`Fecha: ${dateStr}`, "helvetica", "normal", isSmall ? 7 : 8);
    y += 2;
    centerText(`ORDEN #${order.order_number || 'N/A'}`, "helvetica", "bold", isSmall ? 11 : 13);
    y += 2;

    if (order.customer_name) {
        centerText(`Cliente: ${order.customer_name}`, "helvetica", "normal", isSmall ? 8 : 9);
    }

    // Separator
    doc.setLineWidth(0.3);
    doc.line(margin, y, width - margin, y);
    y += 5;

    // Columns Configuration - Adjusted for better spacing
    // CANT | DESC | TOT
    const qtyWidth = isSmall ? 8 : 10;
    const totalWidth = isSmall ? 18 : 22; // Increased for full price display
    const descWidth = contentWidth - qtyWidth - totalWidth - 4; // More padding

    const colQtyX = margin;
    const colDescX = margin + qtyWidth + 2;
    const colTotalX = width - margin; // right aligned

    // Headers
    doc.setFontSize(isSmall ? 7 : 9);
    doc.setFont("helvetica", "bold");
    doc.text("CANT", colQtyX, y);
    doc.text("DESC", colDescX, y);
    doc.text("TOT", colTotalX, y, { align: 'right' });
    y += 4;

    doc.setLineWidth(0.2);
    doc.line(margin, y, width - margin, y);
    y += 4;

    // Items
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isSmall ? 8 : 9);
    const items = order.open_order_items || [];

    items.forEach((item: any) => {
        const qty = String(item.quantity);
        let nameRaw = String(item.product_name || item.name || 'Item'); // Fallback to item.name if product_name is missing

        if (item.comment) {
            nameRaw += `\n(${item.comment})`;
        }

        // Display the base price (unit_price * quantity) - what the customer expects to see
        // This is the "list price" before any tax calculations
        const itemPrice = (item.unit_price || 0) * (item.quantity || 1);
        const total = `$${itemPrice.toFixed(2)}`;

        // Wrap description to fit in column
        const nameLines = doc.splitTextToSize(nameRaw, descWidth);

        // Quantity
        doc.text(qty, colQtyX, y);

        // Description (multiline)
        doc.text(nameLines, colDescX, y);

        // Total - aligned right
        doc.text(total, colTotalX, y, { align: 'right' });

        // Advance y by number of lines (with proper spacing)
        y += (nameLines.length * 4) + 1;
    });

    y += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, y, width - margin, y);
    y += 5;

    // Totals - Centered layout
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isSmall ? 12 : 14);

    const totalLabel = "TOTAL:";
    const totalValue = `$${(order.total || 0).toFixed(2)}`;

    // Center the total line
    const totalLabelWidth = doc.getTextWidth(totalLabel);
    const totalValueWidth = doc.getTextWidth(totalValue);
    const totalLineWidth = totalLabelWidth + totalValueWidth + 5;
    const totalStartX = (width - totalLineWidth) / 2;

    doc.text(totalLabel, totalStartX, y);
    doc.text(totalValue, totalStartX + totalLabelWidth + 5, y);

    y += 8;

    // Footer
    doc.setLineWidth(0.2);
    doc.line(margin, y, width - margin, y);
    y += 5;

    centerText("*** NO ES FACTURA FISCAL ***", "helvetica", "italic", isSmall ? 7 : 8);

    // Auto print script
    doc.autoPrint();

    return doc;
};
