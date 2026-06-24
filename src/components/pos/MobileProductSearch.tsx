import React, { useState } from 'react';
import { Search, Package, Barcode, Hash, Tag, Asterisk, Settings2, LayoutGrid, List as ListIcon, RefreshCcw, Plus, ShoppingCart, Minus, Utensils, ShoppingBag, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/hooks/useProducts';
import { CartItem } from '@/types/pos';
import { useBusinessType } from '@/hooks/useBusinessType';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import VariablePriceDialog from './VariablePriceDialog';
import appLogo from '@/assets/cobro-logo.png';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePOSSearch } from '@/contexts/POSSearchContext';

interface MobileProductSearchProps {
  products: Product[];
  cart?: CartItem[];
  onAddToCart: (product: Product, quantity?: number, forcedPrice?: number) => void;
  onUpdateQuantity?: (id: string, q: number) => void;
  onRemoveFromCart?: (id: string) => void;
  menuButton?: React.ReactNode;
  actionButton?: React.ReactNode;
  gridCols?: number;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onGridColsChange?: (cols: number) => void;
  mode?: 'classic' | 'catalog';
  onLayoutModeChange?: (mode: 'classic' | 'catalog') => void;
  orderType?: 'dine-in' | 'takeout';
  onOrderTypeChange?: (type: 'dine-in' | 'takeout') => void;
  onSearchFocus?: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  companyLogo?: string;
  userName?: string;
}

type SearchType = 'all' | 'name' | 'barcode' | 'id' | 'category';

export interface MobileProductSearchHandle {
  focus: () => void;
}

