import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export interface StatementInvoice {
  invoice_number?: string;
  created_at: string | Date;
  due_date?: string | Date | null;
  total: number;
  amount_paid?: number;
  balance?: number;
}

export interface StatementCustomer {
  id?: string;
  name: string;
  rnc?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  credit_limit?: number | null;
}

export interface StatementCompanyInfo {
  name?: string;
  logo?: string | null;
  rnc?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  website?: string | null;
  slogan?: string | null;
}

export interface StatementBankAccount {
  bank_name: string;
  account_number: string;
  account_type?: string;
  holder_name?: string;
  rnc_cedula?: string;
}

export interface StatementGeneratorParams {
  customer: StatementCustomer;
  invoices: StatementInvoice[];
  totalDebt?: number;
  companyInfo?: StatementCompanyInfo;
  bankAccounts?: StatementBankAccount[];
  returnBlob?: boolean;
}

/**
 * Carga de forma segura cualquier imagen y la convierte a DataURL (base64)
 * con soporte para URLs remotas, blobs, rutas locales y fallbacks de CORS.
 */
export async function loadImageAsDataUrl(
  url: string,
  timeoutMs: number = 3500
): Promise<{ dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof window === 'undefined') return null;

  // 1. Si ya es Data URL
  if (url.startsWith('data:image/')) {
    const isJpeg = url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg');
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl: url,
          width: img.naturalWidth || img.width || 100,
          height: img.naturalHeight || img.height || 100,
          format: isJpeg ? 'JPEG' : 'PNG',
        });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // 2. Intentar fetch como Blob (ideal para Supabase Storage y assets de Vite)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const blob = await res.blob();
      const isJpeg = blob.type.includes('jpeg') || blob.type.includes('jpg');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = dataUrl;
      });

      return {
        dataUrl,
        width: img.naturalWidth || img.width || 100,
        height: img.naturalHeight || img.height || 100,
        format: isJpeg ? 'JPEG' : 'PNG',
      };
    }
  } catch (_e) {
    // Si falla el fetch por CORS o red, recurrir a Image element + Canvas
  }

  // 3. Fallback con elemento Image y Canvas
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 100;
        canvas.height = img.naturalHeight || img.height || 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            format: 'PNG',
          });
          return;
        }
      } catch (_canvasErr) {
        // En caso de canvas tainted, devolvemos el src directo
      }
      resolve({
        dataUrl: img.src,
        width: img.naturalWidth || img.width || 100,
        height: img.naturalHeight || img.height || 100,
        format: 'PNG',
      });
    };

    img.onerror = () => {
      clearTimeout(timer);
      // Reintentar sin crossOrigin si fue bloqueado
      const imgFallback = new Image();
      const fallbackTimer = setTimeout(() => resolve(null), 1500);
      imgFallback.onload = () => {
        clearTimeout(fallbackTimer);
        resolve({
          dataUrl: imgFallback.src,
          width: imgFallback.naturalWidth || imgFallback.width || 100,
          height: imgFallback.naturalHeight || imgFallback.height || 100,
          format: 'PNG',
        });
      };
      imgFallback.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(null);
      };
      imgFallback.src = url;
    };

    img.src = url;
  });
}

/**
 * Genera un Estado de Cuenta PDF con diseño minimalista, moderno y elegante.
 */
