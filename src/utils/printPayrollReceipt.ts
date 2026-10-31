// Utility functions to generate and display payroll receipts and employee vouchers
import appLogo from '@/assets/cobro-logo.png';

export interface CompanyInfo {
    rnc?: string | null;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
}

export interface PayrollSettings {
    afp_rate?: number;
    sfs_rate?: number;
    infotep_rate?: number;
    enable_afp?: boolean;
    enable_sfs?: boolean;
    enable_infotep?: boolean;
    afp_type?: string;
    sfs_type?: string;
    infotep_type?: string;
}

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

const formatMoney = (val: number) => (val || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

/**
 * Imprime los comprobantes individuales de pago para cada empleado (volantes de nómina).
 * Cada empleado tiene su desglose detallado de deducciones (TSS, AFP, SFS, Infotep, préstamos, adelantos, etc.)
 * y en la impresión se separan por páginas individuales.
 */
export const printEmployeeVouchers = (
    payroll: any,
    items: any[],
    employees: any[] = [],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings
) => {
    console.log('[PRINT] Generating employee payroll vouchers...', {
        payrollId: payroll?.id,
        itemsCount: items.length,
        storeName
    });

    if (!items || items.length === 0) {
        alert('No hay empleados con pago en esta nómina para imprimir comprobantes.');
        return;
    }

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

    const isAfpEnabled = settings?.enable_afp !== false;
    const isSfsEnabled = settings?.enable_sfs !== false;
    const isInfotepEnabled = settings?.enable_infotep === true;
    const afpRate = Number(settings?.afp_rate) > 0 ? Number(settings.afp_rate) : 2.87;
    const sfsRate = Number(settings?.sfs_rate) > 0 ? Number(settings.sfs_rate) : 3.04;
    const infotepRate = Number(settings?.infotep_rate) > 0 ? Number(settings.infotep_rate) : 1.0;

    const vouchersHtml = items.map((item, index) => {
        const emp = employees.find(e => e.id === item.profile_id) || {};
        const role = getRoleLabel(emp.role);
        const cedula = emp.cedula || 'N/A';
        const baseSalary = Number(item.base_salary) || 0;
        const bonuses = Number(item.bonuses) || 0;
        const grossSalary = baseSalary + bonuses;
        const tss = Number(item.tss) || 0;
        const infotep = Number(item.infotep) || 0;
        const netSalary = Number(item.net_salary) || 0;

        // Parse deductions details
        let details: Array<{ reason: string; amount: number }> = [];
        if (Array.isArray(item.deductions_details) && item.deductions_details.length > 0) {
            details = item.deductions_details;
        } else if (item.note && typeof item.note === 'string' && item.note.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(item.note);
                if (Array.isArray(parsed)) details = parsed;
            } catch (e) { /* ignore */ }
        }

        // Calculate breakdown for TSS if applicable
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

        const totalDeductions = tss + infotep + (Number(item.deductions) || 0);

        return `
            <div class="voucher-wrapper">
                <div class="voucher-card">
                    <!-- HEADER -->
                    <div class="voucher-header">
                        <div class="header-brand">
                            ${logoUrl ? `
                                <div class="brand-logo">
                                    <img src="${logoUrl}" alt="${storeName}">
                                </div>
                            ` : ''}
                            <div class="brand-info">
                                <h1 class="store-title">${storeName}</h1>
                                ${companyInfo?.rnc ? `<p class="store-meta"><strong>RNC:</strong> ${companyInfo.rnc}</p>` : ''}
                                ${companyInfo?.phone ? `<p class="store-meta"><strong>Tel:</strong> ${companyInfo.phone}</p>` : ''}
                                ${companyInfo?.address ? `<p class="store-meta">${companyInfo.address}</p>` : ''}
                            </div>
                        </div>
                        <div class="header-doc-info">
                            <span class="badge-status">✓ Nómina Pagada</span>
                            <h2 class="doc-title">Comprobante de Pago</h2>
                            <p class="doc-subtitle">Volante Individual de Salario</p>
                            <p class="doc-code">REF: NOM-${(payroll.id || '').toString().slice(0, 8).toUpperCase()}-${String(index + 1).padStart(3, '0')}</p>
                        </div>
                    </div>

                    <!-- EMPLOYEE & PERIOD INFO -->
                    <div class="meta-grid">
                        <div class="meta-box">
                            <span class="meta-label">Colaborador / Empleado</span>
                            <span class="meta-value emp-name">${item.employee_name}</span>
                            <span class="meta-sub">Cargo: <strong>${role}</strong></span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Documento de Identidad</span>
                            <span class="meta-value">${cedula}</span>
                            <span class="meta-sub">ID Sistema: ${(item.profile_id || '').slice(0, 8) || 'N/A'}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Período de Nómina</span>
                            <span class="meta-value">${periodStart}</span>
                            <span class="meta-sub">al ${periodEnd}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Fecha de Emisión</span>
                            <span class="meta-value">${printDate}</span>
                            <span class="meta-sub">Modo: Transferencia / Efectivo</span>
                        </div>
                    </div>

                    <!-- BREAKDOWN: INGRESOS & DEDUCCIONES -->
                    <div class="breakdown-grid">
                        <!-- INGRESOS -->
                        <div class="section-box">
                            <div class="section-title text-emerald">
                                <span>(+) Ingresos / Percepciones</span>
                            </div>
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th class="text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <span class="item-name">Salario Base Ordinario</span>
                                            <span class="item-hint">Periodo trabajado</span>
                                        </td>
                                        <td class="text-right font-mono">$${formatMoney(baseSalary)}</td>
                                    </tr>
                                    ${bonuses > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">Bonos e Incentivos</span>
                                                <span class="item-hint">Horas extras / comisiones</span>
                                            </td>
                                            <td class="text-right font-mono text-emerald">+$${formatMoney(bonuses)}</td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th>Total Ingresos Brutos</th>
                                        <th class="text-right font-mono">$${formatMoney(grossSalary)}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <!-- DEDUCCIONES -->
                        <div class="section-box">
                            <div class="section-title text-rose">
                                <span>(-) Deducciones y Retenciones</span>
                            </div>
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>Concepto / Motivo</th>
                                        <th class="text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${hasDetailedTss ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">AFP - Fondo de Pensiones</span>
                                                <span class="item-hint">Ley 87-01 (${afpRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(afpAmount)}</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <span class="item-name">SFS - Seguro Familiar de Salud</span>
                                                <span class="item-hint">Ley 87-01 (${sfsRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(sfsAmount)}</td>
                                        </tr>
                                    ` : (tss > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">TSS (Seguridad Social)</span>
                                                <span class="item-hint">Retención de Ley (AFP + SFS)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(tss)}</td>
                                        </tr>
                                    ` : '')}

                                    ${infotep > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">INFOTEP</span>
                                                <span class="item-hint">Aporte formativo (${infotepRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(infotep)}</td>
                                        </tr>
                                    ` : ''}

                                    ${details.length > 0 ? details.map(d => `
                                        <tr>
                                            <td>
                                                <span class="item-name">${d.reason || 'Deducción interna'}</span>
                                                <span class="item-hint">Descuento aplicado en nómina</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(Number(d.amount) || 0)}</td>
                                        </tr>
                                    `).join('') : (item.deductions > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">Otras Deducciones</span>
                                                <span class="item-hint">Descuentos registrados</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(item.deductions)}</td>
                                        </tr>
                                    ` : '')}

                                    ${totalDeductions === 0 ? `
                                        <tr>
                                            <td colspan="2" class="text-center text-muted py-2" style="font-size: 11px;">
                                                Sin retenciones aplicadas en este período
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th>Total Deducciones</th>
                                        <th class="text-right font-mono text-rose">-$${formatMoney(totalDeductions)}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- NET SUMMARY BANNER -->
                    <div class="net-banner">
                        <div class="net-left">
                            <span class="net-title">Total Neto a Cobrar</span>
                            <span class="net-subtitle">Ingresos brutos ($${formatMoney(grossSalary)}) menos deducciones ($${formatMoney(totalDeductions)})</span>
                        </div>
                        <div class="net-right">
                            <span class="net-currency">RD$</span>
                            <span class="net-amount">${formatMoney(netSalary)}</span>
                        </div>
                    </div>

                    <!-- LEGAL DISCLAIMER -->
                    <div class="disclaimer">
                        <p>
                            <strong>Constancia de Pago:</strong> Hago constar que he recibido a mi entera satisfacción de parte de <strong>${storeName}</strong> el monto neto indicado en este volante de nómina por concepto de salarios y beneficios del período estipulado, no teniendo reclamo laboral posterior ni pendiente por dicho período.
                        </p>
                    </div>

                    <!-- SIGNATURES -->
                    <div class="signature-section">
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span class="sign-name">${item.employee_name}</span>
                            <span class="sign-role">Firma del Colaborador (Recibí Conforme)</span>
                            <span class="sign-doc">Cédula: ${cedula}</span>
                        </div>
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span class="sign-name">${storeName}</span>
                            <span class="sign-role">Firma Autorizada / RRHH</span>
                            <span class="sign-doc">Fecha: ${printDate.split(',')[0]}</span>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="voucher-footer">
                        <span>Documento emitido oficialmente por Cobro App • Sistema de Gestión de Nóminas</span>
                        <span>Pág. ${index + 1} de ${items.length}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comprobantes de Pago - ${storeName} (${periodStart})</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f1f5f9;
                    color: #0f172a;
                    line-height: 1.4;
                    padding-bottom: 40px;
                }

                .font-mono {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }

                /* Top Action Bar (hidden on print) */
                .action-bar {
                    position: sticky;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #0f172a;
                    color: #ffffff;
                    padding: 12px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                }

                .action-bar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .action-bar-left h3 {
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .action-bar-left span {
                    font-size: 12px;
                    color: #94a3b8;
                    background: #1e293b;
                    padding: 3px 8px;
                    border-radius: 999px;
                }

                .action-bar-right {
                    display: flex;
                    gap: 10px;
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }

                .btn-primary {
                    background: #10b981;
                    color: #ffffff;
                }

                .btn-primary:hover {
                    background: #059669;
                }

                .btn-outline {
                    background: #1e293b;
                    color: #f8fafc;
                    border: 1px solid #334155;
                }

                .btn-outline:hover {
                    background: #334155;
                }

                /* Main Page Container */
                .container {
                    max-width: 820px;
                    margin: 24px auto;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                /* Voucher Card */
                .voucher-wrapper {
                    page-break-after: always;
                    break-after: page;
                }

                .voucher-wrapper:last-child {
                    page-break-after: auto;
                    break-after: auto;
                }

                .voucher-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px 28px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    display: flex;
                    flex-direction: column;
                    min-height: 980px;
                    justify-content: space-between;
                }

                /* Header */
                .voucher-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding-bottom: 16px;
                    border-bottom: 2px solid #0f172a;
                    margin-bottom: 16px;
                    gap: 20px;
                }

                .header-brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .brand-logo {
                    width: 58px;
                    height: 58px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #ffffff;
                }

                .brand-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .store-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.15;
                    margin-bottom: 3px;
                }

                .store-meta {
                    font-size: 11px;
                    color: #475569;
                    line-height: 1.35;
                }

                .header-doc-info {
                    text-align: right;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .badge-status {
                    display: inline-block;
                    background: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                    padding: 2px 10px;
                    border-radius: 999px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                }

                .doc-title {
                    font-size: 15px;
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .doc-subtitle {
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 500;
                }

                .doc-code {
                    font-size: 10px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    color: #94a3b8;
                    margin-top: 2px;
                }

                /* Metadata Grid */
                .meta-grid {
                    display: grid;
                    grid-template-columns: 1.4fr 1fr 1.1fr 1fr;
                    gap: 10px;
                    margin-bottom: 16px;
                }

                .meta-box {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-left: 3px solid #0f172a;
                    padding: 8px 10px;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                }

                .meta-label {
                    font-size: 9px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }

                .meta-value {
                    font-size: 12px;
                    font-weight: 700;
                    color: #0f172a;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .meta-value.emp-name {
                    font-size: 13px;
                }

                .meta-sub {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 1px;
                }

                /* Breakdown Grid */
                .breakdown-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .section-box {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .section-title {
                    background: #f8fafc;
                    padding: 8px 12px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #e2e8f0;
                }

                .text-emerald {
                    color: #059669;
                }

                .text-rose {
                    color: #e11d48;
                }

                .detail-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }

                .detail-table thead {
                    background: #ffffff;
                }

                .detail-table th {
                    padding: 6px 10px;
                    font-size: 9px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: left;
                }

                .detail-table th.text-right {
                    text-align: right;
                }

                .detail-table td {
                    padding: 6px 10px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }

                .detail-table td.text-right {
                    text-align: right;
                }

                .item-name {
                    display: block;
                    font-weight: 600;
                    color: #1e293b;
                    font-size: 11px;
                }

                .item-hint {
                    display: block;
                    font-size: 9px;
                    color: #64748b;
                }

                .detail-table tfoot {
                    background: #f8fafc;
                    border-top: 1.5px solid #cbd5e1;
                }

                .detail-table tfoot th {
                    padding: 8px 10px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #0f172a;
                    border-bottom: none;
                }

                /* Net Summary Banner */
                .net-banner {
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border-radius: 8px;
                    padding: 14px 20px;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);
                }

                .net-left {
                    display: flex;
                    flex-direction: column;
                }

                .net-title {
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #38bdf8;
                }

                .net-subtitle {
                    font-size: 10px;
                    color: #94a3b8;
                    margin-top: 2px;
                }

                .net-right {
                    display: flex;
                    align-items: baseline;
                    gap: 4px;
                }

                .net-currency {
                    font-size: 15px;
                    font-weight: 700;
                    color: #34d399;
                }

                .net-amount {
                    font-size: 26px;
                    font-weight: 900;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    color: #ffffff;
                    letter-spacing: -0.5px;
                }

                /* Disclaimer */
                .disclaimer {
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin-bottom: 18px;
                }

                .disclaimer p {
                    font-size: 9.5px;
                    color: #475569;
                    line-height: 1.35;
                    text-align: justify;
                }

                /* Signatures */
                .signature-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 36px;
                    margin-bottom: 14px;
                    padding-top: 6px;
                }

                .sign-box {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .sign-line {
                    width: 80%;
                    border-top: 1.5px solid #0f172a;
                    margin-bottom: 6px;
                }

                .sign-name {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .sign-role {
                    font-size: 9.5px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .sign-doc {
                    font-size: 9px;
                    color: #64748b;
                    margin-top: 1px;
                }

                /* Footer */
                .voucher-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 8px;
                }

                /* Print Styles */
                @media print {
                    @page {
                        margin: 10mm 12mm;
                        size: letter portrait;
                    }

                    body {
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .container {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        gap: 0 !important;
                    }

                    .voucher-wrapper {
                        page-break-after: always !important;
                        break-after: page !important;
                    }

                    .voucher-wrapper:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .voucher-card {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        padding: 20px 24px !important;
                        min-height: 96vh !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .net-banner {
                        background: #0f172a !important;
                        color: #ffffff !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="action-bar no-print">
                <div class="action-bar-left">
                    <h3>Comprobantes de Nómina</h3>
                    <span>${items.length} ${items.length === 1 ? 'comprobante' : 'comprobantes'}</span>
                </div>
                <div class="action-bar-right">
                    <button class="btn btn-primary" onclick="window.print()">
                        🖨️ Imprimir Todo
                    </button>
                    <button class="btn btn-outline" onclick="window.print()">
                        💾 Guardar como PDF
                    </button>
                    <button class="btn btn-outline" onclick="window.close()">
                        ✖️ Cerrar
                    </button>
                </div>
            </div>

            <div class="container">
                ${vouchersHtml}
            </div>

            <script>
                // Auto trigger print after render
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        window.print();
                    }, 400);
                });
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes en tu navegador para ver e imprimir los comprobantes');
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    console.log('[PRINT] Employee vouchers opened in new window');
};

/**
 * Imprime el comprobante individual de un solo empleado.
 */
export const printSingleEmployeeVoucher = (
    payroll: any,
    item: any,
    employee: any,
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings
) => {
    return printEmployeeVouchers(
        payroll,
        [item],
        employee ? [employee] : [],
        storeName,
        logoUrl,
        companyInfo,
        settings
    );
};

/**
 * Imprime el reporte general consolidado de la nómina (resumen para contabilidad y administración).
 */
export const printPayrollReceipt = (
    payroll: any,
    items: any[],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo
) => {
    console.log('[PRINT] Starting payroll general summary generation...', { payroll, itemsCount: items.length, storeName, logoUrl });

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

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.net_salary) || 0), 0);
    const totalBase = items.reduce((sum, item) => sum + (Number(item.base_salary) || 0), 0);
    const totalBonuses = items.reduce((sum, item) => sum + (Number(item.bonuses) || 0), 0);
    const totalTSS = items.reduce((sum, item) => sum + (Number(item.tss) || 0), 0);
    const totalInfotep = items.reduce((sum, item) => sum + (Number(item.infotep) || 0), 0);
    const totalDeductions = items.reduce((sum, item) => sum + (Number(item.deductions) || 0), 0);

    const showBonuses = items.some(item => (Number(item.bonuses) || 0) > 0);
    const showInfotep = items.some(item => (Number(item.infotep) || 0) > 0);
    const showDeductions = items.some(item => (Number(item.deductions) || 0) > 0);

    const isPaid = payroll?.status === 'paid';
    const statusLabel = isPaid ? '✓ Pagado' : '⏳ Borrador / Vista Previa';
    const statusColor = isPaid ? '#27ae60' : '#d97706';
    const docType = isPaid ? 'Resumen General de Nómina Consolidada' : 'Vista Previa - Resumen General de Nómina';
    const docTitle = isPaid ? `Resumen General de Nómina - ${periodStart}` : `Vista Previa - Resumen de Nómina - ${periodStart}`;

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${docTitle}</title>
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
                    background: #0f172a;
                    padding: 10px 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                }

                .action-btn {
                    background: white;
                    color: #0f172a;
                    border: 1px solid #e0e0e0;
                    padding: 8px 20px;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover {
                    background: #f8f9fa;
                    border-color: #0f172a;
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

                .company-meta {
                    font-size: 11px;
                    color: #64748b;
                }
                
                .document-type {
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: 2px;
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
                <button class="action-btn" onclick="window.close()">
                    ✖️ Cerrar
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
                        ${companyInfo?.rnc ? `<div class="company-meta">RNC: ${companyInfo.rnc}</div>` : ''}
                        <div class="document-type">${docType}</div>
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
                        <div class="info-value" style="color: ${statusColor};">${statusLabel}</div>
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
                                <td class="text-right amount">$${formatMoney(Number(item.base_salary) || 0)}</td>
                                ${showBonuses ? `<td class="text-right amount">$${formatMoney(Number(item.bonuses) || 0)}</td>` : ''}
                                <td class="text-right amount">$${formatMoney(Number(item.tss) || 0)}</td>
                                ${showInfotep ? `<td class="text-right amount">$${formatMoney(Number(item.infotep) || 0)}</td>` : ''}
                                ${showDeductions ? `<td class="text-right amount">$${formatMoney(Number(item.deductions) || 0)}</td>` : ''}
                                <td class="text-right net-amount">$${formatMoney(Number(item.net_salary) || 0)}</td>
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
                        <div class="total-footer">Monto neto desembolsado</div>
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

            <script>
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        window.print();
                    }, 400);
                });
            </script>
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

    console.log('[PRINT] Payroll summary opened in new window');
};

