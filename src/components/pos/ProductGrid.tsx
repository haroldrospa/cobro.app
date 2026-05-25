
import React from 'react';
import { Plus, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/hooks/useProducts';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart }) => {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron productos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
      {products.map((product) => (
        <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm line-clamp-2">{product.name}</h4>
                {product.status === 'low_stock' && (
                  <Badge variant="destructive" className="text-xs">
                    Bajo
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {product.category?.name}
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">${(product.price || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {product.stock}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => onAddToCart(product)}
                  disabled={product.track_inventory !== false && product.stock <= 0}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProductGrid;
