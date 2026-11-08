import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Convierte el HTML exacto de la factura (el mismo generado para imprimir)
 * en un documento PDF de alta fidelidad visual y resolución nítida.
 */
export const generateCleanInvoicePDF = async (
  htmlContent: string,
  paperSize: string = 'carta'
): Promise<jsPDF> => {
  const normPaper = (paperSize || 'carta').toLowerCase();
  const is58mm = normPaper === '58mm';
  const is80mm = normPaper === '80mm';
  const isA4 = normPaper === 'a4';
  const isCarta = normPaper === 'carta' || normPaper === 'letter' || (!is58mm && !is80mm && !isA4);
  const isFullPage = isCarta || isA4;

  // Ancho en píxeles para el renderizado del documento (DPI web estándar 96)
  // Carta: 8.5in * 96 = 816px | A4: 8.27in * 96 ≈ 794px | 80mm ≈ 302px | 58mm ≈ 220px
  const containerWidthPx = isCarta ? 816 : (isA4 ? 794 : (is58mm ? 220 : 302));

  // Crear un iframe aislado en el DOM para evitar que estilos globales o temas interfieran
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = `${containerWidthPx}px`;
  iframe.style.height = isFullPage ? '1056px' : '2000px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('No se pudo inicializar el entorno de renderizado para el PDF.');
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Esperar a que las imágenes (logo, QR, etc.) y fuentes terminen de cargar
    const images = Array.from(iframeDoc.images);
    await Promise.all([
      ...images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2500); // Timeout de seguridad
        });
      }),
      new Promise(resolve => setTimeout(resolve, 350))
    ]);

    // Seleccionar el contenedor principal de la factura
    const targetElement = (iframeDoc.querySelector('.invoice-sheet') || iframeDoc.querySelector('.invoice-container') || iframeDoc.body) as HTMLElement;
    const contentHeight = Math.max(targetElement?.scrollHeight || 0, iframeDoc.body.scrollHeight || 0, isFullPage ? 1056 : 400);
    iframe.style.height = `${contentHeight}px`;

    // Renderizar con html2canvas en 2x (nitidez profesional)
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: containerWidthPx,
    });

    let pdf: jsPDF;

    if (isFullPage) {
      const pdfFormat = isCarta ? 'letter' : 'a4';
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: pdfFormat
      });

      const pageWidthMm = isCarta ? 215.9 : 210;
      const pageHeightMm = isCarta ? 279.4 : 297;

      const imgWidthMm = pageWidthMm;
      const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      let heightLeftMm = imgHeightMm;
      let positionMm = 0;

      pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm, undefined, 'FAST');
      heightLeftMm -= pageHeightMm;

      // Si la factura excede 1 página (muchos ítems), paginar limpiamente
      while (heightLeftMm > 3) {
        positionMm -= pageHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm, undefined, 'FAST');
        heightLeftMm -= pageHeightMm;
      }
    } else {
      // Formato térmico (80mm o 58mm): PDF con altura dinámica que coincide con el ticket
      const widthMm = is58mm ? 58 : 80;
      const heightMm = Math.max(50, (canvas.height * widthMm) / canvas.width);

      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm]
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    }

    return pdf;
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
};

/**
 * Genera y descarga directamente el archivo PDF de la factura con el mismo formato que al imprimir
 */
export const downloadCleanInvoicePDF = async (
  htmlContent: string,
  invoiceNumber: string,
  paperSize: string = 'carta'
): Promise<void> => {
  const doc = await generateCleanInvoicePDF(htmlContent, paperSize);
  const fileName = `${invoiceNumber || 'Factura'}.pdf`;
  doc.save(fileName);
};
