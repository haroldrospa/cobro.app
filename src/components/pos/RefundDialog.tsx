import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCcw, AlertTriangle } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useCreateSale } from '@/hooks/useSales';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
                className="max-w-[95vw] sm:max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col bg-[#0a0a0a] border-zinc-900 rounded-[2rem] shadow-2xl"
                centerOnMobile={true}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5" />
                        Procesar Devolución / Reembolso
                    </DialogTitle>
                    <DialogDescription>
                        Busque la factura original para generar una Nota de Crédito
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2 my-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por NCF (ej. B02...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto min-h-[300px] flex gap-4">
                    {/* List of Results */}
                    <div className={`${selectedSale ? 'w-1/2' : 'w-full'} transition-all duration-300 border rounded-lg overflow-y-auto max-h-[450px]`}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>NCF</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Buscando...</TableCell>
                                    </TableRow>
                                ) : sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            {searchTerm.length > 2 ? 'No se encontraron facturas' : 'Ingrese al menos 3 caracteres'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale: any) => (
                                        <TableRow
                                            key={sale.id}
                                            className={`cursor-pointer ${selectedSale?.id === sale.id ? 'bg-muted' : ''}`}
                                            onClick={() => handleSelectSale(sale)}
                                        >
                                            <TableCell className="font-medium">{sale.invoice_number}</TableCell>
                                            <TableCell>{format(new Date(sale.created_at), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                RD$ {sale.total.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                {sale.total < 0 && <Badge variant="destructive" className="text-xs">Reembolso</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Selected Sale Details */}
                    {selectedSale && (
                        <div className="w-1/2 flex flex-col space-y-4 animate-in fade-in slide-in-from-right-10">
                            <Card className="p-4 bg-muted/30">
                                <h3 className="font-bold text-lg mb-2">Detalles de Factura</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                                    <div>
                                        <p className="text-muted-foreground">Cliente</p>
                                        <p className="font-medium">{selectedSale.customer?.name || 'Cliente General'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Fecha</p>
                                        <p className="font-medium">{format(new Date(selectedSale.created_at), 'PP p')}</p>
                                    </div>
                                </div>

                                <div className="border rounded-md bg-background overflow-hidden mb-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="h-8 py-1">Item</TableHead>
                                                <TableHead className="h-8 py-1 text-right">Cant</TableHead>
                                                <TableHead className="h-8 py-1 text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedSale.sale_items?.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="py-2 text-xs">{item.product?.name || 'Item'}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right">{item.quantity}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right">${item.total.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {selectedSale.total < 0 ? (
                                    <div className="flex items-center justify-center p-4 bg-yellow-500/10 text-yellow-600 rounded-lg">
                                        <AlertTriangle className="h-5 w-5 mr-2" />
                                        <span>Esta factura ya es un reembolso</span>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        onClick={handleProcessRefund}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Procesando...' : 'Generar Nota de Crédito (Reembolso Total)'}
                                    </Button>
                                )}
                            </Card>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-4">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RefundDialog;
