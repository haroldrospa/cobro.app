import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { POSSearchProvider, usePOSSearch } from '@/contexts/POSSearchContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CartItem, GlobalDiscount } from '@/types/pos';
import { calculateItemTotal, calculateTotals } from '@/utils/posCalculations';
import { useMasterData } from '@/providers/MasterDataProvider';
import { Customer, useUpdateCustomer } from '@/hooks/useCustomers';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useCreateSaleOffline } from '@/hooks/useSalesOffline';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Maximize, Minimize, Menu, Home, Package, Users, FileText, BarChart,
  Settings as SettingsIcon, Store, LogOut, Save, ClipboardList, Receipt,
  RefreshCcw, HandCoins, Lock, Unlock, AlertCircle, Crown, DollarSign, ChefHat, Bike,
  Menu as MenuIcon, User, Layers, Info, HelpCircle, Search, ChevronRight
} from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';

import { useNavigate } from 'react-router-dom';
import { useAllActiveOffers, calculateBestOffer } from '@/hooks/useProductOffers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { startOfMonth, endOfMonth } from 'date-fns';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { cn } from '@/lib/utils';

import CartSummary from './pos/CartSummary';
import PaymentSummary from './pos/PaymentSummary';
import PaymentDialog from './pos/PaymentDialog';
// Lazy: arrastra jsPDF + html2canvas, y solo hace falta al terminar una venta
const PrintOptionsDialog = lazy(() => import('./pos/PrintOptionsDialog'));
import ProductSearchList from './pos/ProductSearchList';
import WebSalesDialog from './pos/WebSalesDialog';
import OpenAccountsDialog from './pos/OpenAccountsDialog';
import SaveOrderDialog from './pos/SaveOrderDialog';
import DailySalesDialog from './pos/DailySalesDialog';
import RefundDialog from './pos/RefundDialog';
import CashMovementsDialog from './pos/CashMovementsDialog';
import CloseDayDialog from './pos/CloseDayDialog';
import OpenRegisterDialog from './pos/OpenRegisterDialog';
import { useActiveSession } from '@/hooks/useCashSession';
import { useUserProfile } from '@/hooks/useUserProfile';
// Lazy: arrastra jsPDF, y solo hace falta al abrir un estado de cuenta a crédito
const CustomerCreditDialog = lazy(() => import('./customers/CustomerCreditDialog'));
import { LimitReachedDialog } from './subscription/PlanRestrictions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { useUserStore } from '@/hooks/useUserStore';
import { useAlanubeConfig } from '@/hooks/useAlanubeConfig';
import { useWebOrdersCount } from '@/hooks/useWebOrdersCount';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useSavedCart, useAutoSaveCart } from '@/hooks/useSavedCart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWebOrderNotifications } from '@/hooks/useWebOrderNotifications';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import MobilePOSLayout from './pos/MobilePOSLayout';
import MobileProductSearch from './pos/MobileProductSearch';
import MobileCartView from './pos/MobileCartView';
import MobilePaymentView from './pos/MobilePaymentView';
import { useBusinessType } from '@/hooks/useBusinessType';
import { useRecipeAvailability } from '@/hooks/useRecipeAvailability';
import { useAwardLoyaltyPoints, calculatePointsValue } from '@/hooks/useLoyaltyPoints';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { sendEvolutionWhatsAppMessage } from '@/utils/evolutionApi';

class SimpleErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("POS Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-background">
          <div className="p-6 max-w-md w-full bg-destructive/10 border border-destructive/20 rounded-lg">
            <h2 className="text-xl font-bold text-destructive mb-2">Ha ocurrido un error</h2>
            <p className="text-sm text-muted-foreground mb-4">
              El sistema ha encontrado un error inesperado.
            </p>
            <div className="bg-card p-3 rounded text-xs font-mono text-left overflow-auto max-h-40 mb-4 border">
              {this.state.error?.message || 'Error desconocido'}
            </div>
            <Button onClick={() => window.location.reload()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recargar Página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const POSContent: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { skipKitchenStep, isStore, isSupermarket, orderTypeLabels, orderTypeTags } = useBusinessType();
  const recipeAvailability = useRecipeAvailability();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState('B02');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [userClosedRegisterDialog, setUserClosedRegisterDialog] = useState(false);
  const [showPrintOptionsDialog, setShowPrintOptionsDialog] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [creditDays, setCreditDays] = useState(15);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('pos_mobile_view_mode');
    return (saved as 'grid' | 'list') || 'list';
  });

  const handleMobileViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setMobileViewMode(mode);
    localStorage.setItem('pos_mobile_view_mode', mode);
  }, []);

  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscount>({ value: 0, type: 'percentage' });
  const { data: userStore } = useUserStore();
  const [isWebSalesDialogOpen, setIsWebSalesDialogOpen] = useState(false);

  // Real-time web order notifications
  useWebOrderNotifications({
    storeId: userStore?.id,
    enabled: true,
  });

  // Real-time chat notifications
  useChatNotifications({
    storeId: userStore?.id,
    role: 'store',
    enabled: true,
  });
  const [showWebSalesDialog, setShowWebSalesDialog] = useState(false);
  const [showOpenAccountsDialog, setShowOpenAccountsDialog] = useState(false);
  const [showSaveOrderDialog, setShowSaveOrderDialog] = useState(false);
  const [currentWebOrderId, setCurrentWebOrderId] = useState<string | null>(null);
  const [currentOrderInfo, setCurrentOrderInfo] = useState<{ orderNumber: string; customerName: string; notes?: string } | null>(null);
  const [currentOrderSource, setCurrentOrderSource] = useState<'pos' | 'web'>('pos');
  const [posOrderType, setPosOrderType] = useState<'dine-in' | 'takeout'>('dine-in');
  const [showDailySalesDialog, setShowDailySalesDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCashMovementsDialog, setShowCashMovementsDialog] = useState(false);
  const [showCloseDayDialog, setShowCloseDayDialog] = useState(false);
  const [showDebtSelectDialog, setShowDebtSelectDialog] = useState(false);
  const [selectedCustomerForDebt, setSelectedCustomerForDebt] = useState<any | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  // Phone warning dialog state
  const [showNoPhoneDialog, setShowNoPhoneDialog] = useState(false);
  const [noPhoneCustomer, setNoPhoneCustomer] = useState<Customer | null>(null);
  const [quickPhoneInput, setQuickPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);


  // Loyalty Points state
  const [loyaltyCustomerId, setLoyaltyCustomerId] = useState<string>('');
  const [loyaltyRedeemedPoints, setLoyaltyRedeemedPoints] = useState(0);
  const [loyaltyDiscountAmount, setLoyaltyDiscountAmount] = useState(0);
  const [loyaltyCurrentPoints, setLoyaltyCurrentPoints] = useState<number | undefined>(undefined);
  const awardLoyaltyPoints = useAwardLoyaltyPoints();
  const { companyInfo } = usePrintSettings();
  const isProcessingRef = React.useRef(false);
  const searchInputRef = React.useRef<any>(null);
  const mobileSearchRef = React.useRef<any>(null);

  // Focus search input when PrintOptionsDialog is closed (only on desktop to prevent mobile keyboard from opening)
  useEffect(() => {
    if (!showPrintOptionsDialog && !isMobile) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showPrintOptionsDialog, isMobile]);

  // When a customer is found via RNC in the loyalty panel, also select them
  // as the invoice customer so credit payment works without manual re-selection.
  const handleLoyaltyCustomerFound = useCallback((customerId: string) => {
    setLoyaltyCustomerId(customerId);
    setSelectedCustomer(customerId); // Sync with invoice customer field
  }, []);

  const handleLoyaltyPointsRedeemed = useCallback((discountAmount: number, pointsUsed: number) => {
    setLoyaltyRedeemedPoints(pointsUsed);
    setLoyaltyDiscountAmount(discountAmount);
    // Apply as a fixed discount
    setGlobalDiscount({ value: discountAmount, type: 'amount' });
  }, []);

  const handleLoyaltyClearRedemption = useCallback(() => {
    setLoyaltyRedeemedPoints(0);
    setLoyaltyDiscountAmount(0);
    setGlobalDiscount({ value: 0, type: 'percentage' });
  }, []);

  const handleLoyaltyPointsBalance = useCallback((currentPoints: number) => {
    setLoyaltyCurrentPoints(currentPoints);
  }, []);

  const { data: activeSession, isLoading: isLoadingSession, isFetching: isFetchingSession } = useActiveSession();

  const handleSearchFocus = useCallback(() => {
    if (!activeSession) {
      setUserClosedRegisterDialog(false);
    }
  }, [activeSession]);
  const { profile: rawProfile, isLoading: isLoadingProfile, isPending: isPendingProfile } = useUserProfile();
  const profile = rawProfile || {
    id: '00000000-0000-0000-0000-000000000000',
    full_name: 'Usuario',
    email: '',
    user_number: '',
    store_id: '00000000-0000-0000-0000-000000000000',
    role: 'admin',
    is_active: true,
  };

  const storeId = (profile?.store_id && profile.store_id !== '00000000-0000-0000-0000-000000000000') ? profile.store_id : undefined;

  const { products: allProducts, customers = [], refreshMasterData, isLoading: isMasterDataLoading } = useMasterData();
  const updateCustomerMutation = useUpdateCustomer();
  const loadingProducts = isMasterDataLoading && allProducts.length === 0;
  const products = React.useMemo(() => allProducts.filter(p => p.status !== 'inactive'), [allProducts]);
  const { data: customerBalance } = useCustomerBalance(selectedCustomer);
  const { data: invoiceTypes = [] } = useInvoiceTypes();
  const createSale = useCreateSaleOffline();
  const { toast } = useToast();

  // Detect when a customer without phone is selected
  useEffect(() => {
    if (!selectedCustomer) {
      setShowNoPhoneDialog(false);
      setNoPhoneCustomer(null);
      return;
    }
    const found = customers.find(c => c.id === selectedCustomer);
    if (found && !found.phone) {
      setNoPhoneCustomer(found);
      setQuickPhoneInput('');
      setShowNoPhoneDialog(true);
    } else {
      setShowNoPhoneDialog(false);
      setNoPhoneCustomer(null);
    }
  }, [selectedCustomer, customers]);
  const { data: rawStore, isLoading: isLoadingStore, isPending: isPendingStore } = useUserStore();
  const store = rawStore || {
    id: profile?.store_id || '00000000-0000-0000-0000-000000000000',
    store_code: 'STORE',
    store_name: 'Mi Tienda',
    slug: 'mi-tienda',
    is_active: true,
  };
  const { settings: rawStoreSettings, loadingSettings, updateSettings } = useStoreSettings();
  const storeSettings = {
    invoice_prefix: 'FAC-',
    auto_increment: true,
    show_tax: true,
    default_tax_rate: 18,
    currency: 'DOP',
    payment_terms: 15,
    invoice_footer_text: 'Gracias por su preferencia',
    payment_methods: [
      { id: 'cash', name: 'Efectivo', enabled: true },
      { id: 'card', name: 'Tarjeta', enabled: true, surcharge_percentage: 0 },
      { id: 'transfer', name: 'Transferencia', enabled: true },
      { id: 'check', name: 'Cheque', enabled: true },
      { id: 'credit', name: 'Crédito', enabled: true }
    ],
    low_stock_alert: true,
    low_stock_threshold: 10,
    notifications_enabled: true,
    auto_backup: false,
    theme: 'light',
    language: 'es',
    timezone: 'America/Santo_Domingo',
    paper_size: '80mm',
    use_thermal_printer: false,
    thermal_printer_name: null,
    show_barcode: false,
    invoice_font_size: 12,
    web_order_sound_enabled: true,
    web_order_sound_type: 'chime',
    web_order_sound_volume: 0.7,
    afp_rate: 2.87,
    sfs_rate: 3.04,
    isr_rate: 0,
    infotep_rate: 1.0,
    enable_afp: true,
    enable_sfs: true,
    enable_isr: false,
    enable_infotep: false,
    afp_type: 'percentage',
    sfs_type: 'percentage',
    isr_type: 'percentage',
    infotep_type: 'percentage',
    pos_view_mode: 'grid',
    pos_layout_mode: 'catalog',
    ...rawStoreSettings
  } as any;
  const { config: alanubeConfig } = useAlanubeConfig();
  const isElectronicActive = alanubeConfig?.is_active || false;

  useEffect(() => {
    if (storeSettings?.payment_terms != null && Number(storeSettings.payment_terms) > 0) {
      setCreditDays(Number(storeSettings.payment_terms));
    }
  }, [storeSettings?.payment_terms]);

  const selectedInvoiceTypeData = invoiceTypes.find(t => t.id === selectedInvoiceType);
  const mappedInvoiceTypeCode = React.useMemo(() => {
    if (!selectedInvoiceTypeData?.code) return selectedInvoiceTypeData?.code;
    if (!isElectronicActive) return selectedInvoiceTypeData.code;
    
    const code = selectedInvoiceTypeData.code;
    if (code === 'B01') return 'E31';
    if (code === 'B02') return 'E32';
    if (code === 'B03') return 'E33';
    if (code === 'B04') return 'E34';
    if (code === 'B11') return 'E41';
    if (code === 'B12') return 'E43';
    if (code === 'B13') return 'E44';
    if (code === 'B14') return 'E45';
    if (code === 'B15') return 'E46';
    if (code === 'B16') return 'E47';
    
    if (code.startsWith('B')) {
      return 'E' + code.substring(1);
    }
    return code;
  }, [selectedInvoiceTypeData, isElectronicActive]);

  const requiresCustomer = React.useMemo(() => {
    if (!mappedInvoiceTypeCode) return false;
    const code = mappedInvoiceTypeCode;
    if (['B02', 'E32', 'B12', 'E43', 'B13', 'E44'].includes(code)) return false;
    return true;
  }, [mappedInvoiceTypeCode]);



  // Notificaciones manejadas globalmente en OfflineIndicator



  const { data: webOrdersCount = 0 } = useWebOrdersCount();
  const { data: activeOffers = [] } = useAllActiveOffers();

  // Check Plan Limits
  const { hasReachedLimit, features } = usePlanFeatures();
  const currentMonth = new Date();
  // Only fetch if we need to check limits (not enterprise)
  const shouldCheckLimits = features.maxInvoicesPerMonth !== Infinity;

  // Check invoice count for plan limits — fetch only IDs (count), not full sales with items
  const { data: monthlySalesCount = 0 } = useQuery({
    queryKey: ['monthly-sales-count', startOfMonth(currentMonth).toISOString()],
    queryFn: async () => {
      const authRes = await supabase.auth.getUser();
      const user = authRes?.data?.user;
      if (!user) return 0;
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle();
      if (!profile?.store_id) return 0;
      const { count, error } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', profile.store_id)
        .gte('created_at', startOfMonth(currentMonth).toISOString())
        .lte('created_at', endOfMonth(currentMonth).toISOString());
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: shouldCheckLimits, // Only run if the plan has a limit
  });

  const isInvoiceLimitReached = hasReachedLimit('invoices', monthlySalesCount);

  // Map de ofertas por producto O(1) para evitar filtrado O(N) en cada render del carrito
  const offersByProductId = React.useMemo(() => {
    const map = new Map<string, typeof activeOffers>();
    for (let i = 0; i < activeOffers.length; i++) {
      const o = activeOffers[i];
      if (!o.product_id) continue;
      const existing = map.get(o.product_id) || [];
      existing.push(o);
      map.set(o.product_id, existing);
    }
    return map;
  }, [activeOffers]);

  // Calcular ofertas automáticamente
  const cartWithOffers = React.useMemo(() => {
    if (!cart.length) return [];
    return cart.map(item => {
      // Buscar ofertas para este producto en O(1)
      const productOffers = offersByProductId.get(item.id);

      // Si hay ofertas, calcular el mejor precio
      if (productOffers && productOffers.length > 0) {
        // Usamos item.originalPrice si existe (para no aplicar oferta sobre oferta), o item.price
        const basePrice = item.originalPrice || item.price;
        const { appliedOffer, finalPrice, pricePerUnit, savings } = calculateBestOffer(item.quantity, basePrice, productOffers);

        if (appliedOffer) {
          return {
            ...item,
            price: pricePerUnit, // Precio efectivo por unidad
            originalPrice: basePrice, // Guardar precio base real
            offerApplied: {
              id: appliedOffer.id,
              name: `${appliedOffer.quantity}x$${appliedOffer.offer_price}`,
              quantity: appliedOffer.quantity,
              price: appliedOffer.offer_price,
              savings: savings
            }
          };
        }

        // Si no aplica oferta pero tenía originalPrice, restaurar (por si bajó la cantidad y ya no aplica)
        if (item.originalPrice) {
          return {
            ...item,
            price: item.originalPrice,
            originalPrice: undefined,
            offerApplied: undefined
          };
        }
      }
      return item;
    });
  }, [cart, offersByProductId]);

  const totals = React.useMemo(() => calculateTotals(cartWithOffers, globalDiscount), [cartWithOffers, globalDiscount]);

  const { savedCartData, isLoading: isLoadingSavedCart } = useSavedCart();

  // Memoize auto-save data to prevent unnecessary re-renders
  const autoSaveData = React.useMemo(() => ({
    items: cart,
    orderMetadata: currentWebOrderId ? {
      orderId: currentWebOrderId,
      orderNumber: currentOrderInfo?.orderNumber || '',
      customerName: currentOrderInfo?.customerName || '',
      notes: currentOrderInfo?.notes,
      source: currentOrderSource
    } : undefined,
    globalDiscount,
    selectedCustomer
  }), [cart, currentWebOrderId, currentOrderInfo, currentOrderSource, globalDiscount, selectedCustomer]);

  // Auto-save cart with complete metadata (only when loading has completed)
  useAutoSaveCart(autoSaveData, cartLoaded);

  // Load saved cart on mount with full metadata restoration
  useEffect(() => {
    if (!cartLoaded && savedCartData) {
      // Restore cart items
      if (savedCartData.items && savedCartData.items.length > 0) {
        setCart(savedCartData.items);

        // Restore order metadata if it exists
        if (savedCartData.orderMetadata) {
          setCurrentWebOrderId(savedCartData.orderMetadata.orderId);
          setCurrentOrderInfo({
            orderNumber: savedCartData.orderMetadata.orderNumber,
            customerName: savedCartData.orderMetadata.customerName,
            notes: savedCartData.orderMetadata.notes
          });
          setCurrentOrderSource(savedCartData.orderMetadata.source);
        }

        // Restore global discount
        if (savedCartData.globalDiscount) {
          setGlobalDiscount(savedCartData.globalDiscount);
        }

        // Restore selected customer
        if (savedCartData.selectedCustomer) {
          setSelectedCustomer(savedCartData.selectedCustomer);
        }

        setCartLoaded(true);
      } else {
        setCartLoaded(true);
      }
    } else if (!isLoadingSavedCart && !cartLoaded) {
      setCartLoaded(true);
    }
  }, [savedCartData, cartLoaded, isLoadingSavedCart]);

  // Automatically clear active order reference if the cart becomes empty
  useEffect(() => {
    if (cartLoaded && cart.length === 0 && currentWebOrderId !== null) {
      setCurrentWebOrderId(null);
      setCurrentOrderInfo(null);
    }
  }, [cart.length, currentWebOrderId, cartLoaded]);

  // Set default invoice type
  useEffect(() => {
    if (invoiceTypes.length > 0 && !selectedInvoiceType) {
      const b02 = invoiceTypes.find(t => t.code === 'B02');
      if (b02) {
        setSelectedInvoiceType(b02.id);
      }
    }
  }, [invoiceTypes, selectedInvoiceType]);

  const addToCart = useCallback((product: any, quantity: number = 1, forcedPrice?: number) => {
    if (!activeSession) {
      setUserClosedRegisterDialog(false);
      toast({
        title: "Sesión requerida",
        description: "Debe abrir un turno de caja para poder agregar productos.",
        variant: "destructive"
      });
      return;
    }

    const priceToUse = forcedPrice !== undefined ? forcedPrice : product.price;
    const isAdicional = product.name.toLowerCase().includes('adicional') || product.name.toLowerCase().includes('extra');

    setCart(prevCart => {
      // Buscar un item que coincida con ID Y PRECIO para evitar mezclar precios de bundle con normales
      // Pero si es un adicional/extra, no lo agrupamos para que aparezcan en líneas separadas con notas independientes.
      const existingItem = isAdicional
        ? null
        : prevCart.find(item => item.id === product.id && item.price === priceToUse);

      if (existingItem) {
        // Mover el item existente al principio y actualizar cantidad
        const updatedItem = {
          ...existingItem,
          quantity: existingItem.quantity + quantity
        };
        return [updatedItem, ...prevCart.filter(item => {
          if (existingItem.cartItemId && item.cartItemId) {
            return item.cartItemId !== existingItem.cartItemId;
          }
          return !(item.id === product.id && item.price === priceToUse);
        })];
      } else {
        // Agregar nuevo item al principio con un ID de carrito único
        const cartItemId = `${product.id}-${Date.now()}-${Math.random()}`;
        return [{
          id: product.id,
          cartItemId,
          name: product.name,
          price: priceToUse,
          quantity: quantity,
          tax: (product.tax_percentage !== undefined ? product.tax_percentage : 18) / 100,
          cost_includes_tax: product.cost_includes_tax || false,
          image_url: product.image_url
        }, ...prevCart];
      }
    });
    // Search is cleared by the individual search components after selection
  }, [activeSession, toast]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setCart(prevCart => {
      if (quantity <= 0) {
        return prevCart.filter(item => item.cartItemId !== id && item.id !== id);
      }
      return prevCart.map(item => (item.cartItemId === id || item.id === id) ? { ...item, quantity } : item);
    });
  }, []);

  const updateComment = useCallback((id: string, comment: string) => {
    setCart(prevCart => prevCart.map(item => (item.cartItemId === id || item.id === id) ? { ...item, comment } : item));
  }, []);

  const updateDiscount = useCallback((id: string, value: number, type: 'percentage' | 'amount') => {
    setCart(prevCart => prevCart.map(item =>
      (item.cartItemId === id || item.id === id)
        ? { ...item, discount: value > 0 ? { value, type } : undefined }
        : item
    ));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prevCart => prevCart.filter(item => item.cartItemId !== id && item.id !== id));
  }, []);

  const addExtraToCartItem = useCallback((cartItemId: string, extra: any) => {
    setCart(prevCart => prevCart.map(item => {
      const match = (item.cartItemId && item.cartItemId === cartItemId) || item.id === cartItemId || (item.cartItemId || item.id) === cartItemId;
      if (match) {
        const currentExtras = item.selectedExtras || [];
        return {
          ...item,
          selectedExtras: [...currentExtras, extra]
        };
      }
      return item;
    }));
  }, []);

  const removeExtraFromCartItem = useCallback((cartItemId: string, extraId: string) => {
    setCart(prevCart => prevCart.map(item => {
      const match = (item.cartItemId && item.cartItemId === cartItemId) || item.id === cartItemId || (item.cartItemId || item.id) === cartItemId;
      if (match) {
        const currentExtras = item.selectedExtras || [];
        return {
          ...item,
          selectedExtras: currentExtras.filter(e => e.id !== extraId)
        };
      }
      return item;
    }));
  }, []);

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return;

    if (!activeSession) {
      setUserClosedRegisterDialog(false);
      toast({
        title: "Sesión requerida",
        description: "Debe abrir un turno de caja para poder facturar.",
        variant: "destructive"
      });
      return;
    }

    if (isInvoiceLimitReached) {
      setShowLimitDialog(true);
      return;
    }

    // Auto-fill amount received if web order has change info
    if (currentOrderSource === 'web' && currentOrderInfo?.notes) {
      const changeMatch = currentOrderInfo.notes.match(/\[CAMBIO DE: ([\d.]+)\]/);
      if (changeMatch && changeMatch[1]) {
        setAmountReceived(changeMatch[1]);
      } else if (currentOrderInfo.notes.includes('[EFECTIVO EXACTO]')) {
        setAmountReceived(totals.total.replace(/,/g, ''));
      }
    } else {
      // Default to exact amount for faster processing
      setAmountReceived(totals.total.replace(/,/g, ''));
    }

    setShowPaymentDialog(true);
  }, [cart.length, activeSession, isInvoiceLimitReached, currentOrderSource, currentOrderInfo, totals.total, toast]);

  const queryClient = useQueryClient();

  const processPayment = async (includePreviousDebt: boolean = false, splitMethodParam?: string) => {
    if (isProcessingRef.current || createSale.isPending) return;
    isProcessingRef.current = true;

    // Generar un ID estable para esta venta para prevenir duplicados en caso de reintentos
    const saleId = crypto.randomUUID();
    // Recalculate totals to ensure freshness
    const currentTotals = calculateTotals(cartWithOffers, globalDiscount);
    const baseTotal = parseFloat(currentTotals.total) || 0;

    // Validate baseTotal to prevent NaN
    if (isNaN(baseTotal) || baseTotal < 0) {
      console.error('Error: Total inválido', { currentTotals, baseTotal });
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo calcular el total de la venta' });
      return;
    }

    // Calculate surcharge logic
    const cardMethod = storeSettings?.payment_methods?.find(m => m.id === 'card');
    const surchargePercentage = (paymentMethod === 'card' && cardMethod?.enabled) ? (cardMethod.surcharge_percentage || 0) : 0;
    const surchargeAmount = surchargePercentage > 0 ? (baseTotal * surchargePercentage / 100) : 0;
    const previousDebtAmount = includePreviousDebt ? (customerBalance?.totalDebt || 0) : 0;
    const finalTotal = baseTotal + surchargeAmount + previousDebtAmount;

    const received = parseFloat(amountReceived) || 0;
    const change = received - finalTotal;

    let dueDate = null;
    let paymentStatus = 'paid';
    if (paymentMethod === 'credit') {
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + creditDays);
      dueDate = dueDateObj.toISOString();
      paymentStatus = 'pending';
    }

    // Prepare items including surcharge
    const saleItems = [...cartWithOffers];
    if (surchargeAmount > 0) {
      saleItems.push({
        id: 'surcharge-card',
        name: `Recargo Tarjeta (${surchargePercentage}%)`,
        price: surchargeAmount,
        quantity: 1,
        tax: 0,
        cost_includes_tax: false
      } as CartItem);
    }

    if (includePreviousDebt && previousDebtAmount > 0) {
      saleItems.push({
        id: 'previous-debt-payment',
        name: `Pago de Deuda Anterior`,
        price: previousDebtAmount,
        quantity: 1,
        tax: 0,
        cost_includes_tax: false
      } as CartItem);
    }

    const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
    const selectedInvoiceTypeData = invoiceTypes.find(t => t.id === selectedInvoiceType);

    try {
      // Create sale and wait for completion to get the real invoice number
      const saleResult = await createSale.mutateAsync({
        id: saleId, // Pasar el ID generado para asegurar idempotencia
        customer_id: selectedCustomer || undefined,
        invoice_type_id: selectedInvoiceType,
        invoice_type_code: selectedInvoiceTypeData?.code,
        is_electronic: isElectronicActive,
        store_id: store?.id || undefined,
        subtotal: parseFloat(currentTotals.subtotal) + surchargeAmount + (includePreviousDebt ? previousDebtAmount : 0),
        discount_total: parseFloat(currentTotals.discount),
        tax_total: parseFloat(currentTotals.tax),
        total: finalTotal,
        payment_method: paymentMethod,
        amount_received: paymentMethod === 'cash' || paymentMethod === 'split' ? received : finalTotal,
        change_amount: paymentMethod === 'cash' ? (change >= 0 ? change : 0) : 0,
        split_cash: paymentMethod === 'split' ? received : null,
        split_method: paymentMethod === 'split' ? splitMethodParam : null,
        payment_status: paymentStatus,
        due_date: dueDate,
        items: saleItems,
        profile_id: profile?.id
      });

      // Si se incluyó la deuda anterior, marcar las facturas pendientes como pagadas
      if (includePreviousDebt && customerBalance?.pendingSales) {
        await Promise.all(
          customerBalance.pendingSales.map(sale =>
            supabase
              .from('sales')
              .update({ payment_status: 'paid' })
              .eq('id', sale.id)
          )
        );
        // Invalidar balances
        queryClient.invalidateQueries({ queryKey: ['customer-balance', selectedCustomer] });
      }

      // Prepare sale data for immediate display
      const customerForPoints = loyaltyCustomerId || selectedCustomer;
      const loyaltyPointsEarnedNow = customerForPoints ? Math.floor(finalTotal / 100) : undefined;
      // Compute new balance: current points - redeemed + earned
      const loyaltyNewBalance = loyaltyCurrentPoints !== undefined
        ? loyaltyCurrentPoints - loyaltyRedeemedPoints + (loyaltyPointsEarnedNow || 0)
        : undefined;
      const finalSaleData = {
        ...saleResult,
        items: saleItems.map(item => ({
          ...item,
          total: calculateItemTotal(item)
        })),
        customer: selectedCustomerData,
        invoiceType: selectedInvoiceTypeData?.code || selectedInvoiceTypeData?.name || 'B01',
        totals: {
          ...currentTotals,
          total: (finalTotal || 0).toFixed(2)
        },
        change: paymentMethod === 'cash' ? change : 0,
        paymentMethod,
        previousDebt: customerBalance?.totalDebt || 0,
        customerDebt: (customerBalance?.totalDebt || 0) + (paymentMethod === 'credit' ? finalTotal : 0),
        pendingInvoicesCount: (customerBalance?.pendingSales?.length || 0) + (paymentMethod === 'credit' ? 1 : 0),
        created_at: saleResult.created_at || new Date().toISOString(),
        loyaltyPointsEarned: loyaltyPointsEarnedNow,
        loyaltyPoints: loyaltyNewBalance,
        profile: profile ? { full_name: profile.full_name } : undefined,
      };

      // Show success IMMEDIATELY
      setSaleData(finalSaleData);

      // El envío de WhatsApp automático ha sido delegado al componente PrintOptionsDialog
      // para evitar mensajes duplicados y centralizar la lógica de notificaciones.

      // Reset state for next sale
      setCart([]);
      setSelectedCustomer('');
      setAmountReceived('');
      setPaymentMethod('cash');
      setGlobalDiscount({ value: 0, type: 'percentage' });
      setShowPaymentDialog(false);
      setShowPrintOptionsDialog(true);
      setCurrentOrderInfo(null);

      // Award loyalty points if a loyalty customer was identified
      if (customerForPoints && finalTotal > 0) {
        awardLoyaltyPoints.mutate({
          customerId: customerForPoints,
          saleTotal: finalTotal,
          saleId: saleResult?.id
        });
      }
      // Reset loyalty state
      setLoyaltyCustomerId('');
      setLoyaltyRedeemedPoints(0);
      setLoyaltyDiscountAmount(0);
      setLoyaltyCurrentPoints(undefined);

      // Capture values BEFORE state resets (background kitchen block reads these)
      const capturedPaymentMethod = paymentMethod;
      const capturedPosOrderType = posOrderType;
      const capturedCurrentWebOrderId = currentWebOrderId;
      const capturedCurrentOrderSource = currentOrderSource;
      const capturedCustomerName = selectedCustomerData?.name || 'Venta Directa';
      const capturedOrderNumber = currentOrderInfo?.orderNumber;

      // Declare storeId BEFORE the async block so the cache purge can access it
      const capturedStoreId = store?.id;

      // Background: Handle kitchen order and order status updates
      (async () => {
        try {
          // UUID validator helper
          const isUuid = (str: string | null | undefined): boolean => {
            if (!str) return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
          };

          let targetOrderId: string | null = isUuid(capturedCurrentWebOrderId) ? capturedCurrentWebOrderId!.trim() : null;

          // Fallback: If currentWebOrderId was invalid/corrupted or missing, find order ID by order_number
          if (!targetOrderId && capturedOrderNumber && capturedStoreId) {
            const { data: foundOrder } = await supabase
              .from('open_orders')
              .select('id')
              .eq('order_number', capturedOrderNumber)
              .eq('store_id', capturedStoreId)
              .maybeSingle();

            if (foundOrder?.id) {
              targetOrderId = foundOrder.id;
            }
          }

          if (targetOrderId) {
            // Read current kitchen status BEFORE updating — never regress a completed order
            const { data: existingOrder } = await supabase
              .from('open_orders')
              .select('order_status')
              .eq('id', targetOrderId)
              .maybeSingle();

            // Valid order_status values: 'pending','confirmed','preparing','shipped','completed','paid','ready'
            // 'delivered' is NOT a valid DB value — use 'completed' instead for non-kitchen stores
            const kitchenAlreadyDone = existingOrder?.order_status === 'completed'
              || existingOrder?.order_status === 'shipped'
              || existingOrder?.order_status === 'paid'
              || existingOrder?.order_status === 'ready';

            let nextStatus = existingOrder?.order_status || 'preparing';
            if (skipKitchenStep) {
              // For stores/supermarkets without a kitchen, mark the order as completed
              nextStatus = 'completed';
            } else if (!kitchenAlreadyDone) {
              nextStatus = 'preparing';
            }

            const { error: updateError } = await supabase
              .from('open_orders')
              .update({
                payment_status: 'paid',
                order_status: nextStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', targetOrderId);

            if (updateError) {
              console.error('❌ Error actualizando open_orders tras el cobro:', updateError);
            } else {
              console.log(`✅ Orden ${targetOrderId} marcada como pagada / estado: ${nextStatus}`);
            }

            // Immediately purge from query cache so it disappears from OpenAccountsDialog
            const removeBilled = (old: any[] | undefined) => {
              if (!old) return [];
              return old.filter((o: any) =>
                String(o.id) !== String(targetOrderId) &&
                String(o.order_number) !== String(capturedOrderNumber)
              );
            };
            if (capturedStoreId) {
              queryClient.setQueryData(['pos-open-orders', capturedStoreId], removeBilled);
            }
            queryClient.setQueryData(['pos-open-orders'], removeBilled);
          } else if (!skipKitchenStep) {
            // For direct sales (no saved order), create a temporary "preparing" order for the kitchen
            const { data: orderNumber } = await supabase.rpc('generate_order_number', { order_source: 'pos' });
            const orderId = crypto.randomUUID();

            await supabase.from('open_orders').insert({
              id: orderId,
              order_number: orderNumber,
              customer_name: capturedCustomerName,
              payment_status: capturedPaymentMethod === 'credit' ? 'pending' : 'paid',
              payment_method: capturedPaymentMethod,
              order_status: 'preparing',
              subtotal: parseFloat(currentTotals.subtotal) + surchargeAmount,
              tax_total: parseFloat(currentTotals.tax),
              total: finalTotal,
              source: 'pos',
              notes: orderTypeTags[capturedPosOrderType],
              store_id: capturedStoreId,
              profile_id: profile?.id
            });

            const orderItems = saleItems.map(item => {
              const taxRate = item.tax || 0.18;
              const itemTotalRaw = item.price * item.quantity;
              let subtotal, taxAmount, total;

              if (item.cost_includes_tax) {
                total = itemTotalRaw;
                subtotal = total / (1 + taxRate);
                taxAmount = total - subtotal;
              } else {
                subtotal = itemTotalRaw;
                taxAmount = subtotal * taxRate;
                total = subtotal + taxAmount;
              }

              return {
                order_id: orderId,
                product_id: item.id,
                product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
                quantity: item.quantity,
                unit_price: item.price,
                tax_percentage: taxRate * 100,
                tax_amount: taxAmount,
                subtotal: subtotal,
                total: total,
                cost_includes_tax: item.cost_includes_tax || false
              };
            });

            await supabase.from('open_order_items').insert(orderItems);
          }

          // Invalidate relevant queries globally
          if (capturedStoreId) {
            queryClient.invalidateQueries({ queryKey: ['web-orders', capturedStoreId] });
            queryClient.invalidateQueries({ queryKey: ['pos-open-orders', capturedStoreId] });
            queryClient.invalidateQueries({ queryKey: ['kitchen-orders', capturedStoreId] });
            queryClient.invalidateQueries({ queryKey: ['web-orders-count', capturedStoreId] });
          }

          // Force global invalidation as fallback
          queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
          queryClient.invalidateQueries({ queryKey: ['web-orders'] });
        } catch (err) {
          console.error("Background order update failed:", err);
        }
      })();

      setCurrentWebOrderId(null);

    } catch (error: any) {
      // This should rarely happen since we handle errors gracefully in the background
      console.error('Error processing sale:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al procesar la venta. Inténtalo de nuevo.",
      });
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleLoadWebOrder = (items: CartItem[], orderId?: string, customerName?: string, orderNumber?: string, source?: 'pos' | 'web', notes?: string) => {
    // If items is an array of CartItem, use directly
    if (Array.isArray(items) && items.length > 0) {
      setCart(items);
      if (orderId) {
        setCurrentWebOrderId(orderId);
      }
      if (orderNumber && customerName) {
        setCurrentOrderInfo({ orderNumber, customerName, notes });
      }
      setCurrentOrderSource(source || 'pos');
      return;
    }

    // Legacy support: if items is actually an order object
    const order = items as any;
    const cartItems: CartItem[] = order.items?.map((item: any) => ({
      id: item.product_id || item.id,
      name: item.product_name || item.name,
      price: item.unit_price || item.price,
      quantity: item.quantity,
      tax: item.tax_percentage || 0.18,
      cost_includes_tax: item.cost_includes_tax || false
    })) || [];

    setCart(cartItems);
    setCurrentWebOrderId(order.id);
    if (order.order_number && order.customer_name) {
      setCurrentOrderInfo({ orderNumber: order.order_number, customerName: order.customer_name, notes: order.notes });
    }
    setCurrentOrderSource(order.source || 'pos');

    // Set customer if available
    if (order.customer_id) {
      setSelectedCustomer(order.customer_id);
    }
  };

  // Save existing order directly without dialog
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const saveExistingOrderDirectly = async () => {
    if (!currentWebOrderId || cart.length === 0) return;

    setIsSavingOrder(true);
    try {
      // Calcular los totales de forma directa (useMemo no se puede llamar dentro de una función asíncrona)
      const totals = calculateTotals(cartWithOffers, globalDiscount);

      // 1. Obtener estado actual e ítems actuales de la orden
      const { data: currentOrder, error: fetchError } = await supabase
        .from('open_orders')
        .select('order_status, notes, order_number, customer_name')
        .eq('id', currentWebOrderId)
        .single();

      const isOrderMissing = !!fetchError || !currentOrder;

      const { data: currentItems } = !isOrderMissing
        ? await supabase
            .from('open_order_items')
            .select('product_id, quantity')
            .eq('order_id', currentWebOrderId)
        : { data: [] };

      const isReopened = !!(
        currentOrder &&
        currentOrder.order_status !== 'preparing' &&
        currentOrder.order_status !== 'pending'
      );

      // 2. Calcular ítems delta (nuevos o con cantidad aumentada)
      const deltaItems: typeof cartWithOffers = [];
      let hasNewOrModifiedItems = false;

      cartWithOffers.forEach(item => {
        const matchingOld = currentItems?.find(old => old.product_id === item.id);
        const oldQty = matchingOld ? matchingOld.quantity : 0;
        if (item.quantity > oldQty) {
          hasNewOrModifiedItems = true;
          deltaItems.push({ ...item, quantity: item.quantity - oldQty });
        }
      });

      // 3. Determinar tipo de usuario para tag de tipo de orden
      const orderTypeTag = orderTypeTags[posOrderType];
      const rawNotes = (currentOrderInfo?.notes || '');
      const cleanNotes = rawNotes
        .replace(/\[COMER AQUÍ\]/g, '')
        .replace(/\[PARA LLEVAR\]/g, '')
        .replace(/\[COMPRA AQUÍ\]/g, '')
        .replace(/\[DELIVERY\]/g, '')
        .trim();
      const finalNotes = cleanNotes ? `${cleanNotes}\n${orderTypeTag}` : orderTypeTag;

      // 4. Preparar payload de actualización principal
      const isDelivery = posOrderType === 'takeout' && (isStore || isSupermarket);

      let orderIdToUse = currentWebOrderId;
      let orderNumberToUse = currentOrder?.order_number || currentOrderInfo?.orderNumber;

      if (isOrderMissing) {
        // Generar un nuevo número de orden y crearla desde cero
        const { data: orderNumber, error: orderNumberError } = await supabase
          .rpc('generate_order_number', { order_source: currentOrderSource || 'pos' });

        if (orderNumberError) throw orderNumberError;

        orderNumberToUse = orderNumber;
        orderIdToUse = crypto.randomUUID();

        const { error: insertError } = await supabase
          .from('open_orders')
          .insert({
            id: orderIdToUse,
            order_number: orderNumberToUse,
            customer_name: currentOrderInfo?.customerName || 'Cliente',
            payment_method: 'pending',
            subtotal: parseFloat(totals.subtotal),
            discount_total: parseFloat(totals.discount),
            tax_total: parseFloat(totals.tax),
            total: parseFloat(totals.total),
            notes: finalNotes,
            source: currentOrderSource || 'pos',
            order_status: isDelivery ? 'shipped' : 'preparing',
            payment_status: 'pending',
            profile_id: profile?.id || null,
            store_id: store?.id || null
          });

        if (insertError) throw insertError;
      } else {
        const updatePayload: any = {
          customer_name: currentOrderInfo?.customerName || 'Cliente',
          subtotal: parseFloat(totals.subtotal),
          discount_total: parseFloat(totals.discount),
          tax_total: parseFloat(totals.tax),
          total: parseFloat(totals.total),
          notes: finalNotes,
          updated_at: new Date().toISOString()
        };

        if (isDelivery) {
          // Para supermercados/tiendas, el delivery va directo a despacho (no hay cocina)
          updatePayload.order_status = 'shipped';
        } else if (!isReopened) {
          // Sigue en cocina: solo refrescamos el timer si hay productos nuevos/modificados
          updatePayload.order_status = 'preparing';
          if (hasNewOrModifiedItems) {
            updatePayload.created_at = new Date().toISOString();
          }
        } else {
          // Ya estaba completada: conservamos el estado
          updatePayload.order_status = currentOrder.order_status;
        }

        // 5. Actualizar la orden principal
        const { error: orderError } = await supabase
          .from('open_orders')
          .update(updatePayload)
          .eq('id', currentWebOrderId);

        if (orderError) throw orderError;
      }

      // 6. Reemplazar ítems de la orden principal
      const { error: deleteError } = await supabase
        .from('open_order_items')
        .delete()
        .eq('order_id', orderIdToUse);

      if (deleteError) throw deleteError;

      const orderItems = cartWithOffers.map(item => {
        const taxRate = item.tax || 0.18;
        const itemTotalRaw = item.price * item.quantity;
        let subtotal, taxAmount, total;
        if (item.cost_includes_tax) {
          total = itemTotalRaw;
          subtotal = total / (1 + taxRate);
          taxAmount = total - subtotal;
        } else {
          subtotal = itemTotalRaw;
          taxAmount = subtotal * taxRate;
          total = subtotal + taxAmount;
        }
        return {
          order_id: orderIdToUse,
          product_id: item.id,
          product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_percentage: taxRate * 100,
          tax_amount: taxAmount,
          subtotal,
          total,
          cost_includes_tax: item.cost_includes_tax || false
        };
      });

      const { error: itemsError } = await supabase
        .from('open_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 7. Crear ticket delta en cocina si hay productos nuevos
      if (hasNewOrModifiedItems && !isOrderMissing && currentOrder) {
        const authRes = await supabase.auth.getUser();
        const user = authRes?.data?.user;
        const refOrderNumber = currentOrder.order_number;
        const refCustomerName = currentOrder.customer_name || currentOrderInfo?.customerName || 'Cliente';
        const deltaNotes = `[ACTUALIZADO]\nPedido actualizado de: ${refCustomerName} (#${refOrderNumber})\n${finalNotes}`;

        const { data: deltaOrder, error: deltaOrderError } = await supabase
          .from('open_orders')
          .insert({
            order_number: String(900000 + (Date.now() % 99999)),
            customer_name: refCustomerName,
            payment_method: 'pending',
            subtotal: 0,
            discount_total: 0,
            tax_total: 0,
            total: 0,
            notes: deltaNotes,
            source: 'pos',
            order_status: 'preparing',
            payment_status: 'paid',
            profile_id: user?.id || null,
            store_id: store?.id || null
          })
          .select()
          .single();

        if (deltaOrderError) {
          console.error('Error creando ticket delta:', deltaOrderError);
          throw deltaOrderError;
        }

        if (deltaOrder) {
          const deltaOrderItems = deltaItems.map(item => {
            const taxRate = item.tax || 0.18;
            return {
              order_id: deltaOrder.id,
              product_id: item.id,
              product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
              quantity: item.quantity,
              unit_price: 0,
              tax_percentage: taxRate * 100,
              tax_amount: 0,
              subtotal: 0,
              total: 0,
              cost_includes_tax: item.cost_includes_tax || false
            };
          });
          const { error: deltaItemsError } = await supabase.from('open_order_items').insert(deltaOrderItems);
          if (deltaItemsError) {
            console.error('Error insertando items delta:', deltaItemsError);
            throw deltaItemsError;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });

      toast({
        title: isOrderMissing ? "Pedido guardado como nuevo" : "Pedido actualizado",
        description: `${orderNumberToUse} guardado correctamente${hasNewOrModifiedItems && !isOrderMissing ? ' · Ticket enviado a cocina' : ''}`
      });

      // Reset state
      setCart([]);
      setSelectedCustomer('');
      setAmountReceived('');
      setPaymentMethod('cash');
      setGlobalDiscount({ value: 0, type: 'percentage' });
      setCurrentOrderInfo(null);
      setCurrentOrderSource('pos');
      setCurrentWebOrderId(null);
    } catch (error) {
      console.error('Error saving order:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el pedido"
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveOrder = () => {
    if (cart.length === 0) return;

    // If editing an existing order, save directly
    if (currentWebOrderId) {
      saveExistingOrderDirectly();
    } else {
      // New order - show dialog
      setShowSaveOrderDialog(true);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F8: Cuentas
      if (e.key === 'F8') {
        e.preventDefault();
        setShowOpenAccountsDialog(true);
      }
      // F9: Guardar Venta
      if (e.key === 'F9') {
        e.preventDefault();
        handleSaveOrder();
      }
      // F10: Procesar Venta
      if (e.key === 'F10') {
        e.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, currentWebOrderId]); // Dependencies for handlers

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);



  const handleClearOrder = useCallback(() => {
    setCurrentWebOrderId(null);
    setCurrentOrderInfo(null);
    setCart([]);
  }, []);

  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    updateSettings({ pos_view_mode: mode });
  }, [updateSettings]);

  const handleGridColsChange = useCallback((cols: number) => {
    updateSettings({ pos_layout_grid_cols: cols });
  }, [updateSettings]);

  const handleLayoutModeChange = useCallback((mode: 'classic' | 'catalog') => {
    updateSettings({
      pos_layout_mode: mode,
      pos_view_mode: mode === 'classic' ? 'list' : 'grid'
    });
  }, [updateSettings]);

  const handleRefreshProducts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast({ title: "Sincronizando", description: "Cargando productos actualizados..." });
  }, [queryClient, toast]);

  const handleRefreshMobile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast({ title: "Sincronizando", description: "Actualizando catálogo móvil..." });
  }, [queryClient, toast]);

  const handleGridColsChangeMobile = useCallback((cols: number) => {
    updateSettings({ pos_layout_grid_cols: cols });
  }, [updateSettings]);

  const handleLayoutModeChangeMobile = useCallback((mode: 'classic' | 'catalog') => {
    updateSettings({ pos_layout_mode: mode });
    handleMobileViewModeChange(mode === 'classic' ? 'list' : 'grid');
  }, [updateSettings, handleMobileViewModeChange]);


  const baseTotal = parseFloat(totals.total) || 0;

  // Calculate surcharge if paying with card
  const cardMethod = storeSettings?.payment_methods?.find(m => m.id === 'card');
  const surchargePercentage = (paymentMethod === 'card' && cardMethod?.enabled) ? (cardMethod.surcharge_percentage || 0) : 0;
  const surchargeAmount = surchargePercentage > 0 ? (baseTotal * surchargePercentage / 100) : 0;
  const total = isNaN(baseTotal) ? 0 : baseTotal + surchargeAmount;

  const received = parseFloat(amountReceived) || 0;
  const change = received - total;

  const navigationItems = React.useMemo(() => {
    if (profile?.role === 'kitchen') {
      return [
        { name: 'Pantalla Cocina', href: '/kitchen', icon: ChefHat },
      ];
    }

    if (profile?.role === 'delivery') {
      return [
        { name: 'Pedidos Delivery', href: '/delivery', icon: Bike },
      ];
    }

    if (profile?.role === 'accountant') {
      return [
        { name: 'Contabilidad', href: '/accounting', icon: FileText },
        { name: 'Reportes', href: '/reports', icon: BarChart },
        { name: 'Facturas', href: '/invoices', icon: FileText },
      ];
    }

    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      return [
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
    }

    return [
      { name: 'Administración', href: '/dashboard', icon: Home }
    ];
  }, [profile]);

  const handleShowDailySales = useCallback(() => setShowDailySalesDialog(true), []);
  const handleShowRefund = useCallback(() => setShowRefundDialog(true), []);
  const handleShowCashMovements = useCallback(() => setShowCashMovementsDialog(true), []);
  const handleShowCloseDay = useCallback(() => setShowCloseDayDialog(true), []);
  const handleShowDebtSelect = useCallback(() => setShowDebtSelectDialog(true), []);
  const handleShowOpenAccounts = useCallback(() => setShowOpenAccountsDialog(true), []);
  const handleShowWebSales = useCallback(() => setShowWebSalesDialog(true), []);

  // Load a blocking order from CloseDayDialog into the POS cart
  const handleGoToPOSFromCloseDay = useCallback(async (orderId: string, customerName: string, orderNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('open_orders')
        .select(`
          *,
          open_order_items(
            id, quantity, unit_price, total, product_name, product_id,
            tax_percentage, tax_amount, subtotal,
            products(cost_includes_tax)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el pedido' });
        return;
      }

      const cartItems: CartItem[] = (data.open_order_items || []).map((item: any) => {
        let name = item.product_name;
        let comment = '';
        const match = name?.match(/^(.*) \((.*)\)$/);
        if (match) { name = match[1]; comment = match[2]; }
        return {
          id: item.product_id,
          name,
          price: item.unit_price,
          quantity: item.quantity,
          tax: (item.tax_percentage || 18) / 100,
          cost_includes_tax: item.products?.cost_includes_tax || false,
          comment: comment || undefined,
        };
      });

      handleLoadWebOrder(cartItems, orderId, customerName, orderNumber, 'pos', data.notes);
    } catch (err) {
      console.error('Error loading order into cart:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar el pedido' });
    }
  }, [toast]);

  const handleToggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Limpiar todo el caché de React Query
    navigate('/');
  };

  // Create totals object for the dialog that includes the surcharge
  const dialogTotals = React.useMemo(() => ({
    ...totals,
    total: (total || 0).toFixed(2)
  }), [totals, total]);

  // --- MEMO CALLBACKS extracted for POSActionButtons ---
  const memoHandleSaveOrder = useCallback(handleSaveOrder, [cart, currentWebOrderId, isSavingOrder]);
  const memoHandleShowOpenAccounts = handleShowOpenAccounts;
  const memoHandleShowWebSales = handleShowWebSales;
  const memoHandleToggleFullscreen = handleToggleFullscreen;

  const menuButton = useMemo(() => {
    if (isMobile) {
      return (
        <POSMenuButton
          isMobile={true}
          navigationItems={navigationItems}
          onNavigate={navigate}
          onDailySales={handleShowDailySales}
          onRefund={handleShowRefund}
          onCashMovements={handleShowCashMovements}
          onCloseDay={handleShowCloseDay}
          onDebtSelect={handleShowDebtSelect}
          onLogout={handleLogout}
          viewMode={storeSettings?.pos_view_mode || 'grid'}
          onViewModeChange={(mode) => updateSettings({ pos_view_mode: mode })}
          layoutMode={storeSettings?.pos_layout_mode || 'catalog'}
          onLayoutModeChange={(mode) => updateSettings({
            pos_layout_mode: mode,
            pos_view_mode: mode === 'classic' ? 'list' : 'grid'
          })}
          userName={profile?.full_name}
          activeSession={activeSession}
          onOpenRegister={() => setUserClosedRegisterDialog(false)}
        />
      );
    }
    return (
      <POSMenuButton
        isMobile={false}
        navigationItems={navigationItems}
        onNavigate={navigate}
        onDailySales={handleShowDailySales}
        onRefund={handleShowRefund}
        onCashMovements={handleShowCashMovements}
        onCloseDay={handleShowCloseDay}
        onDebtSelect={handleShowDebtSelect}
        onLogout={handleLogout}
        userName={profile?.full_name}
        activeSession={activeSession}
        onOpenRegister={() => setUserClosedRegisterDialog(false)}
      />
    );
  }, [isMobile, navigationItems, handleShowDailySales, handleShowRefund, handleShowCashMovements, handleShowCloseDay, handleShowDebtSelect, handleLogout, navigate, storeSettings, updateSettings, profile, activeSession]);

  // Action buttons as a stable React.memo component reference
  const actionButtons = useMemo(() => (
    <POSActionButtons
      profileName={profile?.full_name}
      cartLength={cart.length}
      isSavingOrder={isSavingOrder}
      currentWebOrderId={currentWebOrderId}
      webOrdersCount={webOrdersCount}
      isFullscreen={isFullscreen}
      onSaveOrder={memoHandleSaveOrder}
      onOpenAccounts={memoHandleShowOpenAccounts}
      onShowWebSales={memoHandleShowWebSales}
      onToggleFullscreen={memoHandleToggleFullscreen}
    />
  ), [profile?.full_name, cart.length, isSavingOrder, currentWebOrderId, webOrdersCount, isFullscreen, memoHandleSaveOrder, memoHandleShowOpenAccounts, memoHandleShowWebSales, memoHandleToggleFullscreen]);

  // Treat as loading if profile/store data is still missing or dummy
  const hasValidProfile = !!(rawProfile && rawProfile.store_id && rawProfile.store_id !== '00000000-0000-0000-0000-000000000000');
  const hasValidStore = !!(rawStore && rawStore.id && rawStore.id !== '00000000-0000-0000-0000-000000000000');
  const hasValidSettings = !!rawStoreSettings;

  const profileLoading = (isPendingProfile || isLoadingProfile) || !hasValidProfile;
  const storeLoading = (isPendingStore || isLoadingStore) || !hasValidStore;
  const settingsLoading = loadingSettings && !hasValidSettings;

  if (loadingProducts || settingsLoading || storeLoading || profileLoading) {
    let loadingText = 'Cargando sistema...';
    if (profileLoading) loadingText = 'Verificando perfil...';
    else if (storeLoading) loadingText = 'Conectando con tienda...';
    else if (settingsLoading) loadingText = 'Cargando configuraciones...';
    else if (loadingProducts) loadingText = 'Sincronizando productos...';

    return (
      <div className="flex h-screen items-center justify-center flex-col gap-6 bg-background">
        <LoadingLogo text={loadingText} size="md" />
      </div>
    );
  }

  // Verificar si hubo un error en la carga de datos críticos
  if ((!storeLoading && !store) || (!profileLoading && !profile)) {
    const handleRetry = () => {
      queryClient.invalidateQueries({ queryKey: ['user-store'] });
      // Forzar recarga de perfil si es necesario (el hook useUserProfile no usa react-query, pero intentamos reload)
      window.location.reload();
    };

    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Store className="h-10 w-10 text-emerald-500" />
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-zinc-100">¡Casi listos!</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Estamos preparando tu espacio de trabajo. A veces, la conexión necesita un pequeño empujón para sincronizar tus datos.
            </p>
          </div>

          <div className="bg-zinc-950/50 rounded-2xl p-4 border border-zinc-800/50 text-xs text-zinc-500">
            <p>
              Por favor, actualiza la página para intentar de nuevo.
            </p>
            {(!store || !profile) && (
              <p className="mt-1 opacity-60">
                (Falta cargar: {(!store && !profile) ? 'tienda y usuario' : (!store ? 'tienda' : 'usuario')})
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-3 pt-2">
            <Button 
              onClick={handleRetry} 
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
            >
              <RefreshCcw className="mr-2 h-5 w-5" />
              Actualizar página
            </Button>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              className="w-full h-12 text-zinc-400 hover:text-white rounded-xl"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión y volver a entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback de seguridad: si store o profile siguen siendo null pero loading es true (caso raro)
  // o si storeSettings está cargando.
  if (!store || !profile || !storeSettings) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <LoadingLogo text="Finalizando configuración..." size="md" />
        <Button variant="link" size="sm" onClick={() => window.location.reload()} className="text-xs text-muted-foreground">
          ¿Tarda demasiado? Recargar
        </Button>
      </div>
    );
  }





  if (isMobile) {
    return (
      <div className="h-full flex-1 w-full flex flex-col animate-fade-in overflow-hidden bg-background">
        <MobilePOSLayout
          productSearchComponent={
            <MobileProductSearch
              ref={mobileSearchRef}
              products={products}
              cart={cartWithOffers}
              onAddToCart={addToCart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              orderType={posOrderType}
              onOrderTypeChange={setPosOrderType}
              onSearchFocus={handleSearchFocus}
              onRefresh={handleRefreshMobile}
              isLoading={loadingProducts}
              menuButton={menuButton}
              actionButton={actionButtons}
              gridCols={storeSettings?.pos_layout_grid_cols || 4}
              viewMode={mobileViewMode}
              onViewModeChange={handleMobileViewModeChange}
              onGridColsChange={handleGridColsChangeMobile}
              mode={storeSettings?.pos_layout_mode || 'catalog'}
              onLayoutModeChange={handleLayoutModeChangeMobile}
              companyLogo={companyInfo?.logo}
              userName={profile?.full_name}
            />
          }
          cart={cartWithOffers}
          cartComponent={
            <MobileCartView
              cart={cartWithOffers}
              onUpdateQuantity={updateQuantity}
              onUpdateComment={updateComment}
              onUpdateDiscount={updateDiscount}
              onAddExtra={addExtraToCartItem}
              onRemoveExtra={removeExtraFromCartItem}
              onRemoveFromCart={removeFromCart}
              calculateItemTotal={calculateItemTotal}
              currentOrderInfo={currentOrderInfo}
              onClearOrder={handleClearOrder}
              isInvoiceLimitReached={isInvoiceLimitReached}
              orderType={posOrderType}
              onOrderTypeChange={setPosOrderType}
              onSaveOrder={memoHandleSaveOrder}
            />
          }
          paymentComponent={
            <MobilePaymentView
              totals={totals}
              selectedCustomer={selectedCustomer}
              selectedInvoiceType={selectedInvoiceType}
              cartLength={cart.length}
              customers={customers}
              invoiceTypes={invoiceTypes}
              globalDiscount={globalDiscount}
              onCustomerChange={setSelectedCustomer}
              onInvoiceTypeChange={setSelectedInvoiceType}
              onDiscountChange={setGlobalDiscount}
              onCheckout={handleCheckout}
              isInvoiceLimitReached={isInvoiceLimitReached}
              isElectronic={isElectronicActive}
            />
          }
          cartTotal={totals.total}
          onCheckout={handleCheckout}
        />

        {/* Dialogs - shared between mobile and desktop */}
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          totals={dialogTotals}
          paymentMethod={paymentMethod}
          amountReceived={amountReceived}
          change={change}
          received={received}
          total={total}
          surchargeAmount={surchargeAmount}
          selectedCustomer={selectedCustomer}
          creditDays={creditDays}
          onPaymentMethodChange={setPaymentMethod}
          onAmountReceivedChange={setAmountReceived}
          onCreditDaysChange={setCreditDays}
          onProcessPayment={processPayment}
          isProcessing={createSale.isPending}
          availableMethods={storeSettings?.payment_methods}
          webOrderNotes={currentOrderInfo?.notes}
          customers={customers}
          onCustomerChange={setSelectedCustomer}
          requiresCustomer={requiresCustomer}
        />

        {saleData && (
          <Suspense fallback={null}>
            <PrintOptionsDialog
              isOpen={showPrintOptionsDialog}
              onClose={() => setShowPrintOptionsDialog(false)}
              saleData={saleData}
            />
          </Suspense>
        )}

        <WebSalesDialog
          isOpen={showWebSalesDialog}
          onClose={() => setShowWebSalesDialog(false)}
          onLoadToCart={handleLoadWebOrder}
          currentLoadedOrderId={currentWebOrderId}
        />

        <OpenAccountsDialog
          isOpen={showOpenAccountsDialog}
          onClose={() => setShowOpenAccountsDialog(false)}
          onLoadToCart={handleLoadWebOrder}
          currentLoadedOrderId={cart.length > 0 ? currentWebOrderId : null}
        />

        <SaveOrderDialog
          isOpen={showSaveOrderDialog}
          onClose={() => setShowSaveOrderDialog(false)}
          cart={cart}
          orderSource={currentOrderSource}
          initialCustomerName={currentOrderInfo?.customerName || ''}
          initialNotes={(currentOrderInfo?.notes || '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[PARA LLEVAR\]/g, '').trim()}
          existingOrderId={currentWebOrderId}
          existingOrderNumber={currentOrderInfo?.orderNumber}
          posOrderType={posOrderType}
          customers={customers}
          initialCustomerId={selectedCustomer}
          onSaved={() => {
            setCart([]);
            setGlobalDiscount({ value: 0, type: 'percentage' });
            setCurrentOrderInfo(null);
            setCurrentOrderSource('pos');
            setCurrentWebOrderId(null);
          }}
        />

        <DailySalesDialog
          isOpen={showDailySalesDialog}
          onClose={() => setShowDailySalesDialog(false)}
        />

        <RefundDialog
          isOpen={showRefundDialog}
          onClose={() => setShowRefundDialog(false)}
        />

        <CashMovementsDialog
          isOpen={showCashMovementsDialog}
          onClose={() => setShowCashMovementsDialog(false)}
        />

        <CloseDayDialog
          isOpen={showCloseDayDialog}
          onClose={() => setShowCloseDayDialog(false)}
          onGoToPOS={handleGoToPOSFromCloseDay}
        />

        {/* Diálogo de selección de cliente para cobros de deuda */}
        <Dialog open={showDebtSelectDialog} onOpenChange={setShowDebtSelectDialog}>
          <DialogContent 
            className="max-w-[95vw] sm:max-w-md w-full p-0 overflow-hidden bg-[#0a0a0a] border-zinc-900 rounded-[2rem] shadow-2xl"
            centerOnMobile={true}
          >
            <div className="p-6 border-b border-zinc-900 bg-transparent flex items-center justify-between">
              <DialogHeader className="space-y-0.5">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-500" />
                  Seleccionar Cliente
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  Buscar cliente para cobro de deuda
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-4">
              <Command className="bg-transparent border-none [&_[cmdk-input-wrapper]]:border-zinc-800/80 [&_[cmdk-input-wrapper]]:bg-zinc-900/40 [&_[cmdk-input-wrapper]]:rounded-xl [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-input-wrapper]_svg]:text-emerald-500 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4">
                <CommandInput 
                  placeholder="Buscar por nombre, cédula o código..." 
                  className="h-12 bg-transparent text-white placeholder:text-zinc-600 border-none outline-none focus:ring-0 text-sm"
                />
                <CommandList className="max-h-[350px] overflow-y-auto no-scrollbar mt-3 pr-1">
                  <CommandEmpty className="py-8 text-center text-zinc-500 text-sm">No se encontraron clientes.</CommandEmpty>
                  <CommandGroup heading="Clientes con Deuda" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-red-500/80 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                    {customers.filter(c => (c.credit_used || 0) > 0).map(customer => (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.validation_code || ''} ${customer.id}`}
                        onSelect={() => {
                          setSelectedCustomerForDebt(customer);
                          setShowDebtSelectDialog(false);
                        }}
                        className="flex justify-between items-center cursor-pointer p-3 my-1 rounded-xl transition-all duration-200 border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800 text-white data-[selected='true']:bg-emerald-600/10 data-[selected='true']:text-emerald-400 data-[selected='true']:border-emerald-500/20 data-[selected='true']:shadow-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-100">{customer.name}</span>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                            <span className="text-xs text-zinc-500">{customer.phone || 'Sin teléfono'}</span>
                            {(customer.rnc || customer.validation_code) && (
                              <span className="text-[9px] text-zinc-500 font-bold bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                                {customer.rnc ? `ID: ${customer.rnc}` : ''}
                                {customer.rnc && customer.validation_code ? ' | ' : ''}
                                {customer.validation_code ? `Cód: ${customer.validation_code}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-sm text-red-500">${(customer.credit_used || 0).toLocaleString()}</span>
                          <span className="text-[8px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-1 rounded">DEUDA</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Otros Clientes" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                    {customers.filter(c => !(c.credit_used || 0)).map(customer => (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.validation_code || ''} ${customer.id}`}
                        onSelect={() => {
                          setSelectedCustomerForDebt(customer);
                          setShowDebtSelectDialog(false);
                        }}
                        className="flex justify-between items-center cursor-pointer p-3 my-1 rounded-xl transition-all duration-200 border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800 text-white data-[selected='true']:bg-emerald-600/10 data-[selected='true']:text-emerald-400 data-[selected='true']:border-emerald-500/20 data-[selected='true']:shadow-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-200">{customer.name}</span>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                            <span className="text-xs text-zinc-500">{customer.phone || 'Sin teléfono'}</span>
                            {(customer.rnc || customer.validation_code) && (
                              <span className="text-[9px] text-zinc-500 font-bold bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                                {customer.rnc ? `ID: ${customer.rnc}` : ''}
                                {customer.rnc && customer.validation_code ? ' | ' : ''}
                                {customer.validation_code ? `Cód: ${customer.validation_code}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[8px] font-black text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">SIN DEUDA</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </DialogContent>
        </Dialog>

        {selectedCustomerForDebt && (
          <Suspense fallback={null}>
            <CustomerCreditDialog
              customer={selectedCustomerForDebt}
              open={!!selectedCustomerForDebt}
              onOpenChange={(open) => !open && setSelectedCustomerForDebt(null)}
            />
          </Suspense>
        )}

        <OpenRegisterDialog
          isOpen={!activeSession && !isLoadingSession && !userClosedRegisterDialog}
          onOpenChange={(open) => {
            if (!open) {
              setUserClosedRegisterDialog(true);
            }
          }}
        />
      </div>
    );
  }

  // Desktop Layout
  const isClassicLayout = storeSettings?.pos_layout_mode === undefined 
    ? true 
    : storeSettings.pos_layout_mode === 'classic';

  return (
    <SimpleErrorBoundary>
      <div className="h-full flex-1 w-full flex flex-col animate-fade-in overflow-hidden bg-background">
        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-hidden pb-3 md:pb-3">

          {isClassicLayout ? (
            /* --- CLASSIC LAYOUT (Search top-left, Cart bottom-left, Payment right) --- */
            <>
              <div className="shrink-0 lg:flex-1 flex flex-col min-h-0 gap-3 lg:overflow-hidden">
                <div className="flex-shrink-0 z-20 relative">
                  <ProductSearchList
                    ref={searchInputRef}
                    products={products}
                    onAddToCart={addToCart}
                    onSearchFocus={handleSearchFocus}
                    menuButton={menuButton}
                    actionButton={actionButtons}
                    gridCols={storeSettings?.pos_layout_grid_cols || 4}
                    viewMode={storeSettings?.pos_view_mode || 'list'}
                    onViewModeChange={handleViewModeChange}
                    onGridColsChange={handleGridColsChange}
                    mode="classic"
                    onLayoutModeChange={handleLayoutModeChange}
                    onRefresh={handleRefreshProducts}
                    recipeAvailability={recipeAvailability}
                    isLoading={loadingProducts}
                    userName={profile?.full_name}
                  />
                  {products.length === 0 && !loadingProducts && (
                    <div className="mt-2 p-3 bg-muted/40 border rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                      <span className="text-muted-foreground font-medium">No hay productos disponibles en el catálogo.</span>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[11px]"
                          onClick={() => refreshMasterData()}
                        >
                          <RefreshCcw className="w-3 h-3 mr-1" />
                          Recargar Catálogo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div id="pos-cart-area" className="flex-1 min-h-[150px] md:min-h-[250px] overflow-hidden rounded-xl border bg-card shadow-sm z-10">
                  <CartSummary
                    cart={cartWithOffers}
                    onUpdateQuantity={updateQuantity}
                    onUpdateComment={updateComment}
                    onUpdateDiscount={updateDiscount}
                    onAddExtra={addExtraToCartItem}
                    onRemoveExtra={removeExtraFromCartItem}
                    onRemoveFromCart={removeFromCart}
                    calculateItemTotal={calculateItemTotal}
                    currentOrderInfo={currentOrderInfo}
                    onClearOrder={handleClearOrder}
                    orderType={posOrderType}
                    onOrderTypeChange={setPosOrderType}
                    cartTotal={parseFloat(totals.total) || 0}
                  />
                </div>
              </div>

              {/* Right Panel: Payment Only */}
              <div id="pos-payment-area" className="w-full lg:w-[400px] xl:w-[450px] flex-shrink-0 min-h-0 flex flex-col">
                <PaymentSummary
                  totals={totals}
                  selectedCustomer={selectedCustomer}
                  selectedInvoiceType={selectedInvoiceType}
                  cartLength={cart.length}
                  customers={customers}
                  invoiceTypes={invoiceTypes}
                  globalDiscount={globalDiscount}
                  onCustomerChange={setSelectedCustomer}
                  onInvoiceTypeChange={setSelectedInvoiceType}
                  onDiscountChange={setGlobalDiscount}
                  onCheckout={handleCheckout}
                  isInvoiceLimitReached={isInvoiceLimitReached}
                  onLoyaltyCustomerFound={handleLoyaltyCustomerFound}
                  onLoyaltyPointsBalance={handleLoyaltyPointsBalance}
                  onLoyaltyPointsRedeemed={handleLoyaltyPointsRedeemed}
                  onLoyaltyClearRedemption={handleLoyaltyClearRedemption}
                  loyaltyRedeemedPoints={loyaltyRedeemedPoints}
                  isClassicMode={isClassicLayout}
                  isElectronic={isElectronicActive}
                />
              </div>
            </>
          ) : (
            /* --- CATALOG LAYOUT (Products Left, Cart+Payment Right) --- */
            <>
              {/* Panel principal - Catálogo de productos */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                <ProductSearchList
                  ref={searchInputRef}
                  products={products}
                  onAddToCart={addToCart}
                  menuButton={menuButton}
                  actionButton={actionButtons}
                  gridCols={storeSettings?.pos_layout_grid_cols || 4}
                  viewMode={storeSettings?.pos_view_mode || 'grid'}
                  onViewModeChange={handleViewModeChange}
                  onGridColsChange={handleGridColsChange}
                  mode="catalog"
                  onLayoutModeChange={handleLayoutModeChange}
                  isLoading={loadingProducts}
                  recipeAvailability={recipeAvailability}
                  userName={profile?.full_name}
                />
                {products.length === 0 && !loadingProducts && (
                  <div className="m-2 p-3 bg-muted/40 border rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                    <span className="text-muted-foreground font-medium">No hay productos disponibles en el catálogo.</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[11px]"
                        onClick={() => refreshMasterData()}
                      >
                        <RefreshCcw className="w-3 h-3 mr-1" />
                        Recargar Catálogo
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel derecho - Carrito y Totales */}
              <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-3 flex-shrink-0 min-h-0">
                {/* Carrito */}
                <div id="pos-cart-area" className="flex-1 min-h-[150px] md:min-h-[250px] overflow-hidden rounded-xl shadow-sm border bg-card">
                  <CartSummary
                    cart={cartWithOffers}
                    onUpdateQuantity={updateQuantity}
                    onUpdateComment={updateComment}
                    onUpdateDiscount={updateDiscount}
                    onAddExtra={addExtraToCartItem}
                    onRemoveExtra={removeExtraFromCartItem}
                    onRemoveFromCart={removeFromCart}
                    calculateItemTotal={calculateItemTotal}
                    currentOrderInfo={currentOrderInfo}
                    onClearOrder={handleClearOrder}
                    orderType={posOrderType}
                    onOrderTypeChange={setPosOrderType}
                    cartTotal={parseFloat(totals.total) || 0}
                  />
                </div>

                {/* Resumen de Pago */}
                <div id="pos-payment-area" className="flex-shrink min-h-0">
                  <PaymentSummary
                    totals={totals}
                    selectedCustomer={selectedCustomer}
                    selectedInvoiceType={selectedInvoiceType}
                    cartLength={cart.length}
                    customers={customers}
                    invoiceTypes={invoiceTypes}
                    globalDiscount={globalDiscount}
                    onCustomerChange={setSelectedCustomer}
                    onInvoiceTypeChange={setSelectedInvoiceType}
                    onDiscountChange={setGlobalDiscount}
                    onCheckout={handleCheckout}
                    isInvoiceLimitReached={isInvoiceLimitReached}
                    onLoyaltyCustomerFound={handleLoyaltyCustomerFound}
                    onLoyaltyPointsBalance={handleLoyaltyPointsBalance}
                    onLoyaltyPointsRedeemed={handleLoyaltyPointsRedeemed}
                    onLoyaltyClearRedemption={handleLoyaltyClearRedemption}
                    loyaltyRedeemedPoints={loyaltyRedeemedPoints}
                    isClassicMode={isClassicLayout}
                    isElectronic={isElectronicActive}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          totals={dialogTotals}
          paymentMethod={paymentMethod}
          amountReceived={amountReceived}
          change={change}
          received={received}
          total={total}
          surchargeAmount={surchargeAmount}
          selectedCustomer={selectedCustomer}
          creditDays={creditDays}
          onPaymentMethodChange={setPaymentMethod}
          onAmountReceivedChange={setAmountReceived}
          onCreditDaysChange={setCreditDays}
          onProcessPayment={processPayment}
          isProcessing={createSale.isPending}
          availableMethods={storeSettings?.payment_methods}
          customers={customers}
          onCustomerChange={setSelectedCustomer}
          requiresCustomer={requiresCustomer}
        />

        {
          saleData && (
            <Suspense fallback={null}>
              <PrintOptionsDialog
                isOpen={showPrintOptionsDialog}
                onClose={() => setShowPrintOptionsDialog(false)}
                saleData={saleData}
              />
            </Suspense>
          )
        }

        <WebSalesDialog
          isOpen={showWebSalesDialog}
          onClose={() => setShowWebSalesDialog(false)}
          onLoadToCart={handleLoadWebOrder}
        />

        <OpenAccountsDialog
          isOpen={showOpenAccountsDialog}
          onClose={() => setShowOpenAccountsDialog(false)}
          onLoadToCart={handleLoadWebOrder}
        />

        <SaveOrderDialog
          isOpen={showSaveOrderDialog}
          onClose={() => setShowSaveOrderDialog(false)}
          cart={cart}
          orderSource={currentOrderSource}
          initialCustomerName={currentOrderInfo?.customerName || ''}
          initialNotes={(currentOrderInfo?.notes || '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[PARA LLEVAR\]/g, '').trim()}
          existingOrderId={currentWebOrderId}
          existingOrderNumber={currentOrderInfo?.orderNumber}
          posOrderType={posOrderType}
          customers={customers}
          initialCustomerId={selectedCustomer}
          onSaved={() => {
            setCart([]);
            setGlobalDiscount({ value: 0, type: 'percentage' });
            setCurrentOrderInfo(null);
            setCurrentOrderSource('pos');
            setCurrentWebOrderId(null);
          }}
        />

        <DailySalesDialog
          isOpen={showDailySalesDialog}
          onClose={() => setShowDailySalesDialog(false)}
        />

        <RefundDialog
          isOpen={showRefundDialog}
          onClose={() => setShowRefundDialog(false)}
        />

        <CashMovementsDialog
          isOpen={showCashMovementsDialog}
          onClose={() => setShowCashMovementsDialog(false)}
        />

        <CloseDayDialog
          isOpen={showCloseDayDialog}
          onClose={() => setShowCloseDayDialog(false)}
          onGoToPOS={handleGoToPOSFromCloseDay}
        />

        {/* --- DEBT COLLECTION DIALOGS --- */}
        <Dialog open={showDebtSelectDialog} onOpenChange={setShowDebtSelectDialog}>
          <DialogContent 
            className="max-w-[95vw] sm:max-w-md w-full p-0 overflow-hidden bg-[#0a0a0a] border-zinc-900 rounded-[2rem] shadow-2xl"
            centerOnMobile={true}
          >
            <div className="p-6 border-b border-zinc-900 bg-transparent flex items-center justify-between">
              <DialogHeader className="space-y-0.5">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-500" />
                  Seleccionar Cliente
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  Buscar cliente para cobro de deuda
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-4">
              <Command className="bg-transparent border-none [&_[cmdk-input-wrapper]]:border-zinc-800/80 [&_[cmdk-input-wrapper]]:bg-zinc-900/40 [&_[cmdk-input-wrapper]]:rounded-xl [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-input-wrapper]_svg]:text-emerald-500 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4">
                <CommandInput 
                  placeholder="Buscar por nombre, cédula o código..." 
                  className="h-12 bg-transparent text-white placeholder:text-zinc-600 border-none outline-none focus:ring-0 text-sm"
                />
                <CommandList className="max-h-[350px] overflow-y-auto no-scrollbar mt-3 pr-1">
                  <CommandEmpty className="py-8 text-center text-zinc-500 text-sm">No se encontraron clientes.</CommandEmpty>
                  <CommandGroup heading="Clientes con Deuda" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-red-500/80 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                    {customers.filter(c => (c.credit_used || 0) > 0).map(customer => (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.validation_code || ''} ${customer.id}`}
                        onSelect={() => {
                          setSelectedCustomerForDebt(customer);
                          setShowDebtSelectDialog(false);
                        }}
                        className="flex justify-between items-center cursor-pointer p-3 my-1 rounded-xl transition-all duration-200 border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800 text-white data-[selected='true']:bg-emerald-600/10 data-[selected='true']:text-emerald-400 data-[selected='true']:border-emerald-500/20 data-[selected='true']:shadow-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-100">{customer.name}</span>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                            <span className="text-xs text-zinc-500">{customer.phone || 'Sin teléfono'}</span>
                            {(customer.rnc || customer.validation_code) && (
                              <span className="text-[9px] text-zinc-500 font-bold bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                                {customer.rnc ? `ID: ${customer.rnc}` : ''}
                                {customer.rnc && customer.validation_code ? ' | ' : ''}
                                {customer.validation_code ? `Cód: ${customer.validation_code}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-sm text-red-500">${(customer.credit_used || 0).toLocaleString()}</span>
                          <span className="text-[8px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-1 rounded">DEUDA</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Otros Clientes" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                    {customers.filter(c => !(c.credit_used || 0)).map(customer => (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.validation_code || ''} ${customer.id}`}
                        onSelect={() => {
                          setSelectedCustomerForDebt(customer);
                          setShowDebtSelectDialog(false);
                        }}
                        className="flex justify-between items-center cursor-pointer p-3 my-1 rounded-xl transition-all duration-200 border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800 text-white data-[selected='true']:bg-emerald-600/10 data-[selected='true']:text-emerald-400 data-[selected='true']:border-emerald-500/20 data-[selected='true']:shadow-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-200">{customer.name}</span>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                            <span className="text-xs text-zinc-500">{customer.phone || 'Sin teléfono'}</span>
                            {(customer.rnc || customer.validation_code) && (
                              <span className="text-[9px] text-zinc-500 font-bold bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                                {customer.rnc ? `ID: ${customer.rnc}` : ''}
                                {customer.rnc && customer.validation_code ? ' | ' : ''}
                                {customer.validation_code ? `Cód: ${customer.validation_code}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[8px] font-black text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">SIN DEUDA</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </DialogContent>
        </Dialog>

        {selectedCustomerForDebt && (
          <Suspense fallback={null}>
            <CustomerCreditDialog
              customer={selectedCustomerForDebt}
              open={!!selectedCustomerForDebt}
              onOpenChange={(open) => !open && setSelectedCustomerForDebt(null)}
            />
          </Suspense>
        )}

        <OpenRegisterDialog
          isOpen={!activeSession && !isLoadingSession && !userClosedRegisterDialog}
          onOpenChange={(open) => {
            if (!open) {
              setUserClosedRegisterDialog(true);
            }
          }}
        />

        <LimitReachedDialog
          isOpen={showLimitDialog}
          onClose={() => setShowLimitDialog(false)}
          title="Límite de Facturas Alcanzado"
          description="Has llegado al máximo de facturas permitidas en tu plan este mes. Para seguir facturando, necesitas un plan superior."
          limitType="invoices"
        />

        {/* ── NO PHONE WARNING DIALOG ── */}
        <Dialog open={showNoPhoneDialog} onOpenChange={(open) => { if (!open) setShowNoPhoneDialog(false); }}>
          <DialogContent className="max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-5 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <DialogTitle className="text-sm font-bold text-foreground leading-tight">
                  Teléfono de contacto faltante
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">{noPhoneCustomer?.name}</strong> no tiene un número registrado. ¿Deseas agregarlo ahora?
                </DialogDescription>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Ej: 809-555-0000"
                  value={quickPhoneInput}
                  onChange={(e) => setQuickPhoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && quickPhoneInput.trim() && (async () => {
                    if (!noPhoneCustomer || !quickPhoneInput.trim()) return;
                    setIsSavingPhone(true);
                    try {
                      await updateCustomerMutation.mutateAsync({ id: noPhoneCustomer.id, phone: quickPhoneInput.trim() } as any);
                      toast({ title: 'Teléfono guardado', description: `Número agregado para ${noPhoneCustomer.name}.` });
                      setShowNoPhoneDialog(false);
                    } catch (e) {
                      toast({ title: 'Error', description: 'No se pudo guardar el teléfono.', variant: 'destructive' });
                    } finally { setIsSavingPhone(false); }
                  })()}
                  className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!quickPhoneInput.trim() || isSavingPhone}
                  className="h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shrink-0 shadow-sm"
                  onClick={async () => {
                    if (!noPhoneCustomer || !quickPhoneInput.trim()) return;
                    setIsSavingPhone(true);
                    try {
                      await updateCustomerMutation.mutateAsync({ id: noPhoneCustomer.id, phone: quickPhoneInput.trim() } as any);
                      toast({ title: 'Teléfono guardado', description: `Número agregado para ${noPhoneCustomer.name}.` });
                      setShowNoPhoneDialog(false);
                    } catch (e) {
                      toast({ title: 'Error', description: 'No se pudo guardar el teléfono.', variant: 'destructive' });
                    } finally { setIsSavingPhone(false); }
                  }}
                >
                  {isSavingPhone ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>

              <div className="flex justify-end pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 font-medium"
                  onClick={() => setShowNoPhoneDialog(false)}
                >
                  Omitir por ahora
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div >
    </SimpleErrorBoundary >
  );
};

// ── MEMOIZED PURE ACTION BUTTONS COMPONENT ──
// Separated from POSContent to avoid re-rendering on every searchTerm/cart change
interface POSActionButtonsProps {
  profileName?: string;
  cartLength: number;
  isSavingOrder: boolean;
  currentWebOrderId: string | null;
  webOrdersCount: number;
  isFullscreen: boolean;
  onSaveOrder: () => void;
  onOpenAccounts: () => void;
  onShowWebSales: () => void;
  onToggleFullscreen: () => void;
}

const POSActionButtons = React.memo<POSActionButtonsProps>(function POSActionButtons({
  profileName,
  cartLength,
  isSavingOrder,
  currentWebOrderId,
  webOrdersCount,
  isFullscreen,
  onSaveOrder,
  onOpenAccounts,
  onShowWebSales,
  onToggleFullscreen,
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="hidden xl:flex flex-col items-end mr-1 pr-3 border-r border-border/50">
        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter leading-none mb-0.5">Cajero(a)</span>
        <span className="text-xs font-bold text-foreground truncate max-w-[140px] leading-none">{profileName || 'Usuario'}</span>
      </div>

      <Button
        variant="ghost"
        onClick={onSaveOrder}
        size="sm"
        className="h-9 min-w-9 sm:h-10 sm:px-3 gap-2 rounded-full border border-transparent hover:border-border/50"
        disabled={cartLength === 0 || isSavingOrder}
        title="Guardar Pedido (F9)"
      >
        <Save className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden lg:inline font-medium text-sm">{currentWebOrderId ? 'Actualizar' : 'Guardar'}</span>
      </Button>

      <Button
        variant="ghost"
        onClick={onOpenAccounts}
        size="sm"
        className="h-9 min-w-9 sm:h-10 sm:px-3 gap-2 rounded-full border border-transparent hover:border-border/50"
        title="Ver Cuentas (F8)"
      >
        <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden lg:inline font-medium text-sm">Cuentas</span>
      </Button>

      <Button
        variant="default"
        onClick={onShowWebSales}
        size="sm"
        className={`h-9 min-w-9 sm:h-10 sm:px-4 gap-2 rounded-full relative shadow-sm hover:shadow-md transition-all ${webOrdersCount > 0 ? 'bg-primary hover:bg-primary/90' : 'bg-primary/90 hover:bg-primary'}`}
        title="Pedidos Web"
      >
        <Store className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden md:inline font-bold text-sm">Web</span>
        {webOrdersCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-in zoom-in duration-300 ring-2 ring-background">
            {webOrdersCount > 9 ? '9+' : webOrdersCount}
          </span>
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleFullscreen}
        className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10 rounded-full text-muted-foreground hover:text-foreground items-center justify-center"
        title="Pantalla Completa"
      >
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </Button>
    </div>
  );
});

// ── MEMOIZED MENU BUTTON COMPONENT ──
interface POSMenuButtonProps {
  isMobile: boolean;
  navigationItems: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }> }>;
  onNavigate: (href: string) => void;
  onDailySales: () => void;
  onRefund: () => void;
  onCashMovements: () => void;
  onCloseDay: () => void;
  onDebtSelect: () => void;
  onLogout: () => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  layoutMode?: 'classic' | 'catalog';
  onLayoutModeChange?: (mode: 'classic' | 'catalog') => void;
  userName?: string;
  activeSession: any;
  onOpenRegister: () => void;
}

const POSMenuButton = React.memo<POSMenuButtonProps>(function POSMenuButton({
  isMobile,
  navigationItems,
  onNavigate,
  onDailySales,
  onRefund,
  onCashMovements,
  onCloseDay,
  onDebtSelect,
  onLogout,
  viewMode,
  onViewModeChange,
  layoutMode,
  onLayoutModeChange,
  userName,
  activeSession,
  onOpenRegister,
}) {
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
            <MenuIcon className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-zinc-950 border-t border-white/[0.06] p-4 pb-10 rounded-t-3xl">
          <DrawerHeader className="border-b border-white/[0.06] pb-4 mb-4 px-0">
            <DrawerTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
                  <Layers className="h-4.5 w-4.5 text-zinc-950" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-white leading-none mb-1">Menú</span>
                  <span className="text-[11px] text-zinc-500 leading-none">{userName || 'Harold Rosado'}</span>
                </div>
              </div>
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-0 overflow-y-auto max-h-[65vh] px-0.5 py-0.5 no-scrollbar">
            {/* General Navigation */}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1 mb-2 block">Navegación</span>
            {navigationItems.map(item => {
              const Icon = item.icon;
              return (
                <DrawerClose asChild key={item.href}>
                  <Button
                    variant="ghost"
                    onClick={() => onNavigate(item.href)}
                    className="w-full h-14 justify-between px-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] group transition-colors mb-2 active:scale-[0.99]"
                  >
                    <div className="flex items-center min-w-0 gap-3">
                      <div className="bg-white/[0.04] group-hover:bg-emerald-500/10 p-2 rounded-lg transition-colors border border-white/[0.05] group-hover:border-emerald-500/20 shrink-0">
                        <Icon className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{item.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </Button>
                </DrawerClose>
              );
            })}

            {/* MODO DEL POS Segmented Control */}
            <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-2 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Modo del POS</span>
              <div className="grid grid-cols-2 bg-black/30 p-1 rounded-lg gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onLayoutModeChange?.('classic')}
                  className={cn(
                    "h-8.5 text-xs font-medium rounded-md transition-colors",
                    layoutMode === 'classic'
                      ? "bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-500 hover:text-zinc-950"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  )}
                >
                  Búsqueda
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onLayoutModeChange?.('catalog')}
                  className={cn(
                    "h-8.5 text-xs font-medium rounded-md transition-colors",
                    layoutMode === 'catalog'
                      ? "bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-500 hover:text-zinc-950"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                  )}
                >
                  Catálogo
                </Button>
              </div>
            </div>

            {/* View Mode (List/Grid) for Catalog */}
            {layoutMode === 'catalog' && (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Vista de Catálogo</span>
                <div className="grid grid-cols-2 bg-black/30 p-1 rounded-lg gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewModeChange?.('list')}
                    className={cn(
                      "h-8.5 text-xs font-medium rounded-md transition-colors",
                      viewMode === 'list'
                        ? "bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-500 hover:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                    )}
                  >
                    Lista
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewModeChange?.('grid')}
                    className={cn(
                      "h-8.5 text-xs font-medium rounded-md transition-colors",
                      viewMode === 'grid'
                        ? "bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-500 hover:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
                    )}
                  >
                    Cuadros
                  </Button>
                </div>
              </div>
            )}

            {/* Caja Operations Grid */}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1 mb-2 mt-3 block">Caja</span>
            <div className="flex flex-col gap-2 mb-2">
              {/* Ventas del Día — única acción con acento de color, el resto queda neutro */}
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  onClick={onDailySales}
                  className="h-14 flex flex-row items-center gap-3 px-3.5 rounded-xl bg-emerald-500/[0.06] hover:bg-emerald-500/10 border border-emerald-500/20 group transition-colors active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-[13px] font-medium text-zinc-100 group-hover:text-white transition-colors">
                    Ventas del Día
                  </span>
                </Button>
              </DrawerClose>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: RefreshCcw, label: 'Devoluciones', action: onRefund },
                  { icon: HandCoins, label: 'Movimientos', action: onCashMovements },
                  { icon: DollarSign, label: 'Cobros Deudas', action: onDebtSelect, isDebt: true },
                  activeSession
                    ? { icon: Lock, label: 'Cierre de Caja', action: onCloseDay }
                    : { icon: Unlock, label: 'Abrir Caja', action: onOpenRegister },
                ].map((item, idx) => (
                  <DrawerClose asChild key={idx}>
                    <Button
                      variant="ghost"
                      onClick={item.action}
                      className="!flex !flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] group transition-colors active:scale-[0.98] h-20 w-full"
                    >
                      <item.icon className="h-4.5 w-4.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      <span className="font-medium text-zinc-300 group-hover:text-white transition-colors text-[11px] text-center leading-tight">
                        {item.label}
                      </span>
                    </Button>
                  </DrawerClose>
                ))}
              </div>
            </div>

            {/* Logout Button */}
            <div className="mt-1">
              <Button
                onClick={onLogout}
                variant="ghost"
                className="w-full h-12 bg-transparent hover:bg-red-500/10 text-red-400/80 hover:text-red-400 font-medium rounded-xl border border-red-500/20 transition-colors text-xs flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="pos-menu-btn" variant="outline" size="icon" className="h-9 w-9 shrink-0">
          <MenuIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 bg-popover shadow-lg">
        <div className="px-2 py-1.5 text-sm font-semibold">Navegación</div>
        <DropdownMenuSeparator />
        {navigationItems.map(item => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.href} onSelect={() => onNavigate(item.href)} className="cursor-pointer">
              <Icon className="h-4 w-4 mr-2" />
              {item.name}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDailySales} className="cursor-pointer"><Receipt className="h-4 w-4 mr-2" />Ventas del Día</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRefund} className="cursor-pointer"><RefreshCcw className="h-4 w-4 mr-2" />Devoluciones / Reembolsos</DropdownMenuItem>
        <DropdownMenuItem onSelect={onCashMovements} className="cursor-pointer"><HandCoins className="h-4 w-4 mr-2" />Movimientos de Caja (E/S)</DropdownMenuItem>
        {activeSession ? (
          <DropdownMenuItem onSelect={onCloseDay} className="cursor-pointer"><Lock className="h-4 w-4 mr-2" />Cierre de Caja (Finalizar Día)</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onOpenRegister} className="cursor-pointer"><Unlock className="h-4 w-4 mr-2" />Abrir Caja (Iniciar Turno)</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onDebtSelect} className="cursor-pointer"><DollarSign className="h-4 w-4 mr-2" />Cobros a Clientes (Deudas)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" />Cerrar Sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

const POS = () => {
  return (
    <SimpleErrorBoundary>
      <POSSearchProvider>
        <POSContent />
      </POSSearchProvider>
    </SimpleErrorBoundary>
  );
};

export default POS;
