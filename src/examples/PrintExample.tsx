import React, { useEffect } from 'react';
import { handlePrint, usePrintStyles, markContentAsPrintable } from '@/utils/printHandler';

/**
 * Componente de ejemplo: Invoice
 * Muestra cómo integrar el sistema de impresión en tu componente
 */
export const InvoiceExample: React.FC = () => {
    // Inyectar estilos de impresión automáticamente
    usePrintStyles();

    useEffect(() => {
        // Marcar el contenido como imprimible cuando el componente se monta
        markContentAsPrintable('invoice-content');
    }, []);

    const handlePrintClick = (format: '80mm' | '58mm' | 'A4') => {
        handlePrint(format);
    };

    return (
        <div>
            {/* Botones de impresión (no se imprimirán) */}
            <div className="no-print" style={{ marginBottom: '20px' }}>
                <button onClick={() => handlePrintClick('80mm')}>
                    Imprimir 80mm (Térmico)
                </button>
                <button onClick={() => handlePrintClick('58mm')}>
                    Imprimir 58mm (Térmico Pequeño)
                </button>
                <button onClick={() => handlePrintClick('A4')}>
                    Imprimir A4 (Estándar)
                </button>
            </div>

            {/* Contenido de la factura (SE IMPRIMIRÁ) */}
            <div id="invoice-content" className="printable-content">
                <h1>FACTURA #001234</h1>

                <div>
                    <h2>Información de la Empresa</h2>
                    <p>Nombre: Mi Empresa S.A.</p>
                    <p>RNC: 123-456789-0</p>
                    <p>Dirección: Calle Principal, Santo Domingo</p>
                    <p>Teléfono: (809) 555-1234</p>
                </div>

                <div>
                    <h2>Detalles de la Factura</h2>
                    <p>Fecha: {new Date().toLocaleDateString()}</p>
                    <p>Cliente: Juan Pérez</p>
                    <p>RNC Cliente: 987-654321-0</p>
                </div>

                <div>
                    <h3>Productos</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Cant.</th>
                                <th>Descripción</th>
                                <th>P. Unit</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>2</td>
                                <td>Producto A</td>
                                <td>$100.00</td>
                                <td>$200.00</td>
                            </tr>
                            <tr>
                                <td>1</td>
                                <td>Producto B</td>
                                <td>$50.00</td>
                                <td>$50.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ textAlign: 'right', marginTop: '20px' }}>
                    <p><strong>Subtotal:</strong> $250.00</p>
                    <p><strong>ITBIS (18%):</strong> $45.00</p>
                    <p style={{ fontSize: '1.2em' }}><strong>TOTAL:</strong> $295.00</p>
                </div>

                <div style={{ textAlign: 'center', marginTop: '30px' }}>
                    <p>¡Gracias por su compra!</p>
                </div>
            </div>
        </div>
    );
};

// ===============================================
// EJEMPLO DE USO EN TU COMPONENTE EXISTENTE
// ===============================================

/**
 * Ejemplo de cómo integrar en un componente existente
 */
export const ExistingComponentIntegration = () => {
    usePrintStyles(); // Solo necesitas esta línea

    const handlePrintInvoice = () => {
        // Marcar tu contenedor de factura
        markContentAsPrintable('my-invoice-container');

        // Imprimir en el formato deseado
        handlePrint('80mm'); // o '58mm' o 'A4'
    };

    return (
        <div>
            <button onClick={handlePrintInvoice} className="no-print">
                Imprimir Factura
            </button>

            <div id="my-invoice-container">
                {/* Tu contenido de factura aquí */}
            </div>
        </div>
    );
};
