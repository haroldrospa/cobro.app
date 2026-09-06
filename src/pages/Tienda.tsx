import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingCart, Store, Plus, Minus, Trash2, ArrowLeft, Package,
  Search, Sparkles, Tag, Filter, X, ChevronRight, Star, Percent,
  SlidersHorizontal, DollarSign, MapPin, User, ShoppingBag, Utensils, Home,
  Wallet, CreditCard, Smartphone, Building2, CheckCircle2, Navigation, UserPlus,
  Facebook, Instagram, Twitter, Phone, Mail, AlertTriangle, LogIn, Heart, Moon, Sun
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useStoreBySlug, useStoreByStoreCode } from '@/hooks/useStore';
import { useStoreProducts } from '@/hooks/useStoreProducts';
import { useCreateStoreOrder } from '@/hooks/useStoreOrders';
import { useStoreBanners } from '@/hooks/usePromotionalBanners';
import { useShopperProfile } from '@/hooks/useShopperProfile';
import { useShopperAuth } from '@/hooks/useShopperAuth';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import BannerCarousel from '@/components/store/BannerCarousel';
import { ShopperProfileDialog } from '@/components/store/ShopperProfileDialog';
import { supabase } from '@/integrations/supabase/client';
import { useShopperOrders } from '@/hooks/useShopperOrders';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { MobileDock, TabId } from '@/components/store/MobileDock';

interface CartItem {
  product: Product;
  quantity: number;
}

// Helper function to check if discount is active
const isDiscountActive = (product: Product): boolean => {
  const discount = product.discount_percentage || 0;
  if (discount <= 0) return false;

  const now = new Date();
  const startDate = product.discount_start_date ? new Date(product.discount_start_date) : null;
  const endDate = product.discount_end_date ? new Date(product.discount_end_date) : null;

  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;

  return true;
};

// Helper function to get discounted price
const getDiscountedPrice = (product: Product): number => {
  if (!isDiscountActive(product)) return product.price;
  return product.price * (1 - (product.discount_percentage || 0) / 100);
};

