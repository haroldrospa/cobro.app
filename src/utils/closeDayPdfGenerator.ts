// jsPDF/autotable se importan dinámicamente dentro de generateCloseDayPDF —
// solo hacen falta al cerrar caja, no en cada componente que usa este módulo.
import { CompanyInfoForPrint } from '@/hooks/usePrintSettings';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface CloseDayStats {
    initialCash: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    otherSales: number;
    totalRefunds: number;
    deposits: number;
    withdrawals: number;
    expectedCash: number;
    cashToWithdraw: number;
    totalSales: number;
}

export interface CloseDayData {
    stats: CloseDayStats;
    actualCash: number;
    difference: number;
    notes?: string;
    openedAt: string;
    closedAt: string; // Current time usually
    openedBy?: string;
    closedBy?: string;
}

export const generateCloseDayPDF = async (companyInfo: CompanyInfoForPrint, data: CloseDayData) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // --- Header ---
    if (companyInfo.logo) {
        try {
            doc.addImage(companyInfo.logo, 'PNG', 15, 10, 25, 25, undefined, 'FAST');
        } catch (e) {
            console.warn("Logo error", e);
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("REPORTE DE CIERRE DE CAJA", 195, 20, { align: 'right' });

    doc.setFontSize(14);
    doc.text(companyInfo.name || "Mi Empresa", 195, 28, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const today = format(new Date(), "dd 'de' MMMM yyyy, hh:mm a", { locale: es });
    doc.text(`Generado el: ${today}`, 195, 34, { align: 'right' });

    // --- Info Box ---
    autoTable(doc, {
        startY: 45,
        head: [['Detalles de la Sesión', '']],
        body: [
            ['Apertura:', format(new Date(data.openedAt), "dd/MM/yyyy hh:mm a", { locale: es })],
            ['Cierre:', format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es })],
            ['Responsable Apertura:', data.openedBy || '-'],
            ['Responsable Cierre:', data.closedBy || 'Usuario Actual'],
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    // @ts-ignore
    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Financial Summary ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumen Financiero", 14, currentY);
    currentY += 5;

    autoTable(doc, {
        startY: currentY,
        head: [['Concepto', 'Monto']],
        body: [
            ['Fondo Inicial (Caja Chica)', `$${data.stats.initialCash.toLocaleString()}`],
            ['(+) Ventas Efectivo', `$${data.stats.cashSales.toLocaleString()}`],
            ['(+) Entradas de Caja', `$${data.stats.deposits.toLocaleString()}`],
            ['(-) Salidas de Caja', `$${data.stats.withdrawals.toLocaleString()}`],
            ['(-) Devoluciones Efectivo', `$${data.stats.totalRefunds.toLocaleString()}`],
            ['= INGRESO NETO DISPONIBLE', `$${data.stats.expectedCash.toLocaleString()}`],
        ],
        theme: 'striped',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        headStyles: { fillColor: [41, 128, 185] }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Cash Count & Difference ---
    doc.setFont("helvetica", "bold");
    doc.text("Cuadre de Caja", 14, currentY);
    currentY += 5;

    const diffColor: [number, number, number] = data.difference === 0 ? [46, 204, 113] : data.difference > 0 ? [52, 152, 219] : [231, 76, 60];

    autoTable(doc, {
        startY: currentY,
        body: [
            ['Efectivo Real (Conteo Físico)', `$${data.actualCash.toLocaleString()}`],
            ['Diferencia', `$${Math.abs(data.difference).toLocaleString()} ${data.difference > 0 ? '(Sobrante)' : data.difference < 0 ? '(Faltante)' : 'OK'}`],
        ],
        theme: 'grid',
        styles: { fontSize: 12, fontStyle: 'bold', minCellHeight: 10, valign: 'middle' },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (hookData) => {
            if (hookData.row.index === 1 && hookData.column.index === 1) {
                hookData.cell.styles.textColor = diffColor;
            }
        }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Other Sales ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Otras Formas de Pago (No afecta efectivo)", 14, currentY);
    currentY += 2;

    autoTable(doc, {
        startY: currentY + 4,
        body: [
            ['Ventas Tarjeta', `$${data.stats.cardSales.toLocaleString()}`],
            ['Ventas Transferencia', `$${data.stats.transferSales.toLocaleString()}`],
            ['Ventas a Crédito/Otros', `$${data.stats.otherSales.toLocaleString()}`],
            ['TOTAL VENTAS (Todas las formas)', `$${data.stats.totalSales.toLocaleString()}`],
        ],
        theme: 'plain',
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } }
    });

    // Notes
    if (data.notes) {
        // @ts-ignore
        currentY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.text("Notas del Cierre:", 14, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(data.notes, 14, currentY + 6);
    }

    // --- Watermark ---
    try {
        const logoImg = new Image();
        logoImg.src = '/cobro-logo.png'; // Use public folder path for reliability in jspdf
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
            if (logoImg.complete) resolve(null);
        });

        const pageCount = (doc.internal as any).getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        const logoSize = 12;
        const spacing = 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        const textStr = "COBRO";
        const textWidth = doc.getTextWidth(textStr);
        const totalWidth = logoSize + spacing + textWidth;
        const startX = (pageWidth - totalWidth) / 2;
        const watermarkY = pageHeight - 8;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            try {
                doc.addImage(logoImg, 'PNG', startX, watermarkY - 5, logoSize, logoSize, undefined, 'FAST');
            } catch (e) {
                // If image fails, it will just draw text
            }
            doc.setTextColor(150, 150, 150);
            doc.text(textStr, startX + logoSize + spacing, watermarkY + 2);
        }
    } catch (e) {
        // Fallback to text only
        const pageCount = (doc.internal as any).getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(150, 150, 150);
            doc.text("COBRO", 105, pageHeight - 5, { align: 'center' });
        }
    }

    return doc;
};
