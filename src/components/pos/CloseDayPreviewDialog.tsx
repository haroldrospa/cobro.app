import React, { useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, X, Eye, CheckCircle, FileText, Smartphone } from 'lucide-react';
import { CompanyInfoForPrint, PaperSize, usePrintSettings } from '@/hooks/usePrintSettings';
import { CloseDayData, generateCloseDayPDF } from '@/utils/closeDayPdfGenerator';
import { generateCloseDayHTML } from '@/utils/generateCloseDayHTML';
import { format } from 'date-fns';

interface CloseDayPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: CloseDayData | null;
    companyInfo: CompanyInfoForPrint;
    isFinalized?: boolean;
    onConfirmClose?: () => void;
    isClosingPending?: boolean;
}

export const CloseDayPreviewDialog: React.FC<CloseDayPreviewDialogProps> = ({
    isOpen,
    onClose,
    data,
    companyInfo,
    isFinalized = false,
    onConfirmClose,
    isClosingPending = false,
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { printSettings } = usePrintSettings();
    const defaultPaper = (printSettings?.paperSize === 'A4' || printSettings?.paperSize === 'carta') ? 'carta' : '80mm';
    const [selectedPaper, setSelectedPaper] = useState<PaperSize>(defaultPaper);
    const [isDownloading, setIsDownloading] = useState(false);

    const reportHTML = useMemo(() => {
        if (!data) return '';
        return generateCloseDayHTML(companyInfo, data, selectedPaper);
    }, [companyInfo, data, selectedPaper]);

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
        }
    };

    const handleDownloadPDF = async () => {
        if (!data) return;
        setIsDownloading(true);
        try {
            const doc = await generateCloseDayPDF(companyInfo, data, selectedPaper);
            doc.save(`Cierre_Caja_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
        } catch (e) {
            console.error('Error downloading closing PDF:', e);
        } finally {
            setIsDownloading(false);
        }
    };

    if (!data) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                hideCloseButton
                className="sm:max-w-4xl w-full p-0 overflow-hidden rounded-2xl border-border/40 bg-background shadow-2xl flex flex-col"
                style={{ height: 'min(92vh, 820px)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isFinalized ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                            {isFinalized ? <CheckCircle className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-sm sm:text-base tracking-tight text-foreground">
                                    {isFinalized ? '¡Cierre de Caja Finalizado!' : 'Vista Previa del Cierre'}
                                </h2>
                                <Badge className={`text-[10px] ${isFinalized ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                                    {isFinalized ? 'Cierre Guardado' : 'Borrador'}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isFinalized 
                                    ? 'Este es el comprobante oficial registrado. Puedes imprimirlo o descargarlo.' 
                                    : 'Así se imprimirá el comprobante de cierre cuando finalices el día.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Format selector */}
                        <div className="hidden sm:flex items-center bg-muted/50 p-1 rounded-xl border border-border/40 text-xs">
                            <button
                                type="button"
                                onClick={() => setSelectedPaper('80mm')}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${selectedPaper === '80mm' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Smartphone className="h-3 w-3" />
                                <span>Ticket</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPaper('carta')}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${selectedPaper === 'carta' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <FileText className="h-3 w-3" />
                                <span>Carta / A4</span>
                            </button>
                        </div>

                        <Button
                            size="sm"
                            onClick={handlePrint}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 rounded-xl h-9 px-3.5 shadow-sm"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Imprimir</span>
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="border-border text-foreground hover:bg-muted rounded-xl h-9 px-3 gap-1.5"
                        >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'PDF'}</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted ml-1"
                            title="Cerrar"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Body: Live IFrame Viewer */}
                <div className="flex-1 bg-zinc-950/20 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
                    <div className="w-full h-full bg-white rounded-xl shadow-lg border border-border/40 overflow-hidden flex items-center justify-center">
                        <iframe
                            ref={iframeRef}
                            srcDoc={reportHTML}
                            className="w-full h-full border-0 bg-white"
                            title="Vista Previa Cierre de Caja"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 border-t border-border/30 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-muted-foreground">
                        <span>Efectivo real: <strong className="text-foreground">${data.actualCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Diferencia: <strong className={data.difference === 0 ? 'text-emerald-600' : data.difference > 0 ? 'text-blue-600' : 'text-rose-600'}>
                            {data.difference === 0 ? '$0.00 (OK)' : `${data.difference > 0 ? '+' : ''}$${data.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}
                        </strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isFinalized && onConfirmClose ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="rounded-xl text-xs font-semibold"
                                >
                                    Volver a Editar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={onConfirmClose}
                                    disabled={isClosingPending}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-9 px-4 shadow-sm"
                                >
                                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                    {isClosingPending ? 'Finalizando...' : 'Confirmar y Finalizar Cierre'}
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="sm"
                                onClick={onClose}
                                className="bg-primary text-primary-foreground font-bold rounded-xl text-xs h-9 px-5"
                            >
                                Listo / Cerrar
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
