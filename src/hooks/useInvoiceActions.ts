import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { generateProfessionalPDF, CompanyInfo, SaleData } from '@/utils/invoicePdfGenerator';
import JsBarcode from 'jsbarcode';

export const useInvoiceActions = () => {
    const { toast } = useToast();
    const { settings: storeSettings } = useStoreSettings();
    const [isEmailLoading, setIsEmailLoading] = useState(false);

    const generateBarcode = (text: string): string => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, text, {
                format: "CODE128",
                width: 2.5,
                height: 65,
                displayValue: true,
                fontSize: 14,
                margin: 5
            });
            return canvas.toDataURL();
        } catch (error) {
            console.error('Error generating barcode:', error);
            return '';
        }
    };

    const handleDownloadPDF = async (companyInfo: CompanyInfo, saleData: SaleData, invoiceNumber: string) => {
        try {
            toast({
                title: "Generando Factura",
                description: "Creando PDF profesional...",
            });

            const doc = await generateProfessionalPDF(companyInfo, saleData, invoiceNumber);
            doc.save(`${invoiceNumber}.pdf`);

            toast({
                title: "PDF Descargado",
                description: `Factura ${invoiceNumber} descargada correctamente.`,
            });
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el PDF.",
            });
        }
    };

    const handleSendEmail = async (
        companyInfo: CompanyInfo,
        saleData: SaleData,
        invoiceNumber: string,
        emailAddress: string,
        onSuccess?: () => void
    ) => {
        if (!emailAddress) {
            toast({
                variant: "destructive",
                title: "Email requerido",
                description: "Por favor ingrese una dirección de email.",
            });
            return;
        }

        setIsEmailLoading(true);
        toast({
            title: "Enviando correo",
            description: "Preparando factura y enviando...",
        });

        try {
            const doc = await generateProfessionalPDF(companyInfo, saleData, invoiceNumber);
            const pdfBlob = doc.output('blob');

            const base64data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                reader.onloadend = () => {
                    const base64 = reader.result?.toString().split(',')[1];
                    if (base64) resolve(base64);
                    else reject(new Error("Error converting PDF to base64"));
                };
                reader.onerror = reject;
            });

            const barcodeDataUrl = generateBarcode(invoiceNumber);

            const response = await fetch('https://hkzgxdmnvyoviwketxva.supabase.co/functions/v1/send-invoice-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailAddress,
                    saleData: {
                        ...saleData,
                        invoiceNumber,
                        companyInfo
                    },
                    barcodeDataUrl,
                    pdfBase64: base64data,
                    emailGreeting: storeSettings?.email_greeting || '¡Hola!',
                    emailMessage: storeSettings?.email_message || 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.'
                }),
            });

            const result = await response.json();

            if (result.success) {
                toast({
                    title: "Email enviado",
                    description: `Factura enviada a ${emailAddress}`,
                });
                if (onSuccess) onSuccess();
            } else {
                throw new Error(result.error || 'Error desconocido al enviar');
            }
        } catch (error: any) {
            console.error('Error sending email:', error);
            toast({
                variant: "destructive",
                title: "Error envío",
                description: error.message || "No se pudo enviar el correo.",
            });
        } finally {
            setIsEmailLoading(false);
        }
    };

    return {
        handleDownloadPDF,
        handleSendEmail,
        isEmailLoading
    };
};
