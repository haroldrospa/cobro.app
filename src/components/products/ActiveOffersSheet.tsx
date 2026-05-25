import React from 'react';
import { Tag, Calendar, AlertTriangle, TrendingDown } from 'lucide-react';
import { useAllActiveOffers, ProductOffer } from '@/hooks/useProductOffers';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActiveOffersSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ActiveOffersSheet: React.FC<ActiveOffersSheetProps> = ({ isOpen, onClose }) => {
    const { data: offers = [], isLoading } = useAllActiveOffers();

    // Agrupar ofertas por producto si es necesario, o mostrarlas planas
    // Aquí las mostraremos planas pero con la info del producto

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:w-[540px] px-0">
                <SheetHeader className="px-6 border-b pb-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Tag className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <SheetTitle>Ofertas Activas</SheetTitle>
                            <SheetDescription>
                                Ofertas por cantidad vigentes en tu tienda
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-100px)] px-6 py-4">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <LoadingLogo text="Cargando ofertas..." />
                        </div>
                    ) : offers.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg border-muted">
                            <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <h3 className="font-medium text-muted-foreground">No hay ofertas activas</h3>
                            <p className="text-sm text-muted-foreground mt-1 px-8">
                                Crea ofertas en la sección "Productos" editando un producto específico.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {offers.map((offer: ProductOffer & { product?: any }) => {
                                const isValid = !offer.valid_to || new Date(offer.valid_to) > new Date();
                                const expDate = offer.valid_to ? new Date(offer.valid_to) : null;
                                const isExpiringSoon = expDate && (expDate.getTime() - new Date().getTime()) < (1000 * 60 * 60 * 24 * 3); // 3 días

                                return (
                                    <Card key={offer.id} className="overflow-hidden border-l-4 border-l-primary">
                                        <CardContent className="p-4">
                                            {/* Producto Info */}
                                            <div className="flex gap-4">
                                                {/* Imagen miniatura */}
                                                <div className="h-16 w-16 bg-muted rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                                                    {offer.product?.image_url ? (
                                                        <img
                                                            src={offer.product.image_url}
                                                            alt={offer.product?.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Tag className="h-6 w-6 text-muted-foreground/30" />
                                                    )}
                                                </div>

                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-sm line-clamp-1">{offer.product?.name || 'Producto desconocido'}</h4>
                                                    <p className="text-xs text-muted-foreground mb-2">
                                                        {offer.product?.barcode && `Code: ${offer.product.barcode}`}
                                                    </p>

                                                    {/* Detalle oferta */}
                                                    <div className="flex items-center gap-2 bg-secondary/30 p-2 rounded-md">
                                                        <Badge variant="default" className="bg-primary hover:bg-primary/90">
                                                            {offer.quantity}x ${offer.offer_price.toFixed(2)}
                                                        </Badge>

                                                        {/* Cálculo rápido de precio unitario en oferta */}
                                                        <span className="text-xs font-medium text-emerald-600">
                                                            (${(offer.offer_price / offer.quantity).toFixed(2)} c/u)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer con fechas */}
                                            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {offer.valid_from ? (
                                                        <span>Desde: {format(new Date(offer.valid_from), 'd MMM yyyy', { locale: es })}</span>
                                                    ) : (
                                                        <span>Siempre activa</span>
                                                    )}
                                                </div>

                                                {offer.valid_to ? (
                                                    <div className={`flex items-center gap-1.5 font-medium ${isExpiringSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {isExpiringSoon && <AlertTriangle className="h-3.5 w-3.5" />}
                                                        <span>Expira {formatDistanceToNow(new Date(offer.valid_to), { addSuffix: true, locale: es })}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Sin expiración</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
};
