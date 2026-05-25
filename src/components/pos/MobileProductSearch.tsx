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
  const [searchType, setSearchType] = useState<SearchType>('all');
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

  const searchTypes = React.useMemo(() => [
    { type: 'all' as const, label: 'Todo', icon: Asterisk },
    { type: 'name' as const, label: 'Nombre', icon: Package },
    { type: 'barcode' as const, label: 'Código', icon: Barcode },
  ], []);
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

  // 2. Memoize search results to prevent recalculating on every re-render (e.g. when cart updates)
  const filteredProducts = React.useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    
    if (mode === 'classic' && !searchLower) return [];
    if (!searchLower) return normalizedProducts.slice(0, 40);

    const filtered = normalizedProducts.filter(product => {
      if (searchType === 'name') {
        return product._name_lower.includes(searchLower);
      }
      if (searchType === 'barcode') {
        return product._all_barcodes_lower.some(b => b.includes(searchLower));
      }
      // 'all' search type
      return (
        product._name_lower.includes(searchLower) ||
        product._all_barcodes_lower.some(b => b.includes(searchLower)) ||
        product._internal_code_lower.includes(searchLower) ||
        product._category_lower.includes(searchLower)
      );
    });

    return filtered.slice(0, 50);
  }, [normalizedProducts, debouncedSearchTerm, searchType, mode]);
  const currentSearchType = searchTypes.find(st => st.type === searchType);

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

  const handleVariablePriceConfirm = (price: number) => {
    if (selectedVariableProduct) {
      const productWithPrice = { ...selectedVariableProduct, price: price };
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
    <div className="h-full flex flex-col bg-zinc-950/20 backdrop-blur-xl relative">
      {/* ── PREMIUM EBONY & EMERALD SEARCH BAR ── */}
      <div className="px-4 py-4 space-y-4 bg-zinc-950/40 backdrop-blur-2xl border-b border-emerald-500/10 sticky top-0 z-40">
        {/* Top Header Row: Menu, Profile, Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {menuButton && <div className="shrink-0">{menuButton}</div>}
            {companyLogo && (
              <div className="h-10 w-10 relative shrink-0 rounded-xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/5 flex items-center justify-center p-1 shadow-xl">
                <img 
                  src={companyLogo} 
                  alt="Logo" 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            {userName && (
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest leading-none mb-1">Cajero(a)</span>
                <span className="text-[12px] font-bold text-white/90 truncate max-w-[150px] leading-none">{userName}</span>
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
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-zinc-800/50 text-zinc-400">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-3 rounded-[2rem] bg-zinc-900/95 border-emerald-500/20 backdrop-blur-2xl">
                <DropdownMenuLabel className="px-2 pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70">Diseño POS</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onViewModeChange?.('grid')} className="rounded-2xl py-3 focus:bg-emerald-500/10 text-zinc-300">
                  <div className="flex items-center gap-3 font-bold text-sm uppercase tracking-wider"><LayoutGrid className="h-4 w-4" /> Cuadrícula</div>
                  {viewMode === 'grid' && <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onViewModeChange?.('list')} className="rounded-2xl py-3 focus:bg-emerald-500/10 text-zinc-300">
                  <div className="flex items-center gap-3 font-bold text-sm uppercase tracking-wider"><ListIcon className="h-4 w-4" /> Lista</div>
                  {viewMode === 'list' && <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar Row */}
        <div className="relative w-full group">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl group-focus-within:bg-emerald-500/15 transition-all rounded-3xl" />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-500/40 transition-colors group-focus-within:text-emerald-500 z-10" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Escanear o buscar producto..."
            className="pl-12 pr-4 h-14 bg-zinc-900/60 dark:bg-zinc-950/60 backdrop-blur-xl border-emerald-500/20 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-3xl shadow-xl font-black text-base md:text-lg tracking-tight placeholder:text-zinc-500 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onSearchFocus}
            autoComplete="off"
          />
        </div>

        {/* Category Pills - Premium Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {searchTypes.map((st) => (
            <button
              key={st.type}
              onClick={() => setSearchType(st.type)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border whitespace-nowrap",
                searchType === st.type
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-500/20"
                  : "bg-zinc-900/40 border-emerald-500/10 text-zinc-500 hover:border-emerald-500/30 hover:text-zinc-300"
              )}
            >
              {st.label}
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
// This component receives NO cart prop, so adding/removing items from the cart
// does NOT cause the product grid to re-render. This is the #1 perf fix.
interface ProductGridProps {
  filteredProducts: any[];
  viewMode: 'grid' | 'list';
  gridCols: number;
  onSelect: (product: any) => void;
}

const ProductGrid = React.memo<ProductGridProps>(function ProductGrid({
  filteredProducts,
  viewMode,
  gridCols,
  onSelect,
}) {
  return (
    <div
      className={cn(
        "grid",
        viewMode === 'list' ? "grid-cols-1 gap-3" : "grid-cols-4 gap-2"
      )}
    >
      {filteredProducts.map((product) => {
        const outOfStock = product.track_inventory !== false && (product.stock || 0) <= 0;
        const canSelect = !outOfStock;
        return (
          <button
            key={product.id}
            type="button"
            disabled={!canSelect}
            onClick={() => canSelect && onSelect(product)}
            className={cn(
              // Base: no backdrop-blur (too expensive per-card)
              "group text-left overflow-hidden border border-emerald-500/10 bg-zinc-900/40 active:scale-[0.94] transition-transform duration-150 shadow-md",
              gridCols >= 4 ? "rounded-2xl" : "rounded-[1.5rem]",
              outOfStock && "opacity-30 grayscale pointer-events-none",
              viewMode === 'list' ? "flex flex-row h-28" : "flex flex-col"
            )}
          >
            {/* Image Area — no hover scale on mobile (jank) */}
            <div className={cn(
              "relative bg-zinc-900/60 overflow-hidden shrink-0 border-r border-emerald-500/5",
              viewMode === 'list' ? "w-28 h-full" : "aspect-square w-full"
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
                  <Package className="h-12 w-12 text-emerald-500" />
                </div>
              )}

              {product.track_inventory !== false && (
                <div className="absolute top-2 left-2">
                  <span className={cn(
                    "inline-flex items-center h-5 px-2 text-[9px] font-black uppercase tracking-tighter rounded-full shadow-sm",
                    (product.stock || 0) > 10
                      ? "bg-emerald-600/30 text-emerald-400"
                      : "bg-red-600/30 text-red-400"
                  )}>
                    {product.stock || 0}
                  </span>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className={cn(
              "p-1.5 flex flex-col justify-between min-w-0 flex-1",
              viewMode === 'list' ? "p-4" : (gridCols >= 4 ? "h-20" : "h-32")
            )}>
              <div className="space-y-0.5">
                <h4 className={cn(
                  "font-black leading-[1.2] line-clamp-2 uppercase tracking-tight text-white",
                  gridCols >= 4 ? "text-[10px]" : "text-[13px]"
                )}>
                  {product.name}
                </h4>
                {product.category?.name && gridCols < 4 && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60 truncate">
                    {product.category.name}
                  </p>
                )}
              </div>

              <div className={cn(
                "flex items-center justify-between border-t border-emerald-500/5",
                gridCols >= 4 ? "mt-1 pt-1" : "mt-2 pt-2"
              )}>
                <span className={cn(
                  "font-black text-emerald-500 tracking-tighter",
                  gridCols >= 4 ? "text-sm" : "text-xl"
                )}>
                  ${(product.price || 0).toLocaleString()}
                </span>
                <div className={cn(
                  "rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm group-active:scale-90 transition-transform duration-100",
                  gridCols >= 4 ? "h-6 w-6" : "h-9 w-9"
                )}>
                  <Plus className={cn(
                    "text-white",
                    gridCols >= 4 ? "h-3.5 w-3.5" : "h-5 w-5"
                  )} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
