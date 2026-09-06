import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Hash, Barcode, Tag, Package, Asterisk, Search, Settings2, LayoutGrid, List as ListIcon, ScanBarcode, RefreshCcw } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import VariablePriceDialog from './VariablePriceDialog';
import QuantityDialog from './QuantityDialog';
import BarcodeScannerPanel, { ScanDetectResult } from './BarcodeScannerPanel';
import { usePOSSearch } from '@/contexts/POSSearchContext';

interface ProductSearchListProps {
  products: Product[];
  onAddToCart: (product: Product, quantity?: number, forcedPrice?: number) => void;
  menuButton?: React.ReactNode;
  actionButton?: React.ReactNode;
  gridCols?: number;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onGridColsChange?: (cols: number) => void;
  mode?: 'classic' | 'catalog';
  onLayoutModeChange?: (mode: 'classic' | 'catalog') => void;
  /** Map<productId, availableUnits> from recipe stock calculation */
  recipeAvailability?: Map<string, number>;
  isLoading?: boolean;
  onRefresh?: () => void;
  onSearchFocus?: () => void;
  userName?: string;
}

const ProductSkeleton = ({ viewMode }: { viewMode: 'grid' | 'list' }) => (
  <Card className={cn(
    "animate-pulse bg-muted/20 border-border/10",
    viewMode === 'grid' ? "aspect-[4/3] w-full" : "h-20 w-full"
  )}>
    <div className="h-full w-full flex items-center justify-center">
      <div className="bg-muted/40 h-8 w-8 rounded-full" />
    </div>
  </Card>
);

type SearchType = 'all' | 'name' | 'barcode' | 'id' | 'category';

interface ProductItemProps {
  product: Product;
  viewMode: 'grid' | 'list';
  minCardWidth: string;
  recipeAvailability?: Map<string, number>;
  onSelect: (product: Product, bundle?: any) => void;
  isFocused?: boolean;
  matchedBundle?: any;
}