export const generateStatementPDF = async ({
  customer,
  invoices = [],
  totalDebt: providedTotalDebt,
  companyInfo,
  bankAccounts = [],
  returnBlob = false,
}: StatementGeneratorParams): Promise<Blob | void> => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width; // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // ── 1. Cálculos de Totales ──
  const calculatedTotal = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const calculatedPaid = invoices.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0);
  const calculatedDebt = invoices.reduce((sum, inv) => {
    const bal = inv.balance !== undefined ? Number(inv.balance) : (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0);
    return sum + (bal > 0 ? bal : 0);
  }, 0);

  const totalDebt = providedTotalDebt !== undefined && providedTotalDebt !== null
    ? Number(providedTotalDebt)
    : calculatedDebt;

  // ── 2. Carga de Logotipos ──
  // A) Logo de la Empresa (con soporte de fallbacks)
  let resolvedCompanyLogo = companyInfo?.logo?.trim() || null;
  if (!resolvedCompanyLogo) {
    if (companyInfo?.name?.toLowerCase().includes('mamajuana')) {
      resolvedCompanyLogo = '/mamajuana-logo.png';
    } else {
      resolvedCompanyLogo = '/mamajuana-logo.png'; // Fallback estándar del comercio si aplica
    }
  }

  let companyLogoData = resolvedCompanyLogo ? await loadImageAsDataUrl(resolvedCompanyLogo) : null;
  if (!companyLogoData && resolvedCompanyLogo !== '/mamajuana-logo.png' && companyInfo?.name?.toLowerCase().includes('mamajuana')) {
    companyLogoData = await loadImageAsDataUrl('/mamajuana-logo.png');
  }

  // B) Logo oficial de Cobro App
  const cobroLogoData = await loadImageAsDataUrl('/cobro-logo.png');

  // ── 3. Encabezado Minimalista y Moderno (Clean Light Theme) ──
  let topY = 14;

  // A) Logotipo de la empresa (Izquierda)
  let companyTextStartX = marginX;
  if (companyLogoData) {
    try {
      const maxLogoW = 38;
      const maxLogoH = 22;
      const aspect = companyLogoData.width / companyLogoData.height;
      let logoW = maxLogoW;
      let logoH = maxLogoW / aspect;

      if (logoH > maxLogoH) {
        logoH = maxLogoH;
        logoW = maxLogoH * aspect;
      }

      doc.addImage(companyLogoData.dataUrl, companyLogoData.format, marginX, topY, logoW, logoH, undefined, 'FAST');
      companyTextStartX = marginX + logoW + 5;
    } catch (e) {
      console.warn('Error insertando logo de la empresa:', e);
    }
  }

  // B) Información de la Empresa (Nombre y datos de contacto)
  const companyName = companyInfo?.name || 'Mi Empresa';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(companyName, companyTextStartX, topY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500

  let cLineY = topY + 10;
  if (companyInfo?.rnc) {
    doc.text(`RNC: ${companyInfo.rnc}`, companyTextStartX, cLineY);
    cLineY += 4;
  }
  if (companyInfo?.phone) {
    doc.text(`Tel: ${companyInfo.phone}`, companyTextStartX, cLineY);
    cLineY += 4;
  }
  if (companyInfo?.address) {
    const addressLines = doc.splitTextToSize(String(companyInfo.address), 65);
    doc.text(addressLines, companyTextStartX, cLineY);
    cLineY += addressLines.length * 3.8;
  }

  // C) Bloque Derecho: Título "ESTADO DE CUENTA" & Badge
  const rightX = pageWidth - marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('ESTADO DE CUENTA', rightX, topY + 5, { align: 'right' });

  // Badge de Estado (BALANCE PENDIENTE / CUENTA AL DÍA)
  const isDebtPositive = totalDebt > 0;
  const badgeText = isDebtPositive ? 'BALANCE PENDIENTE' : 'CUENTA AL DÍA';
  const badgeWidth = doc.getTextWidth(badgeText) + 8;
  const badgeX = rightX - badgeWidth;
  const badgeY = topY + 8;

  if (isDebtPositive) {
    doc.setFillColor(254, 242, 242); // Rose 50
    doc.setDrawColor(254, 202, 202); // Rose 200
    doc.roundedRect(badgeX, badgeY, badgeWidth, 6, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72); // Rose 600
    doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 4.2, { align: 'center' });
  } else {
    doc.setFillColor(240, 253, 244); // Emerald 50
    doc.setDrawColor(187, 247, 208); // Emerald 200
    doc.roundedRect(badgeX, badgeY, badgeWidth, 6, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 163, 74); // Emerald 600
    doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 4.2, { align: 'center' });
  }

  // Metadatos de emisión
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const nowFormatted = format(new Date(), "dd/MM/yyyy 'a las' hh:mm a", { locale: es });
  doc.text(`Fecha de emisión: ${nowFormatted}`, rightX, topY + 19, { align: 'right' });
  doc.text(`Moneda: DOP ($RD)`, rightX, topY + 23, { align: 'right' });

  // Línea divisoria elegante
  const headerBottomY = Math.max(cLineY + 2, topY + 26);
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.4);
  doc.line(marginX, headerBottomY, rightX, headerBottomY);

  // ── 4. Tarjeta Ficha del Cliente (Modern Slate-50 Card) ──
  let curY = headerBottomY + 5;
  const cardHeight = 22;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(marginX, curY, contentWidth, cardHeight, 2, 2, 'FD');

  // Encabezado interno de la ficha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('DATOS DEL CLIENTE', marginX + 5, curY + 5.5);

  // Nombre del Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(customer?.name || 'Cliente sin nombre', marginX + 5, curY + 11.5);

  // Datos secundarios (Teléfono, Cédula/RNC, Dirección)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate 600

  let clientDetails = [];
  if (customer?.rnc) clientDetails.push(`RNC/Céd: ${customer.rnc}`);
  if (customer?.phone) clientDetails.push(`Tel: ${customer.phone}`);
  if (customer?.address) clientDetails.push(`Dir: ${customer.address}`);
  const clientLine = clientDetails.length > 0 ? clientDetails.join('  •  ') : 'Sin datos adicionales registrados';
  doc.text(clientLine, marginX + 5, curY + 17);

  // Límite de crédito a la derecha
  if (customer?.credit_limit && customer.credit_limit > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Límite de crédito asignado:', rightX - 5, curY + 8, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`$${Number(customer.credit_limit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 5, curY + 14, { align: 'right' });
  }

  curY += cardHeight + 5;

  // ── 5. Tarjetas Resumen KPI (Mini-Dashboard 3 Bloques) ──
  const kpiGap = 4;
  const kpiWidth = (contentWidth - kpiGap * 2) / 3;
  const kpiHeight = 17;

  // KPI 1: Total Facturado
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, curY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL FACTURADO', marginX + 4, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`$${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, marginX + 4, curY + 12.5);

  // KPI 2: Total Abonado
  const kpi2X = marginX + kpiWidth + kpiGap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(kpi2X, curY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ABONADO', kpi2X + 4, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(22, 163, 74); // Emerald 600
  doc.text(`$${calculatedPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, kpi2X + 4, curY + 12.5);

  // KPI 3: Deuda Total Pendiente (Tarjeta Pizarra Minimalista Destacada)
  const kpi3X = kpi2X + kpiWidth + kpiGap;
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(kpi3X, curY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('BALANCE PENDIENTE', kpi3X + 4, curY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`$${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, kpi3X + 4, curY + 12.5);

  curY += kpiHeight + 6;

  // ── 6. Tabla de Facturas Pendientes (AutoTable) ──
  const today = startOfDay(new Date());

  const tableBody = (invoices || []).map((sale) => {
    const saleDate = sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yyyy') : '-';
    let dueDateStr = '-';
    let isOverdue = false;

    if (sale.due_date) {
      const dDate = new Date(sale.due_date);
      dueDateStr = format(dDate, 'dd/MM/yyyy');
      if (isBefore(startOfDay(dDate), today) && (sale.balance === undefined || sale.balance > 0)) {
        isOverdue = true;
      }
    }

    const saleTotal = Number(sale.total) || 0;
    const salePaid = Number(sale.amount_paid) || 0;
    const saleBalance = sale.balance !== undefined ? Number(sale.balance) : saleTotal - salePaid;

    return [
      sale.invoice_number || 'S/N',
      saleDate,
      dueDateStr,
      `$${saleTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      salePaid > 0 ? `$${salePaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
      `$${saleBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      isOverdue ? 'VENCIDA' : 'AL DÍA',
    ];
  });

  autoTable(doc, {
    head: [['FACTURA', 'EMISIÓN', 'VENCE', 'TOTAL', 'ABONADO', 'PENDIENTE', 'ESTADO']],
    body: tableBody.length > 0 ? tableBody : [['-', '-', '-', '$0.00', '-', '$0.00', 'AL DÍA']],
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85], // Slate 700
      cellPadding: 2.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 32 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
      6: { halign: 'center', cellWidth: 24 },
    },
    didParseCell: (data) => {
      // Estilizar la celda de estado
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'VENCIDA') {
          data.cell.styles.textColor = [225, 29, 72]; // Rose 600
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [22, 163, 74]; // Emerald 600
        }
      }
    },
  });

  let afterTableY = (doc as any).lastAutoTable?.finalY + 6;

  // Si queda poco espacio para el total y notas, añadir página
  if (afterTableY + 45 > pageHeight) {
    doc.addPage();
    afterTableY = 20;
  }

  // ── 7. Resumen de Cierre & Cuentas Bancarias ──
  const summaryBoxWidth = 80;
  const summaryBoxX = rightX - summaryBoxWidth;

  // Cuadro de Total Final
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, afterTableY, summaryBoxWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Facturado:', summaryBoxX + 5, afterTableY + 5.5);
  doc.text(`$${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 5, afterTableY + 5.5, { align: 'right' });

  doc.text('Total Abonado:', summaryBoxX + 5, afterTableY + 10.5);
  doc.text(`-$${calculatedPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 5, afterTableY + 10.5, { align: 'right' });

  // Línea interna
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX + 5, afterTableY + 13, rightX - 5, afterTableY + 13);

  // Deuda neta en bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('DEUDA TOTAL:', summaryBoxX + 5, afterTableY + 18.5);
  doc.setTextColor(225, 29, 72); // Rose 600
  doc.text(`$${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 5, afterTableY + 18.5, { align: 'right' });

  // Información Bancaria y Notas a la izquierda
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('MÉTODOS DE PAGO / TRANSFERENCIAS:', marginX, afterTableY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  let bY = afterTableY + 9;
  if (bankAccounts && bankAccounts.length > 0) {
    bankAccounts.slice(0, 2).forEach((acc) => {
      const typeLabel = acc.account_type ? ` (${acc.account_type})` : '';
      const holderLabel = acc.holder_name ? ` • Titular: ${acc.holder_name}` : '';
      doc.text(`• ${acc.bank_name}${typeLabel}: ${acc.account_number}${holderLabel}`, marginX, bY);
      bY += 3.8;
    });
  } else {
    doc.text('• Puede realizar sus pagos directamente en caja o mediante transferencia bancaria.', marginX, bY);
    bY += 3.8;
  }

  doc.setFont('helvetica', 'italic');
  doc.text('Favor saldar este balance a la brevedad posible. Gracias por su preferencia.', marginX, bY + 2);

  // ── 8. Pie de Página Elegante con Cobro App y www.cobroapp.app en todas las páginas ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 10;

    // Línea de separación sutil
    doc.setDrawColor(241, 245, 249); // Slate 100
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 5, rightX, footerY - 5);

    // Izquierda: Nombre de la empresa emisora
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`${companyName} • Estado de Cuenta`, marginX, footerY);

    // Centro: Marca Oficial Cobro App + Logo + www.cobroapp.app
    const brandCenterY = footerY - 0.5;
    const logoSize = 4.5; // mm
    const cobroBrandText = 'Generado con Cobro App • ';
    const cobroUrlText = 'www.cobroapp.app';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const wBrand = doc.getTextWidth(cobroBrandText);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // Verde Cobro
    const wUrl = doc.getTextWidth(cobroUrlText);

    const totalCenterWidth = (cobroLogoData ? logoSize + 1.5 : 0) + wBrand + wUrl;
    let startCenter = (pageWidth - totalCenterWidth) / 2;

    if (cobroLogoData) {
      try {
        doc.addImage(cobroLogoData.dataUrl, 'PNG', startCenter, brandCenterY - 3.2, logoSize, logoSize, undefined, 'FAST');
        startCenter += logoSize + 1.5;
      } catch (_e) { }
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(cobroBrandText, startCenter, footerY);
    startCenter += wBrand;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text(cobroUrlText, startCenter, footerY);

    // Derecha: Número de página
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages}`, rightX, footerY, { align: 'right' });
  }

  // ── 9. Retorno de Blob o Guardado en Disco ──
  if (returnBlob) {
    return doc.output('blob');
  }

  const safeCustomerName = (customer?.name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const dateSuffix = format(new Date(), 'yyyyMMdd');
  doc.save(`Estado_Cuenta_${safeCustomerName}_${dateSuffix}.pdf`);
};
