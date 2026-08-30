import React, { useState } from 'react';
import { Search, Package, Barcode, Hash, Tag, Asterisk, Settings2, LayoutGrid, List as ListIcon, RefreshCcw, Plus, ShoppingCart, Minus, Utensils, ShoppingBag, Trash2, ScanBarcode } from 'lucide-react';
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
import QuantityDialog from './QuantityDialog';
import BarcodeScannerPanel, { ScanDetectResult } from './BarcodeScannerPanel';
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
  // Debounce search for performance — only recalculate after user stops typing (150ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 150);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isVariablePriceDialogOpen, setIsVariablePriceDialogOpen] = useState(false);
  const [selectedVariableProduct, setSelectedVariableProduct] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [selectedQuantityProduct, setSelectedQuantityProduct] = useState<{ id: string; name: string; currentQuantity: number } | null>(null);

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

  const normalizeText = React.useCallback((text: string) => {
    return (text || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }, []);

  // Pre-normalize products for faster searching (eliminate repeated toLowerCase calls)
  const normalizedProducts = React.useMemo(() => {
    return products.map(p => ({
      ...p,
      _name_norm: normalizeText(p.name),
      _barcode_norm: normalizeText(p.barcode),
      _internal_code_norm: normalizeText(p.internal_code),
      _category_norm: normalizeText(p.category?.name),
      _all_barcodes_norm: [
        p.barcode,
        ...(p.barcodes?.map(b => b.barcode) ?? [])
      ].map(b => normalizeText(b)).filter(Boolean) as string[]
    }));
  }, [products, normalizeText]);

  // Memoize search results to filter by category and search term
  const filteredProducts = React.useMemo(() => {
    const rawTerm = debouncedSearchTerm.trim();
    
    let list = normalizedProducts;

    // Filter by category if not 'Todos'
    if (selectedCategory !== 'Todos') {
      const catNorm = normalizeText(selectedCategory);
      list = list.filter(product => product._category_norm === catNorm);
    }

    if (!rawTerm) {
      return list.slice(0, 80);
    }

    const normTerm = normalizeText(rawTerm);
    const searchWords = normTerm.split(/\s+/).filter(Boolean);

    if (searchWords.length === 0) {
      return list.slice(0, 80);
    }

    // Scoring and filtering products by relevance
    const scoredProducts = list
      .map(product => {
        let score = 0;

        // 1. Exact Barcode Match (highest priority for scanners)
        const isExactBarcode = product._all_barcodes_norm.some(b => b === normTerm);
        if (isExactBarcode) {
          score += 1000;
        }

        // 2. Exact Internal Code Match
        if (product._internal_code_norm === normTerm) {
          score += 900;
        }

        // 3. Name matches
        if (product._name_norm === normTerm) {
          score += 800; // Exact name match
        } else if (product._name_norm.startsWith(normTerm)) {
          score += 500; // Name starts with search term
        }

        // 4. Token/Word matching (Fuzzy search)
        let matchedWordsCount = 0;
        searchWords.forEach(word => {
          const inName = product._name_norm.includes(word);
          const inBarcode = product._all_barcodes_norm.some(b => b.includes(word));
          const inCode = product._internal_code_norm.includes(word);
          const inCategory = product._category_norm.includes(word);

          if (inName || inBarcode || inCode || inCategory) {
            matchedWordsCount++;
            if (inName) score += 50;
            if (inBarcode) score += 40;
            if (inCode) score += 30;
          }
        });

        // Must match at least one word to be included
        if (matchedWordsCount === 0) {
          return null;
        }

        // Boost products that match ALL search words
        if (matchedWordsCount === searchWords.length) {
          score += 200;
        }

        // Relative match percentage bonus
        score += (matchedWordsCount / searchWords.length) * 100;

        return { product, score };
      })
      .filter((item): item is { product: any; score: number } => item !== null);

    // Sort by score descending, then by name alphabetically
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.product._name_norm.localeCompare(b.product._name_norm);
    });

    const result = scoredProducts.map(item => item.product);

    return result.slice(0, 80);
  }, [normalizedProducts, debouncedSearchTerm, selectedCategory, normalizeText]);

  // Slice results for infinite scrolling/performance
  const slicedProducts = React.useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Reset visible products on search or category filter change
  React.useEffect(() => {
    setVisibleCount(24);
  }, [debouncedSearchTerm, selectedCategory]);

  // Infinite scroll observer sentinel
  React.useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && filteredProducts.length > visibleCount) {
          setVisibleCount(prev => prev + 24);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredProducts.length, visibleCount]);

  const handleProductSelect = React.useCallback((product: Product, preMatchedBundle?: any) => {
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
  }, [searchTerm, onAddToCart, setSearchTerm]);

  // Busca una coincidencia EXACTA de código de barras (propio o de bundle) y
  // agrega el producto al carrito. Compartido entre Enter, el diálogo de
  // escaneo por cámara y el lector físico Sunmi — una sola lógica de match.
  const addByExactCode = React.useCallback((rawCode: string): ScanDetectResult => {
    const search = rawCode.toLowerCase().trim();
    if (!search) return { found: false };

    let matchedBundle: any = null;
    const exactBarcodeMatch: Product | undefined = products.find(p => {
      if (p.barcode && p.barcode.toLowerCase() === search) return true;
      const extraMatch = p.barcodes?.find(b => b.barcode.toLowerCase() === search);
      if (extraMatch) { matchedBundle = extraMatch; return true; }
      return false;
    });

    if (!exactBarcodeMatch) return { found: false };

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
    return { found: true, productName: exactBarcodeMatch.name };
  }, [products, onAddToCart, handleProductSelect]);

  // Igual que addByExactCode, pero además refleja el código escaneado en la
  // barra de búsqueda cuando no hay coincidencia — para que quede visible
  // arriba aunque el producto no exista en el catálogo.
  const handleScanDetect = React.useCallback((code: string): ScanDetectResult => {
    const result = addByExactCode(code);
    if (!result.found) {
      setSearchTerm(code);
    }
    return result;
  }, [addByExactCode, setSearchTerm]);

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Lector físico Sunmi: el nativo dispara este evento con el código leído.
  React.useEffect(() => {
    const handlePhysicalScan = (e: Event) => {
      const code = (e as CustomEvent<{ code: string }>).detail?.code;
      if (!code) return;
      if (!addByExactCode(code).found) {
        setSearchTerm(code);
      }
    };
    window.addEventListener('cobro_barcode', handlePhysicalScan);
    return () => window.removeEventListener('cobro_barcode', handlePhysicalScan);
  }, [addByExactCode, setSearchTerm]);

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

  const handleQuantityClick = React.useCallback((id: string, name: string, currentQuantity: number) => {
    setSelectedQuantityProduct({ id, name, currentQuantity });
    setIsQuantityDialogOpen(true);
  }, []);

  const handleQuantityConfirm = React.useCallback((quantity: number) => {
    if (selectedQuantityProduct) {
      props.onUpdateQuantity?.(selectedQuantityProduct.id, quantity);
      setIsQuantityDialogOpen(false);
      setSelectedQuantityProduct(null);
    }
  }, [selectedQuantityProduct, props.onUpdateQuantity]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const search = searchTerm.toLowerCase().trim();
      if (!search) {
        if (filteredProducts.length === 1) handleProductSelect(filteredProducts[0]);
        return;
      }

      if (addByExactCode(searchTerm).found) return;

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
                className="h-9 w-9 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 rounded-xl transition-colors"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin text-emerald-500")} />
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
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Escanear o buscar producto..."
            className="pl-9 pr-11 h-10 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/10 transition-colors rounded-xl font-medium text-xs tracking-tight placeholder:text-muted-foreground text-foreground w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onSearchFocus}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            title="Escanear código de barras o QR"
          >
            <ScanBarcode className="h-4 w-4" />
          </button>
        </div>

        <BarcodeScannerPanel
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onDetect={handleScanDetect}
        />

      </div>

      {/* ── PRODUCTS FEED ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth overscroll-contain">
        <div className={cn("px-2 pt-4", cart && cart.length > 0 ? "pb-28" : "pb-6")}>
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
                  <div className="flex w-full bg-muted p-1 rounded-xl mb-4 border border-border min-w-0">
                    <button
                      onClick={() => onOrderTypeChange('dine-in')}
                      className={cn(
                        "flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all truncate",
                        orderType === 'dine-in'
                          ? "bg-background text-emerald-600 dark:text-emerald-400 border border-border"
                          : "text-muted-foreground hover:text-foreground"
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
                          ? "bg-background text-emerald-600 dark:text-emerald-400 border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ShoppingBag className="h-3 w-3" />
                      {orderTypeLabels['takeout']}
                    </button>
                  </div>
                )}
                
                {cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex flex-col gap-1 py-4 border-b border-border/40 last:border-0 w-full text-left px-1 md:px-2 group min-w-0">
                    <div className="flex items-center justify-between gap-2 md:gap-4 w-full min-w-0">
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="font-bold text-foreground text-xs md:text-sm uppercase truncate">{item.name}</p>
                        <p className="text-[10px] md:text-[11px] text-muted-foreground mt-1 font-medium truncate">
                          ${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ud
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border shrink-0">
                          <button
                            className="h-6 w-6 md:h-8 md:w-8 flex items-center justify-center text-muted-foreground active:bg-background rounded-md transition-colors"
                            onClick={() => props.onUpdateQuantity?.(item.id, item.quantity - 1)}
                          >
                             <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                           <span
                             className="w-6 md:w-8 text-center text-xs md:text-sm font-bold text-foreground shrink-0 cursor-pointer hover:text-emerald-500 transition-colors"
                             onClick={() => handleQuantityClick(item.id, item.name, item.quantity)}
                           >
                             {item.quantity}
                           </span>
                          <button
                            className="h-6 w-6 md:h-8 md:w-8 flex items-center justify-center text-emerald-500 active:bg-background rounded-md transition-colors"
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
                  <div className="relative bg-card p-10 rounded-[3rem] border border-border backdrop-blur-2xl shadow-sm">
                    <Package className="h-20 w-20 text-emerald-500/40 relative z-10" />
                    <Search className="h-8 w-8 text-emerald-500 absolute -bottom-2 -right-2 bg-background p-1.5 rounded-xl border border-border shadow-sm" />
                  </div>
                </div>

                <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter italic mb-3">
                  Sin Resultados
                </h3>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
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
                    className="mt-10 h-11 px-8 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  >
                    Limpiar Búsqueda
                  </Button>
                )}
              </div>
            )
          ) : (
            <ProductGrid
              filteredProducts={slicedProducts}
              viewMode={viewMode}
              gridCols={gridCols}
              onSelect={handleProductSelect}
              cart={cart}
              onUpdateQuantity={props.onUpdateQuantity}
              onQuantityClick={handleQuantityClick}
            />
          )}
          {slicedProducts.length > visibleCount && (
            <div ref={loadMoreRef} className="py-4 flex justify-center items-center w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50 animate-pulse">
                Cargando más productos...
              </span>
            </div>
          )}
        </div>
      </div>

      <VariablePriceDialog
        isOpen={isVariablePriceDialogOpen}
        onClose={() => setIsVariablePriceDialogOpen(false)}
        onConfirm={handleVariablePriceConfirm}
        product={selectedVariableProduct}
      />

      <QuantityDialog
        isOpen={isQuantityDialogOpen}
        onClose={() => setIsQuantityDialogOpen(false)}
        onConfirm={handleQuantityConfirm}
        itemName={selectedQuantityProduct?.name || ''}
        currentQuantity={selectedQuantityProduct?.currentQuantity || 0}
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
  onQuantityClick?: (id: string, name: string, qty: number) => void;
}

const ProductGrid = React.memo<ProductGridProps>(function ProductGrid({
  filteredProducts,
  viewMode,
  gridCols,
  onSelect,
  cart,
  onUpdateQuantity,
  onQuantityClick,
}) {
  // Precompute cart quantity mapping to optimize inside-loop lookups from O(C) to O(1)
  const cartMap = React.useMemo(() => {
    const map = new Map<string, number>();
    if (cart) {
      for (const item of cart) {
        map.set(item.id, (map.get(item.id) || 0) + item.quantity);
      }
    }
    return map;
  }, [cart]);

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
      {filteredProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          viewMode={viewMode}
          gridCols={gridCols}
          cartQty={cartMap.get(product.id) || 0}
          onSelect={onSelect}
          onUpdateQuantity={onUpdateQuantity}
          onQuantityClick={onQuantityClick}
        />
      ))}
    </div>
  );
});

// ── ISOLATED PRODUCT CARD — React.memo con cartQty como número plano (no el
// carrito entero) — así cambiar el carrito solo re-renderiza la tarjeta cuya
// cantidad realmente cambió, no las 24-80 tarjetas visibles en pantalla.
// Antes cada tarjeta vivía inline dentro del .map() de ProductGrid, leyendo
// el mapa completo desde el closure — eso hacía que CUALQUIER cambio de
// carrito re-renderizara TODA la grilla visible (medido: ~800ms-1.3s de
// frame trabado por interacción en esta tablet). El resto del JSX es
// idéntico, solo se movió a su propio componente.
interface ProductCardProps {
  product: any;
  viewMode: 'grid' | 'list';
  gridCols: number;
  cartQty: number;
  onSelect: (product: any) => void;
  onUpdateQuantity?: (id: string, q: number) => void;
  onQuantityClick?: (id: string, name: string, qty: number) => void;
}

const ProductCard = React.memo<ProductCardProps>(function ProductCard({
  product,
  viewMode,
  gridCols,
  cartQty,
  onSelect,
  onUpdateQuantity,
  onQuantityClick,
}) {
  const outOfStock = product.track_inventory !== false && (product.stock || 0) <= 0;

  return (
    <div
      onClick={() => onSelect(product)}
      className={cn(
        "group text-left relative flex transition-colors duration-200 cursor-pointer",
        viewMode === 'list'
          ? cn(
              "rounded-2xl flex-row h-[4.25rem] items-center",
              cartQty > 0 ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]" : "bg-muted/50 hover:bg-muted/80"
            )
          : cn(
              "overflow-hidden border shadow-sm",
              gridCols >= 4 ? "rounded-xl flex-col" : "rounded-2xl flex-col",
              cartQty > 0
                ? "border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]"
                : "border-border/60 bg-card hover:border-emerald-500/20 hover:shadow-md"
            )
      )}
    >
      {/* Quantity Badge - Only in Grid mode to avoid clutter in List mode */}
      {cartQty > 0 && viewMode === 'grid' && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 text-[8px] font-black rounded-full bg-emerald-600 text-white shadow-md border border-emerald-400/10">
            {cartQty}
          </span>
        </div>
      )}

      {/* Image Area — Inset rounded square in list mode */}
      <div className={cn(
        "relative bg-muted overflow-hidden shrink-0 flex items-center justify-center",
        viewMode === 'list'
          ? "w-12 h-12 rounded-xl ml-3"
          : "aspect-square w-full border-b border-border"
      )}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <Package className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
          </div>
        )}

        {/* Stock Badge - clean pill (solo en grid; en lista el stock va como texto junto al precio) */}
        {product.track_inventory !== false && viewMode !== 'list' && (
          <div className="absolute top-1.5 left-1.5">
            <span className={cn(
              // Sin backdrop-blur: esta insignia se repite en cada tarjeta
              // de la grilla (hasta 80 en pantalla) y el fondo ya es
              // semitransparente de por sí — el blur no se nota pero sí
              // cuesta caro recomponerlo en cada render en GPUs débiles.
              "inline-flex items-center h-3.5 px-1.5 text-[7px] font-bold uppercase tracking-tight rounded-md shadow-sm",
              (product.stock || 0) > 10
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10"
                : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/10"
            )}>
              {product.stock || 0}
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={cn(
        "flex min-w-0 flex-1",
        viewMode === 'list' ? "flex-row items-center justify-between pl-3 pr-4 py-1.5 h-full" : (gridCols >= 4 ? "flex-col justify-between p-2 h-22 sm:h-18 gap-1" : "flex-col justify-between p-3 h-28 gap-2")
      )}>
        <div className={cn("min-w-0", viewMode === 'list' ? "flex flex-col justify-center" : "space-y-0.5")}>
          <h4 className={cn(
            "font-semibold leading-snug line-clamp-2 tracking-tight text-foreground group-hover:text-emerald-500 transition-colors duration-200",
            viewMode === 'list' ? "text-xs" : (gridCols >= 4 ? "text-[9px]" : "text-[11px]")
          )}>
            {product.name}
          </h4>
          {viewMode === 'list' && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tracking-tight text-xs">
                ${(product.price || 0).toLocaleString()}
              </span>
              {product.track_inventory !== false && (
                <span className={cn(
                  "text-[10px] font-medium",
                  (product.stock || 0) > 10 ? "text-muted-foreground/60" : "text-red-500/80"
                )}>
                  · {product.stock || 0} uds
                </span>
              )}
            </div>
          )}
          {product.category?.name && gridCols < 4 && viewMode !== 'list' && (
            <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-600/60 truncate">
              {product.category.name}
            </p>
          )}
        </div>

        <div className={cn(
          "flex items-center",
          viewMode === 'list' ? "ml-2 shrink-0" : "justify-between mt-auto border-t border-border/50 pt-1.5 w-full"
        )}>
          {viewMode !== 'list' && (
            <span className={cn(
              "font-bold text-emerald-600 dark:text-emerald-400 tracking-tight",
              gridCols >= 4 ? "text-xs" : "text-sm"
            )}>
              ${(product.price || 0).toLocaleString()}
            </span>
          )}

          {cartQty > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center bg-secondary/80 border border-border/30 rounded-full p-0.5 shadow-sm"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity?.(product.id, cartQty - 1);
                }}
                className={cn(
                  "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card rounded-full transition-all active:scale-90",
                  viewMode === 'list' ? "h-8 w-8" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
                )}
              >
                <Minus className={cn(viewMode === 'list' ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} />
              </button>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityClick?.(product.id, product.name, cartQty);
                }}
                className={cn(
                  "text-center font-bold text-foreground shrink-0 cursor-pointer hover:text-emerald-500 transition-colors active:scale-95",
                  viewMode === 'list' ? "w-6 text-xs" : (gridCols >= 4 ? "w-4 text-[9px]" : "w-5 text-[11px]")
                )}
              >
                {cartQty}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity?.(product.id, cartQty + 1);
                }}
                className={cn(
                  "flex items-center justify-center text-emerald-500 dark:text-emerald-400 hover:bg-card rounded-full transition-all active:scale-90",
                  viewMode === 'list' ? "h-8 w-8" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
                )}
              >
                <Plus className={cn(viewMode === 'list' ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} />
              </button>
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(product);
              }}
              className={cn(
                "rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-sm active:scale-90 transition-all duration-150 cursor-pointer",
                viewMode === 'list' ? "h-7 w-7" : (gridCols >= 4 ? "h-4.5 w-4.5" : "h-6 w-6")
              )}>
              <Plus className={cn(
                "text-white",
                viewMode === 'list' ? "h-3.5 w-3.5" : (gridCols >= 4 ? "h-3 w-3" : "h-4 w-4")
              )} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
