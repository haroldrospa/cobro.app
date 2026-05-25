import React, { useState } from 'react';
import { Plus, Trash2, Tag, TrendingDown, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    useProductOffers,
    useCreateOffer,
    useUpdateOffer,
    useDeleteOffer,
    ProductOffer,
} from '@/hooks/useProductOffers';

interface ProductOffersManagerProps {
    productId?: string;
    productPrice: number;
}

export const ProductOffersManager: React.FC<ProductOffersManagerProps> = ({
    productId,
    productPrice,
}) => {
    const [newQuantity, setNewQuantity] = useState<string>('');
    const [newPrice, setNewPrice] = useState<string>('');
    const [expiryDate, setExpiryDate] = useState<string>('');
    const [isOffersOpen, setIsOffersOpen] = useState(false);

    const { data: offers = [], isLoading } = useProductOffers(productId);
    const createOffer = useCreateOffer();
    const updateOffer = useUpdateOffer();
    const deleteOffer = useDeleteOffer();

    const handleCreateOffer = () => {
        const quantity = parseFloat(newQuantity);
        const price = parseFloat(newPrice);

        if (!productId) {
            alert('Primero guarda el producto antes de agregar ofertas.');
            return;
        }

        if (!quantity || quantity <= 0) {
            alert('La cantidad debe ser mayor a 0.');
            return;
        }

        if (!price || price <= 0) {
            alert('El precio debe ser mayor a 0.');
            return;
        }

        const normalPrice = quantity * productPrice;
        if (price >= normalPrice) {
            const confirm = window.confirm(
                `⚠️ El precio de oferta ($${price}) es mayor o igual al precio normal ($${normalPrice.toFixed(2)}).\n\n¿Estás seguro de crear esta oferta?`
            );
            if (!confirm) return;
        }

        createOffer.mutate(
            {
                product_id: productId,
                quantity,
                offer_price: price,
                is_active: true,
                valid_to: expiryDate ? new Date(expiryDate + 'T23:59:59').toISOString() : undefined,
            },
            {
                onSuccess: () => {
                    setNewQuantity('');
                    setNewPrice('');
                    setExpiryDate('');
                },
            }
        );
    };

    const handleDeleteOffer = (offer: ProductOffer) => {
        if (window.confirm(`¿Eliminar la oferta de ${offer.quantity} unidades por $${offer.offer_price}?`)) {
            deleteOffer.mutate({ id: offer.id, product_id: offer.product_id });
        }
    };

    const calculateSavings = (quantity: number, offerPrice: number) => {
        const normalPrice = quantity * productPrice;
        const savings = normalPrice - offerPrice;
        const discountPercent = ((savings / normalPrice) * 100).toFixed(0);
        return { savings, discountPercent };
    };

    if (!productId) {
        return (
            <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center">
                <Tag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                    Guarda el producto primero para poder agregar ofertas
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <button
                type="button"
                onClick={() => setIsOffersOpen(!isOffersOpen)}
                className="flex items-center w-full justify-between focus:outline-none"
            >
                <div className="flex flex-col items-start text-left">
                    <Label className="text-base font-semibold cursor-pointer">Ofertas por Cantidad</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Ej: 2 unidades por $150 (en lugar de $200)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
                    </Badge>
                    {isOffersOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
            </button>

            {isOffersOpen && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                    {/* Lista de ofertas existentes */}
                    {offers.length > 0 && (
                        <div className="space-y-2">
                            {offers.map((offer) => {
                                const { savings, discountPercent } = calculateSavings(offer.quantity, offer.offer_price);
                                const normalPrice = offer.quantity * productPrice;

                                return (
                                    <Card key={offer.id} className="border-emerald-200 bg-emerald-50/50">
                                        <CardContent className="p-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="bg-emerald-100 rounded-full p-2">
                                                    <TrendingDown className="h-4 w-4 text-emerald-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="font-bold text-emerald-700">
                                                            {offer.quantity} unidades
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">por</span>
                                                        <span className="font-bold text-lg text-emerald-600">
                                                            ${offer.offer_price.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="line-through">
                                                            Precio normal: ${normalPrice.toFixed(2)}
                                                        </span>
                                                        <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                                                            -{discountPercent}%
                                                        </Badge>
                                                        <span className="text-emerald-600 font-medium">
                                                            Ahorro: ${savings.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {offer.valid_to && (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                                                            <Calendar className="h-3 w-3" />
                                                            <span>Expira: {format(new Date(offer.valid_to), 'd MMM yyyy', { locale: es })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteOffer(offer)}
                                                disabled={deleteOffer.isPending}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Formulario para nueva oferta */}
                    <Card className="border-dashed">
                        <CardContent className="p-4">
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="offer-quantity" className="text-xs">
                                            Cantidad Mínima
                                        </Label>
                                        <Input
                                            id="offer-quantity"
                                            type="number"
                                            step="any"
                                            min="0.001"
                                            placeholder="2"
                                            value={newQuantity}
                                            onChange={(e) => setNewQuantity(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="offer-price" className="text-xs">
                                            Precio Total ($)
                                        </Label>
                                        <Input
                                            id="offer-price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="150.00"
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="space-y-1.5 col-span-2">
                                        <Label htmlFor="offer-expiry" className="text-xs">
                                            Fecha de Expiración (Opcional)
                                        </Label>
                                        <Input
                                            id="offer-expiry"
                                            type="date"
                                            min={new Date().toISOString().split('T')[0]}
                                            value={expiryDate}
                                            onChange={(e) => setExpiryDate(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>

                                {/* Vista previa */}
                                {newQuantity && newPrice && parseFloat(newQuantity) > 0 && parseFloat(newPrice) > 0 && (
                                    <div className="bg-muted/50 rounded-md p-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Vista previa:</span>
                                            <div className="font-medium">
                                                {newQuantity}x ${productPrice.toFixed(2)} = $
                                                {(parseFloat(newQuantity) * productPrice).toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-emerald-600 font-medium">Con oferta:</span>
                                            <div className="font-bold text-emerald-600">
                                                ${parseFloat(newPrice).toFixed(2)}
                                                <span className="text-[10px] ml-1 text-muted-foreground">
                                                    (ahorro: $
                                                    {(parseFloat(newQuantity) * productPrice - parseFloat(newPrice)).toFixed(2)})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    onClick={handleCreateOffer}
                                    disabled={createOffer.isPending || !newQuantity || !newPrice}
                                    className="w-full h-9"
                                    size="sm"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Agregar Oferta
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {offers.length === 0 && (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                            No hay ofertas configuradas. Agrega una oferta para incrementar las ventas.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
