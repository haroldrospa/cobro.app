import { CompanyInfoForPrint, PaperSize } from '@/hooks/usePrintSettings';
import { CloseDayData } from '@/utils/closeDayPdfGenerator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateCloseDayHTML = (
    companyInfo: CompanyInfoForPrint,
    data: CloseDayData,
    paperSize: PaperSize = '80mm'
): string => {
    const isThermal = paperSize === '80mm' || paperSize === '58mm';
    const paperWidth = paperSize === '58mm' ? '58mm' : paperSize === '80mm' ? '80mm' : '100%';
    const containerMaxWidth = paperSize === '58mm' ? '280px' : paperSize === '80mm' ? '360px' : '780px';

    const fmt = (val: number) => (val || 0).toLocaleString('es-DO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const openedDateStr = data.openedAt ? format(new Date(data.openedAt), "dd/MM/yyyy hh:mm a", { locale: es }) : 'N/A';
    const closedDateStr = data.closedAt ? format(new Date(data.closedAt), "dd/MM/yyyy hh:mm a", { locale: es }) : format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es });
    const diff = data.difference || 0;
    const diffStatus = diff === 0 ? 'CUADRADO (OK)' : diff > 0 ? `SOBRANTE (+RD$ ${fmt(diff)})` : `FALTANTE (-RD$ ${fmt(Math.abs(diff))})`;
    const diffColor = diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444';

    if (isThermal) {
        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cierre de Caja - ${companyInfo.name || 'Cobro App'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
                        font-size: 11px;
                        line-height: 1.35;
                        color: #000000;
                        background: #ffffff;
                        padding: 8px 4px;
                    }
                    .receipt-container {
                        max-width: ${containerMaxWidth};
                        margin: 0 auto;
                        width: 100%;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: 700; }
                    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
                    .divider {
                        border-top: 1px dashed #000000;
                        margin: 6px 0;
                    }
                    .double-divider {
                        border-top: 2px solid #000000;
                        margin: 6px 0;
                    }
                    .logo-box {
                        text-align: center;
                        margin-bottom: 6px;
                    }
                    .logo-box img {
                        max-width: 60px;
                        max-height: 60px;
                        object-fit: contain;
                    }
                    .store-name {
                        font-size: 14px;
                        font-weight: 800;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }
                    .store-meta {
                        font-size: 10px;
                        color: #333333;
                    }
                    .report-title {
                        font-size: 12px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin: 4px 0 2px;
                    }
                    .row {
                        display: flex;
                        justify-content: space-between;
                        padding: 1.5px 0;
                        font-size: 11px;
                    }
                    .row-sub {
                        font-size: 10px;
                        color: #444444;
                        padding-left: 6px;
                    }
                    .highlight-box {
                        border: 1.5px solid #000000;
                        padding: 6px 8px;
                        margin: 6px 0;
                        border-radius: 4px;
                    }
                    .diff-text {
                        font-weight: 800;
                        font-size: 11px;
                    }
                    .signatures {
                        margin-top: 24px;
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                    }
                    .sign-line {
                        border-top: 1px solid #000000;
                        margin-top: 18px;
                        padding-top: 3px;
                        text-align: center;
                        font-size: 9px;
                        text-transform: uppercase;
                    }
                    .footer-brand {
                        text-align: center;
                        font-size: 9px;
                        color: #666666;
                        margin-top: 14px;
                    }
                    @media print {
                        @page { margin: 0; size: ${paperWidth} auto; }
                        body { padding: 4px 2px; width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    ${companyInfo.logo ? `
                        <div class="logo-box">
                            <img src="${companyInfo.logo}" alt="Logo">
                        </div>
                    ` : ''}
                    <div class="text-center">
                        <div class="store-name">${companyInfo.name || 'Mi Negocio'}</div>
                        ${companyInfo.rnc ? `<div class="store-meta">RNC: ${companyInfo.rnc}</div>` : ''}
                        ${companyInfo.phone ? `<div class="store-meta">Tel: ${companyInfo.phone}</div>` : ''}
                        ${companyInfo.address ? `<div class="store-meta">${companyInfo.address}</div>` : ''}
                        <div class="double-divider"></div>
                        <div class="report-title">CIERRE DE CAJA / TURNO</div>
                        <div class="store-meta">${closedDateStr}</div>
                    </div>

                    <div class="divider"></div>

                    <!-- DATOS DE SESIÓN -->
                    <div class="row"><span class="store-meta">Apertura:</span><span class="font-mono">${openedDateStr}</span></div>
                    <div class="row"><span class="store-meta">Cierre:</span><span class="font-mono">${closedDateStr}</span></div>
                    <div class="row"><span class="store-meta">Apertura por:</span><span>${data.openedBy || '-'}</span></div>
                    <div class="row"><span class="store-meta">Cierre por:</span><span>${data.closedBy || 'Usuario Actual'}</span></div>

                    <div class="divider"></div>
                    <div class="text-center font-bold" style="font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
                        RESUMEN DE EFECTIVO
                    </div>

                    <div class="row"><span>Fondo Inicial (Base):</span><span class="font-mono">RD$ ${fmt(data.stats.initialCash)}</span></div>
                    <div class="row"><span>(+) Ventas Efectivo:</span><span class="font-mono font-bold">RD$ ${fmt(data.stats.cashSales)}</span></div>
                    ${data.stats.deposits > 0 ? `<div class="row"><span>(+) Entradas de Caja:</span><span class="font-mono">RD$ ${fmt(data.stats.deposits)}</span></div>` : ''}
                    ${data.stats.withdrawals > 0 ? `<div class="row"><span>(-) Salidas de Caja:</span><span class="font-mono">RD$ ${fmt(data.stats.withdrawals)}</span></div>` : ''}
                    ${data.stats.totalRefunds > 0 ? `<div class="row"><span>(-) Devoluciones:</span><span class="font-mono">RD$ ${fmt(data.stats.totalRefunds)}</span></div>` : ''}

                    <div class="divider"></div>

                    <div class="row font-bold" style="font-size: 12px;">
                        <span>EFECTIVO ESPERADO:</span>
                        <span class="font-mono">RD$ ${fmt(data.stats.expectedCash)}</span>
                    </div>

                    <div class="highlight-box">
                        <div class="row font-bold" style="font-size: 12px;">
                            <span>EFECTIVO REAL (Físico):</span>
                            <span class="font-mono">RD$ ${fmt(data.actualCash)}</span>
                        </div>
                        <div class="row diff-text" style="color: ${diffColor}; margin-top: 3px;">
                            <span>DIFERENCIA:</span>
                            <span class="font-mono">${diffStatus}</span>
                        </div>
                    </div>

                    <div class="divider"></div>
                    <div class="text-center font-bold" style="font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
                        OTRAS FORMAS DE PAGO
                    </div>

                    <div class="row"><span>Ventas Tarjeta:</span><span class="font-mono">RD$ ${fmt(data.stats.cardSales)}</span></div>
                    <div class="row"><span>Ventas Transferencia:</span><span class="font-mono">RD$ ${fmt(data.stats.transferSales)}</span></div>
                    ${data.stats.otherSales > 0 ? `<div class="row"><span>Ventas Crédito / Otros:</span><span class="font-mono">RD$ ${fmt(data.stats.otherSales)}</span></div>` : ''}

                    <div class="double-divider"></div>
                    <div class="row font-bold" style="font-size: 12px;">
                        <span>TOTAL VENTAS DEL TURNO:</span>
                        <span class="font-mono">RD$ ${fmt(data.stats.totalSales)}</span>
                    </div>
                    <div class="row store-meta">
                        <span>Total Transacciones:</span>
                        <span class="font-mono">${data.stats.salesCount || 0} ventas</span>
                    </div>

                    ${data.notes ? `
                        <div class="divider"></div>
                        <div class="font-bold" style="font-size: 10px; text-transform: uppercase;">NOTAS / OBSERVACIONES:</div>
                        <div style="font-size: 10px; font-style: italic; margin-top: 2px;">${data.notes}</div>
                    ` : ''}

                    <div class="signatures">
                        <div>
                            <div class="sign-line">Firma del Cajero / Responsable</div>
                        </div>
                        <div>
                            <div class="sign-line">Firma Autorizada / Supervisor</div>
                        </div>
                    </div>

                    <div class="footer-brand">
                        Generado por Cobro App • Sistema de Gestión
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // A4 / Carta Full Page Layout
    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cierre de Caja - ${companyInfo.name || 'Cobro App'}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #ffffff;
                    color: #0f172a;
                    line-height: 1.4;
                    padding: 24px;
                }
                .container {
                    max-width: ${containerMaxWidth};
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 16px;
                    margin-bottom: 20px;
                }
                .brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .brand img {
                    width: 56px;
                    height: 56px;
                    object-fit: contain;
                }
                .store-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.2;
                }
                .store-meta {
                    font-size: 11px;
                    color: #64748b;
                }
                .header-right {
                    text-align: right;
                }
                .badge {
                    display: inline-block;
                    background: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                    padding: 2px 10px;
                    border-radius: 999px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .doc-title {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .doc-date {
                    font-size: 11px;
                    color: #64748b;
                }
                .grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .meta-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-left: 3px solid #0f172a;
                    padding: 10px 14px;
                    border-radius: 6px;
                }
                .meta-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .meta-val {
                    font-size: 13px;
                    font-weight: 700;
                    color: #0f172a;
                }
                .meta-sub {
                    font-size: 11px;
                    color: #64748b;
                }
                .table-box {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 18px;
                }
                .table-header {
                    background: #f8fafc;
                    padding: 8px 14px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #e2e8f0;
                    color: #0f172a;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                th, td {
                    padding: 7px 14px;
                    border-bottom: 1px solid #f1f5f9;
                }
                th {
                    text-align: left;
                    font-size: 10px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                }
                td.text-right, th.text-right {
                    text-align: right;
                }
                .font-mono {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }
                .total-row {
                    background: #f8fafc;
                    font-weight: 700;
                    border-top: 2px solid #e2e8f0;
                }
                .cuadre-card {
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #ffffff;
                    border-radius: 8px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .cuadre-item {
                    display: flex;
                    flex-direction: column;
                }
                .cuadre-label {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #94a3b8;
                    letter-spacing: 0.5px;
                }
                .cuadre-amount {
                    font-size: 22px;
                    font-weight: 800;
                    font-family: ui-monospace, monospace;
                    color: #ffffff;
                }
                .cuadre-diff {
                    font-size: 18px;
                    font-weight: 800;
                    font-family: ui-monospace, monospace;
                }
                .notes-card {
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 6px;
                    padding: 10px 14px;
                    margin-bottom: 24px;
                    font-size: 11px;
                }
                .signatures {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-top: 30px;
                    padding-top: 10px;
                }
                .sign-box {
                    text-align: center;
                }
                .sign-line {
                    border-top: 1.5px solid #0f172a;
                    margin-bottom: 4px;
                }
                .sign-label {
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #475569;
                }
                .footer {
                    margin-top: 24px;
                    padding-top: 10px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 10px;
                    color: #94a3b8;
                }
                @media print {
                    @page { margin: 12mm; size: letter portrait; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="brand">
                        ${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="Logo">` : ''}
                        <div>
                            <div class="store-title">${companyInfo.name || 'Mi Negocio'}</div>
                            ${companyInfo.rnc ? `<div class="store-meta">RNC: ${companyInfo.rnc}</div>` : ''}
                            ${companyInfo.phone ? `<div class="store-meta">Tel: ${companyInfo.phone}</div>` : ''}
                            ${companyInfo.address ? `<div class="store-meta">${companyInfo.address}</div>` : ''}
                        </div>
                    </div>
                    <div class="header-right">
                        <span class="badge">✓ Turno Cerrado</span>
                        <div class="doc-title">Reporte de Cierre de Caja</div>
                        <div class="doc-date">${closedDateStr}</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="meta-card">
                        <div class="meta-label">Horario de Sesión</div>
                        <div class="meta-val">${openedDateStr}</div>
                        <div class="meta-sub">al ${closedDateStr}</div>
                    </div>
                    <div class="meta-card">
                        <div class="meta-label">Responsables</div>
                        <div class="meta-val">${data.closedBy || 'Usuario Actual'} (Cierre)</div>
                        <div class="meta-sub">Apertura: ${data.openedBy || '-'}</div>
                    </div>
                </div>

                <!-- RESUMEN EFECTIVO -->
                <div class="table-box">
                    <div class="table-header">Movimientos de Efectivo</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th class="text-right">Monto (RD$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Fondo Inicial de Caja (Base)</td><td class="text-right font-mono">$${fmt(data.stats.initialCash)}</td></tr>
                            <tr><td>(+) Ventas en Efectivo</td><td class="text-right font-mono font-bold" style="color: #059669;">+$${fmt(data.stats.cashSales)}</td></tr>
                            ${data.stats.deposits > 0 ? `<tr><td>(+) Entradas extraordinarias a caja</td><td class="text-right font-mono">+$${fmt(data.stats.deposits)}</td></tr>` : ''}
                            ${data.stats.withdrawals > 0 ? `<tr><td>(-) Salidas / Retiros de caja</td><td class="text-right font-mono" style="color: #e11d48;">-$${fmt(data.stats.withdrawals)}</td></tr>` : ''}
                            ${data.stats.totalRefunds > 0 ? `<tr><td>(-) Devoluciones en efectivo</td><td class="text-right font-mono" style="color: #e11d48;">-$${fmt(data.stats.totalRefunds)}</td></tr>` : ''}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td>EFECTIVO ESPERADO EN CAJA</td>
                                <td class="text-right font-mono">$${fmt(data.stats.expectedCash)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- CUADRE DE CAJA BANNER -->
                <div class="cuadre-card">
                    <div class="cuadre-item">
                        <span class="cuadre-label">Efectivo Físico Contado</span>
                        <span class="cuadre-amount">$${fmt(data.actualCash)}</span>
                    </div>
                    <div class="cuadre-item" style="text-align: right;">
                        <span class="cuadre-label">Diferencia de Cuadre</span>
                        <span class="cuadre-diff" style="color: ${diffColor};">${diffStatus}</span>
                    </div>
                </div>

                <!-- OTRAS FORMAS DE PAGO -->
                <div class="table-box">
                    <div class="table-header">Resumen General de Ventas (Todas las Formas)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Método de Pago</th>
                                <th class="text-right">Monto (RD$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Ventas en Efectivo</td><td class="text-right font-mono">$${fmt(data.stats.cashSales)}</td></tr>
                            <tr><td>Ventas con Tarjeta (Crédito / Débito)</td><td class="text-right font-mono">$${fmt(data.stats.cardSales)}</td></tr>
                            <tr><td>Ventas por Transferencia Bancaria</td><td class="text-right font-mono">$${fmt(data.stats.transferSales)}</td></tr>
                            ${data.stats.otherSales > 0 ? `<tr><td>Ventas a Crédito / Otros métodos</td><td class="text-right font-mono">$${fmt(data.stats.otherSales)}</td></tr>` : ''}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td>TOTAL GENERAL FACTURADO (${data.stats.salesCount || 0} Ventas)</td>
                                <td class="text-right font-mono" style="font-size: 14px;">$${fmt(data.stats.totalSales)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${data.notes ? `
                    <div class="notes-card">
                        <strong>Observaciones registradas en el cierre:</strong>
                        <p style="margin-top: 3px; font-style: italic;">${data.notes}</p>
                    </div>
                ` : ''}

                <div class="signatures">
                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <div class="sign-label">Firma del Cajero / Responsable</div>
                        <div style="font-size: 11px; font-weight: 600; margin-top: 2px;">${data.closedBy || 'Usuario Actual'}</div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <div class="sign-label">Firma Autorizada / Supervisor</div>
                        <div style="font-size: 11px; font-weight: 600; margin-top: 2px;">${companyInfo.name || 'Mi Negocio'}</div>
                    </div>
                </div>

                <div class="footer">
                    Documento de Cierre Oficial emitido por Cobro App • Sistema de Punto de Venta y Gestión
                </div>
            </div>
        </body>
        </html>
    `;
};
