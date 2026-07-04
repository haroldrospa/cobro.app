/**
 * Sistema de impresión con soporte multi-formato
 * Soporta: 80mm (papel térmico), 58mm/58mm (papel térmico pequeño), A4 (estándar)
 */

export type PrintFormat = '80mm' | '58mm' | '58mm' | 'A4';

/**
 * Maneja la impresión aplicando estilos específicos según el formato
 * @param format - Formato de papel deseado
 * @returns Promise que se resuelve cuando se completa la impresión
 */
export const handlePrint = async (format: PrintFormat): Promise<void> => {
  // Determinar la clase CSS a aplicar
  const printClass = `print-${format.toLowerCase()}`;

  // Obtener el body
  const body = document.body;

  // Guardar clases originales
  const originalClasses = body.className;

  try {
    // Aplicar la clase de impresión
    body.classList.add(printClass);

    // Wait for all images inside the printable content (or body) to load completely
    const printableContent = document.querySelector('.printable-content');
    const images = (printableContent || document).querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Resolve even on error to avoid hanging forever
      });
    });
    // Give it a max timeout of 2.5 seconds to avoid freezing the UI if something is stuck
    await Promise.race([
      Promise.all(imagePromises),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);

    // Pequeño delay para asegurar que el DOM se actualice
    await new Promise(resolve => setTimeout(resolve, 100));

    // Ejecutar la impresión
    window.print();

    // Esperar a que el diálogo de impresión se cierre
    // Nota: No hay evento directo, pero podemos usar un pequeño delay
    await new Promise(resolve => setTimeout(resolve, 500));

  } finally {
    // Restaurar las clases originales
    body.className = originalClasses;
  }
};

/**
 * Inyecta dinámicamente los estilos de impresión en el documento
 * Debe llamarse una vez al iniciar la aplicación
 */
