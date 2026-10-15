// Utility function to generate and display payroll receipt
import appLogo from '@/assets/cobro-logo.png';
export const printPayrollReceipt = (
    payroll: any,
    items: any[],
    storeName: string,
    logoUrl?: string
) => {
    console.log('[PRINT] Starting receipt generation...', { payroll, itemsCount: items.length, storeName, logoUrl });

    const periodStart = new Date(payroll.period_start).toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const periodEnd = new Date(payroll.period_end).toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const printDate = new Date().toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const formatMoney = (val: number) => (val || 0).toLocaleString('es-DO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const totalAmount = items.reduce((sum, item) => sum + item.net_salary, 0);
    const totalBase = items.reduce((sum, item) => sum + item.base_salary, 0);
    const totalBonuses = items.reduce((sum, item) => sum + item.bonuses, 0);
    const totalTSS = items.reduce((sum, item) => sum + item.tss, 0);
    const totalInfotep = items.reduce((sum, item) => sum + item.infotep, 0);
    const totalDeductions = items.reduce((sum, item) => sum + item.deductions, 0);

    // Determine which columns to show (only show if any employee has a value > 0)
    const showBonuses = items.some(item => item.bonuses > 0);
    const showInfotep = items.some(item => item.infotep > 0);
    const showDeductions = items.some(item => item.deductions > 0);

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comprobante de Nómina - ${periodStart}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                @media print {
                    @page {
                        margin: 10mm 12mm;
                        size: letter portrait;
                    }
                    html, body {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .page-container {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }
                    table, tr, td, th, .summary-section, .signatures, .footer {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #ffffff;
                    color: #1a1a1a;
                    line-height: 1.4;
                    padding: 16px;
                }

                .action-bar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #2c3e50;
                    padding: 10px 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                }

                .action-btn {
                    background: white;
                    color: #2c3e50;
                    border: 1px solid #e0e0e0;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover {
                    background: #f8f9fa;
                    border-color: #2c3e50;
                }

                .page-container {
                    max-width: 850px;
                    margin: 45px auto 0;
                    background: white;
                }
                
                /* Header */
                .header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #1a1a1a;
                    margin-bottom: 14px;
                }

                .logo-container {
                    width: 52px;
                    height: 52px;
                    flex-shrink: 0;
                }

                .logo-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .header-text {
                    flex: 1;
                }

                .company-name {
                    font-size: 21px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 2px;
                    line-height: 1.2;
                }
                
                .document-type {
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Info Section */
                .info-section {
                    display: grid;
                    grid-template-columns: 1.3fr 0.9fr 1fr 0.8fr;
                    gap: 14px;
                    margin-bottom: 14px;
                }

                .info-item {
                    border-left: 3px solid #1a1a1a;
                    padding-left: 10px;
                }

                .info-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }

                .info-value {
                    font-size: 12.5px;
                    font-weight: 600;
                    color: #1a1a1a;
                    white-space: nowrap;
                }

                /* Table */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 16px;
                    font-size: 12px;
                }

                thead {
                    background: #1a1a1a;
                    color: white;
                }

                th {
                    padding: 8px 8px;
                    text-align: left;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                th.text-right {
                    text-align: right;
                }

                tbody tr {
                    border-bottom: 1px solid #e5e5e5;
                }

                tbody tr:last-child {
                    border-bottom: 2px solid #1a1a1a;
                }

                td {
                    padding: 6.5px 8px;
                    color: #333;
                }

                td:first-child {
                    font-weight: 600;
                    color: #1a1a1a;
                }

                td.text-right {
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }

                td.amount {
                    font-weight: 500;
                }

                td.net-amount {
                    font-weight: 700;
                    color: #1a1a1a;
                    font-size: 12.5px;
                }

                /* Summary */
                .summary-section {
                    display: grid;
                    grid-template-columns: 1.15fr 1fr;
                    gap: 20px;
                    align-items: stretch;
                    margin-bottom: 20px;
                }

                .summary-left {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 0;
                }

                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 3.5px 0;
                    border-bottom: 1px solid #e5e5e5;
                    font-size: 12px;
                }

                .summary-row.subtotal {
                    font-weight: 600;
                    border-bottom: 1.5px solid #1a1a1a;
                }

                .summary-label {
                    color: #555;
                }

                .summary-value {
                    font-weight: 600;
                    color: #1a1a1a;
                    font-variant-numeric: tabular-nums;
                }

                .total-box {
                    background: linear-gradient(135deg, #f8f9fa 0%, #edf0f2 100%);
                    border: 1.5px solid #dee2e6;
                    border-radius: 6px;
                    padding: 14px 18px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .total-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #1a1a1a;
                    margin-bottom: 6px;
                }

                .total-label {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #495057;
                }

                .total-amount {
                    font-size: 28px;
                    font-weight: 800;
                    color: #1a1a1a;
                    font-variant-numeric: tabular-nums;
                    line-height: 1;
                }

                .total-footer {
                    text-align: right;
                    font-size: 10px;
                    color: #868e96;
                    font-style: italic;
                }

                /* Signatures */
                .signatures {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 40px;
                    margin: 22px 0 16px;
                }

                .signature-box {
                    text-align: center;
                }

                .signature-line {
                    border-top: 1.5px solid #1a1a1a;
                    margin-bottom: 4px;
                    padding-top: 4px;
                }

                .signature-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Footer */
                .footer {
                    text-align: center;
                    padding-top: 10px;
                    border-top: 1px solid #e5e5e5;
                    font-size: 10px;
                    color: #999;
                    line-height: 1.4;
                }

                .footer strong {
                    color: #666;
                }

                .app-watermark {
                    margin-top: 8px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 6px;
                    opacity: 0.5;
                }
                .app-watermark img {
                    height: 14px;
                    width: auto;
                    filter: grayscale(100%);
                }
                .app-watermark span {
                    font-size: 10px;
                    font-weight: 600;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            </style>
        </head>
        <body>
            <div class="action-bar no-print">
                <button class="action-btn" onclick="window.print()">
                    🖨️ Imprimir
                </button>
                <button class="action-btn" onclick="window.print()">
                    💾 Guardar como PDF
                </button>
            </div>

            <div class="page-container">
                <div class="header">
                    ${logoUrl ? `
                        <div class="logo-container">
                            <img src="${logoUrl}" alt="${storeName}">
                        </div>
                    ` : ''}
                    <div class="header-text">
                        <div class="company-name">${storeName}</div>
                        <div class="document-type">Comprobante de Pago de Nómina</div>
                    </div>
                </div>

                <div class="info-section">
                    <div class="info-item">
                        <div class="info-label">Período de Nómina</div>
                        <div class="info-value">${periodStart}</div>
                        <div class="info-value" style="font-size: 11px; font-weight: 400; color: #666;">al ${periodEnd}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Total Empleados</div>
                        <div class="info-value">${items.length} empleados</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Fecha de Emisión</div>
                        <div class="info-value">${printDate}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Estado del Pago</div>
                        <div class="info-value" style="color: #27ae60;">✓ Pagado</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Empleado</th>
                            <th class="text-right">Salario Base</th>
                            ${showBonuses ? '<th class="text-right">Bonos</th>' : ''}
                            <th class="text-right">TSS</th>
                            ${showInfotep ? '<th class="text-right">Infotep</th>' : ''}
                            ${showDeductions ? '<th class="text-right">Deducciones</th>' : ''}
                            <th class="text-right">Neto a Pagar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.employee_name}</td>
                                <td class="text-right amount">$${formatMoney(item.base_salary)}</td>
                                ${showBonuses ? `<td class="text-right amount">$${formatMoney(item.bonuses)}</td>` : ''}
                                <td class="text-right amount">$${formatMoney(item.tss)}</td>
                                ${showInfotep ? `<td class="text-right amount">$${formatMoney(item.infotep)}</td>` : ''}
                                ${showDeductions ? `<td class="text-right amount">$${formatMoney(item.deductions)}</td>` : ''}
                                <td class="text-right net-amount">$${formatMoney(item.net_salary)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="summary-section">
                    <div class="summary-left">
                        <div class="summary-row">
                            <span class="summary-label">Subtotal Salarios Base</span>
                            <span class="summary-value">$${formatMoney(totalBase)}</span>
                        </div>
                        ${showBonuses && totalBonuses > 0 ? `
                        <div class="summary-row">
                            <span class="summary-label">Total Bonos</span>
                            <span class="summary-value">$${formatMoney(totalBonuses)}</span>
                        </div>
                        ` : ''}
                        <div class="summary-row">
                            <span class="summary-label">Total TSS</span>
                            <span class="summary-value">-$${formatMoney(totalTSS)}</span>
                        </div>
                        ${showInfotep && totalInfotep > 0 ? `
                        <div class="summary-row">
                            <span class="summary-label">Total Infotep</span>
                            <span class="summary-value">-$${formatMoney(totalInfotep)}</span>
                        </div>
                        ` : ''}
                        ${showDeductions && totalDeductions > 0 ? `
                        <div class="summary-row subtotal">
                            <span class="summary-label">Total Deducciones</span>
                            <span class="summary-value">-$${formatMoney(totalDeductions)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="total-box">
                        <div class="total-content">
                            <div class="total-label">Total a Pagar</div>
                            <div class="total-amount">$${formatMoney(totalAmount)}</div>
                        </div>
                        <div class="total-footer">Monto neto a desembolsar</div>
                    </div>
                </div>

                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Firma del Administrador</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Fecha</div>
                    </div>
                </div>

                <div class="footer">
                    <p>
                        <strong>Certificación:</strong> Este documento certifica el pago de nómina correspondiente al período indicado.
                        <br>
                        Generado automáticamente por el Sistema de Gestión de ${storeName}
                    </p>
                    <div class="app-watermark">
                        <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/cobro-logo.png" alt="Cobro">
                        <span>Cobro</span>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    // Open in new window/tab
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes para ver el comprobante');
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    console.log('[PRINT] Receipt opened in new window');
};
