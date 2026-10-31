import { CompanyInfo, PayrollSettings } from './printPayrollReceipt';
import { loadImageAsDataUrl } from './statementPdfGenerator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (val: number) => (val || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const getRoleLabel = (role?: string): string => {
    switch (role?.toLowerCase()) {
        case 'admin':
            return 'Administrador';
        case 'manager':
            return 'Gerente';
        case 'cashier':
        case 'staff':
            return 'Cajero';
        case 'accountant':
            return 'Contador';
        case 'kitchen':
            return 'Cocinero';
        case 'delivery':
            return 'Delivery / Repartidor';
        case 'waiter':
        case 'mesero':
            return 'Mesero/a';
        default:
            return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Colaborador';
    }
};

/**
 * Renderiza la página del Resumen General de Nómina en una instancia de jsPDF
 */
export const renderPayrollSummaryPage = async (
    doc: any,
    payroll: any,
    items: any[],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo
) => {
    const { default: autoTable } = await import('jspdf-autotable');

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const rightX = pageWidth - margin;

    const isPaid = payroll?.status === 'paid';
    const periodStart = payroll?.period_start
        ? format(new Date(payroll.period_start), "dd 'de' MMMM, yyyy", { locale: es })
        : 'N/A';
    const periodEnd = payroll?.period_end
        ? format(new Date(payroll.period_end), "dd 'de' MMMM, yyyy", { locale: es })
        : 'N/A';
    const printDate = format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es });

    let curY = margin;

    // --- LOGO ---
    let logoData = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;
    let textStartX = margin;

    if (logoData) {
        try {
            const maxW = 32;
            const maxH = 18;
            const aspect = logoData.width / logoData.height;
            let w = maxW;
            let h = maxW / aspect;
            if (h > maxH) {
                h = maxH;
                w = maxH * aspect;
            }
            doc.addImage(logoData.dataUrl, logoData.format, margin, curY, w, h, undefined, 'FAST');
            textStartX = margin + w + 5;
        } catch (_e) {
            // Ignore logo error
        }
    }

    // --- COMPANY INFO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(storeName || 'Mi Negocio', textStartX, curY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500

    let lineY = curY + 8.5;
    if (companyInfo?.rnc) {
        doc.text(`RNC: ${companyInfo.rnc}`, textStartX, lineY);
        lineY += 3.8;
    }
    if (companyInfo?.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, textStartX, lineY);
        lineY += 3.8;
    }
    if (companyInfo?.address) {
        const addrLines = doc.splitTextToSize(String(companyInfo.address), 60);
        doc.text(addrLines, textStartX, lineY);
        lineY += addrLines.length * 3.5;
    }

    // --- TITLE & BADGE (RIGHT SIDE) ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(isPaid ? 'RESUMEN GENERAL DE NÓMINA' : 'VISTA PREVIA DE NÓMINA', rightX, curY + 4, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Consolidado Oficial de Sueldos y Retenciones', rightX, curY + 8.5, { align: 'right' });

    // Status Badge
    const badgeText = isPaid ? '✓ NÓMINA PAGADA' : '⏳ BORRADOR / VISTA PREVIA';
    const badgeColor: [number, number, number] = isPaid ? [16, 185, 129] : [245, 158, 11];
    const badgeBg: [number, number, number] = isPaid ? [236, 253, 245] : [254, 243, 199];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const badgeW = doc.getTextWidth(badgeText) + 8;
    const badgeH = 5.5;
    const badgeX = rightX - badgeW;
    const badgeY = curY + 11.5;

    doc.setFillColor(...badgeBg);
    doc.setDrawColor(...badgeColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'FD');

    doc.setTextColor(...badgeColor);
    doc.text(badgeText, badgeX + 4, badgeY + 3.8);

    curY = Math.max(lineY + 4, badgeY + badgeH + 6);

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, curY, rightX, curY);
    curY += 5;

    // --- METADATA SECTION ---
    const colW = (pageWidth - margin * 2) / 4;
    const metaBoxY = curY;
    const metaBoxH = 13;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, metaBoxY, pageWidth - margin * 2, metaBoxH, 2, 2, 'F');

    const drawMetaItem = (idx: number, label: string, val: string, sub?: string) => {
        const itemX = margin + colW * idx + 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), itemX, metaBoxY + 4);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(val, itemX, metaBoxY + 8);

        if (sub) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text(sub, itemX, metaBoxY + 11.5);
        }
    };

    drawMetaItem(0, 'Período', periodStart, `al ${periodEnd}`);
    drawMetaItem(1, 'Colaboradores', `${items.length} Empleados`, 'Total registrados');
    drawMetaItem(2, 'Emisión', printDate.split(' ')[0], printDate.split(' ').slice(1).join(' '));
    drawMetaItem(3, 'Estado de Nómina', isPaid ? 'Pagada' : 'Pendiente', isPaid ? 'Desembolso confirmado' : 'En revisión');

    curY += metaBoxH + 6;

    // --- AUTOTABLE CONSOLIDATED ---
    const showBonuses = items.some(i => (Number(i.bonuses) || 0) > 0);
    const showInfotep = items.some(i => (Number(i.infotep) || 0) > 0);
    const showDeductions = items.some(i => (Number(i.deductions) || 0) > 0);

    const headers: string[] = ['Empleado', 'Salario Base'];
    if (showBonuses) headers.push('Bonos');
    headers.push('TSS');
    if (showInfotep) headers.push('Infotep');
    if (showDeductions) headers.push('Deducciones');
    headers.push('Neto a Pagar');

    const totalBase = items.reduce((s, i) => s + (Number(i.base_salary) || 0), 0);
    const totalBonuses = items.reduce((s, i) => s + (Number(i.bonuses) || 0), 0);
    const totalTSS = items.reduce((s, i) => s + (Number(i.tss) || 0), 0);
    const totalInfotep = items.reduce((s, i) => s + (Number(i.infotep) || 0), 0);
    const totalDeductions = items.reduce((s, i) => s + (Number(i.deductions) || 0), 0);
    const totalNet = items.reduce((s, i) => s + (Number(i.net_salary) || 0), 0);

    const tableRows = items.map(item => {
        const row: string[] = [item.employee_name, `RD$ ${fmt(Number(item.base_salary) || 0)}`];
        if (showBonuses) row.push(`RD$ ${fmt(Number(item.bonuses) || 0)}`);
        row.push(`RD$ ${fmt(Number(item.tss) || 0)}`);
        if (showInfotep) row.push(`RD$ ${fmt(Number(item.infotep) || 0)}`);
        if (showDeductions) row.push(`RD$ ${fmt(Number(item.deductions) || 0)}`);
        row.push(`RD$ ${fmt(Number(item.net_salary) || 0)}`);
        return row;
    });

    const footRow: string[] = ['TOTALES CONSOLIDADOS', `RD$ ${fmt(totalBase)}`];
    if (showBonuses) footRow.push(`RD$ ${fmt(totalBonuses)}`);
    footRow.push(`RD$ ${fmt(totalTSS)}`);
    if (showInfotep) footRow.push(`RD$ ${fmt(totalInfotep)}`);
    if (showDeductions) footRow.push(`RD$ ${fmt(totalDeductions)}`);
    footRow.push(`RD$ ${fmt(totalNet)}`);

    autoTable(doc, {
        head: [headers],
        body: tableRows,
        foot: [footRow],
        startY: curY,
        margin: { left: margin, right: margin },
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2.2,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.2
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'left'
        },
        footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            halign: 'right'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || curY + 60;
    curY = finalY + 7;

    // --- TOTAL NET HIGHLIGHT BANNER ---
    const bannerH = 14;
    doc.setFillColor(15, 23, 42); // Dark slate
    doc.roundedRect(margin, curY, pageWidth - margin * 2, bannerH, 2.5, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(56, 189, 248); // Cyan 400
    doc.text('TOTAL GENERAL A DESEMBOLSAR (NETO DE NÓMINA)', margin + 6, curY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Monto final aprobado para los ${items.length} colaboradores de este período`, margin + 6, curY + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(52, 211, 153); // Emerald 400
    doc.text(`RD$ ${fmt(totalNet)}`, rightX - 6, curY + 9, { align: 'right' });

    curY += bannerH + 12;

    // --- SIGNATURES ---
    const signY = Math.min(curY, pageHeight - 25);
    const signWidth = 65;

    // Left Signature
    const sign1X = margin + 10;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign1X, signY, sign1X + signWidth, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Firma de la Administración', sign1X + signWidth / 2, signY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(storeName, sign1X + signWidth / 2, signY + 7.5, { align: 'center' });

    // Right Signature
    const sign2X = rightX - signWidth - 10;
    doc.line(sign2X, signY, sign2X + signWidth, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Firma de Recursos Humanos / Contabilidad', sign2X + signWidth / 2, signY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${printDate.split(' ')[0]}`, sign2X + signWidth / 2, signY + 7.5, { align: 'center' });

    // --- FOOTER ---
    const footerY = pageHeight - 7;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2.5, rightX, footerY - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
        'Documento emitido oficialmente por Cobro App • Sistema de Gestión y Nóminas',
        pageWidth / 2,
        footerY,
        { align: 'center' }
    );
};