const Tienda: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // Try to find store by Slug first, then by Store Code (for QR codes)
  const { data: storeBySlug, isLoading: loadingSlug } = useStoreBySlug(slug);
  const { data: storeByCode, isLoading: loadingCode } = useStoreByStoreCode(slug);

  const store = storeBySlug || storeByCode;
  const storeLoading = loadingSlug || loadingCode;
  const storeError = !store && !storeLoading ? (new Error("Store not found")) : null;
  const { data: products = [], isLoading: productsLoading } = useStoreProducts(store?.id);
  const { data: banners = [] } = useStoreBanners(store?.id);
  const createOrder = useCreateStoreOrder();
  const { toast } = useToast();
  const { profile, saveProfile, isProfileComplete } = useShopperProfile();
  const { user } = useShopperAuth();
  const { theme, setTheme } = useTheme();

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(`cobro_cart_${slug}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save cart to local storage whenever it changes
  useEffect(() => {
    if (slug) {
      localStorage.setItem(`cobro_cart_${slug}`, JSON.stringify(cart));
    }
  }, [cart, slug]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<TabId>('home');

  useEffect(() => {
    if (!showCart && activeMobileTab === 'cart') {
      setActiveMobileTab('home');
    }
  }, [showCart, activeMobileTab]);

  useEffect(() => {
    if (!showProfileDialog && activeMobileTab === 'profile') {
      setActiveMobileTab('home');
    }
  }, [showProfileDialog, activeMobileTab]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveMobileTab(tab);
    if (tab === 'cart') {
      setShowCart(true);
    } else if (tab === 'profile') {
      setShowProfileDialog(true);
    } else if (tab === 'search') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const [profileDialogView, setProfileDialogView] = useState<'orders' | 'settings'>('orders');
  const [loyaltyData, setLoyaltyData] = useState<{ points: number, code: string } | null>(null);

  const { data: orders = [] } = useShopperOrders(
    profile?.email || user?.email || '',
    profile?.phone || ''
  );

  // Real-time chat notifications for shoppers
  useChatNotifications({
    orderIds: orders.map((o: any) => o.id),
    role: 'customer',
    enabled: true,
  });

  // Load loyalty data for the shopper
  useEffect(() => {
    const fetchLoyalty = async () => {
      if (!profile?.cedula || !store?.id) {
        setLoyaltyData(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('loyalty_points, validation_code')
          .eq('rnc', profile.cedula)
          .eq('store_id', store.id)
          .maybeSingle();

        if (data && !error) {
          setLoyaltyData({
            points: data.loyalty_points || 0,
            code: data.validation_code || ''
          });
        }
      } catch (err) {
        console.error("Error fetching loyalty data:", err);
      }
    };
    fetchLoyalty();
  }, [profile?.cedula, store?.id]);

  // Animation State for Add to Cart
  type CartAnimationType = { id: string; x: number; y: number; image?: string };
  const [cartAnimations, setCartAnimations] = useState<CartAnimationType[]>([]);

  const handleAddToCartAnim = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);

    // Create floating animation relative to the clicked button!
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newAnim = {
      id: Date.now().toString() + Math.random(),
      x: rect.left + rect.width / 2,
      y: rect.top,
      image: product.image_url
    };

    setCartAnimations(prev => [...prev, newAnim]);
    setTimeout(() => {
      setCartAnimations(prev => prev.filter(a => a.id !== newAnim.id));
    }, 800); // 0.8s match with animation duration
  };

  // Checkout Form State
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'dine-in'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'mobile'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [needsChange, setNeedsChange] = useState(false);
  const [amountPayingWith, setAmountPayingWith] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [showOnlyDiscounts, setShowOnlyDiscounts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm, selectedCategory, priceFilter, showOnlyDiscounts]);

  // Auto-fill checkout form from profile and user session
  useEffect(() => {
    if (user) {
      setCustomerEmail(user.email || '');
      if (user.user_metadata?.full_name) {
        setCustomerName(user.user_metadata.full_name);
      }
    }

    if (profile) {
      if (!user) {
        setCustomerName(profile.name || '');
        setCustomerEmail(profile.email || '');
      }
      setCustomerPhone(profile.phone || '');

      // Build address: text + GPS link if available
      let fullAddress = profile.address || '';
      if (profile.deliveryLat && profile.deliveryLng) {
        const gpsLink = `https://www.google.com/maps?q=${profile.deliveryLat},${profile.deliveryLng}`;
        fullAddress = fullAddress
          ? `${fullAddress}\n[GPS: ${gpsLink}]`
          : `[GPS: ${gpsLink}]`;
      } else if (profile.locationUrl) {
        fullAddress += `\n[GPS: ${profile.locationUrl}]`;
      }
      setCustomerAddress(fullAddress);
      setCustomerNotes(profile.notes || '');
    }
  }, [profile, user, showCheckout]);

  /* -----------------------------------------------------------------------------------------------
   * COMPREHENSIVE THEME ENGINE
   * ----------------------------------------------------------------------------------------------- */
  const storeSettings = Array.isArray(store?.store_settings)
    ? store?.store_settings?.[0]
    : store?.store_settings;
  const shopType = (storeSettings as any)?.shop_type || 'default';
  const isRestaurant = shopType === 'restaurant' || shopType === 'restaurante';

  // Calculate if store is currently open based on business hours
  const isStoreCurrentlyOpen = useMemo(() => {
    const hours = (storeSettings as any)?.business_hours;
    if (!hours) return true; // Assume open if no hours configured

    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    const todayHours = hours[currentDay];

    if (!todayHours || todayHours.closed) return false;

    // Convert time strings (HH:mm) to minutes for easier comparison
    const [openH, openM] = todayHours.open.split(':').map(Number);
    const [closeH, closeM] = todayHours.close.split(':').map(Number);
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const openTime = openH * 60 + openM;
    let closeTime = closeH * 60 + closeM;

    // If closing time is before or at opening time, it means it closes the next day
    if (closeTime <= openTime) {
      closeTime += 24 * 60;
    }

    // Check if within today's shift
    const isOpenToday = currentTime >= openTime && currentTime < closeTime;
    if (isOpenToday) return true;

    // Also check if we are within the late-night shift of yesterday
    const yesterdayDay = days[(now.getDay() + 6) % 7];
    const yesterdayHours = hours[yesterdayDay];
    if (yesterdayHours && !yesterdayHours.closed) {
      const [yOpenH, yOpenM] = yesterdayHours.open.split(':').map(Number);
      const [yCloseH, yCloseM] = yesterdayHours.close.split(':').map(Number);
      const yOpenTime = yOpenH * 60 + yOpenM;
      const yCloseTime = yCloseH * 60 + yCloseM;

      if (yCloseTime <= yOpenTime) {
        // It's an overnight shift
        const adjustedCurrentTime = currentTime + 24 * 60;
        const adjustedYCloseTime = yCloseTime + 24 * 60;
        return adjustedCurrentTime >= yOpenTime && adjustedCurrentTime < adjustedYCloseTime;
      }
    }

    return false;
  }, [storeSettings]);

  // Complete theme configurations with design tokens
  const themeConfigs = useMemo(() => ({
    default: {
      // PRESERVE EXACTLY - No CSS variable overrides
      cssVars: {},
      layout: { cardRadius: 'default', gridDensity: 'normal', spacing: 'default' },
      typography: { fontFamily: 'inherit', headingWeight: '600' },
      effects: { shadowIntensity: 'medium', borderStyle: 'solid' },
      imageAspect: 'aspect-square',
      cardPadding: 'p-1',
      priceSize: 'text-[10px]'
    },
    restaurant: {
      cssVars: {
        '--primary': '160 84% 39%',        // Emerald 600
        '--primary-foreground': '0 0% 100%',
        '--secondary': '240 10% 10%',      // Deep Zinc
        '--secondary-foreground': '0 0% 100%',
        '--accent': '160 84% 45%',         // Lighter Emerald
        '--accent-foreground': '0 0% 100%',
        '--radius': '1.5rem',
        '--card': '240 10% 4%',            // Ebony Card
        '--card-foreground': '0 0% 100%',
        '--background': '240 10% 2%',      // Darkest Ebony
        '--muted': '240 5% 15%',
        '--muted-foreground': '240 5% 65%',
      } as React.CSSProperties,
      layout: { cardRadius: 'xl', gridDensity: 'spacious', spacing: 'relaxed' },
      typography: { fontFamily: "'Comfortaa', 'Inter', cursive", headingWeight: '700' },
      effects: { shadowIntensity: 'mega', borderStyle: 'warm' },
      imageAspect: 'aspect-[4/3]',
      cardPadding: 'p-1',
      priceSize: 'text-[11px]'
    },
    fashion: {
      cssVars: {
        '--primary': '0 0% 0%',           // Pure Black
        '--primary-foreground': '0 0% 100%',
        '--secondary': '0 0% 98%',        // Almost white
        '--secondary-foreground': '0 0% 0%',
        '--muted': '0 0% 98%',
        '--muted-foreground': '0 0% 35%', // Medium gray
        '--radius': '0px',                // Perfectly sharp
        '--card': '0 0% 100%',
        '--card-foreground': '0 0% 0%',
        '--background': '0 0% 100%',      // Pure white
        '--border': '0 0% 90%',           // Very light gray borders
        '--accent': '0 0% 5%',
        '--accent-foreground': '0 0% 100%',
      } as React.CSSProperties,
      layout: { cardRadius: 'none', gridDensity: 'ultra-sparse', spacing: 'generous' },
      typography: { fontFamily: "'Playfair Display', serif", headingWeight: '300' },
      effects: { shadowIntensity: 'ultra-minimal', borderStyle: 'sharp' },
      imageAspect: 'aspect-[3/4]',  // Portrait for clothing
      cardPadding: 'p-2',
      priceSize: 'text-[9px]'          // Subtle prices (luxury)
    },
    supermarket: {
      cssVars: {
        '--primary': '40 65% 55%',         // Warm Gold (logo accent)
        '--primary-foreground': '145 45% 12%', // Dark forest green text on gold
        '--secondary': '145 45% 20%',      // Medium forest green
        '--secondary-foreground': '40 70% 80%', // Cream/gold text
        '--radius': '0.5rem',
        '--accent': '40 75% 62%',          // Lighter gold for highlights
        '--accent-foreground': '145 45% 12%',
        '--card': '145 40% 14%',           // Dark forest green cards
        '--card-foreground': '40 70% 88%', // Cream text on cards
        '--background': '145 45% 11%',     // Deep forest green (logo bg)
        '--foreground': '40 60% 85%',      // Warm cream foreground
        '--muted': '145 35% 18%',          // Slightly lighter green for muted zones
        '--muted-foreground': '40 40% 60%',// Muted gold
        '--border': '40 35% 28%',          // Gold-tinted border
        '--destructive': '0 75% 50%',
        '--ring': '40 65% 55%',
      } as React.CSSProperties,
      layout: { cardRadius: 'sm', gridDensity: 'ultra-dense', spacing: 'compact' },
      typography: { fontFamily: "'Inter', 'Arial', sans-serif", headingWeight: '800' },
      effects: { shadowIntensity: 'flat', borderStyle: 'solid' },
      imageAspect: 'aspect-square',
      cardPadding: 'p-1',
      priceSize: 'text-[12px] font-black'
    },
    technology: {
      cssVars: {
        '--primary': '210 100% 55%',      // Cyan Blue (neon)
        '--primary-foreground': '0 0% 100%',
        '--secondary': '220 20% 15%',     // Dark steel
        '--secondary-foreground': '210 100% 70%',
        '--radius': '0.25rem',
        '--background': '220 30% 8%',     // Very dark background
        '--foreground': '210 100% 90%',   // Bright cyan text
        '--card': '220 25% 12%',          // Dark cards
        '--card-foreground': '210 100% 85%',
        '--muted': '220 20% 18%',
        '--muted-foreground': '210 60% 60%',
        '--border': '210 80% 30%',        // Cyan borders
        '--accent': '270 100% 60%',       // Purple accent
        '--destructive': '0 100% 60%',
      } as React.CSSProperties,
      layout: { cardRadius: 'sm', gridDensity: 'normal', spacing: 'default' },
      typography: { fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", headingWeight: '600' },
      effects: { shadowIntensity: 'neon-glow', borderStyle: 'cyber' },
      imageAspect: 'aspect-[16/9]',  // Widescreen
      cardPadding: 'p-1',
      priceSize: 'text-[11px] font-mono'
    }
  }), []);

  // Apply CSS variables from theme config
  const themeStyles = useMemo(() => {
    const config = themeConfigs[shopType as keyof typeof themeConfigs] || themeConfigs.default;
    return config.cssVars;
  }, [shopType, themeConfigs]);

  // Computed theme classes for components - EXTREME DIFFERENTIATION
  const themeClasses = useMemo(() => {
    const config = themeConfigs[shopType as keyof typeof themeConfigs] || themeConfigs.default;

    return {
      // CARD STYLING - Dramatically different per theme
      // CARD STYLING - Refined for premium compact look
      card: {
        restaurant: `rounded-2xl shadow-sm hover:shadow-md border border-border/40 bg-card transition-all duration-300 hover:-translate-y-1`, // Removed heavy gradients and borders
        fashion: `rounded-sm border border-border/20 shadow-none hover:shadow-sm transition-all duration-300 bg-white dark:bg-card`,
        supermarket: `rounded-lg border border-[hsl(40,35%,28%)] shadow-md hover:shadow-lg hover:border-[hsl(40,65%,55%)] transition-all duration-200 bg-[hsl(145,40%,14%)] overflow-hidden`,
        technology: `rounded-xl bg-slate-900 border border-slate-800 shadow-sm hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300`,
        default: `rounded-xl border border-border/40 shadow-sm hover:shadow-md bg-card transition-all duration-300`
      }[shopType] || `rounded-xl border border-border/40 shadow-sm hover:shadow-md bg-card transition-all duration-300`,

      // BUTTON STYLING - Highly distinctive
      // BUTTON STYLING - More compact and clearer
      button: {
        restaurant: 'rounded-full font-bold h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow transition-all',
        fashion: 'rounded-none uppercase tracking-widest text-[10px] h-8 border border-foreground hover:bg-foreground hover:text-background transition-all',
        supermarket: 'rounded font-extrabold h-8 text-xs bg-[hsl(40,65%,55%)] hover:bg-[hsl(40,70%,62%)] text-[hsl(145,45%,12%)] shadow-sm tracking-wide uppercase',
        technology: 'rounded font-mono text-[10px] h-8 bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-wider',
        default: 'rounded-lg h-9 text-sm font-medium shadow-sm active:scale-95 transition-all'
      }[shopType] || 'rounded-lg h-9 text-sm font-medium shadow-sm active:scale-95 transition-all',

      // GRID LAYOUT - Extreme density differences
      // GRID LAYOUT - Much denser for better overview
      // GRID LAYOUT - Force 2 columns on mobile for all themes
      grid: {
        restaurant: 'grid-cols-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6',
        fashion: 'grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8',
        supermarket: 'grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4',
        technology: 'grid-cols-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4',
        default: 'grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6'
      }[shopType] || 'grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6',

      imageAspect: config.imageAspect,
      cardPadding: config.cardPadding,
      priceSize: config.priceSize,

      // Typography - MUCH MORE DISTINCT
      heading: {
        fontFamily: config.typography.fontFamily,
        fontWeight: config.typography.headingWeight
      },

      // CONTAINER STYLING - Theme-specific backgrounds
      pageBackground: {
        restaurant: 'bg-gradient-to-b from-orange-50 via-white to-red-50',
        fashion: 'bg-white dark:bg-card',
        supermarket: 'bg-[hsl(145,45%,11%)]',
        technology: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950',
        default: 'bg-gradient-to-b from-background to-muted/20'
      }[shopType] || 'bg-gradient-to-b from-background to-muted/20'
    };
  }, [shopType, themeConfigs]);

  const activeProducts = products.filter(p => (p.track_inventory === false) || (p.stock ?? 0) > 0);
  const settingsData = store?.company_settings;
  const companySettings = Array.isArray(settingsData) ? settingsData[0] : settingsData as any; // Cast as any just to be safe with TS if types are loose
  const storeName = companySettings?.company_name || store?.store_name || 'Tienda';

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    activeProducts.forEach(p => {
      if (p.category?.name && p.category_id) {
        cats.set(p.category_id, p.category.name);
      }
    });
    return Array.from(cats, ([id, name]) => ({ id, name }));
  }, [activeProducts]);

  // Featured products - prioritize products with active discounts or marked as featured
  const featuredProducts = useMemo(() => {
    return activeProducts
      .filter(p => p.is_featured || isDiscountActive(p))
      .slice(0, 6);
  }, [activeProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.category?.name?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(p => {
        const price = getDiscountedPrice(p);
        switch (priceFilter) {
          case 'under50': return price < 50;
          case '50to100': return price >= 50 && price <= 100;
          case '100to500': return price > 100 && price <= 500;
          case 'over500': return price > 500;
          default: return true;
        }
      });
    }

    // Discounts only filter
    if (showOnlyDiscounts) {
      filtered = filtered.filter(p => isDiscountActive(p));
    }

    return filtered;
  }, [activeProducts, searchTerm, selectedCategory, priceFilter, showOnlyDiscounts]);

  const addToCart = (product: Product) => {
    if (!isStoreCurrentlyOpen) {
      toast({
        title: 'Negocio Cerrado',
        description: 'Lo sentimos, en este momento no estamos aceptando pedidos.',
        variant: 'destructive'
      });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: product.track_inventory === false ? item.quantity + 1 : Math.min(item.quantity + 1, product.stock ?? 0) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    // Toast removed as per user request
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (item.product.track_inventory !== false && newQty > (item.product.stock ?? 0)) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const { cartTotal, cartSubtotal, cartTax } = cart.reduce((acc, item) => {
    const price = getDiscountedPrice(item.product);
    const taxRate = (item.product.tax_percentage ?? 18) / 100;
    const quantity = item.quantity;

    let itemTotal, itemTax, itemSubtotal;

    if (item.product.cost_includes_tax) {
      itemTotal = price * quantity;
      itemSubtotal = itemTotal / (1 + taxRate);
      itemTax = itemTotal - itemSubtotal;
    } else {
      itemSubtotal = price * quantity;
      itemTax = itemSubtotal * taxRate;
      itemTotal = itemSubtotal + itemTax;
    }

    return {
      cartTotal: acc.cartTotal + itemTotal,
      cartSubtotal: acc.cartSubtotal + itemSubtotal,
      cartTax: acc.cartTax + itemTax
    };
  }, { cartTotal: 0, cartSubtotal: 0, cartTax: 0 });
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !store) return;

    if (!isStoreCurrentlyOpen) {
      toast({
        title: 'Tienda Cerrada',
        description: 'En este momento no estamos recibiendo pedidos. Consulta nuestros horarios.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const items = cart.map(item => {
        const taxPercentage = item.product.tax_percentage ?? 18;
        const discountPrice = getDiscountedPrice(item.product);
        const quantity = item.quantity;

        let subtotal, taxAmount, total;

        if (item.product.cost_includes_tax) {
          total = discountPrice * quantity;
          subtotal = total / (1 + taxPercentage / 100);
          taxAmount = total - subtotal;
        } else {
          subtotal = discountPrice * quantity;
          taxAmount = subtotal * (taxPercentage / 100);
          total = subtotal + taxAmount;
        }

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: quantity,
          unit_price: discountPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total: total
        };
      });

      await createOrder.mutateAsync({
        store_id: store.id,
        customer_name: customerName || 'Cliente Web',
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        customer_address: orderType === 'delivery' ? customerAddress : `Pedido para ${orderType === 'pickup' ? 'Recoger' : 'Comer Dentro'}`,
        notes: `[${orderType.toUpperCase()}] [${paymentMethod.toUpperCase()}] ${paymentMethod === 'cash' ? (needsChange ? `[CAMBIO DE: ${amountPayingWith}]` : '[EFECTIVO EXACTO]') : ''} ${customerNotes || ''}`.trim(),
        payment_method: paymentMethod,
        subtotal: cartSubtotal,
        discount_total: 0,
        tax_total: cartTax,
        total: cartTotal,
        items,
      });

      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setNeedsChange(false);
      setAmountPayingWith('');

      // Open the profile dialog immediately to show the order status tracking
      setProfileDialogView('orders');
      setShowProfileDialog(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo procesar el pedido.',
        variant: 'destructive'
      });
    }
  };

  const handleCheckoutWhatsApp = async () => {
    const phone = companySettings?.phone || store?.phone || '';
    
    // Save order in database first
    await handleCheckout();

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      let text = `*¡Nuevo Pedido en ${storeName}!*\n\n`;
      text += `👤 *Cliente:* ${customerName || 'Cliente'}\n`;
      if (customerPhone) text += `📞 *Teléfono:* ${customerPhone}\n`;
      if (orderType === 'delivery') text += `🛵 *Entrega:* ${customerAddress || 'No especificada'}\n`;
      else text += `🛍️ *Modalidad:* ${orderType === 'pickup' ? 'Para Recoger' : 'Comer en Local'}\n`;
      text += `💳 *Pago:* ${paymentMethod.toUpperCase()} ${paymentMethod === 'cash' && needsChange ? `(Cambio de $${amountPayingWith})` : ''}\n\n`;
      text += `*Productos:*\n`;
      cart.forEach(item => {
        text += `• ${item.quantity}x ${item.product.name} - $${(getDiscountedPrice(item.product) * item.quantity).toFixed(2)}\n`;
      });
      text += `\n*TOTAL: $${cartTotal.toFixed(2)}*`;

      const url = `https://wa.me/${cleanPhone.startsWith('1') ? cleanPhone : '1' + cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  if (storeLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Tienda no encontrada</h1>
        <p className="text-muted-foreground mb-6">La tienda que buscas no existe o no está disponible.</p>
        <Link to="/buscar-tienda">
          <Button>Buscar otra tienda</Button>
        </Link>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 font-sans text-slate-900 dark:text-zinc-100 pb-24 selection:bg-emerald-500/20 selection:text-emerald-600">
      {/* Sleek Minimalist Header - Fixed on top */}
      <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-3 min-w-0">
            {companySettings?.logo_url ? (
              <img
                src={companySettings.logo_url}
                alt={storeName}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-slate-100 dark:bg-zinc-900 p-1 border border-slate-200 dark:border-zinc-800 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                {storeName || 'Tienda'}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px]">
                {isStoreCurrentlyOpen ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Abierto
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-rose-500 dark:text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Cerrado
                  </span>
                )}
                {companySettings?.phone && (
                  <>
                    <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-slate-400 dark:text-zinc-500 truncate hidden sm:inline">
                      {companySettings.phone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search Bar (Desktop Integrated) */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, categoría o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 h-10 bg-slate-100/80 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Desktop Cart Button */}
            <Button
              variant="outline"
              onClick={() => setShowCart(true)}
              className="relative h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/80 gap-2 text-slate-700 dark:text-zinc-200 hidden sm:flex items-center font-bold text-xs"
            >
              <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Carrito</span>
              {cartItemCount > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-black h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Button>

            {/* Profile / Orders Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setShowProfileDialog(true)}
              title="Mi perfil y pedidos"
            >
              {user && profile?.name ? (
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <User className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 space-y-6 mt-5 max-w-7xl mx-auto w-full">
        {/* Mobile Search Bar */}
        <div className="relative md:hidden">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 h-11 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Restaurant Special Hero Banner (Only shown if shopType is restaurant) */}
        {isRestaurant && (
          <section className="bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent dark:from-amber-950/20 dark:via-rose-950/10 rounded-2xl p-5 sm:p-6 border border-amber-500/20 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                {companySettings?.logo_url ? (
                  <img src={companySettings.logo_url} alt={storeName} className="h-14 w-14 object-cover rounded-2xl border border-white/20 shadow-sm" />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                    <Utensils className="h-7 w-7" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{storeName}</h2>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Utensils className="h-3 w-3" /> Restaurante
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-1">
                    {companySettings?.slogan || companySettings?.meta_description || "¡Sabores preparados al instante para ti!"}
                  </p>
                  <div className="flex items-center gap-2.5 mt-2 text-xs flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 4.8
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      🛵 25-35 min
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Promotional Banner Carousel */}
        {banners.length > 0 && (
          <section className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <BannerCarousel banners={banners} />
          </section>
        )}

        {/* Category Filter Pills & Header */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isRestaurant ? "Menú de Platos" : "Catálogo de Productos"}
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'producto disponible' : 'productos disponibles'}
              </p>
            </div>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold px-2 rounded-lg"
                onClick={() => setSelectedCategory(null)}
              >
                Limpiar filtro
              </Button>
            )}
          </div>

          {/* Minimalist Horizontal Scroll Categories */}
          <ScrollArea className="w-full whitespace-nowrap pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6" type="scroll">
            <div className="flex w-max space-x-2 py-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  !selectedCategory
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-zinc-800'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-zinc-800'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </section>

        {/* Minimalist Modern Product Grid */}
        <section className="pt-1">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900/50 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60">
              <Package className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-800 dark:text-zinc-200">No se encontraron productos</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Prueba cambiando la búsqueda o seleccionando otra categoría</p>
              {selectedCategory && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl text-xs font-bold"
                  onClick={() => setSelectedCategory(null)}
                >
                  Ver todos los productos
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
              {filteredProducts.slice(0, visibleCount).map((product) => {
                const hasDiscount = isDiscountActive(product);
                const discountedPrice = getDiscountedPrice(product);
                const cartItem = cart.find(item => item.product.id === product.id);
                const itemQty = cartItem ? cartItem.quantity : 0;

                return (
                  <div
                    key={product.id}
                    className="group relative bg-white dark:bg-zinc-900/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-lg dark:hover:shadow-zinc-950/50 transition-all duration-300 flex flex-col justify-between"
                  >
                    {/* Top Badges & Actions */}
                    <div className="relative">
                      {/* Heart / Favorite */}
                      <button
                        className="absolute top-0 left-0 z-10 p-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-slate-400 hover:text-rose-500 transition-colors shadow-xs"
                        onClick={(e) => { e.stopPropagation(); }}
                        title="Favorito"
                      >
                        <Heart className="h-3.5 w-3.5" />
                      </button>

                      {/* Discount / Special Badge */}
                      <div className="absolute top-0 right-0 z-10 flex flex-col items-end gap-1">
                        {hasDiscount && (
                          <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs tracking-wide">
                            -{product.discount_percentage}%
                          </span>
                        )}
                        {isRestaurant && product.is_featured && (
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Top
                          </span>
                        )}
                      </div>

                      {/* Product Image Box */}
                      <div
                        className="aspect-square w-full rounded-xl bg-slate-50/90 dark:bg-zinc-800/40 p-3 mb-3 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-100/80 dark:group-hover:bg-zinc-800/70 transition-colors cursor-pointer"
                        onClick={(e) => handleAddToCartAnim(e, product)}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-300 dark:text-zinc-600">
                            {isRestaurant ? <Utensils className="h-7 w-7 text-amber-500/40" /> : <Package className="h-7 w-7" />}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Meta */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {product.category?.name && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block line-clamp-1 mb-1">
                            {product.category.name}
                          </span>
                        )}
                        <h3 className="font-bold text-[13px] sm:text-sm text-slate-800 dark:text-zinc-100 line-clamp-2 leading-snug min-h-[2.4rem] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            {hasDiscount && (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 line-through">
                                ${product.price.toFixed(2)}
                              </span>
                            )}
                            <span className="font-black text-sm sm:text-base font-mono tracking-tight text-slate-900 dark:text-white">
                              ${discountedPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-400 dark:text-zinc-500">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-[10px] font-bold">4.8</span>
                          </div>
                        </div>

                        {/* Quantity / Add Button */}
                        {itemQty === 0 ? (
                          <Button
                            size="sm"
                            className="w-full h-9 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/10 hover:shadow-md hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            onClick={(e) => handleAddToCartAnim(e, product)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between bg-slate-100 dark:bg-zinc-800/90 rounded-xl p-1 border border-slate-200/80 dark:border-zinc-700/60 shadow-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product.id, -1);
                              }}
                              className="h-7 w-7 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-colors shadow-xs active:scale-90"
                              title="Restar"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-black text-xs text-slate-800 dark:text-zinc-100 px-2 font-mono">
                              {itemQty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCartAnim(e, product);
                              }}
                              className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors shadow-xs active:scale-90"
                              title="Sumar"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {visibleCount < filteredProducts.length && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                className="rounded-xl bg-white dark:bg-zinc-900 shadow-xs border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs h-10 px-6 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
                onClick={() => setVisibleCount(prev => prev + 24)}
              >
                Cargar más productos ({filteredProducts.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </section>
      </main>
      {/* Premium Footer */ }
  <footer className="bg-gradient-to-b from-muted/50 to-muted/80 border-t border-border/40 pt-16 pb-8 mt-auto">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">

        {/* Brand Section */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-3">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt={storeName} className="h-12 w-12 object-contain rounded-xl bg-white dark:bg-card/5 p-1 border border-white/10" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold tracking-tight">{storeName}</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Catálogo Digital</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-sm">
            {companySettings?.meta_description || "Ofrecemos productos de la más alta calidad para satisfacer tus antojos. Tu satisfacción es nuestra prioridad."}
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-3 pt-2">
            {[
              { icon: Facebook, label: "Facebook", url: companySettings?.social_facebook },
              { icon: Instagram, label: "Instagram", url: companySettings?.social_instagram },
              { icon: Twitter, label: "Twitter", url: companySettings?.social_twitter }
            ].map((social, idx) => (
              <a
                key={idx}
                href={social.url || "#"}
                target={social.url ? "_blank" : "_self"}
                rel={social.url ? "noopener noreferrer" : ""}
                className="h-10 w-10 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group"
                aria-label={social.label}
              >
                <social.icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
              </a>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="md:col-span-4 space-y-4">
          <h4 className="font-semibold text-foreground tracking-tight">Contacto</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>
                {companySettings?.address || "Dirección no disponible"}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary shrink-0" />
              <a href={`tel:${companySettings?.phone}`} className="hover:text-primary transition-colors">{companySettings?.phone || "No registrado"}</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <a href={`mailto:${companySettings?.email}`} className="hover:text-primary transition-colors">{companySettings?.email || "contacto@tienda.com"}</a>
            </li>
          </ul>
        </div>

        {/* Hours */}
        <div className="md:col-span-3 space-y-4">
          <h4 className="font-semibold text-foreground tracking-tight">Horarios</h4>
          <div className="space-y-2 text-sm">
            {storeSettings?.business_hours ? (
              ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((dayKey) => {
                const day = storeSettings.business_hours[dayKey];
                const labelMap: Record<string, string> = {
                  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
                  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
                };

                if (!day) return null;

                return (
                  <div key={dayKey} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground w-24">{labelMap[dayKey]}</span>
                    <span className={`font-medium ${day.closed ? 'text-rose-500/80' : 'text-foreground'}`}>
                      {day.closed ? 'Cerrado' : `${day.open} - ${day.close}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground italic">
                <p>Horarios no configurados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {storeName}. Todos los derechos reservados.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-primary transition-colors">Privacidad</a>
          <a href="#" className="hover:text-primary transition-colors">Términos</a>
          <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
            <span>Powered by</span>
            <span className="font-bold text-foreground">CobroApp</span>
          </div>
        </div>
      </div>
    </div>
  </footer>

  {/* Sticky Floating Cart Bar */}
  {cartItemCount > 0 && (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-5 duration-300">
      <div 
        onClick={() => setShowCart(true)}
        className="bg-slate-900/95 dark:bg-zinc-900/95 backdrop-blur-xl text-white p-3.5 pl-4 rounded-2xl shadow-[0_15px_35px_-5px_rgba(0,0,0,0.4)] border border-white/10 flex items-center justify-between cursor-pointer hover:bg-slate-900 dark:hover:bg-zinc-900 transition-all group active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 group-hover:scale-105 transition-transform">
            <ShoppingBag className="h-5.5 w-5.5 text-white" />
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] h-5 w-5 rounded-full flex items-center justify-center border-2 border-slate-900">
              {cartItemCount}
            </span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-400">Ver tu pedido</p>
            <p className="text-lg font-black tracking-tight text-white font-mono">${cartTotal.toFixed(2)}</p>
          </div>
        </div>

        <Button className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4 shadow-md flex items-center gap-1.5 group-hover:translate-x-0.5 transition-all">
          Ver Carrito
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )}

  {/* Mobile Spotlight Dock */}
  <MobileDock
    activeTab={activeMobileTab}
    setActiveTab={handleTabChange}
    cartItemCount={cartItemCount}
  />

  {/* Cart Dialog */}
  <Dialog open={showCart} onOpenChange={setShowCart}>
    <DialogContent 
      centerOnMobile={false}
      className="w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border bg-card shadow-2xl"
    >
      {/* Mobile bottom-sheet drag indicator */}
      <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-3 block sm:hidden shrink-0 animate-pulse" />
      
      <DialogHeader className="px-6 py-5 border-b border-border bg-card/50">
        <DialogTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-md relative border border-white/10">
              <ShoppingBag className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Tu Carrito</span>
          </div>
          {cartItemCount > 0 && (
            <Badge variant="secondary" className="bg-secondary/60 text-secondary-foreground text-[11px] font-bold rounded-full px-2.5 py-0.5 shadow-sm">
              {cartItemCount} {cartItemCount === 1 ? 'ítem' : 'ítems'}
            </Badge>
          )}
        </DialogTitle>
      </DialogHeader>

      {cart.length === 0 ? (
        <div className="py-16 text-center px-6 flex flex-col items-center justify-center">
          <div className="h-20 w-20 bg-muted/40 rounded-full flex items-center justify-center mb-5">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-bold text-foreground">Tu carrito está vacío</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[200px] leading-relaxed">¡Agrega productos deliciosos para comenzar tu pedido!</p>
          <Button variant="outline" className="mt-6 rounded-full px-6 font-semibold" onClick={() => setShowCart(false)}>
            Seguir comprando
          </Button>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 max-h-[50vh] overflow-y-auto px-6">
            <div className="divide-y divide-border/40 pb-4 pt-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-4 py-4 group">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white dark:bg-card dark:bg-secondary flex-shrink-0 shadow-sm border border-black/5 dark:border-border">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="font-bold text-[14px] leading-tight text-foreground line-clamp-2 pr-2">{item.product.name}</p>
                    <p className="text-[13px] font-semibold text-primary mt-1.5 font-mono">${item.product.price.toFixed(2)}</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex items-center bg-secondary/40 rounded-full border border-border overflow-hidden shadow-sm">
                      <button 
                        type="button"
                        className="h-8 w-8 flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-secondary/80 transition-colors active:bg-secondary focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" 
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold select-none text-foreground">{item.quantity}</span>
                      <button 
                        type="button"
                        className="h-8 w-8 flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-secondary/80 transition-colors active:bg-secondary focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" 
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button 
                      type="button"
                      className="h-8 w-8 flex items-center justify-center rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" 
                      onClick={() => removeFromCart(item.product.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="bg-card/50 px-6 py-4 border-t border-border/40 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-end mb-4">
              <span className="font-bold text-muted-foreground">Total</span>
              <span className="text-2xl font-black text-primary font-mono">${cartTotal.toFixed(2)}</span>
            </div>

            <div className="w-full space-y-2.5">
              <Button
                size="lg"
                className={`w-full h-14 rounded-2xl font-bold transition-all text-base border-0 ${
                  !isStoreCurrentlyOpen 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none' 
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98]'
                }`}
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                disabled={!isStoreCurrentlyOpen}
              >
                {isStoreCurrentlyOpen ? (
                  <div className="flex items-center justify-center w-full gap-2">
                    <span>Hacer Pedido / Checkout</span>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                ) : (
                  "Negocio Cerrado"
                )}
              </Button>

              {!user && (
                <div className="text-center pt-1">
                  <button 
                    onClick={() => { setShowCart(false); setProfileDialogView('orders'); setShowProfileDialog(true); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    ¿Ya tienes cuenta? Inicia sesión aquí
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>

  {/* Checkout Dialog - Ultra-fast Interactive 1-Click Checkout */}
  <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
    <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col rounded-[2rem] p-0 gap-0 overflow-hidden border-slate-200/80 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950">
      {/* Header */}
      <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Finalizar Pedido
              </DialogTitle>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                {isProfileComplete(profile) ? "Verifica y confirma en 1 solo paso" : "Completa tus datos para entrega"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs font-black px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            ${cartTotal.toFixed(2)}
          </Badge>
        </div>
        {!isStoreCurrentlyOpen && (
          <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl">
            <p className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Tienda fuera de horario. No se pueden procesar pedidos ahora.
            </p>
          </div>
        )}
      </DialogHeader>

      <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-5">
        {/* Order Type Tabs (Interactive Segmented Control) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Modalidad de Entrega
          </label>
          <div className={`grid ${(shopType === 'store' || shopType === 'supermarket') ? 'grid-cols-2' : 'grid-cols-3'} gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800`}>
            <button
              type="button"
              onClick={() => setOrderType('delivery')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                orderType === 'delivery'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 scale-[1.02]'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Delivery</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderType('pickup')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                orderType === 'pickup'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 scale-[1.02]'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Para Recoger</span>
            </button>
            {!(shopType === 'store' || shopType === 'supermarket') && (
              <button
                type="button"
                onClick={() => setOrderType('dine-in')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  orderType === 'dine-in'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 scale-[1.02]'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Utensils className="h-4 w-4" />
                <span>En Mesa</span>
              </button>
            )}
          </div>
        </div>

        {/* Customer Information (Smart Mode: Express Card vs Quick Form) */}
        {isProfileComplete(profile) ? (
          /* Express Customer Summary Card */
          <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  {profile!.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{profile!.name}</p>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{profile!.phone}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg px-2.5"
                onClick={() => { setShowCheckout(false); setProfileDialogView('settings'); setShowProfileDialog(true); }}
              >
                Editar
              </Button>
            </div>

            {orderType === 'delivery' && (
              <div className="pt-2 border-t border-emerald-500/15 flex items-start gap-2 text-xs text-slate-600 dark:text-zinc-300">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-2">{profile!.address || 'Dirección guardada'}</p>
                  {profile!.deliveryLat && profile!.deliveryLng && (
                    <a
                      href={`https://www.google.com/maps?q=${profile!.deliveryLat},${profile!.deliveryLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1 mt-0.5 hover:underline"
                    >
                      <Navigation className="h-3 w-3" />
                      {profile!.locationLabel || 'Ubicación GPS confirmada'}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Guest Smart Form */
          <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Nombre Completo <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Tu nombre"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="h-10 text-sm bg-white dark:bg-zinc-900 rounded-xl"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Teléfono / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="tel"
                  placeholder="(809) 000-0000"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="h-10 text-sm bg-white dark:bg-zinc-900 rounded-xl"
                />
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  Dirección de Entrega
                </label>
                <Textarea
                  placeholder="Sector, calle, número de casa/apto..."
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  className="min-h-[70px] text-sm bg-white dark:bg-zinc-900 rounded-xl resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Payment Methods (Interactive Chips) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Método de Pago
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'cash', label: 'Efectivo', icon: Wallet },
              { id: 'card', label: 'Tarjeta', icon: CreditCard },
              { id: 'transfer', label: 'Transferencia', icon: Building2 },
              { id: 'mobile', label: 'Pago Móvil', icon: Smartphone }
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/50'
                      : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-1.5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Change Selector for Cash */}
          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  ¿Con cuánto vas a pagar?
                </span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {amountPayingWith ? `Cambio de $${amountPayingWith}` : 'Monto exacto'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setNeedsChange(false); setAmountPayingWith(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !needsChange
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Exacto
                </button>
                {[500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setNeedsChange(true); setAmountPayingWith(amt.toString()); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      needsChange && amountPayingWith === amt.toString()
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optional Notes */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
            Notas para el pedido (Opcional)
          </label>
          <Input
            placeholder="Ej: Tocar el timbre, salsa extra..."
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            className="h-10 text-xs bg-slate-50 dark:bg-zinc-900/60 rounded-xl"
          />
        </div>
      </div>

      {/* Footer / Express Action Buttons */}
      <div className="bg-slate-50/80 dark:bg-zinc-900/80 backdrop-blur-xl px-5 sm:px-6 py-4 border-t border-slate-200/60 dark:border-zinc-800 flex flex-col-reverse sm:flex-row gap-2.5">
        <Button
          variant="ghost"
          onClick={() => setShowCheckout(false)}
          className="w-full sm:w-auto h-11 rounded-xl text-xs font-bold text-slate-500 dark:text-zinc-400"
        >
          Volver
        </Button>
        <Button
          onClick={handleCheckout}
          disabled={createOrder.isPending || !customerName.trim() || !isStoreCurrentlyOpen}
          className="w-full sm:flex-1 h-12 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {createOrder.isPending ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Procesando...</span>
            </div>
          ) : !isStoreCurrentlyOpen ? (
            "Tienda Cerrada"
          ) : (
            <>
              <span>Confirmar Pedido • ${cartTotal.toFixed(2)}</span>
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
      <ShopperProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        currentProfile={profile}
        onSave={saveProfile}
        requiresCompletion={!isProfileComplete(profile)}
        shopType={shopType}
        storeId={store?.id}
        storeName={storeName}
        logoUrl={companySettings?.logo_url}
        companyPhone={companySettings?.phone}
        companyAddress={companySettings?.address}
        companyEmail={companySettings?.email}
        companyDescription={companySettings?.meta_description}
        defaultView={profileDialogView}
        cartItemsCount={cartItemCount}
        cartTotal={cartTotal}
        onViewCart={() => setShowCart(true)}
      />

  {/* Floating Cart Animations */}
  {cartAnimations.length > 0 && (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {cartAnimations.map(anim => (
          <div
            key={anim.id}
            className="absolute animate-float-cart flex flex-col items-center justify-center"
            style={{
              left: anim.x - 32, // approx center considering 64px width elements
              top: anim.y - 32,
            }}
          >
            <div className="relative">
              {anim.image ? (
                <div className="h-16 w-16 p-1 bg-white dark:bg-card/95 backdrop-blur-md rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] border-2 border-primary/20 flex items-center justify-center">
                  <img src={anim.image} alt="product" className="h-full w-full rounded-full object-cover" />
                </div>
              ) : (
                <div className="h-16 w-16 p-1 bg-white dark:bg-card/95 backdrop-blur-md rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] border-2 border-primary/20 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-primary flex items-center justify-center text-white">
                    <ShoppingBag className="h-7 w-7" />
                  </div>
                </div>
              )}
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[12px] font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-white">
                +1
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

    </div >
  );
};

export default Tienda;
