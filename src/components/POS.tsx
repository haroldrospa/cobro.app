import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import PrintOptionsDialog from './pos/PrintOptionsDialog';
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
import CustomerCreditDialog from './customers/CustomerCreditDialog';
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
  const [creditDays, setCreditDays] = useState(30);
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

  const storeId = profile?.store_id;

  const { products: allProducts, customers = [] } = useMasterData();
  const updateCustomerMutation = useUpdateCustomer();
  const productsQueryLoading = false;
  const productsQueryFetching = false;
  const loadingProducts = (productsQueryLoading || productsQueryFetching) && allProducts.length === 0;
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

  const selectedInvoiceTypeData = invoiceTypes.find(t => t.id === selectedInvoiceType);
  const mappedInvoiceTypeCode = isElectronicActive
    ? (selectedInvoiceTypeData?.code === 'B01' ? 'E31' : selectedInvoiceTypeData?.code === 'B02' ? 'E32' : selectedInvoiceTypeData?.code)
    : selectedInvoiceTypeData?.code;
  const requiresCustomer = mappedInvoiceTypeCode === 'B01' || mappedInvoiceTypeCode === 'E31' || selectedInvoiceTypeData?.name?.toLowerCase().includes('crédito fiscal');



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
      const { data: { user } } = await supabase.auth.getUser();
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

  // Calcular ofertas automáticamente
  const cartWithOffers = React.useMemo(() => {
    return cart.map(item => {
      // Buscar ofertas para este producto
      const productOffers = activeOffers.filter(o => o.product_id === item.id);

      // Si hay ofertas, calcular el mejor precio
      if (productOffers.length > 0) {
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
  }, [cart, activeOffers]);

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

        const hasOrder = savedCartData.orderMetadata;
        toast({
          title: hasOrder ? "Orden restaurada" : "Carrito restaurado",
          description: hasOrder
            ? `${savedCartData.orderMetadata!.orderNumber} - ${savedCartData.items.length} productos`
            : `Se cargaron ${savedCartData.items.length} productos del carrito guardado.`,
        });
      } else {
        setCartLoaded(true);
      }
    } else if (!isLoadingSavedCart && !cartLoaded) {
      setCartLoaded(true);
    }
  }, [savedCartData, cartLoaded, isLoadingSavedCart, toast]);

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

      // Background: Handle kitchen order and order status updates
      (async () => {
        try {
          if (capturedCurrentWebOrderId) {
            if (capturedCurrentOrderSource === 'pos') {
              // FOR POS ORDERS: Complete cleanup (Delete) to avoid duplicates/confusion
              // The sale is already permanently recorded in the 'sales' table.
              await supabase
                .from('open_order_items')
                .delete()
                .eq('order_id', capturedCurrentWebOrderId);

              await supabase
                .from('open_orders')
                .delete()
                .eq('id', capturedCurrentWebOrderId);

              console.log('🗑️ Pedido guardado del POS eliminado correctamente tras el cobro.');
            } else {
              // FOR WEB ORDERS: Mark as paid but keep history
              // Read current kitchen status BEFORE updating — never regress a completed order
              const { data: existingOrder } = await supabase
                .from('open_orders')
                .select('order_status')
                .eq('id', capturedCurrentWebOrderId)
                .maybeSingle();

              // Only mark as 'preparing' if it hasn't been completed yet by the kitchen
              const kitchenAlreadyDone = existingOrder?.order_status === 'completed'
                || existingOrder?.order_status === 'delivered'
                || existingOrder?.order_status === 'shipped';

              // Determination of the new status:
              // For companies without kitchen (stores/supermarkets), we mark it as delivered/closed.
              // For restaurants, we ensure it enters/remains in the kitchen cycle.
              let nextStatus = existingOrder?.order_status || 'preparing';
              if (skipKitchenStep) {
                nextStatus = 'delivered';
              } else if (!kitchenAlreadyDone) {
                nextStatus = 'preparing';
              }

              await supabase
                .from('open_orders')
                .update({
                  payment_status: 'paid',
                  order_status: nextStatus,
                  updated_at: new Date().toISOString()
                })
                .eq('id', capturedCurrentWebOrderId);
            }
          } else if (!skipKitchenStep) {
            // For direct sales, create a temporary "preparing" order for the kitchen
            const { data: orderNumber } = await supabase.rpc('generate_order_number', { order_source: 'pos' });
            const orderId = crypto.randomUUID();

            await supabase.from('open_orders').insert({
              id: orderId,
              order_number: orderNumber,
              customer_name: selectedCustomerData?.name || 'Venta Directa',
              payment_status: 'paid',
              payment_method: capturedPaymentMethod,
              order_status: 'preparing',
              subtotal: parseFloat(currentTotals.subtotal) + surchargeAmount,
              tax_total: parseFloat(currentTotals.tax),
              total: finalTotal,
              source: 'pos',
              notes: orderTypeTags[capturedPosOrderType],
              store_id: store?.id,
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
          const storeId = store?.id;

          // Invalidate specific store queries
          if (storeId) {
            queryClient.invalidateQueries({ queryKey: ['web-orders', storeId] });
            queryClient.invalidateQueries({ queryKey: ['pos-open-orders', storeId] });
            queryClient.invalidateQueries({ queryKey: ['kitchen-orders', storeId] });
            queryClient.invalidateQueries({ queryKey: ['web-orders-count', storeId] });
          }

          // Force global invalidation as fallback to ensure the UI refreshes
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

      toast({
        title: "Pedido cargado",
        description: `${orderNumber || 'Pedido'} - ${customerName || 'Cliente'} (${items.length} productos)`,
      });
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

    toast({
      title: "Pedido cargado",
      description: `${order.order_number || 'Pedido'} - ${order.customer_name || 'Cliente'}`,
    });
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
        const { data: { user } } = await supabase.auth.getUser();
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

  // Treat as loading if pending (no data yet) or actively loading for the first time
  const storeLoading = isPendingStore || isLoadingStore;
  const profileLoading = isPendingProfile || isLoadingProfile;

  if (loadingProducts || loadingSettings || storeLoading || profileLoading) {
    let loadingText = 'Cargando sistema...';
    if (profileLoading) loadingText = 'Verificando perfil...';
    else if (storeLoading) loadingText = 'Conectando con tienda...';
    else if (loadingSettings) loadingText = 'Cargando configuraciones...';
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
          cart={cart}
          cartComponent={
            <MobileCartView
              cart={cartWithOffers}
              onUpdateQuantity={updateQuantity}
              onUpdateComment={updateComment}
              onUpdateDiscount={updateDiscount}
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
          <PrintOptionsDialog
            isOpen={showPrintOptionsDialog}
            onClose={() => setShowPrintOptionsDialog(false)}
            saleData={saleData}
          />
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
          <CustomerCreditDialog
            customer={selectedCustomerForDebt}
            open={!!selectedCustomerForDebt}
            onOpenChange={(open) => !open && setSelectedCustomerForDebt(null)}
          />
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
        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-y-auto lg:overflow-hidden pb-32 md:pb-3">

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
                  {products.length === 0 && (
                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex flex-col gap-1">
                      <span className="font-bold">🔍 DEBUG INFO (Envíaselo al desarrollador):</span>
                      <span>• Store ID (UserStore): {storeId || 'null/undefined'}</span>
                      <span>• Profile Store ID: {profile?.store_id || 'null/undefined'}</span>
                      <span>• Total Products (MasterData): {allProducts?.length ?? 0}</span>
                      <span>• Business Type: {storeSettings?.shop_type || 'undefined'}</span>
                      <span>• Session Loaded: {!isLoadingSession ? 'YES' : 'NO'} (Active: {activeSession ? 'YES' : 'NO'})</span>
                    </div>
                  )}
                </div>

                <div id="pos-cart-area" className="flex-1 min-h-[150px] md:min-h-[250px] overflow-hidden rounded-xl border bg-card shadow-sm z-10">
                  <CartSummary
                    cart={cartWithOffers}
                    onUpdateQuantity={updateQuantity}
                    onUpdateComment={updateComment}
                    onUpdateDiscount={updateDiscount}
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
                {products.length === 0 && (
                  <div className="m-2 p-2 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex flex-col gap-1">
                    <span className="font-bold">🔍 DEBUG INFO (Envíaselo al desarrollador):</span>
                    <span>• Store ID (UserStore): {storeId || 'null/undefined'}</span>
                    <span>• Profile Store ID: {profile?.store_id || 'null/undefined'}</span>
                    <span>• Total Products (MasterData): {allProducts?.length ?? 0}</span>
                    <span>• Business Type: {storeSettings?.shop_type || 'undefined'}</span>
                    <span>• Session Loaded: {!isLoadingSession ? 'YES' : 'NO'} (Active: {activeSession ? 'YES' : 'NO'})</span>
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
            <PrintOptionsDialog
              isOpen={showPrintOptionsDialog}
              onClose={() => setShowPrintOptionsDialog(false)}
              saleData={saleData}
            />
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
          <CustomerCreditDialog
            customer={selectedCustomerForDebt}
            open={!!selectedCustomerForDebt}
            onOpenChange={(open) => !open && setSelectedCustomerForDebt(null)}
          />
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
          <DialogContent className="max-w-sm rounded-2xl border border-amber-500/30 bg-card shadow-2xl p-0 overflow-hidden gap-0">
            {/* Amber accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
            <div className="p-6 space-y-4">
              <DialogHeader className="space-y-2 pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground leading-snug">
                      Teléfono de contacto faltante
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                      El cliente <strong className="text-foreground">{noPhoneCustomer?.name}</strong> no tiene número de teléfono registrado.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  ¿Deseas agregar el número de contacto ahora? Es importante para comunicaciones y seguimiento de crédito.
                </p>
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
                    className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    disabled={!quickPhoneInput.trim() || isSavingPhone}
                    className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold shrink-0"
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
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
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
        <DrawerContent className="bg-background border-zinc-800 p-4 pb-12 rounded-t-[2.5rem] shadow-2xl">
          <DrawerHeader className="border-b border-white/[0.04] pb-4 mb-4">
            <DrawerTitle className="text-lg font-black text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 h-9 w-9 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold tracking-tight text-white leading-none mb-0.5">Menú Principal</span>
                  <span className="text-[10px] font-medium text-zinc-500 leading-none">{userName || 'Vendedor'}</span>
                </div>
              </div>
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[65vh] px-1 py-1 no-scrollbar">
            {/* General Navigation */}
            {navigationItems.map(item => {
              const Icon = item.icon;
              return (
                <DrawerClose asChild key={item.href}>
                  <Button
                    variant="ghost"
                    onClick={() => onNavigate(item.href)}
                    className="w-full h-16 justify-between px-4 rounded-[1.25rem] bg-gradient-to-r from-zinc-900/60 to-zinc-950/60 hover:from-emerald-500/5 hover:to-teal-500/5 border border-white/[0.04] hover:border-emerald-500/20 group transition-all duration-300 mb-3.5"
                  >
                    <div className="flex items-center min-w-0">
                      <div className="bg-zinc-800/80 group-hover:bg-emerald-500/15 p-2.5 rounded-xl mr-3.5 transition-all duration-300 border border-white/[0.03] group-hover:border-emerald-500/10 shrink-0">
                        <Icon className="h-5 w-5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div className="text-left min-w-0">
                        <span className="font-bold text-zinc-500 group-hover:text-emerald-400/80 transition-colors uppercase tracking-[0.15em] text-[8px] block">Panel Principal</span>
                        <span className="text-xs font-black text-zinc-200 group-hover:text-white transition-colors truncate">{item.name}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </Button>
                </DrawerClose>
              );
            })}
 
            {/* MODO DEL POS Segmented Control */}
            <div className="flex flex-col gap-2 p-3.5 rounded-[1.25rem] bg-zinc-900/20 border border-white/[0.04] mb-3.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Modo del POS</span>
                  <span className="text-xs font-black text-zinc-100">
                    {layoutMode === 'classic' ? 'Búsqueda de Productos' : 'Catálogo Visual'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 bg-zinc-950/80 p-1 rounded-xl border border-white/[0.05] gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onLayoutModeChange?.('classic')}
                  className={cn(
                    "h-8.5 text-xs font-bold rounded-lg transition-all duration-300",
                    layoutMode === 'classic' 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/10 font-black" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Búsqueda
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onLayoutModeChange?.('catalog')}
                  className={cn(
                    "h-8.5 text-xs font-bold rounded-lg transition-all duration-300",
                    layoutMode === 'catalog' 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/10 font-black" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Catálogo
                </Button>
              </div>
            </div>
 
            {/* View Mode (List/Grid) for Catalog */}
            {layoutMode === 'catalog' && (
              <div className="flex flex-col gap-2 p-3.5 rounded-[1.25rem] bg-zinc-900/20 border border-white/[0.04] mb-3.5 transition-all duration-300">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Vista de Catálogo</span>
                    <span className="text-xs font-black text-zinc-100">
                      {viewMode === 'list' ? 'Lista Detallada' : 'Cuadricula de Fotos'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 bg-zinc-950/80 p-1 rounded-xl border border-white/[0.05] gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewModeChange?.('list')}
                    className={cn(
                      "h-8.5 text-xs font-bold rounded-lg transition-all duration-300",
                      viewMode === 'list' 
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/10 font-black" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Lista
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewModeChange?.('grid')}
                    className={cn(
                      "h-8.5 text-xs font-bold rounded-lg transition-all duration-300",
                      viewMode === 'grid' 
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/10 font-black" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Cuadros
                  </Button>
                </div>
              </div>
            )}
 
            {/* Caja Operations Grid */}
            <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500 px-1 mb-2.5 mt-1">Operaciones de Caja</div>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {[
                { icon: Receipt, label: 'Ventas del Día', action: onDailySales, color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/25 group-hover:bg-blue-500/10' },
                { icon: RefreshCcw, label: 'Devoluciones', action: onRefund, color: 'text-orange-400', bg: 'bg-orange-500/5 border-orange-500/10 hover:border-orange-500/25 group-hover:bg-orange-500/10' },
                { icon: HandCoins, label: 'Movimientos', action: onCashMovements, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/25 group-hover:bg-emerald-500/10' },
                activeSession
                  ? { icon: Lock, label: 'Cierre de Caja', action: onCloseDay, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/25 group-hover:bg-rose-500/10' }
                  : { icon: Unlock, label: 'Abrir Caja', action: onOpenRegister, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/25 group-hover:bg-emerald-500/10' },
                { icon: DollarSign, label: 'Cobros Deudas', action: onDebtSelect, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/25 group-hover:bg-amber-500/10', colSpan: true },
              ].map((item, idx) => (
                <DrawerClose asChild key={idx}>
                  <Button
                    variant="ghost"
                    onClick={item.action}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-900/30 hover:bg-zinc-900/50 border border-white/[0.03] hover:border-zinc-800/80 group transition-all duration-300",
                      item.colSpan ? "col-span-2 h-16 flex-row gap-3" : "h-22"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-all duration-300",
                      item.bg,
                      !item.colSpan && "mb-1.5"
                    )}>
                      <item.icon className={cn("h-5 w-5", item.color)} />
                    </div>
                    <span className="font-bold text-zinc-300 group-hover:text-white transition-colors tracking-wide text-[10px] text-center uppercase">{item.label}</span>
                  </Button>
                </DrawerClose>
              ))}
            </div>
 
            {/* Logout Button */}
            <div className="px-1 mt-2">
              <Button
                onClick={onLogout}
                variant="ghost"
                className="w-full h-14 bg-rose-950/15 hover:bg-rose-900/20 text-rose-400 font-extrabold rounded-[1.25rem] border border-rose-500/10 hover:border-rose-500/30 transition-all duration-300 uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="h-4.5 w-4.5" />
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