export const injectPrintStyles = (): void => {
  // Obtener configuración guardada o valores por defecto
  const localSettings = JSON.parse(localStorage.getItem('print_margins_settings') || '{}');
  const baseFontSize = parseInt(localSettings.fontSize || '12');

  // Calcular tamaños relativos
  const sizeH1 = Math.round(baseFontSize * 1.5); // Ej: 12 -> 18px
  const sizeH2 = Math.round(baseFontSize * 1.3); // Ej: 12 -> 16px
  const sizeH3 = Math.round(baseFontSize * 1.1); // Ej: 12 -> 13px
  const sizeTable = Math.round(baseFontSize * 0.9); // Ej: 12 -> 11px
  const sizeSmall = Math.round(baseFontSize * 0.85); // Ej: 12 -> 10px

  // Verificar si ya existe el elemento de estilo para actualizarlo
  let styleElement = document.getElementById('dynamic-print-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-print-styles';
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = `
    /* ============================================
       ESTILOS DE IMPRESIÓN GLOBAL
       Generado dinámicamente: Base Font Size ${baseFontSize}px
       ============================================ */
    
    @media print {
      /* Configuración base para todos los formatos */
      @page {
        size: auto;
        margin: 0mm;
      }
      
      html, body {
        margin: 0;
        padding: 0;
        background: white !important;
        color: black !important;
      }
      
      /* Ocultar elementos de UI que no deben imprimirse */
      .no-print,
      nav,
      header,
      footer,
      .sidebar,
      .menu,
      button,
      .btn,
      [role="navigation"],
      [role="banner"],
      [role="complementary"] {
        display: none !important;
      }
      
      /* Asegurar que solo se imprima el contenido principal */
      body > *:not(.printable-content) {
        display: none !important;
      }
      
      .printable-content {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        color: black !important;
      }
      
      .printable-content * {
        color: black !important;
      }
    }
    
    /* ============================================
       FORMATO 80MM (PAPEL TÉRMICO ESTÁNDAR)
       ============================================ */
    
    @media print {
      body.print-80mm {
        width: 80mm !important;
        max-width: 80mm !important;
      }
      
      body.print-80mm * {
        max-width: 80mm !important;
      }
      
      body.print-80mm .printable-content {
        width: 80mm !important;
        max-width: 80mm !important;
        font-family: 'Courier New', Courier, monospace;
        font-size: ${baseFontSize}px;
        line-height: 1.3;
        padding: 2mm;
        box-sizing: border-box;
      }
      
      body.print-80mm h1 {
        font-size: ${sizeH1}px;
        margin: 2mm 0;
        text-align: center;
      }
      
      body.print-80mm h2 {
        font-size: ${sizeH2}px;
        margin: 1.5mm 0;
      }
      
      body.print-80mm h3 {
        font-size: ${sizeH3}px;
        margin: 1mm 0;
      }
      
      body.print-80mm p, 
      body.print-80mm div {
        margin: 0.5mm 0;
      }
      
      body.print-80mm table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${sizeTable}px;
      }
      
      body.print-80mm td, 
      body.print-80mm th {
        padding: 1mm;
        text-align: left;
      }

      /* Clases de utilidad para tamaños específicos */
      body.print-80mm .text-xs, 
      body.print-80mm .text-small {
          font-size: ${sizeSmall}px !important;
      }
      body.print-80mm .text-lg, 
      body.print-80mm .text-large {
          font-size: ${sizeH2}px !important;
      }
      body.print-80mm .font-bold {
          font-weight: bold !important;
      }
    }
    
    /* ============================================
       FORMATO 58MM / 50MM (PAPEL TÉRMICO PEQUEÑO)
       ============================================ */
    
    @media print {
      body.print-58mm,
      body.print-58mm {
        width: 58mm !important;
        max-width: 58mm !important;
      }
      
      body.print-58mm *,
      body.print-58mm * {
        max-width: 58mm !important;
      }
      
      body.print-58mm .printable-content,
      body.print-58mm .printable-content {
        width: 58mm !important;
        max-width: 58mm !important;
        font-family: 'Courier New', Courier, monospace;
        font-size: ${Math.max(8, baseFontSize - 2)}px;
        line-height: 1.2;
        padding: 1mm;
        box-sizing: border-box;
      }
      
      body.print-58mm h1,
      body.print-58mm h1 {
        font-size: ${Math.max(10, sizeH1 - 2)}px;
        margin: 1mm 0;
        text-align: center;
      }
      
      body.print-58mm h2,
      body.print-58mm h2 {
        font-size: ${Math.max(9, sizeH2 - 2)}px;
        margin: 0.8mm 0;
      }
      
      body.print-58mm h3,
      body.print-58mm h3 {
        font-size: ${Math.max(8, sizeH3 - 2)}px;
        margin: 0.5mm 0;
      }
      
      body.print-58mm p,
      body.print-58mm div,
      body.print-58mm p,
      body.print-58mm div {
        margin: 0.3mm 0;
      }
      
      body.print-58mm table,
      body.print-58mm table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${Math.max(7, sizeTable - 2)}px;
      }
      
      body.print-58mm td,
      body.print-58mm th,
      body.print-58mm td,
      body.print-58mm th {
        padding: 0.5mm;
        text-align: left;
      }
    }
    
    /* ============================================
       FORMATO A4 (PAPEL ESTÁNDAR)
       ============================================ */
    
    @media print {
      body.print-a4 {
        width: 210mm !important;
      }
      
      body.print-a4 @page {
        size: A4 portrait;
        margin: 15mm 20mm;
      }
      
      body.print-a4 .printable-content {
        width: 100%;
        max-width: 170mm;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        padding: 10mm;
        box-sizing: border-box;
      }
      
      body.print-a4 h1 {
        font-size: 20pt;
        margin: 5mm 0;
        text-align: center;
        border-bottom: 2px solid #333;
        padding-bottom: 3mm;
      }
      
      body.print-a4 h2 {
        font-size: 16pt;
        margin: 4mm 0;
        border-bottom: 1px solid #666;
        padding-bottom: 2mm;
      }
      
      body.print-a4 h3 {
        font-size: 13pt;
        margin: 3mm 0;
      }
      
      body.print-a4 p {
        margin: 2mm 0;
      }
      
      body.print-a4 table {
        width: 100%;
        border-collapse: collapse;
        margin: 3mm 0;
      }
      
      body.print-a4 th {
        background-color: #f0f0f0;
        font-weight: bold;
        padding: 3mm;
        border: 1px solid #999;
      }
      
      body.print-a4 td {
        padding: 3mm;
        border: 1px solid #ccc;
      }
      
      /* Evitar saltos de página no deseados */
      body.print-a4 table,
      body.print-a4 tr,
      body.print-a4 img {
        page-break-inside: avoid;
      }
      
      body.print-a4 h1,
      body.print-a4 h2,
      body.print-a4 h3 {
        page-break-after: avoid;
      }
    }
  `;
};

/**
 * Hook de conveniencia para usar en componentes React
 * Inyecta los estilos automáticamente
 */
export const usePrintStyles = (): void => {
  if (typeof window !== 'undefined') {
    injectPrintStyles();
  }
};

/**
 * Función auxiliar para preparar el contenido para impresión
 * Agrega la clase 'printable-content' al elemento que contiene la factura
 */
export const markContentAsPrintable = (elementId: string): void => {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.add('printable-content');
  }
};

/**
 * Función auxiliar para limpiar el marcado de impresión
 */
export const unmarkContentAsPrintable = (elementId: string): void => {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove('printable-content');
  }
};