/**
 * Renderiza la página del Comprobante Individual de Pago de un Empleado en jsPDF
 */
export const renderEmployeeVoucherPage = async (
    doc: any,
    payroll: any,
    item: any,
    employee: any,
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings,
    index: number = 0,
    totalCount: number = 1
) => {
    const { default: autoTable } = await import('jspdf-autotable');

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const rightX = pageWidth - margin;

    const periodStart = payroll?.period_start
        ? format(new Date(payroll.period_start), "dd 'de' MMMM, yyyy", { locale: es })
        : 'N/A';
    const periodEnd = payroll?.period_end
        ? format(new Date(payroll.period_end), "dd 'de' MMMM, yyyy", { locale: es })
        : 'N/A';
    const printDate = format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es });

    const role = getRoleLabel(employee?.role);
    const cedula = employee?.cedula || 'N/A';

    const baseSalary = Number(item.base_salary) || 0;
    const bonuses = Number(item.bonuses) || 0;
    const grossSalary = baseSalary + bonuses;
    const tss = Number(item.tss) || 0;
    const infotep = Number(item.infotep) || 0;
    const netSalary = Number(item.net_salary) || 0;

    const isAfpEnabled = settings?.enable_afp !== false;
    const isSfsEnabled = settings?.enable_sfs !== false;
    const afpRate = Number(settings?.afp_rate) > 0 ? Number(settings.afp_rate) : 2.87;
    const sfsRate = Number(settings?.sfs_rate) > 0 ? Number(settings.sfs_rate) : 3.04;
    const infotepRate = Number(settings?.infotep_rate) > 0 ? Number(settings.infotep_rate) : 1.0;

    // Detailed TSS breakdown if calculated
    let afpAmount = 0;
    let sfsAmount = 0;
    let hasDetailedTss = false;
    if (tss > 0 && isAfpEnabled && isSfsEnabled) {
        const calculatedAfp = Math.round((baseSalary * (afpRate / 100)) * 100) / 100;
        const calculatedSfs = Math.round((baseSalary * (sfsRate / 100)) * 100) / 100;
        if (Math.abs((calculatedAfp + calculatedSfs) - tss) <= 0.05) {
            afpAmount = calculatedAfp;
            sfsAmount = calculatedSfs;
            hasDetailedTss = true;
        }
    }

    // Deduction details
    let details: Array<{ reason: string; amount: number }> = [];
    if (Array.isArray(item.deductions_details) && item.deductions_details.length > 0) {
        details = item.deductions_details;
    } else if (item.note && typeof item.note === 'string' && item.note.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(item.note);
            if (Array.isArray(parsed)) details = parsed;
        } catch (_e) { }
    }

    const totalDeductions = tss + infotep + (Number(item.deductions) || 0);

    let curY = margin;

    // --- LOGO ---
    let logoData = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;
    let textStartX = margin;

    if (logoData) {
        try {
            const maxW = 32;
            const maxH = 18;
            const aspect = logoData.width / logoData.height;
            let w = maxW;
            let h = maxW / aspect;
            if (h > maxH) {
                h = maxH;
                w = maxH * aspect;
            }
            doc.addImage(logoData.dataUrl, logoData.format, margin, curY, w, h, undefined, 'FAST');
            textStartX = margin + w + 5;
        } catch (_e) { }
    }

    // --- COMPANY INFO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(storeName || 'Mi Negocio', textStartX, curY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    let lineY = curY + 8.5;
    if (companyInfo?.rnc) {
        doc.text(`RNC: ${companyInfo.rnc}`, textStartX, lineY);
        lineY += 3.8;
    }
    if (companyInfo?.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, textStartX, lineY);
        lineY += 3.8;
    }
    if (companyInfo?.address) {
        const addrLines = doc.splitTextToSize(String(companyInfo.address), 60);
        doc.text(addrLines, textStartX, lineY);
        lineY += addrLines.length * 3.5;
    }

    // --- RIGHT SIDE HEADER: COMPROBANTE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPROBANTE DE PAGO', rightX, curY + 4, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Volante Individual de Salario', rightX, curY + 8.5, { align: 'right' });

    const refCode = `REF: NOM-${(payroll?.id || '').toString().slice(0, 8).toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(refCode, rightX, curY + 13, { align: 'right' });

    curY = Math.max(lineY + 4, curY + 16);

    // Separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, curY, rightX, curY);
    curY += 5;

    // --- EMPLOYEE HIGHLIGHT CARD ---
    const empCardH = 19;
    doc.setFillColor(248, 250, 252); // Light background
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, curY, pageWidth - margin * 2, empCardH, 2, 2, 'FD');

    // Left block: Employee name & role
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('COLABORADOR / EMPLEADO', margin + 4, curY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(item.employee_name || 'Empleado', margin + 4, curY + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Cargo: `, margin + 4, curY + 14.5);
    doc.setFont('helvetica', 'bold');
    doc.text(role, margin + 14, curY + 14.5);

    // Middle block: Cedula & ID
    const midX = margin + (pageWidth - margin * 2) * 0.45;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('DOCUMENTO DE IDENTIDAD', midX, curY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(cedula, midX, curY + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`ID: ${(item.profile_id || '').slice(0, 8) || 'N/A'}`, midX, curY + 14.5);

    // Right block: Period
    const rightBlockX = margin + (pageWidth - margin * 2) * 0.72;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PERÍODO DE PAGO', rightBlockX, curY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(periodStart, rightBlockX, curY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`al ${periodEnd}`, rightBlockX, curY + 13.5);

    curY += empCardH + 6;

    // --- TABLES: INGRESOS & DEDUCCIONES (SIDE BY SIDE) ---
    const tableGap = 4;
    const tableWidth = (pageWidth - margin * 2 - tableGap) / 2;

    // 1. Ingresos Table
    const ingresosRows: string[][] = [
        ['Salario Base Ordinario', `RD$ ${fmt(baseSalary)}`]
    ];
    if (bonuses > 0) {
        ingresosRows.push(['Bonos e Incentivos', `+RD$ ${fmt(bonuses)}`]);
    }

    autoTable(doc, {
        head: [['(+) Concepto de Ingreso', 'Monto']],
        body: ingresosRows,
        foot: [['TOTAL INGRESOS BRUTOS', `RD$ ${fmt(grossSalary)}`]],
        startY: curY,
        margin: { left: margin, right: rightX - tableWidth },
        tableWidth: tableWidth,
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2.2,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.2
        },
        headStyles: {
            fillColor: [5, 150, 105], // Emerald 600
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        footStyles: {
            fillColor: [236, 253, 245],
            textColor: [5, 150, 105],
            fontStyle: 'bold',
            halign: 'right'
        },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'right', fontStyle: 'bold' }
        }
    });

    const ingresosFinalY = (doc as any).lastAutoTable?.finalY || curY + 30;

    // 2. Deducciones Table
    const deduccionesRows: string[][] = [];
    if (hasDetailedTss) {
        deduccionesRows.push([`AFP - Pensiones (${afpRate}%)`, `-RD$ ${fmt(afpAmount)}`]);
        deduccionesRows.push([`SFS - Salud (${sfsRate}%)`, `-RD$ ${fmt(sfsAmount)}`]);
    } else if (tss > 0) {
        deduccionesRows.push(['TSS (Seguridad Social)', `-RD$ ${fmt(tss)}`]);
    }

    if (infotep > 0) {
        deduccionesRows.push([`INFOTEP (${infotepRate}%)`, `-RD$ ${fmt(infotep)}`]);
    }

    if (details.length > 0) {
        details.forEach(d => {
            deduccionesRows.push([d.reason || 'Deducción interna', `-RD$ ${fmt(Number(d.amount) || 0)}`]);
        });
    } else if (item.deductions > 0) {
        deduccionesRows.push(['Otras Deducciones', `-RD$ ${fmt(Number(item.deductions) || 0)}`]);
    }

    if (deduccionesRows.length === 0) {
        deduccionesRows.push(['Sin retenciones en este período', 'RD$ 0.00']);
    }

    autoTable(doc, {
        head: [['(-) Concepto de Deducción', 'Monto']],
        body: deduccionesRows,
        foot: [['TOTAL DEDUCCIONES', `-RD$ ${fmt(totalDeductions)}`]],
        startY: curY,
        margin: { left: margin + tableWidth + tableGap, right: margin },
        tableWidth: tableWidth,
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2.2,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.2
        },
        headStyles: {
            fillColor: [225, 29, 72], // Rose 600
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        footStyles: {
            fillColor: [255, 241, 242],
            textColor: [225, 29, 72],
            fontStyle: 'bold',
            halign: 'right'
        },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'right', fontStyle: 'bold' }
        }
    });

    const deduccionesFinalY = (doc as any).lastAutoTable?.finalY || curY + 30;
    curY = Math.max(ingresosFinalY, deduccionesFinalY) + 6;

    // --- NET BANNER ---
    const netBannerH = 15;
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(margin, curY, pageWidth - margin * 2, netBannerH, 2.5, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(56, 189, 248); // Cyan 400
    doc.text('TOTAL NETO A COBRAR', margin + 6, curY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Ingresos Brutos ($${fmt(grossSalary)}) menos Deducciones ($${fmt(totalDeductions)})`, margin + 6, curY + 10.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(52, 211, 153); // Emerald 400
    doc.text(`RD$ ${fmt(netSalary)}`, rightX - 6, curY + 9.5, { align: 'right' });

    curY += netBannerH + 6;

    // --- LEGAL DISCLAIMER BOX ---
    const discH = 12;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.roundedRect(margin, curY, pageWidth - margin * 2, discH, 1.5, 1.5, 'FD');
    doc.setLineDashPattern([], 0); // Reset dash

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Constancia de Pago:', margin + 3, curY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const discText = `Hago constar que he recibido a mi entera satisfacción de parte de ${storeName} el monto neto indicado en este volante de nómina por concepto de salarios y beneficios del período estipulado, no teniendo reclamo laboral pendiente por dicho período.`;
    const discLines = doc.splitTextToSize(discText, pageWidth - margin * 2 - 6);
    doc.text(discLines, margin + 3, curY + 7.5);

    curY += discH + 12;

    // --- SIGNATURES ---
    const signY = Math.min(curY, pageHeight - 24);
    const signWidth = 65;

    // Employee Signature
    const sign1X = margin + 12;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign1X, signY, sign1X + signWidth, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.employee_name, sign1X + signWidth / 2, signY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Firma del Colaborador (Recibí Conforme)', sign1X + signWidth / 2, signY + 7, { align: 'center' });
    doc.text(`Cédula: ${cedula}`, sign1X + signWidth / 2, signY + 10, { align: 'center' });

    // Company Signature
    const sign2X = rightX - signWidth - 12;
    doc.line(sign2X, signY, sign2X + signWidth, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(storeName, sign2X + signWidth / 2, signY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Firma Autorizada / RRHH', sign2X + signWidth / 2, signY + 7, { align: 'center' });
    doc.text(`Fecha: ${printDate.split(' ')[0]}`, sign2X + signWidth / 2, signY + 10, { align: 'center' });

    // --- FOOTER ---
    const footerY = pageHeight - 7;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2.5, rightX, footerY - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento emitido oficialmente por Cobro App • Sistema de Nóminas', margin, footerY);
    doc.text(`Comprobante ${index + 1} de ${totalCount}`, rightX, footerY, { align: 'right' });
};

/**
 * 1. Descarga directa en PDF del Resumen General de Nómina
 */
export const downloadPayrollSummaryPDF = async (
    payroll: any,
    items: any[],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo
) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'letter'
    });

    await renderPayrollSummaryPage(doc, payroll, items, storeName, logoUrl, companyInfo);

    const periodStr = payroll?.period_start ? format(new Date(payroll.period_start), 'yyyy-MM-dd') : 'periodo';
    const safeStore = (storeName || 'Empresa').trim().replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Resumen_Nomina_${safeStore}_${periodStr}.pdf`);
};