const ProductItem = React.memo<ProductItemProps>(({ 
  product, 
  viewMode, 
  minCardWidth, 
  recipeAvailability, 
  onSelect,
  isFocused = false,
  matchedBundle
}) => {
  const hasRecipeStock = recipeAvailability?.has(product.id);
  const avail = hasRecipeStock ? recipeAvailability.get(product.id)! : 0;
  const isOutOfStock = hasRecipeStock 
    ? avail <= 0 
    : (product.track_inventory !== false && product.stock <= 0);

  const handleClick = () => {
    onSelect(product, matchedBundle);
  };

  // Scroll into view when focused
  const itemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  return (
    <Card
      ref={itemRef}
      className={cn(
        "group cursor-pointer relative overflow-hidden border-border/40 bg-card/40 transition-all duration-150 hover:border-primary/40 hover:bg-card hover:shadow-sm",
        isOutOfStock ? "opacity-70 grayscale-[0.3]" : "",
        viewMode === 'list' ? "flex flex-row items-center p-2.5 sm:p-3 min-h-[72px] gap-3 rounded-xl" : "rounded-xl",
        isFocused && "ring-2 ring-primary border-primary bg-primary/5 shadow-md z-10"
      )}
      onClick={handleClick}
      style={viewMode === 'grid' ? { flex: '1 1 auto' } : undefined}
    >
      {/* Image Section */}
      <div className={cn(
        "relative flex items-center justify-center overflow-hidden shrink-0",
        viewMode === 'list' 
          ? "w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-secondary/30 border border-border/40" 
          : "aspect-[4/3] w-full bg-secondary/20",
        !product.image_url && "bg-muted/15"
      )}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center text-muted-foreground/30">
            <Package className={cn(viewMode === 'list' ? "h-6 w-6" : "h-8 w-8")} strokeWidth={1.5} />
          </div>
        )}

        {/* Stock Badges (Overlay on Image) - ONLY in Grid Mode */}
        {viewMode === 'grid' && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {(() => {
              if (hasRecipeStock) {
                if (avail <= 0) {
                  return (
                    <Badge variant="destructive" className="shadow-sm px-2 h-5 text-[10px] font-semibold bg-destructive/90">
                      Agotado
                    </Badge>
                  );
                }
                if (avail <= 5) {
                  return (
                    <Badge className="shadow-sm px-2 h-5 text-[10px] font-semibold bg-amber-500/90 text-white border-0">
                      {avail} disp.
                    </Badge>
                  );
                }
                return (
                  <Badge className="shadow-sm px-2 h-5 text-[10px] font-semibold bg-emerald-600/90 text-white border-0">
                    {avail} disp.
                  </Badge>
                );
              }
              if (product.track_inventory !== false && product.stock <= 0) {
                return (
                  <Badge variant="destructive" className="shadow-sm px-2 h-5 text-[10px] font-semibold bg-destructive/90">
                    Agotado
                  </Badge>
                );
              }
              if (product.track_inventory !== false && product.stock < 10) {
                return (
                  <Badge className="shadow-sm px-2 h-5 text-[10px] font-semibold bg-amber-500/90 text-white border-0">
                    Quedan {product.stock}
                  </Badge>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Category Badge overlay (bottom left of image) - Only in Grid */}
        {viewMode === 'grid' && product.category?.name && (
          <div className="absolute bottom-2 left-2 max-w-[80%]">
            <Badge variant="secondary" className="shadow-sm px-1.5 h-4 text-[9px] font-medium bg-background/70 text-foreground/80 border-0 truncate max-w-full">
              {product.category.name}
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={cn(
        "flex min-w-0",
        viewMode === 'list' 
          ? "flex-1 items-center justify-between gap-3" 
          : "flex-col p-3 gap-2 justify-between"
      )}>
        {/* Left/Top: Name & Details */}
        <div className="space-y-1 min-w-0 flex-1">
          <h4 className={cn(
            "font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary break-words min-w-0",
            viewMode === 'list' ? "text-sm sm:text-base line-clamp-1" : "text-sm leading-tight line-clamp-2"
          )}>
            {product.name}
          </h4>

          {viewMode === 'list' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {product.category?.name && (
                <span className="px-1.5 py-0.5 rounded bg-secondary/50 text-foreground/70 font-medium text-[11px]">
                  {product.category.name}
                </span>
              )}
              {product.internal_code && (
                <span className="flex items-center gap-0.5 font-mono text-[11px] opacity-60">
                  <span>#</span>{product.internal_code}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right/Bottom: Price & Stock Badge */}
        <div className={cn(
          "flex items-center shrink-0",
          viewMode === 'list' ? "flex-col items-end gap-1" : "justify-between mt-auto pt-1"
        )}>
          {viewMode === 'grid' && (
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">
              {matchedBundle ? 'Precio Paquete' : 'Precio'}
            </span>
          )}

          <div className="font-bold text-base sm:text-lg text-emerald-500 font-mono leading-none flex items-center gap-1.5">
            {(() => {
              let displayPrice = product.price || 0;
              if (matchedBundle) {
                const qty = Number(matchedBundle.quantity) || 1;
                const discount = Number(matchedBundle.discount_value) || 0;
                const type = matchedBundle.discount_type || 'percentage';
                if (discount > 0) {
                  if (type === 'percentage') {
                    displayPrice = product.price * (1 - discount / 100);
                  } else {
                    displayPrice = product.price - (discount / qty);
                  }
                }
              }
              return `$${displayPrice.toFixed(2)}`;
            })()}
            
            {matchedBundle && (
              <span className="text-[10px] line-through text-muted-foreground font-normal opacity-50">
                ${(product.price * (Number(matchedBundle.quantity) || 1)).toFixed(2)}
              </span>
            )}
          </div>

          {matchedBundle && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 whitespace-nowrap gap-1">
              <Package className="h-3 w-3" />
              Paquete x {matchedBundle.quantity}
            </Badge>
          )}

          {/* Clean Stock Pill in List Mode */}
          {viewMode === 'list' && (() => {
            if (hasRecipeStock) {
              return (
                <span className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-full font-mono",
                  avail <= 0 
                    ? "bg-destructive/15 text-destructive font-semibold" 
                    : avail <= 5 
                    ? "bg-amber-500/15 text-amber-500" 
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}>
                  {avail <= 0 ? "Agotado" : `${avail} disp.`}
                </span>
              );
            }
            if (product.track_inventory !== false) {
              if (product.stock <= 0) {
                return (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-mono">
                    Agotado
                  </span>
                );
              }
              return (
                <span className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-full font-mono",
                  product.stock < 5 
                    ? "bg-amber-500/15 text-amber-500 font-semibold" 
                    : product.stock < 10
                    ? "bg-amber-500/10 text-amber-500/90"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}>
                  {product.stock} un.
                </span>
              );
            }
            return null;
          })()}

          {viewMode === 'grid' && product.internal_code && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {product.internal_code}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.stock === next.product.stock &&
    prev.product.price === next.product.price &&
    prev.viewMode === next.viewMode &&
    prev.minCardWidth === next.minCardWidth &&
    prev.isFocused === next.isFocused &&
    prev.matchedBundle === next.matchedBundle &&
    // Shallow check on recipeAvailability since it's a stable Map reference
    prev.recipeAvailability === next.recipeAvailability
  );
});

ProductItem.displayName = 'ProductItem';

export interface ProductSearchListHandle {
  focus: () => void;
}

const ProductSearchList = React.memo(React.forwardRef<ProductSearchListHandle, ProductSearchListProps>(({
  products,
  onAddToCart,
  menuButton,
  actionButton,
  gridCols = 4,
  viewMode = 'list',
  onViewModeChange,
  onGridColsChange,
  mode = 'catalog',
  onLayoutModeChange,
  recipeAvailability,
  isLoading,
  onRefresh,
  onSearchFocus
}, ref) => {
  const { searchTerm, setSearchTerm } = usePOSSearch();
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [isVariablePriceDialogOpen, setIsVariablePriceDialogOpen] = useState(false);
  const [isVariableQuantityDialogOpen, setIsVariableQuantityDialogOpen] = useState(false);
  const [selectedVariableProduct, setSelectedVariableProduct] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const [isFocusedInput, setIsFocusedInput] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTermRef = useRef(searchTerm);
  // Flag: true when the useEffect barcode auto-add already fired for the current term,
  // so the Enter keydown handler knows NOT to add again (preventing quantity doubling).
  const barcodeAutoAddedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    searchTermRef.current = searchTerm;
    // Reset the flag whenever the search term changes so a new scan can trigger auto-add
    barcodeAutoAddedRef.current = false;
  }, [searchTerm]);

  // Exponer método de foco al padre
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      searchInputRef.current?.focus();
    }
  }));

  // Focus on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Debounce search term for better performance (150ms = fast but smooth)
  const debouncedSearchTerm = useDebounce(searchTerm, 150);

  const searchTypes = useMemo(() => [{
    type: 'all' as const,
    label: 'Todo',
    icon: Asterisk,
    placeholder: 'Buscar por cualquier campo...'
  }, {
    type: 'name' as const,
    label: 'Nombre',
    icon: Package,
    placeholder: 'Buscar por nombre...'
  }, {
    type: 'barcode' as const,
    label: 'Barras',
    icon: Barcode,
    placeholder: 'Buscar por código de barras...'
  }, {
    type: 'id' as const,
    label: 'Interno',
    icon: Hash,
    placeholder: 'Buscar por código interno...'
  }, {
    type: 'category' as const,
    label: 'Categ.',
    icon: Tag,
    placeholder: 'Buscar por categoría...'
  }], []);

  const normalizeText = useCallback((text: string) => {
    return (text || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }, []);

  // O(1) Barcode & Internal Code Map for instant scanning & search
  const barcodeMap = useMemo(() => {
    const map = new Map<string, { product: Product; bundle?: any }>();
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.barcode) {
        const norm = normalizeText(p.barcode);
        if (norm && !map.has(norm)) {
          map.set(norm, { product: p });
        }
      }
      if (p.internal_code) {
        const norm = normalizeText(p.internal_code);
        if (norm && !map.has(norm)) {
          map.set(norm, { product: p });
        }
      }
      if (p.barcodes && Array.isArray(p.barcodes)) {
        for (let j = 0; j < p.barcodes.length; j++) {
          const b = p.barcodes[j];
          if (b.barcode) {
            const norm = normalizeText(b.barcode);
            if (norm && !map.has(norm)) {
              map.set(norm, { product: p, bundle: b });
            }
          }
        }
      }
    }
    return map;
  }, [products, normalizeText]);

  // Pre-normalize products for faster searching (eliminate repeated toLowerCase calls)
  const normalizedProducts = useMemo(() => {
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

  // Memoize filtered products - only recalculate when products or search changes
  const filteredProducts = useMemo(() => {
    const rawTerm = debouncedSearchTerm.trim();
    
    // Classic mode: only show if searching
    if (mode === 'classic' && !rawTerm) return [];

    // Catalog mode or while searching: Show results
    if (!rawTerm) return normalizedProducts.slice(0, 60);

    const normTerm = normalizeText(rawTerm);
    const searchWords = normTerm.split(/\s+/).filter(Boolean);

    if (searchWords.length === 0) return normalizedProducts.slice(0, 60);

    // Scoring and filtering products by relevance
    const scoredProducts = normalizedProducts
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
          const inName = (searchType === 'name' || searchType === 'all') && product._name_norm.includes(word);
          const inBarcode = (searchType === 'barcode' || searchType === 'all') && product._all_barcodes_norm.some(b => b.includes(word));
          const inCode = (searchType === 'id' || searchType === 'all') && product._internal_code_norm.includes(word);
          const inCategory = (searchType === 'category' || searchType === 'all') && product._category_norm.includes(word);

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
      const nameA = a.product._name_norm;
      const nameB = b.product._name_norm;
      return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
    });

    const sortedProducts = scoredProducts.map(item => item.product);

    // --- DEDUPLICACION DE BUNDLES ---
    let filtered = sortedProducts;
    const hasBundleMatch = filtered.some(p =>
      p.barcodes?.some(b => {
        const isExact = normalizeText(b.barcode) === normTerm;
        const qty = Number(b.quantity) || 1;
        const disc = Number(b.discount_value) || 0;
        return isExact && (qty > 1 || disc > 0);
      })
    );
    
    if (hasBundleMatch) {
      filtered = filtered.filter(p => {
        const isPrimaryBarcode = p._barcode_norm === normTerm;
        if (!isPrimaryBarcode) return true;
        const hasBundleRule = p.barcodes?.some(b => {
          return normalizeText(b.barcode) === normTerm && ((Number(b.quantity) || 1) > 1 || (Number(b.discount_value) || 0) > 0);
        });
        return !!hasBundleRule;
      });
    }

    const withBundles = filtered.map(p => ({
      ...p,
      _matchedBundle: normTerm
        ? p.barcodes?.find(b => normalizeText(b.barcode) === normTerm) ?? null
        : null,
    }));

    return withBundles.slice(0, 60);
  }, [normalizedProducts, debouncedSearchTerm, searchType, mode, normalizeText]);

  // Reset focused index when search results change
  useEffect(() => {
    setFocusedIndex(0);
  }, [debouncedSearchTerm, filteredProducts.length]);

  // Instant Auto-select on exact Barcode scan without waiting for debounce
  // NOTE: sets barcodeAutoAddedRef so the Enter keydown handler won't double-add.
  useEffect(() => {
    const search = searchTerm.trim();
    if (!search) return;

    const norm = normalizeText(search);
    const directMatch = barcodeMap.get(norm);

    if (directMatch && /^\d{4,}$/.test(norm)) {
      const { product, bundle } = directMatch;
      const qty = bundle ? (Number(bundle.quantity) || 1) : 1;
      const discount = bundle ? (Number(bundle.discount_value) || 0) : 0;
      const type = bundle?.discount_type || 'percentage';
      let finalPrice = product.price;

      if (discount > 0) {
        if (type === 'percentage') {
          finalPrice = product.price * (1 - discount / 100);
        } else {
          finalPrice = product.price - (discount / qty);
        }
      }

      barcodeAutoAddedRef.current = true;
      onAddToCart(product, qty, finalPrice);
      setSearchTerm('');
      if (searchInputRef.current) searchInputRef.current.value = '';
    }
  }, [searchTerm, barcodeMap, onAddToCart, setSearchTerm, normalizeText]);

  const handleSearchTypeChange = useCallback((newType: SearchType) => {
    setSearchType(newType);
    setSearchTerm('');
  }, [setSearchTerm]);

  useEffect(() => {
    setVisibleCount(40);
  }, [searchTerm]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      setVisibleCount(prev => Math.min(prev + 40, filteredProducts.length));
    }
  }, [filteredProducts.length]);

  const handleProductSelect = useCallback((product: Product, preMatchedBundle?: any) => {
    if (product.is_variable_price) {
      setSelectedVariableProduct(product);
      setIsVariablePriceDialogOpen(true);
      return;
    }

    if (product.is_variable_quantity) {
      setSelectedVariableProduct(product);
      setIsVariableQuantityDialogOpen(true);
      return;
    }

    const searchRaw = (searchTermRef.current || '').trim();
    const matchedBundle = preMatchedBundle;
    
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
  }, [onAddToCart, setSearchTerm]);

  // Busca una coincidencia EXACTA de código de barras (propio o de bundle) y
  // agrega el producto al carrito. Compartido entre Enter, el diálogo de
  // escaneo por cámara y el lector físico Sunmi — una sola lógica de match.
  const addByExactCode = useCallback((rawCode: string): ScanDetectResult => {
    const search = rawCode.toLowerCase().trim();
    if (!search) return { found: false };

    let matchedBundle: any = null;
    let exactBarcodeMatch: Product | undefined = undefined;

    for (const p of products) {
      const extraMatch = p.barcodes?.find(b => b.barcode.toLowerCase() === search);
      const q = extraMatch ? (Number(extraMatch.quantity) || 1) : 1;
      const d = extraMatch ? (Number(extraMatch.discount_value) || 0) : 0;

      if (extraMatch && (q > 1 || d > 0)) {
        matchedBundle = extraMatch;
        exactBarcodeMatch = p;
        break;
      }
    }

    if (!exactBarcodeMatch) {
      exactBarcodeMatch = products.find(p => {
        if (p.barcode && p.barcode.toLowerCase() === search) return true;
        return p.barcodes?.some(b => b.barcode.toLowerCase() === search);
      });

      if (exactBarcodeMatch && !matchedBundle) {
        matchedBundle = exactBarcodeMatch.barcodes?.find(b => b.barcode.toLowerCase() === search);
      }
    }

    if (!exactBarcodeMatch) return { found: false };

    if (matchedBundle) {
      const qty = Number(matchedBundle.quantity) || 1;
      const discount = Number(matchedBundle.discount_value) || 0;
      const type = matchedBundle.discount_type || 'percentage';
      let finalPrice = exactBarcodeMatch.price;

      if (discount > 0) {
        if (type === 'percentage') {
          finalPrice = exactBarcodeMatch.price * (1 - discount / 100);
        } else {
          finalPrice = exactBarcodeMatch.price - (discount / qty);
        }
      }
      onAddToCart(exactBarcodeMatch, qty, finalPrice);
    } else {
      handleProductSelect(exactBarcodeMatch);
    }
    setSearchTerm('');
    return { found: true, productName: exactBarcodeMatch.name };
  }, [products, onAddToCart, handleProductSelect, setSearchTerm]);

  // Igual que addByExactCode, pero además refleja el código escaneado en la
  // barra de búsqueda cuando no hay coincidencia — para que quede visible
  // arriba aunque el producto no exista en el catálogo.
  const handleScanDetect = useCallback((code: string): ScanDetectResult => {
    const result = addByExactCode(code);
    if (!result.found) {
      setSearchTerm(code);
    }
    return result;
  }, [addByExactCode, setSearchTerm]);

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Lector físico Sunmi: el nativo dispara este evento con el código leído.
  useEffect(() => {
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

  const handleVariableQuantityConfirm = useCallback((quantity: number) => {
    if (selectedVariableProduct) {
      (onAddToCart as any)(selectedVariableProduct, quantity);
      setSearchTerm('');
      setSelectedVariableProduct(null);
    }
  }, [selectedVariableProduct, onAddToCart, setSearchTerm]);

  const handleVariablePriceConfirm = useCallback((price: number, name?: string) => {
    if (selectedVariableProduct) {
      onAddToCart({ 
        ...selectedVariableProduct, 
        price,
        name: name || selectedVariableProduct.name
      });
      setSearchTerm('');
      setSelectedVariableProduct(null);
    }
  }, [selectedVariableProduct, onAddToCart, setSearchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLoading && filteredProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const rawSearch = (searchTermRef.current || searchInputRef.current?.value || '').trim();
      if (!rawSearch) return;

      // Si el useEffect de auto-escaneo ya agrego este codigo, no lo agregues
      // de nuevo aqui - evita duplicar la cantidad (ver barcodeAutoAddedRef).
      if (barcodeAutoAddedRef.current) {
        barcodeAutoAddedRef.current = false;
        return;
      }

      if (addByExactCode(rawSearch).found) return;

      if (filteredProducts.length > 0) {
        const targetProduct = filteredProducts[focusedIndex] || filteredProducts[0];
        handleProductSelect(targetProduct, (targetProduct as any)._matchedBundle);
      }
    }
  };

  const minCardWidth = {
    1: '100%',
    2: '180px',
    3: '150px',
    4: '130px',
    5: '115px',
    6: '100px'
  }[gridCols] || '150px';

  const isClassic = mode === 'classic';

  return (
    <div className={cn(
      "flex flex-col bg-background rounded-lg",
      isClassic ? "relative w-full" : "relative h-full overflow-hidden"
    )}>
      {/* Search Header - Unified for both modes */}
      <div className="p-3 border-b space-y-3 bg-card rounded-t-lg">
        <div className="flex items-center gap-2">
          {menuButton}

          {/* Search Type Buttons */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/40 overflow-x-auto scrollbar-hide shrink min-w-0">
            {searchTypes.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                onClick={() => handleSearchTypeChange(type)}
                className={cn(
                  "h-7 px-2 lg:px-2.5 text-xs gap-1.5 shrink-0 whitespace-nowrap rounded-md font-medium transition-all shadow-none",
                  searchType === type 
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/50" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={label}
              >
                <Icon className="h-3 w-3 opacity-70" />
                <span className={cn(
                  "transition-all duration-200",
                  searchType === type ? "inline-block" : "hidden xl:inline-block"
                )}>{label}</span>
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          {/* View Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-2.5 gap-1.5 shrink-0 rounded-lg border-border/40 bg-background hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground shadow-none"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vista</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Diseño del POS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onLayoutModeChange?.('classic')} className="justify-between cursor-pointer">
                Clásico (Búsqueda)
                {mode === 'classic' && <div className="h-2 w-2 rounded-full bg-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onLayoutModeChange?.('catalog')} className="justify-between cursor-pointer">
                Catálogo (Grilla)
                {mode === 'catalog' && <div className="h-2 w-2 rounded-full bg-primary" />}
              </DropdownMenuItem>

              {!isClassic && (
                <>
                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>Vista de Productos</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onViewModeChange?.('list')} className="justify-between cursor-pointer">
                    <span className="flex items-center gap-2">
                      <ListIcon className="h-4 w-4" /> Lista
                    </span>
                    {viewMode === 'list' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onViewModeChange?.('grid')} className="justify-between cursor-pointer">
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" /> Cuadros
                    </span>
                    {viewMode === 'grid' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </DropdownMenuItem>

                  {viewMode === 'grid' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Columnas</DropdownMenuLabel>
                      <div className="grid grid-cols-5 gap-1 p-1">
                        {[2, 3, 4, 5, 6].map((cols) => (
                          <Button
                            key={cols}
                            variant={gridCols === cols ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-full p-0"
                            onClick={(e) => {
                              e.preventDefault();
                              onGridColsChange?.(cols);
                            }}
                          >
                            {cols}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="shrink-0">
            {actionButton}
          </div>
        </div>

        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={
              searchType === 'all' ? 'Buscar por nombre, código o categoría...' :
              searchType === 'name' ? 'Buscar por nombre...' :
              searchType === 'barcode' ? 'Buscar por código de barras...' :
              searchType === 'id' ? 'Buscar por código interno...' :
              'Buscar por categoría...'
            }
            className="pl-10 pr-28 h-11 bg-background border-border/40 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setFocusedIndex(-1); // Reset focus when typing
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocusedInput(true);
              onSearchFocus?.();
            }}
            onBlur={() => setIsFocusedInput(false)}
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setIsScannerOpen(true)}
              title="Escanear código de barras o QR"
            >
              <ScanBarcode className="h-4 w-4" />
            </Button>
            {onRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={onRefresh}
                disabled={isLoading}
                title="Sincronizar productos"
              >
                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/20 text-[10px] uppercase font-bold text-muted-foreground tracking-wider pointer-events-none">
              <span className="text-[14px]">⏎</span>
              <span>Enter</span>
            </div>
          </div>
        </div>

        <BarcodeScannerPanel
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onDetect={handleScanDetect}
        />
      </div>

      {/* Product List/Grid */}
      <div 
        className={cn(
          "bg-muted/10 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
          isClassic ? "absolute top-full left-0 right-0 z-50 mt-1 shadow-lg rounded-b-lg border bg-background max-h-[60vh]" : "flex-1 min-h-0",
          (!filteredProducts.length && isClassic && !searchTerm) ? "hidden" : ""
        )}
        onScroll={handleScroll}
      >
        {isLoading && filteredProducts.length === 0 ? (
          <div
            className={cn(viewMode === 'list' && "flex flex-col gap-3")}
            style={viewMode === 'grid' ? {
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
              gap: '12px'
            } : undefined}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium text-sm">No se encontraron productos</p>
            {searchTerm && <p className="text-xs text-muted-foreground mt-0.5">Prueba con otro término</p>}
          </div>
        ) : (
          <div
            className={cn(viewMode === 'list' && "flex flex-col gap-3")}
            style={viewMode === 'grid' ? {
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
              gap: '12px'
            } : undefined}
          >
            {filteredProducts.slice(0, visibleCount).map((product, index) => {
              // Use pre-computed matchedBundle from memo (no per-render lookup)
              const matchedBundle = (product as any)._matchedBundle ?? null;
              
              return (
                <ProductItem 
                  key={product.id}
                  product={product}
                  viewMode={viewMode}
                  minCardWidth={minCardWidth}
                  recipeAvailability={recipeAvailability}
                  onSelect={handleProductSelect}
                  isFocused={focusedIndex === index}
                  matchedBundle={matchedBundle}
                />
              );
            })}
          </div>
        )}
      </div>

      <VariablePriceDialog
        isOpen={isVariablePriceDialogOpen}
        onClose={() => setIsVariablePriceDialogOpen(false)}
        onConfirm={handleVariablePriceConfirm}
        product={selectedVariableProduct}
      />
      <QuantityDialog
        isOpen={isVariableQuantityDialogOpen}
        onClose={() => setIsVariableQuantityDialogOpen(false)}
        onConfirm={handleVariableQuantityConfirm}
        itemName={selectedVariableProduct?.name || ''}
        currentQuantity={1}
      />
    </div>
  );
}), (prev, next) => {
  return (
    prev.products === next.products &&
    prev.actionButton === next.actionButton &&
    prev.gridCols === next.gridCols &&
    prev.viewMode === next.viewMode &&
    prev.mode === next.mode &&
    prev.isLoading === next.isLoading &&
    prev.recipeAvailability === next.recipeAvailability &&
    prev.userName === next.userName
  );
});

ProductSearchList.displayName = 'ProductSearchList';

export default ProductSearchList;