const MobileProductSearch = React.forwardRef<MobileProductSearchHandle, MobileProductSearchProps>((props, ref) => {
  const {
    products,
    cart,
    onAddToCart,
    menuButton,
    actionButton,
    gridCols = 2,
    viewMode = 'grid',
    onViewModeChange,
    onGridColsChange,
    mode = 'catalog',
    onLayoutModeChange,
    orderType = 'dine-in',
    onOrderTypeChange,
    onSearchFocus,
    isLoading,
    onRefresh,
    companyLogo,
    userName
  } = props;

  const { searchTerm, setSearchTerm } = usePOSSearch();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isVariablePriceDialogOpen, setIsVariablePriceDialogOpen] = useState(false);
  const [selectedVariableProduct, setSelectedVariableProduct] = useState<Product | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const { isRestaurant, isStore, isSupermarket, orderTypeLabels } = useBusinessType();

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      searchInputRef.current?.focus();
    }
  }));

  const minCardWidth = {
    1: '100%',
    2: '140px',
    3: '100px',
    4: '75px'
  }[gridCols] || '140px';

  const categories = React.useMemo(() => {
    const names = products
      .map(p => p.category?.name)
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
    return ['Todos', ...Array.from(new Set(names))];
  }, [products]);

  const normalizedProducts = React.useMemo(() => {
    return products.map(p => ({
      ...p,
      _name_lower: p.name?.toLowerCase() || '',
      _barcode_lower: p.barcode?.toLowerCase() || '',
      _internal_code_lower: p.internal_code?.toLowerCase() || '',
      _category_lower: p.category?.name?.toLowerCase() || '',
      _all_barcodes_lower: [
        p.barcode?.toLowerCase(),
        ...(p.barcodes?.map(b => b.barcode.toLowerCase()) ?? [])
      ].filter(Boolean) as string[]
    }));
  }, [products]);

  // Debounce search for performance — only recalculate after user stops typing (150ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 150);

  // Memoize search results to filter by category and search term
  const filteredProducts = React.useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    
    let list = normalizedProducts;

    // Filter by category if not 'Todos'
    if (selectedCategory !== 'Todos') {
      const catLower = selectedCategory.toLowerCase();
      list = list.filter(product => product._category_lower === catLower);
    }

    if (!searchLower) {
      return list.slice(0, 80);
    }

    const filtered = list.filter(product => {
      return (
        product._name_lower.includes(searchLower) ||
        product._all_barcodes_lower.some(b => b.includes(searchLower)) ||
        product._internal_code_lower.includes(searchLower) ||
        product._category_lower.includes(searchLower)
      );
    });

    return filtered.slice(0, 80);
  }, [normalizedProducts, debouncedSearchTerm, selectedCategory]);

  const handleProductSelect = (product: Product, preMatchedBundle?: any) => {
    if (product.is_variable_price) {
      setSelectedVariableProduct(product);
      setIsVariablePriceDialogOpen(true);
      return;
    }

    const searchRaw = (searchTerm || '').trim();
    const search = searchRaw.toLowerCase();
    const matchedBundle = preMatchedBundle || product.barcodes?.find(b => b.barcode.toLowerCase() === search);
    
    const bundleQty = matchedBundle ? (Number(matchedBundle.quantity) || 1) : 1;
    const bundleDiscount = matchedBundle ? (Number(matchedBundle.discount_value) || 0) : 0;
    
    if (matchedBundle && (bundleQty > 1 || bundleDiscount > 0)) {
      const type = matchedBundle.discount_type || 'percentage';
      let finalPrice = product.price;
      if (bundleDiscount > 0) {
        if (type === 'percentage') {
          finalPrice = product.price * (1 - bundleDiscount / 100);
        } else {
          finalPrice = product.price - (bundleDiscount / bundleQty);
        }
      }
      onAddToCart(product, bundleQty, finalPrice);
    } else {
      onAddToCart(product);
    }

    setSearchTerm('');
  };

  const handleVariablePriceConfirm = (price: number, name?: string) => {
    if (selectedVariableProduct) {
      const productWithPrice = { 
        ...selectedVariableProduct, 
        price: price,
        name: name || selectedVariableProduct.name
      };
      onAddToCart(productWithPrice);
      setSearchTerm('');
      setSelectedVariableProduct(null);
      setIsVariablePriceDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const search = searchTerm.toLowerCase().trim();
      if (!search) {
        if (filteredProducts.length === 1) handleProductSelect(filteredProducts[0]);
        return;
      }

      let matchedBundle: any = null;
      let exactBarcodeMatch: Product | undefined = products.find(p => {
        if (p.barcode && p.barcode.toLowerCase() === search) return true;
        const extraMatch = p.barcodes?.find(b => b.barcode.toLowerCase() === search);
        if (extraMatch) { matchedBundle = extraMatch; return true; }
        return false;
      });

      if (exactBarcodeMatch) {
        if (matchedBundle) {
          const qty = matchedBundle.quantity || 1;
          const discount = matchedBundle.discount_value || 0;
          const type = matchedBundle.discount_type || 'percentage';
          let finalPrice = exactBarcodeMatch.price;
          if (discount > 0) {
            if (type === 'percentage') finalPrice = exactBarcodeMatch.price * (1 - discount / 100);
            else finalPrice = exactBarcodeMatch.price - (discount / qty);
          }
          onAddToCart(exactBarcodeMatch, qty, finalPrice);
        } else {
          handleProductSelect(exactBarcodeMatch);
        }
        return;
      }

      if (filteredProducts.length === 1) handleProductSelect(filteredProducts[0]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* ── PREMIUM EBONY & EMERALD SEARCH BAR ── */}
      <div className="px-3 py-2 space-y-2 bg-card border-b border-emerald-500/10 sticky top-0 z-40">
        {/* Top Header Row: Menu, Profile, Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {menuButton && <div className="shrink-0">{menuButton}</div>}
            {companyLogo && (
              <div className="hidden sm:flex h-10 w-10 relative shrink-0 rounded-xl overflow-hidden bg-muted border border-border items-center justify-center p-1 shadow-xl">
                <img 
                  src={companyLogo} 
                  alt="Logo" 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            {userName && (
              <div className="hidden sm:flex flex-col shrink-0">
                <span className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest leading-none mb-1">Cajero(a)</span>
                <span className="text-[12px] font-bold text-foreground/90 truncate max-w-[150px] leading-none">{userName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {actionButton && <div className="flex shrink-0 mr-1">{actionButton}</div>}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-xl transition-all"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-3 rounded-[2rem] bg-popover border-emerald-500/20 shadow-2xl">
                <DropdownMenuLabel className="px-2 pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70">Diseño POS</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onViewModeChange?.('grid')} className="rounded-2xl py-3 focus:bg-emerald-500/10 text-foreground">
                  <div className="flex items-center gap-3 font-bold text-sm uppercase tracking-wider"><LayoutGrid className="h-4 w-4" /> Cuadrícula</div>
                  {viewMode === 'grid' && <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onViewModeChange?.('list')} className="rounded-2xl py-3 focus:bg-emerald-500/10 text-foreground">
                  <div className="flex items-center gap-3 font-bold text-sm uppercase tracking-wider"><ListIcon className="h-4 w-4" /> Lista</div>
                  {viewMode === 'list' && <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar Row */}
        <div className="relative w-full group">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl group-focus-within:bg-emerald-500/15 transition-all rounded-2xl" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-500/40 transition-colors group-focus-within:text-emerald-500 z-10" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Escanear o buscar producto..."
            className="pl-9 pr-3 h-10 bg-background border-emerald-500/20 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl shadow-md font-bold text-xs tracking-tight placeholder:text-muted-foreground text-foreground w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onSearchFocus}
            autoComplete="off"
          />
        </div>

        {/* Category Pills - Premium Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 no-scrollbar w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap shrink-0",
                selectedCategory === cat
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  : "bg-muted border-emerald-500/10 text-muted-foreground hover:border-emerald-500/30 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRODUCTS FEED ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="px-2 pb-36 pt-4">
          {filteredProducts.length === 0 ? (
            cart && cart.length > 0 ? (
              <div className="flex flex-col gap-3 py-6 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-w-0 max-w-full overflow-x-hidden">
                <div className="flex items-center justify-between mb-4 w-full min-w-0">
                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2 shrink-0">
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    En tu Pedido
                  </h3>
                  <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/10 font-black shrink-0">
                    {cart.length} items
                  </Badge>
                </div>
                
                {/* Order Type Toggle */}
                {onOrderTypeChange && (isRestaurant || isStore || isSupermarket) && (
                  <div className="flex w-full bg-zinc-900/50 p-1 rounded-xl mb-4 border border-white/5 shadow-inner min-w-0">
                    <button
                      onClick={() => onOrderTypeChange('dine-in')}
                      className={cn(
                        "flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all truncate",
                        orderType === 'dine-in' 
                          ? "bg-zinc-800 text-emerald-500 shadow-xl border border-white/5" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {(isStore || isSupermarket) ? <Tag className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}
                      {orderTypeLabels['dine-in']}
                    </button>
                    <button
                      onClick={() => onOrderTypeChange('takeout')}
                      className={cn(
                        "flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all truncate",
                        orderType === 'takeout' 
                          ? "bg-zinc-800 text-emerald-500 shadow-xl border border-white/5" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <ShoppingBag className="h-3 w-3" />
                      {orderTypeLabels['takeout']}
                    </button>
                  </div>
                )}
                
                {cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex flex-col gap-1 py-4 border-b border-white/5 last:border-0 w-full text-left px-1 md:px-2 group min-w-0">
                    <div className="flex items-center justify-between gap-2 md:gap-4 w-full min-w-0">
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="font-bold text-white text-xs md:text-sm uppercase truncate">{item.name}</p>
                        <p className="text-[10px] md:text-[11px] text-zinc-500 mt-1 font-medium truncate">
                          ${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ud
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                        <div className="flex items-center bg-zinc-800/80 rounded-lg p-0.5 border border-white/5 shrink-0">
                          <button 
                            className="h-6 w-6 md:h-8 md:w-8 flex items-center justify-center text-zinc-500 active:bg-zinc-700/50 rounded-md transition-colors"
                            onClick={() => props.onUpdateQuantity?.(item.id, item.quantity - 1)}
                          >
                             <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <span className="w-6 md:w-8 text-center text-xs md:text-sm font-bold text-white shrink-0">{item.quantity}</span>
                          <button 
                            className="h-6 w-6 md:h-8 md:w-8 flex items-center justify-center text-emerald-500 active:bg-zinc-700/50 rounded-md transition-colors"
                            onClick={() => props.onUpdateQuantity?.(item.id, item.quantity + 1)}
                          >
                             <Plus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>
                        <p className="font-black text-emerald-500 text-sm md:text-base min-w-[70px] md:min-w-[90px] text-right shrink-0">
                          ${((item.price || 0) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500/60 hover:text-red-600 hover:bg-red-500/10 rounded-full shrink-0"
                          onClick={() => props.onRemoveFromCart?.(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-700">
                <div className="relative mb-10">
                  {/* Outer glow circles */}
                  <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full animate-pulse" />
                  <div className="absolute inset-0 bg-emerald-400/5 blur-[40px] rounded-full" />
                  
                  {/* Icon composition */}
                  <div className="relative bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 backdrop-blur-2xl shadow-2xl">
                    <Package className="h-20 w-20 text-emerald-500/40 relative z-10" />
                    <Search className="h-8 w-8 text-emerald-500 absolute -bottom-2 -right-2 bg-zinc-950 p-1.5 rounded-xl border border-white/10 shadow-xl" />
                  </div>
                </div>
                
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-3">
                  Sin Resultados
                </h3>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                    No encontramos lo que buscas
                  </p>
                  <p className="text-[10px] font-medium text-emerald-500/50 uppercase tracking-widest">
                    Intenta con otro nombre o código
                  </p>
                </div>
                
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setSearchTerm('')}
                    className="mt-10 h-11 px-8 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Limpiar Búsqueda
                  </Button>
                )}
              </div>
            )
          ) : (
            <ProductGrid
              filteredProducts={filteredProducts}
              viewMode={viewMode}
              gridCols={gridCols}
              onSelect={handleProductSelect}
              cart={cart}
              onUpdateQuantity={props.onUpdateQuantity}
            />
          )}
        </div>
      </div>

      <VariablePriceDialog
        isOpen={isVariablePriceDialogOpen}
        onClose={() => setIsVariablePriceDialogOpen(false)}
        onConfirm={handleVariablePriceConfirm}
        product={selectedVariableProduct}
      />
    </div>
  );
});

MobileProductSearch.displayName = 'MobileProductSearch';

export default React.memo(MobileProductSearch);

// ── ISOLATED PRODUCT GRID — React.memo so cart changes never re-render this ──
// This component receives cart and onUpdateQuantity props to show/adjust quantities on cards
interface ProductGridProps {
  filteredProducts: any[];
  viewMode: 'grid' | 'list';
  gridCols: number;
  onSelect: (product: any) => void;
  cart?: CartItem[];
  onUpdateQuantity?: (id: string, q: number) => void;
}

const ProductGrid = React.memo<ProductGridProps>(function ProductGrid({
  filteredProducts,
  viewMode,
  gridCols,
  onSelect,
  cart,
  onUpdateQuantity,
}) {
  return (
    <div
      className={cn(
        "grid",
        viewMode === 'list' ? "grid-cols-1 gap-2" : {
          1: "grid-cols-1 gap-3",
          2: "grid-cols-2 gap-2",
          3: "grid-cols-3 gap-1.5",
          4: "grid-cols-2 min-[420px]:grid-cols-3 gap-1.5"
        }[gridCols] || "grid-cols-2 min-[420px]:grid-cols-3 gap-1.5"
      )}
    >
      {filteredProducts.map((product) => {
        const outOfStock = product.track_inventory !== false && (product.stock || 0) <= 0;
        const canSelect = !outOfStock;
        const cartQty = cart?.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0) || 0;

        return (
          <div
            key={product.id}
            onClick={() => canSelect && onSelect(product)}
            className={cn(
              "group text-left overflow-hidden border transition-all duration-150 shadow-sm relative flex",
              cartQty > 0 
                ? "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/20 shadow-md" 
                : "border-border bg-card hover:border-emerald-500/20",
              gridCols >= 4 ? "rounded-xl" : "rounded-2xl",
              outOfStock && "opacity-30 grayscale pointer-events-none",
              viewMode === 'list' ? "flex-row h-16" : "flex-col",
              canSelect && "cursor-pointer"
            )}
          >
            {/* Quantity Badge */}
            {cartQty > 0 && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 text-[8px] font-black rounded-full bg-emerald-600 text-white shadow-md border border-emerald-400/10">
                  {cartQty}
                </span>
              </div>
            )}

            {/* Image Area — no hover scale on mobile (jank) */}
            <div className={cn(
              "relative bg-muted overflow-hidden shrink-0 border-r border-border",
              viewMode === 'list' ? "w-16 h-full" : "aspect-square w-full"
            )}>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <Package className="h-10 w-10 text-emerald-500" />
                </div>
              )}

              {product.track_inventory !== false && (
                <div className="absolute top-1.5 left-1.5">
                  <span className={cn(
                    "inline-flex items-center h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter rounded shadow-sm",
                    (product.stock || 0) > 10
                      ? "bg-emerald-600/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-600/30 text-red-600 dark:text-red-400"
                  )}>
                    {product.stock || 0}
                  </span>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className={cn(
              "p-1.5 flex flex-col justify-between min-w-0 flex-1",
              viewMode === 'list' ? "p-2 py-1.5" : (gridCols >= 4 ? "h-22 sm:h-18" : "h-28")
            )}>
              <div className="space-y-0.5">
                <h4 className={cn(
                  "font-bold leading-[1.2] line-clamp-2 uppercase tracking-tight text-foreground",
                  viewMode === 'list' ? "text-xs" : (gridCols >= 4 ? "text-[9px]" : "text-[11px]")
                )}>
                  {product.name}
                </h4>
                {product.category?.name && gridCols < 4 && viewMode !== 'list' && (
                  <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600/60 truncate">
                    {product.category.name}
                  </p>
                )}
              </div>

              <div className={cn(
                "flex items-center justify-between border-t border-border mt-1 pt-1"
              )}>
                <span className={cn(
                  "font-bold text-emerald-600 dark:text-emerald-500 tracking-tight",
                  viewMode === 'list' ? "text-sm" : (gridCols >= 4 ? "text-xs" : "text-sm")
                )}>
                  ${(product.price || 0).toLocaleString()}
                </span>
                
                {cartQty > 0 ? (
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="flex items-center bg-muted border border-emerald-500/20 rounded-lg p-0.5"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity?.(product.id, cartQty - 1);
                      }}
                      className={cn(
                        "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors",
                        viewMode === 'list' ? "h-5 w-5" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
                      )}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className={cn(
                      "text-center font-bold text-foreground shrink-0",
                      viewMode === 'list' ? "w-5 text-[11px]" : (gridCols >= 4 ? "w-4 text-[9px]" : "w-5 text-[11px]")
                    )}>
                      {cartQty}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity?.(product.id, cartQty + 1);
                      }}
                      className={cn(
                        "flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-accent/50 rounded transition-colors",
                        viewMode === 'list' ? "h-5 w-5" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
                      )}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className={cn(
                    "rounded bg-primary flex items-center justify-center shadow-sm group-active:scale-90 transition-transform duration-100",
                    viewMode === 'list' ? "h-5 w-5" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
                  )}>
                    <Plus className={cn(
                      "text-white",
                      viewMode === 'list' ? "h-3.5 w-3.5" : (gridCols >= 4 ? "h-3 w-3" : "h-4 w-4")
                    )} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