/**
 * 2. Descarga directa en PDF del comprobante individual con el NOMBRE DEL EMPLEADO
 */
export const downloadEmployeeVoucherPDF = async (
    payroll: any,
    item: any,
    employee: any,
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings
) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'letter'
    });

    await renderEmployeeVoucherPage(doc, payroll, item, employee, storeName, logoUrl, companyInfo, settings, 0, 1);

    const safeEmp = (item.employee_name || 'Empleado').trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
    const periodStr = payroll?.period_start ? format(new Date(payroll.period_start), 'yyyy-MM-dd') : 'periodo';
    doc.save(`Nomina_${safeEmp}_${periodStr}.pdf`);
};

/**
 * 3. Descarga un archivo PDF con la Nómina COMPLETA:
 *    - Página 1: Resumen General Consolidado
 *    - Páginas 2..N: Comprobante de pago individual de cada empleado separado por su nombre
 */
export const downloadCompletePayrollPDF = async (
    payroll: any,
    items: any[],
    employees: any[] = [],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings
) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'letter'
    });

    // Página 1: Resumen General
    await renderPayrollSummaryPage(doc, payroll, items, storeName, logoUrl, companyInfo);

    // Páginas siguientes: Un comprobante por cada empleado
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const emp = employees.find(e => e.id === item.profile_id);
        doc.addPage();
        await renderEmployeeVoucherPage(
            doc,
            payroll,
            item,
            emp,
            storeName,
            logoUrl,
            companyInfo,
            settings,
            i,
            items.length
        );
    }

    const periodStr = payroll?.period_start ? format(new Date(payroll.period_start), 'yyyy-MM-dd') : 'periodo';
    const safeStore = (storeName || 'Empresa').trim().replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Nomina_Completa_${safeStore}_${periodStr}.pdf`);
};

/**
 * 4. Descarga todos los comprobantes individuales en PDF por separado, cada uno con el nombre del empleado
 */
export const downloadAllEmployeesIndividualPDFs = async (
    payroll: any,
    items: any[],
    employees: any[] = [],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings,
    onProgress?: (current: number, total: number, empName: string) => void
) => {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const emp = employees.find(e => e.id === item.profile_id);
        if (onProgress) {
            onProgress(i + 1, items.length, item.employee_name);
        }
        await downloadEmployeeVoucherPDF(payroll, item, emp, storeName, logoUrl, companyInfo, settings);
        if (i < items.length - 1) {
            await new Promise(r => setTimeout(r, 250)); // Pausa breve para descarga fluida en navegador
        }
    }
};
