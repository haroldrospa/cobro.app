import { CompanyInfoForPrint, PaperSize } from '@/hooks/usePrintSettings';
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
    salesCount?: number;
    totalCost?: number;
    netProfit?: number;
    profitMargin?: number;
}

export interface CloseDayData {
    stats: CloseDayStats;
    actualCash: number;
    difference: number;
    notes?: string;
    openedAt: string;
    closedAt: string;
    openedBy?: string;
    closedBy?: string;
}

export const generateCloseDayPDF = async (
    companyInfo: CompanyInfoForPrint,
    data: CloseDayData,
    paperSize: PaperSize = 'carta'
) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const fmt = (val: number) => (val || 0).toLocaleString('es-DO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const openedDateStr = data.openedAt ? format(new Date(data.openedAt), "dd/MM/yyyy hh:mm a", { locale: es }) : 'N/A';
    const closedDateStr = data.closedAt ? format(new Date(data.closedAt), "dd/MM/yyyy hh:mm a", { locale: es }) : format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es });
    const diff = data.difference || 0;
    const diffStatus = diff === 0 ? 'CUADRADO (OK)' : diff > 0 ? `SOBRANTE (+RD$ ${fmt(diff)})` : `FALTANTE (-RD$ ${fmt(Math.abs(diff))})`;
    const diffColor: [number, number, number] = diff === 0 ? [16, 185, 129] : diff > 0 ? [59, 130, 246] : [239, 68, 68];

    const isThermal = paperSize === '80mm' || paperSize === '58mm';

    // ==========================================
    // 1. FORMATO TÉRMICO (80mm o 58mm)
    // ==========================================
    if (isThermal) {
        const rollWidth = paperSize === '58mm' ? 58 : 80;
        const thermalMargin = 4;
        const thermalContentW = rollWidth - (thermalMargin * 2);

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [rollWidth, 297]
        });

        let curY = 6;

        // Logo
        if (companyInfo.logo) {
            try {
                const logoSize = rollWidth === 58 ? 14 : 18;
                doc.addImage(companyInfo.logo, 'PNG', (rollWidth - logoSize) / 2, curY, logoSize, logoSize, undefined, 'FAST');
                curY += logoSize + 2;
            } catch (e) {
                console.warn("Logo error", e);
            }
        }

        // Store info
        doc.setFont("helvetica", "bold");
        doc.setFontSize(rollWidth === 58 ? 10 : 12);
        doc.setTextColor(0, 0, 0);
        doc.text(companyInfo.name || "Mi Negocio", rollWidth / 2, curY, { align: 'center' });
        curY += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(60, 60, 60);
        if (companyInfo.rnc) {
            doc.text(`RNC: ${companyInfo.rnc}`, rollWidth / 2, curY, { align: 'center' });
            curY += 3.5;
        }
        if (companyInfo.phone) {
            doc.text(`Tel: ${companyInfo.phone}`, rollWidth / 2, curY, { align: 'center' });
            curY += 3.5;
        }

        // Divider
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
        curY += 4;

        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text("CIERRE DE CAJA / TURNO", rollWidth / 2, curY, { align: 'center' });
        curY += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(closedDateStr, rollWidth / 2, curY, { align: 'center' });
        curY += 4;

        // Session metadata
        doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
        curY += 3;
        doc.setFontSize(7.5);
        doc.text("Apertura:", thermalMargin, curY);
        doc.text(openedDateStr, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;
        doc.text("Cierre:", thermalMargin, curY);
        doc.text(closedDateStr, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;
        doc.text("Cajero/a:", thermalMargin, curY);
        doc.text(data.closedBy || 'Usuario Actual', rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 4;

        // Cash section
        doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
        curY += 3.5;
        doc.setFont("helvetica", "bold");
        doc.text("RESUMEN DE EFECTIVO", rollWidth / 2, curY, { align: 'center' });
        curY += 4;

        doc.setFont("helvetica", "normal");
        doc.text("Fondo Inicial (Base):", thermalMargin, curY);
        doc.text(`RD$ ${fmt(data.stats.initialCash)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;

        doc.setFont("helvetica", "bold");
        doc.text("(+) Ventas Efectivo:", thermalMargin, curY);
        doc.text(`RD$ ${fmt(data.stats.cashSales)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;

        if (data.stats.deposits > 0) {
            doc.setFont("helvetica", "normal");
            doc.text("(+) Entradas:", thermalMargin, curY);
            doc.text(`RD$ ${fmt(data.stats.deposits)}`, rollWidth - thermalMargin, curY, { align: 'right' });
            curY += 3.5;
        }
        if (data.stats.withdrawals > 0) {
            doc.setFont("helvetica", "normal");
            doc.text("(-) Salidas:", thermalMargin, curY);
            doc.text(`RD$ ${fmt(data.stats.withdrawals)}`, rollWidth - thermalMargin, curY, { align: 'right' });
            curY += 3.5;
        }
        if (data.stats.totalRefunds > 0) {
            doc.setFont("helvetica", "normal");
            doc.text("(-) Devoluciones:", thermalMargin, curY);
            doc.text(`RD$ ${fmt(data.stats.totalRefunds)}`, rollWidth - thermalMargin, curY, { align: 'right' });
            curY += 3.5;
        }

        doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
        curY += 3.5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("EFECTIVO ESPERADO:", thermalMargin, curY);
        doc.text(`RD$ ${fmt(data.stats.expectedCash)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 5;

        // Cash Count box
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(thermalMargin, curY, thermalContentW, 11);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("EFECTIVO REAL (Físico):", thermalMargin + 2, curY + 4);
        doc.text(`RD$ ${fmt(data.actualCash)}`, rollWidth - thermalMargin - 2, curY + 4, { align: 'right' });

        doc.setFontSize(7.5);
        doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
        doc.text("DIFERENCIA:", thermalMargin + 2, curY + 8.5);
        doc.text(diffStatus, rollWidth - thermalMargin - 2, curY + 8.5, { align: 'right' });
        curY += 14;

        // Other Sales
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("TOTAL VENTAS DEL TURNO", thermalMargin, curY);
        doc.text(`RD$ ${fmt(data.stats.totalSales)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(`Total Transacciones: ${data.stats.salesCount || 0} ventas`, thermalMargin, curY);
        curY += 5;

        // Fund Separation
        const totalCost = data.stats.totalCost || 0;
        const netProfit = data.stats.netProfit || 0;
        const marginPct = (data.stats.profitMargin ?? (data.stats.totalSales > 0 ? (netProfit / data.stats.totalSales) * 100 : 0)).toFixed(1);

        doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
        curY += 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("SEPARACIÓN DE FONDOS", rollWidth / 2, curY, { align: 'center' });
        curY += 4;

        doc.setTextColor(37, 99, 235); // Blue
        doc.text("REINVERSIÓN (COSTO):", thermalMargin, curY);
        doc.text(`RD$ ${fmt(totalCost)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 4;

        doc.setTextColor(5, 150, 105); // Green
        doc.text("GANANCIA NETA:", thermalMargin, curY);
        doc.text(`RD$ ${fmt(netProfit)}`, rollWidth - thermalMargin, curY, { align: 'right' });
        curY += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(`Margen de ganancia: ${marginPct}%`, thermalMargin, curY);
        curY += 6;

        // Notes
        if (data.notes) {
            doc.line(thermalMargin, curY, rollWidth - thermalMargin, curY);
            curY += 3.5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(0, 0, 0);
            doc.text("NOTAS:", thermalMargin, curY);
            curY += 3;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7);
            doc.text(data.notes, thermalMargin, curY);
            curY += 5;
        }

        // Signatures
        curY += 8;
        doc.setDrawColor(0, 0, 0);
        doc.line(thermalMargin + 5, curY, rollWidth - thermalMargin - 5, curY);
        curY += 3.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text("Firma del Cajero / Responsable", rollWidth / 2, curY, { align: 'center' });

        return doc;
    }

    // ==========================================
    // 2. FORMATO CARTA / A4 (Diseño idéntico a la Vista Previa)
    // ==========================================
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'letter'
    });

    const pageWidth = 215.9; // Letter width
    const pageHeight = 279.4; // Letter height
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);
    const rightX = pageWidth - margin;

    // --- 1. HEADER MODERNO ---
    const headerY = 14;
    let logoWidth = 0;
    if (companyInfo.logo) {
        try {
            doc.addImage(companyInfo.logo, 'PNG', margin, headerY, 22, 22, undefined, 'FAST');
            logoWidth = 26;
        } catch (e) {
            console.warn("Logo error", e);
        }
    }

    const brandX = margin + logoWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(companyInfo.name || "Mi Negocio", brandX, headerY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // #64748b
    let textY = headerY + 11;
    if (companyInfo.rnc) {
        doc.text(`RNC: ${companyInfo.rnc}`, brandX, textY);
        textY += 4.2;
    }
    if (companyInfo.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, brandX, textY);
        textY += 4.2;
    }
    if (companyInfo.address) {
        doc.text(companyInfo.address, brandX, textY);
    }

    // Header Right (Badge, Title, Date)
    const badgeW = 34;
    const badgeH = 5.5;
    const badgeX = rightX - badgeW;
    const badgeY = headerY + 1;
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.setDrawColor(167, 243, 208); // #a7f3d0
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.7, 2.7, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105); // #059669
    doc.text("✓ TURNO CERRADO", badgeX + (badgeW / 2), badgeY + 3.8, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("Reporte de Cierre de Caja", rightX, headerY + 13, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(closedDateStr, rightX, headerY + 18, { align: 'right' });

    // Divider Line below Header
    const divY = Math.max(textY + 5, headerY + 24);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(margin, divY, rightX, divY);

    // --- 2. TARJETAS DE SESIÓN (Grid 2 columnas) ---
    const cardY = divY + 4;
    const cardH = 15;
    const cardW = (contentWidth - 6) / 2;

    // Card 1: Horario de Sesión
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, cardY, 1.2, cardH, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("HORARIO DE SESIÓN", margin + 4, cardY + 4);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(openedDateStr, margin + 4, cardY + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`al ${closedDateStr}`, margin + 4, cardY + 12.5);

    // Card 2: Responsables
    const card2X = margin + cardW + 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(card2X, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(15, 23, 42);
    doc.rect(card2X, cardY, 1.2, cardH, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("RESPONSABLES", card2X + 4, cardY + 4);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${data.closedBy || 'Usuario Actual'} (Cierre)`, card2X + 4, cardY + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Apertura: ${data.openedBy || '-'}`, card2X + 4, cardY + 12.5);

    let currentY = cardY + cardH + 4;

    // --- 3. MOVIMIENTOS DE EFECTIVO ---
    const cashBody: any[] = [
        ['Fondo Inicial de Caja (Base)', `$${fmt(data.stats.initialCash)}`],
        ['(+) Ventas en Efectivo', `+$${fmt(data.stats.cashSales)}`]
    ];
    if (data.stats.deposits > 0) {
        cashBody.push(['(+) Entradas extraordinarias a caja', `+$${fmt(data.stats.deposits)}`]);
    }
    if (data.stats.withdrawals > 0) {
        cashBody.push(['(-) Salidas / Retiros de caja', `-$${fmt(data.stats.withdrawals)}`]);
    }
    if (data.stats.totalRefunds > 0) {
        cashBody.push(['(-) Devoluciones en efectivo', `-$${fmt(data.stats.totalRefunds)}`]);
    }

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['Movimientos de Efectivo', 'Monto (RD$)']],
        body: cashBody,
        foot: [['EFECTIVO ESPERADO EN CAJA', `$${fmt(data.stats.expectedCash)}`]],
        theme: 'plain',
        headStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: 2.2
        },
        footStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 2.5,
            lineWidth: { top: 0.4 },
            lineColor: [226, 232, 240]
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            lineColor: [241, 245, 249],
            lineWidth: { bottom: 0.15 }
        },
        columnStyles: {
            0: { cellWidth: 'auto', textColor: [30, 41, 59] },
            1: { halign: 'right', fontStyle: 'bold', font: 'courier' }
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 1) {
                const text = String(hookData.cell.raw);
                if (text.startsWith('+')) {
                    hookData.cell.styles.textColor = [5, 150, 105];
                } else if (text.startsWith('-')) {
                    hookData.cell.styles.textColor = [225, 29, 72];
                }
            }
        }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 3.5;

    // --- 4. CUADRE DE CAJA BANNER (Card Oscura) ---
    const bannerH = 14;
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.roundedRect(margin, currentY, contentWidth, bannerH, 2.5, 2.5, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text("EFECTIVO FÍSICO CONTADO", margin + 5, currentY + 4.5);

    doc.setFont("courier", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`$${fmt(data.actualCash)}`, margin + 5, currentY + 10.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("DIFERENCIA DE CUADRE", rightX - 5, currentY + 4.5, { align: 'right' });

    doc.setFont("courier", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
    doc.text(diffStatus, rightX - 5, currentY + 10.5, { align: 'right' });

    currentY += bannerH + 3.5;

    // --- 5. RESUMEN GENERAL DE VENTAS (TODAS LAS FORMAS) ---
    const salesBody: any[] = [
        ['Ventas en Efectivo', `$${fmt(data.stats.cashSales)}`],
        ['Ventas con Tarjeta (Crédito / Débito)', `$${fmt(data.stats.cardSales)}`],
        ['Ventas por Transferencia Bancaria', `$${fmt(data.stats.transferSales)}`]
    ];
    if (data.stats.otherSales > 0) {
        salesBody.push(['Ventas a Crédito / Otros métodos', `$${fmt(data.stats.otherSales)}`]);
    }

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['Resumen General de Ventas (Todas las Formas)', 'Monto (RD$)']],
        body: salesBody,
        foot: [[`TOTAL GENERAL FACTURADO (${data.stats.salesCount || 0} Ventas)`, `$${fmt(data.stats.totalSales)}`]],
        theme: 'plain',
        headStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: 2.2
        },
        footStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 2.5,
            lineWidth: { top: 0.4 },
            lineColor: [226, 232, 240]
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            lineColor: [241, 245, 249],
            lineWidth: { bottom: 0.15 }
        },
        columnStyles: {
            0: { cellWidth: 'auto', textColor: [30, 41, 59] },
            1: { halign: 'right', fontStyle: 'bold', font: 'courier' }
        }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 3.5;

    // --- 6. SEPARACIÓN DE FONDOS (REINVERSIÓN Y GANANCIA NETA) ---
    const totalCost = data.stats.totalCost || 0;
    const netProfit = data.stats.netProfit || 0;
    const marginPct = (data.stats.profitMargin ?? (data.stats.totalSales > 0 ? (netProfit / data.stats.totalSales) * 100 : 0)).toFixed(1);

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [[`Separación de Fondos (Cuadre de Ventas) - Margen: ${marginPct}%`, 'Propósito / Destino', 'Monto a Separar (RD$)']],
        body: [
            ['Capital de Reinversión', 'Costo de mercancía a reponer en inventario y suplidores', `$${fmt(totalCost)}`],
            ['Ganancia Neta Estimada', 'Utilidad líquida real generada por las ventas del turno', `$${fmt(netProfit)}`]
        ],
        foot: [['TOTAL FACTURADO (Reinversión + Ganancia Neta)', '', `$${fmt(data.stats.totalSales)}`]],
        theme: 'plain',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: 2.2
        },
        footStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 2.5,
            lineWidth: { top: 0.4 },
            lineColor: [226, 232, 240]
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            lineColor: [241, 245, 249],
            lineWidth: { bottom: 0.15 }
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 55 },
            1: { textColor: [100, 116, 139], fontSize: 8 },
            2: { halign: 'right', fontStyle: 'bold', font: 'courier' }
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body') {
                if (hookData.row.index === 0) {
                    if (hookData.column.index === 0 || hookData.column.index === 2) {
                        hookData.cell.styles.textColor = [37, 99, 235]; // Blue
                    }
                } else if (hookData.row.index === 1) {
                    if (hookData.column.index === 0 || hookData.column.index === 2) {
                        hookData.cell.styles.textColor = [5, 150, 105]; // Green
                    }
                }
            }
        }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 3.5;

    // --- 7. OBSERVACIONES / NOTAS ---
    if (data.notes) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Observaciones registradas en el cierre:", margin + 3, currentY + 3.8);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(data.notes, margin + 3, currentY + 7.5);
        currentY += 13;
    } else {
        currentY += 5;
    }

    // --- 8. FIRMAS AUTORIZADAS ---
    const signY = Math.min(currentY + 12, pageHeight - 22);

    // Firma Cajero
    const sign1X1 = margin + 15;
    const sign1X2 = margin + 75;
    const sign1Mid = (sign1X1 + sign1X2) / 2;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign1X1, signY, sign1X2, signY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("FIRMA DEL CAJERO / RESPONSABLE", sign1Mid, signY + 3.5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.closedBy || 'Usuario Actual', sign1Mid, signY + 7, { align: 'center' });

    // Firma Supervisor
    const sign2X1 = rightX - 75;
    const sign2X2 = rightX - 15;
    const sign2Mid = (sign2X1 + sign2X2) / 2;
    doc.line(sign2X1, signY, sign2X2, signY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("FIRMA AUTORIZADA / SUPERVISOR", sign2Mid, signY + 3.5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(companyInfo.name || 'Mi Negocio', sign2Mid, signY + 7, { align: 'center' });

    // --- 9. PIE DE PÁGINA OFICIAL ---
    const footerY = pageHeight - 7;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2.5, rightX, footerY - 2.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
        "Documento de Cierre Oficial emitido por Cobro App • Sistema de Punto de Venta y Gestión",
        pageWidth / 2,
        footerY,
        { align: 'center' }
    );

    return doc;
};