/**
 * Imprime el Paquete Completo de Nómina en un único documento:
 * - Página 1: Resumen General Consolidado de la Nómina Completa
 * - Páginas 2..N: Comprobante Individual de Pago de cada colaborador (separadas por página y nombre)
 * Listo para guardar en un único archivo PDF o imprimir todo junto.
 */
export const printCompletePayrollPackage = (
    payroll: any,
    items: any[],
    employees: any[] = [],
    storeName: string,
    logoUrl?: string,
    companyInfo?: CompanyInfo,
    settings?: PayrollSettings
) => {
    console.log('[PRINT] Generating complete payroll package (summary + all vouchers)...', {
        payrollId: payroll?.id,
        itemsCount: items.length,
        storeName
    });

    if (!items || items.length === 0) {
        alert('No hay empleados con pago en esta nómina para imprimir.');
        return;
    }

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

    const isPaid = payroll?.status === 'paid';
    const statusLabel = isPaid ? '✓ Pagado' : '⏳ Borrador / Vista Previa';
    const statusColor = isPaid ? '#27ae60' : '#d97706';
    const docType = isPaid ? 'Resumen General de Nómina Consolidada' : 'Vista Previa - Resumen General de Nómina';

    // Summary calculations
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.net_salary) || 0), 0);
    const totalBase = items.reduce((sum, item) => sum + (Number(item.base_salary) || 0), 0);
    const totalBonuses = items.reduce((sum, item) => sum + (Number(item.bonuses) || 0), 0);
    const totalTSS = items.reduce((sum, item) => sum + (Number(item.tss) || 0), 0);
    const totalInfotep = items.reduce((sum, item) => sum + (Number(item.infotep) || 0), 0);
    const totalDeductions = items.reduce((sum, item) => sum + (Number(item.deductions) || 0), 0);

    const showBonuses = items.some(item => (Number(item.bonuses) || 0) > 0);
    const showInfotep = items.some(item => (Number(item.infotep) || 0) > 0);
    const showDeductions = items.some(item => (Number(item.deductions) || 0) > 0);

    // Voucher settings
    const isAfpEnabled = settings?.enable_afp !== false;
    const isSfsEnabled = settings?.enable_sfs !== false;
    const isInfotepEnabled = settings?.enable_infotep === true;
    const afpRate = Number(settings?.afp_rate) > 0 ? Number(settings.afp_rate) : 2.87;
    const sfsRate = Number(settings?.sfs_rate) > 0 ? Number(settings.sfs_rate) : 3.04;
    const infotepRate = Number(settings?.infotep_rate) > 0 ? Number(settings.infotep_rate) : 1.0;

    // Generate individual vouchers
    const vouchersHtml = items.map((item, index) => {
        const emp = employees.find(e => e.id === item.profile_id) || {};
        const role = getRoleLabel(emp.role);
        const cedula = emp.cedula || 'N/A';
        const baseSalary = Number(item.base_salary) || 0;
        const bonuses = Number(item.bonuses) || 0;
        const grossSalary = baseSalary + bonuses;
        const tss = Number(item.tss) || 0;
        const infotep = Number(item.infotep) || 0;
        const netSalary = Number(item.net_salary) || 0;

        let details: Array<{ reason: string; amount: number }> = [];
        if (Array.isArray(item.deductions_details) && item.deductions_details.length > 0) {
            details = item.deductions_details;
        } else if (item.note && typeof item.note === 'string' && item.note.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(item.note);
                if (Array.isArray(parsed)) details = parsed;
            } catch (e) { /* ignore */ }
        }

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

        const empTotalDeductions = tss + infotep + (Number(item.deductions) || 0);

        return `
            <div class="voucher-wrapper">
                <div class="voucher-card">
                    <!-- HEADER -->
                    <div class="voucher-header">
                        <div class="header-brand">
                            ${logoUrl ? `
                                <div class="brand-logo">
                                    <img src="${logoUrl}" alt="${storeName}">
                                </div>
                            ` : ''}
                            <div class="brand-info">
                                <h1 class="store-title">${storeName}</h1>
                                ${companyInfo?.rnc ? `<p class="store-meta"><strong>RNC:</strong> ${companyInfo.rnc}</p>` : ''}
                                ${companyInfo?.phone ? `<p class="store-meta"><strong>Tel:</strong> ${companyInfo.phone}</p>` : ''}
                                ${companyInfo?.address ? `<p class="store-meta">${companyInfo.address}</p>` : ''}
                            </div>
                        </div>
                        <div class="header-doc-info">
                            <span class="badge-status">${isPaid ? '✓ Nómina Pagada' : '⏳ Vista Previa'}</span>
                            <h2 class="doc-title">Comprobante de Pago</h2>
                            <p class="doc-subtitle">Volante Individual de Salario</p>
                            <p class="doc-code">REF: NOM-${(payroll.id || '').toString().slice(0, 8).toUpperCase()}-${String(index + 1).padStart(3, '0')}</p>
                        </div>
                    </div>

                    <!-- EMPLOYEE & PERIOD INFO -->
                    <div class="meta-grid">
                        <div class="meta-box">
                            <span class="meta-label">Colaborador / Empleado</span>
                            <span class="meta-value emp-name">${item.employee_name}</span>
                            <span class="meta-sub">Cargo: <strong>${role}</strong></span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Documento de Identidad</span>
                            <span class="meta-value">${cedula}</span>
                            <span class="meta-sub">ID: ${(item.profile_id || '').slice(0, 8) || 'N/A'}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Período de Nómina</span>
                            <span class="meta-value">${periodStart}</span>
                            <span class="meta-sub">al ${periodEnd}</span>
                        </div>
                        <div class="meta-box">
                            <span class="meta-label">Fecha de Emisión</span>
                            <span class="meta-value">${printDate}</span>
                            <span class="meta-sub">Modo: Transferencia / Efectivo</span>
                        </div>
                    </div>

                    <!-- BREAKDOWN -->
                    <div class="breakdown-grid">
                        <!-- INGRESOS -->
                        <div class="section-box">
                            <div class="section-title text-emerald">
                                <span>(+) Ingresos / Percepciones</span>
                            </div>
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th class="text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <span class="item-name">Salario Base Ordinario</span>
                                            <span class="item-hint">Periodo trabajado</span>
                                        </td>
                                        <td class="text-right font-mono">$${formatMoney(baseSalary)}</td>
                                    </tr>
                                    ${bonuses > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">Bonos e Incentivos</span>
                                                <span class="item-hint">Horas extras / comisiones</span>
                                            </td>
                                            <td class="text-right font-mono text-emerald">+$${formatMoney(bonuses)}</td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th>Total Ingresos Brutos</th>
                                        <th class="text-right font-mono">$${formatMoney(grossSalary)}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <!-- DEDUCCIONES -->
                        <div class="section-box">
                            <div class="section-title text-rose">
                                <span>(-) Deducciones y Retenciones</span>
                            </div>
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>Concepto / Motivo</th>
                                        <th class="text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${hasDetailedTss ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">AFP - Fondo de Pensiones</span>
                                                <span class="item-hint">Ley 87-01 (${afpRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(afpAmount)}</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <span class="item-name">SFS - Seguro Familiar de Salud</span>
                                                <span class="item-hint">Ley 87-01 (${sfsRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(sfsAmount)}</td>
                                        </tr>
                                    ` : (tss > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">TSS (Seguridad Social)</span>
                                                <span class="item-hint">Retención de Ley (AFP + SFS)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(tss)}</td>
                                        </tr>
                                    ` : '')}

                                    ${infotep > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">INFOTEP</span>
                                                <span class="item-hint">Aporte formativo (${infotepRate}%)</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(infotep)}</td>
                                        </tr>
                                    ` : ''}

                                    ${details.length > 0 ? details.map(d => `
                                        <tr>
                                            <td>
                                                <span class="item-name">${d.reason || 'Deducción interna'}</span>
                                                <span class="item-hint">Descuento aplicado en nómina</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(Number(d.amount) || 0)}</td>
                                        </tr>
                                    `).join('') : (item.deductions > 0 ? `
                                        <tr>
                                            <td>
                                                <span class="item-name">Otras Deducciones</span>
                                                <span class="item-hint">Descuentos registrados</span>
                                            </td>
                                            <td class="text-right font-mono text-rose">-$${formatMoney(item.deductions)}</td>
                                        </tr>
                                    ` : '')}

                                    ${empTotalDeductions === 0 ? `
                                        <tr>
                                            <td colspan="2" class="text-center text-muted py-2" style="font-size: 11px;">
                                                Sin retenciones aplicadas en este período
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th>Total Deducciones</th>
                                        <th class="text-right font-mono text-rose">-$${formatMoney(empTotalDeductions)}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- NET BANNER -->
                    <div class="net-banner">
                        <div class="net-left">
                            <span class="net-title">Total Neto a Cobrar</span>
                            <span class="net-subtitle">Ingresos brutos ($${formatMoney(grossSalary)}) menos deducciones ($${formatMoney(empTotalDeductions)})</span>
                        </div>
                        <div class="net-right">
                            <span class="net-currency">RD$</span>
                            <span class="net-amount">${formatMoney(netSalary)}</span>
                        </div>
                    </div>

                    <!-- LEGAL DISCLAIMER -->
                    <div class="disclaimer">
                        <p>
                            <strong>Constancia de Pago:</strong> Hago constar que he recibido a mi entera satisfacción de parte de <strong>${storeName}</strong> el monto neto indicado en este volante de nómina por concepto de salarios y beneficios del período estipulado, no teniendo reclamo laboral posterior ni pendiente por dicho período.
                        </p>
                    </div>

                    <!-- SIGNATURES -->
                    <div class="signature-section">
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span class="sign-name">${item.employee_name}</span>
                            <span class="sign-role">Firma del Colaborador (Recibí Conforme)</span>
                            <span class="sign-doc">Cédula: ${cedula}</span>
                        </div>
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span class="sign-name">${storeName}</span>
                            <span class="sign-role">Firma Autorizada / RRHH</span>
                            <span class="sign-doc">Fecha: ${printDate.split(',')[0]}</span>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="voucher-footer">
                        <span>Documento emitido oficialmente por Cobro App • Sistema de Gestión de Nóminas</span>
                        <span>Comprobante ${index + 1} de ${items.length}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const safeStore = (storeName || 'Empresa').replace(/\s+/g, '_');
    const docTitle = `Nomina_Completa_${safeStore}_${periodStart}_al_${periodEnd}`;

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${docTitle}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f1f5f9;
                    color: #0f172a;
                    line-height: 1.4;
                    padding-bottom: 40px;
                }

                .font-mono {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }

                /* Top Action Bar (hidden on print) */
                .action-bar {
                    position: sticky;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #0f172a;
                    color: #ffffff;
                    padding: 12px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                }

                .action-bar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .action-bar-left h3 {
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .action-bar-left span {
                    font-size: 12px;
                    color: #94a3b8;
                    background: #1e293b;
                    padding: 3px 8px;
                    border-radius: 999px;
                }

                .action-bar-right {
                    display: flex;
                    gap: 10px;
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }

                .btn-primary {
                    background: #10b981;
                    color: #ffffff;
                }

                .btn-primary:hover {
                    background: #059669;
                }

                .btn-outline {
                    background: #1e293b;
                    color: #ffffff;
                    border: 1px solid #334155;
                }

                .btn-outline:hover {
                    background: #334155;
                }

                .package-container {
                    max-width: 900px;
                    margin: 24px auto;
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                }

                /* Summary Page Container */
                .summary-page {
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 28px 32px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
                }

                .summary-page .header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #1a1a1a;
                    margin-bottom: 14px;
                }

                .summary-page .logo-container {
                    width: 52px;
                    height: 52px;
                    flex-shrink: 0;
                }

                .summary-page .logo-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .summary-page .header-text {
                    flex: 1;
                }

                .summary-page .company-name {
                    font-size: 21px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 2px;
                    line-height: 1.2;
                }

                .summary-page .company-meta {
                    font-size: 11px;
                    color: #64748b;
                }

                .summary-page .document-type {
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: 2px;
                }

                .summary-page .info-section {
                    display: grid;
                    grid-template-columns: 1.3fr 0.9fr 1fr 0.8fr;
                    gap: 14px;
                    margin-bottom: 14px;
                }

                .summary-page .info-item {
                    border-left: 3px solid #1a1a1a;
                    padding-left: 10px;
                }

                .summary-page .info-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }

                .summary-page .info-value {
                    font-size: 12.5px;
                    font-weight: 600;
                    color: #1a1a1a;
                    white-space: nowrap;
                }

                .summary-page table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 16px;
                    font-size: 12px;
                }

                .summary-page th {
                    background: #0f172a;
                    color: white;
                    padding: 9px 12px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .summary-page td {
                    padding: 8px 12px;
                    border-bottom: 1px solid #e0e0e0;
                    color: #333;
                }

                .summary-page tr:last-child td {
                    border-bottom: 2px solid #1a1a1a;
                }

                .summary-page tr:nth-child(even) {
                    background: #fafafa;
                }

                .summary-page .text-right {
                    text-align: right;
                }

                .summary-page .amount {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 11.5px;
                    color: #333;
                }

                .summary-page .net-amount-cell {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-weight: 700;
                    color: #27ae60;
                    font-size: 12.5px;
                }

                .summary-page .summary-section {
                    display: grid;
                    grid-template-columns: 1.4fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .summary-page .summary-left {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .summary-page .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    font-size: 12px;
                    border-bottom: 1px dashed #e0e0e0;
                }

                .summary-page .summary-row.subtotal {
                    border-top: 1px solid #1a1a1a;
                    border-bottom: none;
                    font-weight: 600;
                    padding-top: 8px;
                }

                .summary-page .summary-label {
                    color: #666;
                }

                .summary-page .summary-value {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-weight: 600;
                    color: #1a1a1a;
                }

                .summary-page .total-box {
                    background: #1a1a1a;
                    color: white;
                    padding: 16px;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .summary-page .total-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #888;
                }

                .summary-page .total-amount {
                    font-size: 26px;
                    font-weight: 700;
                    color: #27ae60;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    margin: 6px 0;
                }

                .summary-page .total-footer {
                    font-size: 10px;
                    color: #888;
                }

                .summary-page .signatures {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 36px;
                    margin-top: 20px;
                    margin-bottom: 16px;
                    padding-top: 16px;
                }

                .summary-page .signature-box {
                    text-align: center;
                }

                .summary-page .signature-line {
                    border-top: 1px solid #1a1a1a;
                    margin-bottom: 6px;
                }

                .summary-page .signature-label {
                    font-size: 10px;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .summary-page .footer {
                    margin-top: 16px;
                    padding-top: 12px;
                    border-top: 1px solid #e0e0e0;
                    font-size: 10px;
                    color: #888;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }

                .summary-page .app-watermark {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .summary-page .app-watermark img {
                    width: 16px;
                    height: 16px;
                    object-fit: contain;
                }

                /* Voucher Card Styles */
                .voucher-card {
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 24px 28px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .voucher-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 14px;
                    margin-bottom: 14px;
                }

                .header-brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .brand-logo {
                    width: 56px;
                    height: 56px;
                    flex-shrink: 0;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8fafc;
                }

                .brand-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .brand-info .store-title {
                    font-size: 18px;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.2;
                }

                .brand-info .store-meta {
                    font-size: 10.5px;
                    color: #64748b;
                    line-height: 1.35;
                }

                .header-doc-info {
                    text-align: right;
                }

                .badge-status {
                    display: inline-block;
                    background: #ecfdf5;
                    color: #059669;
                    font-size: 9.5px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 999px;
                    border: 1px solid #a7f3d0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                }

                .doc-title {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    line-height: 1.2;
                }

                .doc-subtitle {
                    font-size: 11px;
                    color: #64748b;
                }

                .doc-code {
                    font-size: 9.5px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    color: #94a3b8;
                    font-weight: 600;
                    margin-top: 2px;
                }

                .meta-grid {
                    display: grid;
                    grid-template-columns: 1.3fr 1fr 1fr 1fr;
                    gap: 10px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 14px;
                }

                .meta-box {
                    display: flex;
                    flex-direction: column;
                }

                .meta-label {
                    font-size: 9px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }

                .meta-value {
                    font-size: 11.5px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .meta-value.emp-name {
                    font-size: 13px;
                    color: #0f172a;
                    font-weight: 800;
                }

                .meta-sub {
                    font-size: 9.5px;
                    color: #64748b;
                    margin-top: 1px;
                }

                .breakdown-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 14px;
                }

                .section-box {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background: #ffffff;
                }

                .section-title {
                    padding: 6px 12px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #e2e8f0;
                }

                .section-title.text-emerald {
                    background: #f0fdf4;
                    color: #166534;
                    border-bottom-color: #bbf7d0;
                }

                .section-title.text-rose {
                    background: #fff1f2;
                    color: #9f1239;
                    border-bottom-color: #fecdd3;
                }

                .detail-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }

                .detail-table th {
                    background: #f8fafc;
                    padding: 5px 10px;
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: left;
                }

                .detail-table td {
                    padding: 6px 10px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #1e293b;
                    vertical-align: middle;
                }

                .detail-table tr:last-child td {
                    border-bottom: none;
                }

                .detail-table tfoot th {
                    background: #f8fafc;
                    padding: 7px 10px;
                    font-size: 10.5px;
                    font-weight: 800;
                    color: #0f172a;
                    border-top: 1.5px solid #cbd5e1;
                    border-bottom: none;
                    text-transform: none;
                }

                .item-name {
                    display: block;
                    font-weight: 600;
                    color: #0f172a;
                    font-size: 11px;
                }

                .item-hint {
                    display: block;
                    font-size: 9px;
                    color: #94a3b8;
                }

                .text-rose {
                    color: #e11d48;
                }

                .text-emerald {
                    color: #059669;
                }

                .text-muted {
                    color: #94a3b8;
                }

                .net-banner {
                    background: #0f172a;
                    color: #ffffff;
                    border-radius: 8px;
                    padding: 12px 18px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }

                .net-title {
                    font-size: 12px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #38bdf8;
                }

                .net-subtitle {
                    font-size: 9.5px;
                    color: #94a3b8;
                    margin-top: 2px;
                }

                .net-right {
                    display: flex;
                    align-items: baseline;
                    gap: 4px;
                }

                .net-currency {
                    font-size: 14px;
                    font-weight: 700;
                    color: #34d399;
                }

                .net-amount {
                    font-size: 24px;
                    font-weight: 900;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    color: #ffffff;
                }

                .disclaimer {
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 6px;
                    padding: 7px 10px;
                    margin-bottom: 14px;
                }

                .disclaimer p {
                    font-size: 8.5px;
                    color: #475569;
                    line-height: 1.35;
                    text-align: justify;
                }

                .signature-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 36px;
                    margin-bottom: 10px;
                    padding-top: 4px;
                }

                .sign-box {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .sign-line {
                    width: 80%;
                    border-top: 1.5px solid #0f172a;
                    margin-bottom: 4px;
                }

                .sign-name {
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .sign-role {
                    font-size: 9px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                }

                .sign-doc {
                    font-size: 8.5px;
                    color: #64748b;
                }

                .voucher-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 8.5px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 6px;
                }

                /* Print Styles */
                @media print {
                    @page {
                        margin: 10mm 12mm;
                        size: letter portrait;
                    }

                    body {
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .package-container {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        gap: 0 !important;
                    }

                    .summary-page {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        padding: 20px 24px !important;
                        min-height: 96vh !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .voucher-wrapper {
                        page-break-after: always !important;
                        break-after: page !important;
                    }

                    .voucher-wrapper:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .voucher-card {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        padding: 20px 24px !important;
                        min-height: 96vh !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .net-banner {
                        background: #0f172a !important;
                        color: #ffffff !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="action-bar no-print">
                <div class="action-bar-left">
                    <h3>Nómina Completa (Resumen + Comprobantes)</h3>
                    <span>${items.length} ${items.length === 1 ? 'colaborador' : 'colaboradores'}</span>
                </div>
                <div class="action-bar-right">
                    <button class="btn btn-primary" onclick="window.print()">
                        🖨️ Imprimir Todo
                    </button>
                    <button class="btn btn-outline" onclick="window.print()">
                        💾 Guardar como PDF
                    </button>
                    <button class="btn btn-outline" onclick="window.close()">
                        ✖️ Cerrar
                    </button>
                </div>
            </div>

            <div class="package-container">
                <!-- PÁGINA 1: RESUMEN GENERAL -->
                <div class="summary-page">
                    <div class="header">
                        ${logoUrl ? `
                            <div class="logo-container">
                                <img src="${logoUrl}" alt="${storeName}">
                            </div>
                        ` : ''}
                        <div class="header-text">
                            <div class="company-name">${storeName}</div>
                            ${companyInfo?.rnc ? `<div class="company-meta">RNC: ${companyInfo.rnc}</div>` : ''}
                            <div class="document-type">${docType}</div>
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
                            <div class="info-value" style="color: ${statusColor};">${statusLabel}</div>
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
                                    <td class="text-right amount">$${formatMoney(Number(item.base_salary) || 0)}</td>
                                    ${showBonuses ? `<td class="text-right amount">$${formatMoney(Number(item.bonuses) || 0)}</td>` : ''}
                                    <td class="text-right amount">$${formatMoney(Number(item.tss) || 0)}</td>
                                    ${showInfotep ? `<td class="text-right amount">$${formatMoney(Number(item.infotep) || 0)}</td>` : ''}
                                    ${showDeductions ? `<td class="text-right amount">$${formatMoney(Number(item.deductions) || 0)}</td>` : ''}
                                    <td class="text-right net-amount-cell">$${formatMoney(Number(item.net_salary) || 0)}</td>
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
                            <div class="total-footer">Monto neto desembolsado</div>
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
                            <strong>Certificación:</strong> Resumen oficial consolidado correspondiente al período de nómina indicado.
                            <br>
                            Generado automáticamente por el Sistema de Gestión de ${storeName}
                        </p>
                        <div class="app-watermark">
                            <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/cobro-logo.png" alt="Cobro">
                            <span>Cobro</span>
                        </div>
                    </div>
                </div>

                <!-- PÁGINAS 2..N: COMPROBANTES INDIVIDUALES POR EMPLEADO -->
                ${vouchersHtml}
            </div>

            <script>
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        window.print();
                    }, 400);
                });
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes en tu navegador para ver e imprimir el paquete de nómina');
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    console.log('[PRINT] Complete payroll package opened in new window');
};
