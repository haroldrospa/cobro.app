import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCcw, AlertTriangle, ReceiptText } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useCreateSale } from '@/hooks/useSales';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RefundDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const RefundDialog: React.FC<RefundDialogProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch sales based on search term (only if term is long enough to avoid fetching everything)
    const { data: sales = [], isLoading } = useSales({
        searchTerm: searchTerm.length > 2 ? searchTerm : undefined
    });

    const { data: invoiceTypes = [] } = useInvoiceTypes();
    const createSale = useCreateSale();
    const { toast } = useToast();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // The query hook will auto-refetch when searchTerm changes
    };

    const handleSelectSale = (sale: any) => {
        // Prevent selecting already refunded sales if possible (checking status)
        // For MVP we warn user
        setSelectedSale(sale);
    };

    const handleProcessRefund = async () => {
        if (!selectedSale) return;

        // Confirm
        if (!confirm(`¿Estás seguro de procesar la devolución de la factura ${selectedSale.invoice_number}? Esto generará una Nota de Crédito y devolverá los artículos al inventario.`)) {
            return;
        }

        setIsProcessing(true);

        try {
            // Find B04 invoice type
            const refundType = invoiceTypes.find(t => t.code === 'B04');
            const refundTypeId = refundType?.id;

            if (!refundTypeId) {
                toast({
                    variant: "destructive",
                    title: "Error de configuración",
                    description: "No se encontró el tipo de comprobante B04 (Nota de Crédito). Contacte soporte."
                });
                setIsProcessing(false);
                return;
            }

            // Prepare refund items (negative quantities)
            const refundItems = selectedSale.sale_items.map((item: any) => ({
                id: item.product.id || item.product_id, // Ensure we have the ID for stock update
                name: item.product?.name || 'Producto',
                price: item.unit_price,
                quantity: -Math.abs(item.quantity), // Negative quantity returns stock
                tax: (item.tax_percentage || 18) / 100,
                cost_includes_tax: false // Assuming standard
            }));

            // Calculate negative totals
            const refundTotal = -Math.abs(selectedSale.total);
            const refundSubtotal = -Math.abs(selectedSale.subtotal);
            const refundTax = -Math.abs(selectedSale.tax_total);

            // Execute "Sale" (Refund)
            await createSale.mutateAsync({
                customer_id: selectedSale.customer_id,
                invoice_type_id: refundTypeId,
                subtotal: refundSubtotal,
                discount_total: 0, // Simplified: usually we reverse discount too? keeping 0 for now to be safe or -discount
                tax_total: refundTax,
                total: refundTotal,
                payment_method: selectedSale.payment_method, // Refund method matches payment
                amount_received: refundTotal, // Paid back
                change_amount: 0,
                payment_status: 'paid', // Use 'paid' to satisfy DB constraint (it is settled)
                items: refundItems
            });

            toast({
                title: "Devolución Exitosa",
                description: `Se ha generado la nota de crédito para ${selectedSale.invoice_number}`
            });

            // Optional: Update original sale status to 'refunded' via separate call?
            // For now, tracking via the new B04 record is the official accounting way.

            onClose();
            setSearchTerm('');
            setSelectedSale(null);

        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo procesar la devolución: " + error.message
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                className="!flex !flex-col !p-0 !overflow-hidden !max-w-[95vw] sm:!max-w-3xl lg:!max-w-4xl w-full !h-[90dvh] !max-h-[90dvh] bg-[#0a0a0a] border-zinc-900 !rounded-[2rem] shadow-2xl"
                centerOnMobile={true}
            >
                <div className="p-4 sm:p-6 border-b border-zinc-900 bg-transparent flex flex-col gap-3 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                            <RefreshCcw className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-500" />
                            Procesar Devolución / Reembolso
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-[9px] sm:text-[10px] font-medium">
                            Busque la factura original para generar una Nota de Crédito
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                        <Input
                            placeholder="Buscar por NCF (ej. B02...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 pl-10 bg-zinc-900 border-zinc-800/80 rounded-lg text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-500/30 text-xs sm:text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden px-3 sm:px-6 flex flex-col sm:flex-row gap-4 min-h-0">
                    {/* List of Results */}
                    <div className={cn(
                        "transition-all duration-300 border border-zinc-900 rounded-2xl overflow-y-auto bg-zinc-950/20 flex-1 min-h-0 no-scrollbar",
                        selectedSale ? "w-full sm:w-1/2 max-h-[160px] sm:max-h-[450px]" : "w-full max-h-[360px] sm:max-h-[450px]"
                    )}>
                        <Table>
                            <TableHeader className="bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
                                <TableRow className="border-zinc-900 hover:bg-transparent">
                                    <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider py-2.5">NCF</TableHead>
                                    <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Fecha</TableHead>
                                    <TableHead className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-zinc-500 text-xs font-bold uppercase tracking-wider">Buscando...</TableCell>
                                    </TableRow>
                                ) : sales.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={3} className="text-center py-8 text-zinc-600 text-xs font-semibold">
                                            {searchTerm.length > 2 ? 'No se encontraron facturas' : 'Ingrese al menos 3 caracteres'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale: any) => (
                                        <TableRow
                                            key={sale.id}
                                            className={cn(
                                                "border-zinc-900/60 hover:bg-zinc-900/40 transition-colors cursor-pointer",
                                                selectedSale?.id === sale.id ? "bg-zinc-900/60" : ""
                                            )}
                                            onClick={() => handleSelectSale(sale)}
                                        >
                                            <TableCell className="font-semibold text-xs text-white">{sale.invoice_number}</TableCell>
                                            <TableCell className="text-xs text-zinc-400">{format(new Date(sale.created_at), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-black text-xs text-emerald-500">
                                                RD$ {sale.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                {sale.total < 0 && <span className="block text-[7px] text-red-500 font-bold uppercase tracking-wider mt-0.5">Reembolso</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Selected Sale Details */}
                    {selectedSale && (
                        <div className="w-full sm:w-1/2 flex flex-col min-h-0 overflow-y-auto border border-zinc-900 rounded-2xl bg-zinc-900/10 p-4 gap-3 animate-in fade-in slide-in-from-bottom-5 sm:slide-in-from-right-10">
                            <div>
                                <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-1.5">
                                    <ReceiptText className="h-4 w-4 text-zinc-500" />
                                    Detalles de Factura
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/20 p-3 border border-zinc-900 rounded-xl">
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cliente</p>
                                        <p className="font-semibold text-zinc-300 truncate">{selectedSale.customer?.name || 'Cliente General'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Fecha</p>
                                        <p className="font-semibold text-zinc-300 truncate">{format(new Date(selectedSale.created_at), 'dd/MM/yy hh:mm a')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-zinc-900 rounded-xl bg-zinc-950/20 overflow-hidden mb-1 flex-1 min-h-[100px] overflow-y-auto no-scrollbar">
                                <Table>
                                    <TableHeader className="bg-zinc-900/30">
                                        <TableRow className="border-zinc-900/60">
                                            <TableHead className="h-8 py-1 text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Item</TableHead>
                                            <TableHead className="h-8 py-1 text-[8px] font-bold text-zinc-500 uppercase tracking-wider text-right">Cant</TableHead>
                                            <TableHead className="h-8 py-1 text-[8px] font-bold text-zinc-500 uppercase tracking-wider text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedSale.sale_items?.map((item: any) => (
                                            <TableRow key={item.id} className="border-zinc-900/40 hover:bg-transparent">
                                                <TableCell className="py-1.5 text-xs text-zinc-300 font-medium truncate max-w-[120px]">{item.product?.name || 'Item'}</TableCell>
                                                <TableCell className="py-1.5 text-xs text-zinc-400 text-right font-semibold">{item.quantity}</TableCell>
                                                <TableCell className="py-1.5 text-xs text-zinc-200 text-right font-black">RD$ {item.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-auto shrink-0">
                                {selectedSale.total < 0 ? (
                                    <div className="flex items-center justify-center p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        <span>Esta factura ya es un reembolso</span>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full h-auto py-2.5 px-4 whitespace-normal text-xs font-bold leading-tight rounded-xl flex items-center justify-center"
                                        variant="destructive"
                                        onClick={handleProcessRefund}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Procesando...' : 'Generar Nota de Crédito (Reembolso Total)'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="shrink-0 flex justify-end p-4 border-t border-zinc-900 mt-2">
                    <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white rounded-lg">Cancelar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RefundDialog;
