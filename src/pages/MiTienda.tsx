import React, { useState } from 'react';
import { ShoppingCart, Store, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCreateOpenOrder } from '@/hooks/useOpenOrders';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface CartItem {
  product: Product;
  quantity: number;
}

const MiTienda: React.FC = () => {
  const { data: products = [], isLoading } = useProducts();
  const createOpenOrder = useCreateOpenOrder();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const activeProducts = products.filter(p => p.status === 'active' && (p.stock ?? 0) > 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock ?? 0) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: 'Agregado al carrito', description: product.name });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > (item.product.stock ?? 0)) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = item.product.price;
    const tax = item.product.tax_percentage ?? 18;
    const priceWithTax = item.product.cost_includes_tax ? price : price * (1 + tax / 100);
    return sum + priceWithTax * item.quantity;
  }, 0);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartTax = cartTotal - cartSubtotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const items = cart.map(item => {
        const taxPercentage = item.product.tax_percentage ?? 18;
        const unitPrice = item.product.price;
        const subtotal = unitPrice * item.quantity;
        const taxAmount = subtotal * (taxPercentage / 100);
        const total = subtotal + taxAmount;

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total: total
        };
      });

      await createOpenOrder.mutateAsync({
        customer_name: customerName || 'Cliente Web',
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        payment_method: 'pending',
        subtotal: cartSubtotal,
        discount_total: 0,
        tax_total: cartTax,
        total: cartTotal,
        items,
      });

      toast({ 
        title: '¡Pedido recibido!', 
        description: 'Tu pedido será procesado pronto.' 
      });
      
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'No se pudo procesar el pedido.', 
        variant: 'destructive' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Mi Tienda</h1>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="relative" 
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Carrito
            {cart.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Nuestros Productos</h2>
        
        {activeProducts.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {activeProducts.map(product => (
              <Card key={product.id} className="group overflow-hidden hover:shadow-lg transition-shadow">
                {product.image_url ? (
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <Store className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                      {product.category && (
                        <p className="text-sm text-muted-foreground">{product.category.name}</p>
                      )}
                    </div>
                    {(product.stock ?? 0) <= (product.min_stock ?? 0) && (
                      <Badge variant="secondary" className="text-xs">Últimos</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-2">${product.price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Stock: {product.stock}</p>
                </CardContent>
                
                <CardFooter className="p-4 pt-0">
                  <Button 
                    className="w-full" 
                    onClick={() => addToCart(product)}
                    disabled={(product.stock ?? 0) <= 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar al Carrito
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Tu Carrito
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Tu carrito está vacío
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {item.product.image_url ? (
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Store className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">${item.product.price.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ITBIS</span>
                  <span>${cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button className="w-full" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                  Proceder al Pago
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre (opcional)</label>
              <Input 
                placeholder="Tu nombre" 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Teléfono (opcional)</label>
              <Input 
                placeholder="Tu teléfono" 
                value={customerPhone} 
                onChange={e => setCustomerPhone(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email (opcional)</label>
              <Input 
                type="email" 
                placeholder="Tu email" 
                value={customerEmail} 
                onChange={e => setCustomerEmail(e.target.value)} 
              />
            </div>

            <Separator />

            <div className="flex justify-between font-bold text-lg">
              <span>Total a Pagar</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCheckout} disabled={createOpenOrder.isPending}>
              {createOpenOrder.isPending ? 'Procesando...' : 'Confirmar Pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MiTienda;
