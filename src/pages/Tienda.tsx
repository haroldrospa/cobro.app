import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingCart, Store, Plus, Minus, Trash2, ArrowLeft, Package,
  Search, Sparkles, Tag, Filter, X, ChevronRight, Star, Percent,
  SlidersHorizontal, DollarSign, MapPin, User, ShoppingBag, Utensils, Home,
  Wallet, CreditCard, Smartphone, Building2, CheckCircle2, Navigation, UserPlus,
  Facebook, Instagram, Twitter, Phone, Mail, AlertTriangle, LogIn
} from 'lucide-react';
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
        fashion: `rounded-sm border border-border/20 shadow-none hover:shadow-sm transition-all duration-300 bg-white`,
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
        fashion: 'bg-white',
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
    <div
      className={`min-h-screen ${themeClasses.pageBackground} transition-colors duration-500`}
      style={themeStyles}
      data-theme={shopType}
    >
      {/* Header - Optimized for Mobile */}
      {/* Header - Premium App Style */}
      {/* Header - Premium Glassmorphism Style */}
      <header className="sticky top-0 z-50 w-full transition-all duration-300">
        {/* Glass Background Layer */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-2xl border-b border-white/10 shadow-lg shadow-black/5 supports-[backdrop-filter]:bg-background/40 transition-colors duration-500" />

        <div className="relative container mx-auto px-4 py-3">
          {/* Mobile Layout Premium Optimization */}
          <div className="md:hidden space-y-5">
            {/* Top Row: Brand & Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              {/* Brand Identity */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative group cursor-pointer flex-shrink-0">
                  {companySettings?.logo_url ? (
                    <img
                      src={companySettings.logo_url}
                      alt="Logo"
                      className="h-11 w-11 object-cover rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
                      <Store className="h-5.5 w-5.5 text-primary" />
                    </div>
                  )}
                  {/* Live Status Orb */}
                  <span className="absolute bottom-0 right-0 flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isStoreCurrentlyOpen ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isStoreCurrentlyOpen ? 'bg-emerald-500' : 'bg-red-500'} border-2 border-background shadow-sm`}></span>
                  </span>
                </div>

                <div className="flex flex-col justify-center min-w-0">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight truncate">
                    {storeName}
                  </h1>
                  <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mt-0.5 tracking-wider uppercase">
                    <span className={isStoreCurrentlyOpen ? "text-emerald-600 dark:text-emerald-500 font-bold" : "text-red-600 dark:text-red-500 font-bold"}>
                      {isStoreCurrentlyOpen ? "Abierto" : "Cerrado"}
                    </span>
                    <span className="opacity-40">•</span>
                    <span>Catálogo</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 sm:gap-1.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition-all"
                  onClick={() => { setProfileDialogView('orders'); setShowProfileDialog(true); }}
                >
                  <User className="h-5 w-5 sm:h-4.5 sm:w-4.5 opacity-80" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCart(true)}
                  className={`relative h-10 w-10 sm:h-9 sm:w-9 rounded-full transition-all ${cartAnimations.length > 0 ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary/60 hover:bg-secondary text-foreground'}`}
                  aria-label="Ver carrito"
                >
                  <ShoppingBag className={`h-5 w-5 sm:h-4.5 sm:w-4.5 ${cartAnimations.length > 0 ? 'animate-bounce' : 'opacity-80'}`} />
                  {cartItemCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-1 bg-destructive text-white text-[9px] font-black rounded-full flex items-center justify-center border border-background shadow-sm transition-transform duration-300 ${cartAnimations.length > 0 ? 'scale-110' : 'animate-in zoom-in'}`}>
                      {cartItemCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* Premium Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-4.5 w-4.5 text-muted-foreground/60" />
              </div>
              <Input
                placeholder="¿Qué se te antoja hoy?"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-11 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-border h-12 rounded-2xl text-[15px] font-medium placeholder:text-muted-foreground/50 shadow-none transition-all hover:bg-secondary/70"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-muted-foreground"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Layout - Premium & Spacious */}
          <div className="hidden md:flex items-center gap-8 animate-in fade-in slide-in-from-top-4 duration-700 fill-mode-forwards">
            {/* Animated Brand Section */}
            <div className="flex items-center gap-4 group cursor-pointer select-none">
              <div className="relative transition-transform duration-500 hover:scale-110">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse-slow" />
                {companySettings?.logo_url ? (
                  <img
                    src={companySettings.logo_url}
                    alt="Logo"
                    className="relative h-12 w-12 object-contain rounded-full shadow-xl shadow-primary/10 ring-2 ring-white/10 bg-background/80 backdrop-blur-md transition-all duration-300 group-hover:ring-primary/40 group-hover:shadow-primary/30"
                  />
                ) : (
                  <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg ring-2 ring-white/20 transition-all duration-300 group-hover:shadow-primary/50 group-hover:scale-105">
                    <Store className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 transform origin-left group-hover:scale-[1.02]">{storeName}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mt-1 transition-opacity group-hover:opacity-90">
                  <span className={`inline-flex items-center gap-1.5 ${isStoreCurrentlyOpen ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5 group-hover:bg-red-500/15 group-hover:border-red-500/30'} px-2.5 py-0.5 rounded-full border backdrop-blur-sm shadow-sm transition-colors`}>
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isStoreCurrentlyOpen ? 'bg-emerald-400' : 'bg-red-400'} opacity-75 duration-1000`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isStoreCurrentlyOpen ? 'bg-emerald-500' : 'bg-red-500'} ${isStoreCurrentlyOpen ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold ml-0.5">
                      {isStoreCurrentlyOpen ? "Abierto" : "Cerrado"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Search Bar */}
            <div className="flex-1 max-w-xl mx-4 transition-all duration-500 ease-out hover:max-w-2xl">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 rounded-full blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                <div className="relative flex items-center">
                  <Search className="absolute left-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                  <Input
                    placeholder="Buscar en todo el catálogo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 h-12 bg-muted/40 hover:bg-muted/60 focus:bg-background border-white/5 hover:border-white/10 focus:border-primary/30 rounded-full transition-all duration-300 shadow-inner focus:shadow-xl focus:shadow-primary/5 text-sm placeholder:text-muted-foreground/50 selection:bg-primary/20"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 h-8 w-8 rounded-full hover:bg-background/80 text-muted-foreground hover:text-foreground animate-in zoom-in duration-200"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="hidden lg:flex h-11 rounded-full px-4 hover:bg-white/5 border border-transparent hover:border-white/10 gap-3 transition-all group overflow-hidden"
                onClick={() => setShowProfileDialog(true)}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-md group-hover:scale-110 transition-transform duration-300">
                  <div className="h-full w-full rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    {user && profile?.name ? (
                      <span className="text-xs font-bold text-white">{profile.name.charAt(0)}</span>
                    ) : (
                      <User className="h-3.5 w-3.5 text-white" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-0.5 max-w-[100px]">
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate w-full">
                    {user && profile?.name ? `Hola, ${profile.name.split(' ')[0]}` : 'Mi Cuenta'}
                  </span>
                  {user && <span className="text-[10px] text-primary/80 font-semibold tracking-wide uppercase">Cliente</span>}
                </div>
              </Button>

              <Button
                className={`relative h-11 rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all duration-300 group overflow-hidden ${cartAnimations.length > 0 ? 'scale-105 shadow-primary/50 translate-y-[-2px] ring-4 ring-primary/30' : 'shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'}`}
                onClick={() => setShowCart(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer skew-x-12" />

                <div className="relative flex items-center gap-2.5">
                  <div className="relative">
                    <ShoppingBag className={`h-5 w-5 transition-transform duration-300 ${cartAnimations.length > 0 ? 'animate-bounce scale-110 drop-shadow-md' : 'group-hover:rotate-6'}`} />
                    {cartItemCount > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary text-[9px] font-bold shadow-sm transition-transform duration-300 ${cartAnimations.length > 0 ? 'scale-125 bg-emerald-400 text-white' : 'animate-bounce'}`}>
                        {cartItemCount}
                      </span>
                    )}
                  </div>
                  <span className="hidden lg:inline font-bold tracking-tight">Mi Pedido</span>
                  {cartItemCount > 0 && (
                    <span className="hidden lg:flex bg-white/20 backdrop-blur-sm h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ml-1 animate-in zoom-in">
                      {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(cartTotal)}
                    </span>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-6">

        {/* Tarjeta de Fidelidad Virtual */}
        {loyaltyData && (
          <section className="mb-2 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="relative group overflow-hidden max-w-sm mx-auto sm:mx-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-card border rounded-2xl p-5 shadow-sm overflow-hidden min-h-[160px] flex flex-col justify-between">
                {/* Decorative card background element */}
                <div className="absolute top-0 right-0 -tr-4 opacity-5 pointer-events-none">
                  <Star className="h-32 w-32 text-yellow-500 rotate-12" />
                </div>

                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-yellow-500" />
                      Tarjeta Virtual
                    </span>
                    <h3 className="text-lg font-black tracking-tight">Cobroapp Rewards</h3>
                  </div>
                  <div className="h-10 w-10 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20">
                    <Star className="h-6 w-6 text-yellow-600 fill-yellow-500" />
                  </div>
                </div>

                <div className="flex items-center gap-4 my-2 z-10">
                  <div className="text-4xl font-black text-foreground tracking-tighter">
                    {loyaltyData.points}
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Puntos</span>
                    <span className="text-sm font-bold text-yellow-600">Acumulados</span>
                  </div>
                </div>

                <div className="pt-3 mt-1 border-t border-dashed border-border/60 flex items-center justify-between z-10">
                  <div>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Validación POS</span>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-mono font-black text-primary tracking-widest uppercase">
                        {loyaltyData.code || '---'}
                      </p>
                      {loyaltyData.code && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-transparent"
                          onClick={() => {
                            navigator.clipboard.writeText(loyaltyData.code);
                            toast({ title: "Código copiado", description: "Llévalo contigo para usar tus puntos en caja." });
                          }}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-muted-foreground italic leading-none mb-1">Dígitalo en caja</p>
                    <div className="flex gap-1 justify-end opacity-40">
                      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-0.5 w-2 bg-foreground rounded-full"></div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* Closed Store Warning Alert */}
      {!isStoreCurrentlyOpen && (
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-4 md:p-6 shadow-xl shadow-red-500/20 border border-white/10 overflow-hidden relative group">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 bg-black/10 rounded-full blur-3xl group-hover:bg-black/20 transition-all duration-700" />

            <div className="relative flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
              <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <AlertTriangle className="h-7 w-7 text-white animate-pulse" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase italic">
                  ¡Negocio Cerrado Temporalmente!
                </h2>
                <p className="text-white/90 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
                  Agradecemos tu preferencia, pero en este momento no estamos recibiendo pedidos.
                  Por favor revisa nuestro horario de atención para saber cuándo estaremos listos para servirte.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-w-[120px]">
                <span className="px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] uppercase font-black tracking-widest text-center">
                  Pronto Contigo
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filters Sticky Bar - Elegant & Modern */}
      <section className="sticky top-[100px] md:top-[80px] z-40 -mx-4 px-4 md:mx-0 md:px-0 pointer-events-none pt-2">
        {/* Container with pointer-events-auto so clicks work but empty space passes through to content below */}
        <div className="pointer-events-auto">
          <div className="relative">
            {/* Horizontal Gradient Masks for scroll cue */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />

            <div className="flex items-center gap-2.5 overflow-x-auto pb-4 pt-1 -mx-4 px-4 scrollbar-none snap-x mask-fade-edges">
              {/* Offers Chip */}
              <button
                onClick={() => setShowOnlyDiscounts(!showOnlyDiscounts)}
                className={`
                      relative group flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 select-none whitespace-nowrap snap-start
                      ${showOnlyDiscounts
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-md scale-105'
                    : 'bg-secondary/60 hover:bg-secondary text-foreground'
                  }
                    `}
              >
                <Percent className={`h-3.5 w-3.5 ${showOnlyDiscounts ? '' : 'text-orange-500'}`} />
                <span>Ofertas</span>
              </button>

              <div className="h-5 w-px bg-border/40 mx-1 flex-shrink-0" />

              {/* Category Chips - Premium styling */}
              <button
                onClick={() => setSelectedCategory(null)}
                className={`
                      px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 whitespace-nowrap select-none snap-start
                      ${selectedCategory === null
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-md scale-105'
                    : 'bg-secondary/60 hover:bg-secondary text-foreground'
                  }
                    `}
              >
                Todos
              </button>

              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`
                        px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 whitespace-nowrap select-none snap-start
                        ${selectedCategory === cat.id
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-md scale-105'
                      : 'bg-secondary/60 hover:bg-secondary text-foreground'
                    }
                      `}
                >
                  {cat.name}
                </button>
              ))}

              {/* Price Filter - Desktop only usually, but let's keep it tucked inside for mobile if needed or just visible on larger screens */}
              <div className="hidden sm:block ml-auto pl-2">
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className={`border-0 bg-muted/50 hover:bg-muted focus:ring-0 rounded-full h-9 gap-2 text-xs font-medium w-auto min-w-[130px] transition-all ${priceFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className="flex items-center gap-2">
                      <div className="bg-background rounded-full p-1 shadow-sm">
                        <DollarSign className="h-3 w-3" />
                      </div>
                      <SelectValue placeholder="Precio" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/20 shadow-xl bg-background/95 backdrop-blur-lg">
                    <SelectItem value="all">Cualquier precio</SelectItem>
                    <SelectItem value="under50">Menos de $50</SelectItem>
                    <SelectItem value="50to100">$50 - $100</SelectItem>
                    <SelectItem value="100to500">$100 - $500</SelectItem>
                    <SelectItem value="over500">Más de $500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Carousel */}
      {banners.length > 0 && !searchTerm && (
        <section className="animate-fade-in mt-2 mb-6 md:mt-0 shadow-lg shadow-black/5 rounded-2xl ring-1 ring-border/30">
          <BannerCarousel banners={banners} />
        </section>
      )}
      {/* Featured Section */}
      {featuredProducts.length > 0 && !searchTerm && !selectedCategory && (
        <section className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-gradient-to-br from-destructive to-orange-500 rounded-lg">
              <Percent className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: themeClasses.heading.fontFamily, fontWeight: themeClasses.heading.fontWeight }}>¡Ofertas y Destacados!</h2>
              <p className="text-sm text-muted-foreground">Productos en promoción</p>
            </div>
          </div>

          <div className={`grid ${themeClasses.grid}`}>
            {featuredProducts.map(product => {
              const hasDiscount = isDiscountActive(product);
              const discountedPrice = getDiscountedPrice(product);

              return (
                <Card
                  key={product.id}
                  className={`group overflow-hidden ${themeClasses.card} hover:-translate-y-1 cursor-pointer ${hasDiscount ? 'border-destructive/30 bg-gradient-to-br from-destructive/5 to-orange-500/5' : ''}`}
                  onClick={(e) => handleAddToCartAnim(e, product)}
                >
                  <div className="relative">
                    {product.image_url ? (
                      <div className={`${themeClasses.imageAspect} overflow-hidden`}>
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Discount badge */}
                    {hasDiscount && (
                      <Badge className="absolute top-2 left-2 bg-destructive border-0 text-sm font-bold">
                        -{product.discount_percentage}%
                      </Badge>
                    )}

                    {/* Featured badge */}
                    {product.is_featured && !hasDiscount && (
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                        <Star className="h-3 w-3 mr-1" />
                        Destacado
                      </Badge>
                    )}
                  </div>

                  <CardContent className={themeClasses.cardPadding}>
                    <h3 className="font-semibold line-clamp-1 text-sm">{product.name}</h3>
                    <div className="mt-1">
                      {hasDiscount ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through text-muted-foreground">${product.price.toFixed(2)}</span>
                          <span className={`${themeClasses.priceSize} font-bold text-destructive`}>${discountedPrice.toFixed(2)}</span>
                        </div>
                      ) : (
                        <p className={`${themeClasses.priceSize} font-bold text-primary`}>${product.price.toFixed(2)}</p>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 pt-0">
                    <Button
                      size="sm"
                      className={`w-full ${themeClasses.button} ${hasDiscount ? 'bg-gradient-to-r from-destructive to-orange-500 hover:from-destructive/90 hover:to-orange-600 text-white border-0' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCartAnim(e, product);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      )}


      {/* Products Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ fontFamily: themeClasses.heading.fontFamily, fontWeight: themeClasses.heading.fontWeight }}>
            {selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name
              : searchTerm
                ? `Resultados para "${searchTerm}"`
                : 'Todos los Productos'}
          </h2>
          <Badge variant="secondary">{filteredProducts.length} productos</Badge>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-base font-medium">No se encontraron productos</p>
            <p className="text-sm text-muted-foreground mb-4">Intenta con otra búsqueda</p>
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setSelectedCategory(null); }}>
              Ver todos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 pb-24 md:pb-0">
            {filteredProducts.slice(0, visibleCount).map((product, idx) => (
              <div
                key={product.id}
                className="group relative bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 active:scale-95 animate-in fade-in zoom-in-95 duration-500"
                style={{ animationDelay: `${(idx % 20) * 30}ms` }}
                onClick={(e) => {
                  if (!isDiscountActive(product) && (product.track_inventory !== false) && (product.stock ?? 0) <= 0) return;
                  handleAddToCartAnim(e, product);
                }}
              >
                {/* Image Area */}
                <div className="relative aspect-[1/1.1] overflow-hidden bg-zinc-800/30">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${(product.track_inventory !== false) && (product.stock ?? 0) <= 0 ? 'grayscale opacity-40' : ''}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-zinc-700" />
                    </div>
                  )}

                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                  {/* Badges - Scaled for 4 columns */}
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                    {isDiscountActive(product) && (
                      <div className="bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white shadow-lg animate-pulse">
                        -{product.discount_percentage}%
                      </div>
                    )}
                    {(product.track_inventory !== false) && (product.stock ?? 0) <= (product.min_stock ?? 0) && (product.stock ?? 0) > 0 && (
                      <div className="bg-orange-500 text-[7px] font-black px-1.5 py-0.5 rounded-full text-white shadow-lg uppercase tracking-tighter">
                        Ultimos
                      </div>
                    )}
                  </div>

                  {/* Out of Stock Overlay */}
                  {(product.track_inventory !== false) && (product.stock ?? 0) <= 0 && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                      <Badge variant="outline" className="font-bold border-2 px-3 py-1 bg-background/50 rounded-full">Agotado</Badge>
                    </div>
                  )}
                </div>

                {/* Content Area - Minimal & Epic */}
                <div className="p-2 flex-1 flex flex-col justify-between gap-1.5">
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-[10px] leading-tight line-clamp-2 text-zinc-100 tracking-tight uppercase">
                      {product.name}
                    </h3>
                    {product.category && (
                      <p className="text-[7px] uppercase tracking-widest font-black text-emerald-500/50 line-clamp-1">
                        {product.category.name}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-auto">
                    <div className="flex flex-col">
                      {isDiscountActive(product) ? (
                        <div className="flex flex-col -space-y-0.5">
                          <span className="text-[7px] text-zinc-500 line-through opacity-70">${product.price.toLocaleString()}</span>
                          <span className="font-black text-xs text-emerald-500 tracking-tighter">${getDiscountedPrice(product).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="font-black text-xs text-emerald-500 tracking-tighter">${product.price.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="h-6 w-6 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform">
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleCount < filteredProducts.length && (
          <div className="flex justify-center mt-8 pb-24 md:pb-0 animate-in fade-in duration-300">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 font-semibold shadow-sm hover:shadow-md transition-all bg-background/80 backdrop-blur-md border-border/60 hover:bg-muted/80"
              onClick={() => setVisibleCount(prev => prev + 24)}
            >
              Cargar más productos
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
              <img src={companySettings.logo_url} alt={storeName} className="h-12 w-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" />
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

  {/* Floating Cart Button (Mobile) - Enhanced */ }
  {
    cartItemCount > 0 && (
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 p-3 bg-gradient-to-t from-background via-background to-transparent animate-in slide-in-from-bottom duration-300">
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold shadow-2xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          onClick={() => setShowCart(true)}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-2 -right-2 h-4 w-4 bg-destructive text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              </div>
              <span>Ver Carrito</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg">${cartTotal.toFixed(2)}</span>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </Button>
      </div>
    )
  }

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
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white dark:bg-zinc-800 flex-shrink-0 shadow-sm border border-black/5 dark:border-white/5">
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

            <div className="w-full space-y-3">
              {!user ? (
                <>
                  <Button
                    size="lg"
                    className="w-full h-16 rounded-full font-bold shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground text-base md:text-[17px] border-0"
                    onClick={() => { setShowCart(false); setProfileDialogView('orders'); setShowProfileDialog(true); }}
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    Iniciar Sesión / Registrarme
                  </Button>
                </>
              ) : isProfileComplete(profile) ? (
                <Button
                  size="lg"
                  className={`w-full h-16 rounded-full font-bold transition-all duration-300 scale-100 hover:scale-[1.02] active:scale-[0.98] text-base md:text-[17px] border-0 ${
                    !isStoreCurrentlyOpen 
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20'
                  }`}
                  onClick={() => { setShowCart(false); setShowCheckout(true); }}
                  disabled={!isStoreCurrentlyOpen}
                >
                  {isStoreCurrentlyOpen ? (
                    <div className="flex items-center justify-center w-full">
                      Proceder al Pago
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </div>
                  ) : (
                    "Negocio Cerrado"
                  )}
                </Button>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 mb-3">
                    <UserPlus className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold leading-relaxed">
                      Necesitas completar tu perfil (cédula y ubicación) para poder enviar el pedido.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="w-full h-16 rounded-full font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all text-base md:text-[17px] border-0"
                    onClick={() => { setShowCart(false); setProfileDialogView('settings'); setShowProfileDialog(true); }}
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    Completar mi Perfil
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>

  {/* Checkout Dialog - Mobile Optimized */ }
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] flex flex-col rounded-[2rem] p-0 gap-0 overflow-hidden border-border/50 shadow-2xl bg-background/95 backdrop-blur-xl">
          <DialogHeader className="px-6 py-5 border-b border-border/40 bg-card/50">
            <DialogTitle className="text-lg md:text-xl font-black">Finalizar Pedido</DialogTitle>
            <p className="text-sm text-muted-foreground">Completa tus datos para confirmar</p>
            {!isStoreCurrentlyOpen && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                  <X className="h-3 w-3" />
                  AVISO: La tienda se encuentra fuera de horario de servicio.
                </p>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">

            {/* Saved Profile Summary Card */}
            {isProfileComplete(profile) && (
              <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-base flex-shrink-0">
                  {profile!.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300 truncate">{profile!.name}</p>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">{profile!.cedula}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">{profile!.phone}</p>
                  {(profile!.deliveryLat && profile!.deliveryLng) && (
                    <a
                      href={`https://www.google.com/maps?q=${profile!.deliveryLat},${profile!.deliveryLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5 hover:underline"
                    >
                      <Navigation className="h-3 w-3" />
                      {profile!.locationLabel || 'Ver punto de entrega GPS'}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => { setShowCheckout(false); setProfileDialogView('settings'); setShowProfileDialog(true); }}
                  className="text-[10px] text-emerald-600 font-bold hover:underline flex-shrink-0 mt-0.5"
                >
                  Editar
                </button>
              </div>
            )}

            {/* Order Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Pedido</label>
              <div className={`grid ${(shopType === 'store' || shopType === 'supermarket') ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${orderType === 'delivery'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <ShoppingBag className={`h-6 w-6 md:h-7 md:w-7 ${orderType === 'delivery' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs md:text-sm font-medium">Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${orderType === 'pickup'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <Home className={`h-6 w-6 md:h-7 md:w-7 ${orderType === 'pickup' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs md:text-sm font-medium">Recoger</span>
                </button>
                {!(shopType === 'store' || shopType === 'supermarket') && (
                  <button
                    type="button"
                    onClick={() => setOrderType('dine-in')}
                    className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border-2 transition-all active:scale-95 ${orderType === 'dine-in'
                      ? 'border-primary bg-primary/10 text-primary shadow-md'
                      : 'border-border hover:border-primary/50 hover:bg-muted'
                      }`}
                  >
                    <Utensils className={`h-6 w-6 md:h-7 md:w-7 ${orderType === 'dine-in' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-xs md:text-sm font-medium">Comer Aquí</span>
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Nombre <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Tu nombre completo"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="h-12 text-base"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Teléfono</label>
              <Input
                type="tel"
                placeholder="(809) 000-0000"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Conditional Address Field - Only for Delivery */}
            {orderType === 'delivery' && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Dirección de Entrega
                </label>
                <Textarea
                  placeholder="Calle, número, sector, ciudad..."
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  className="min-h-[80px] text-base resize-none"
                />
              </div>
            )}

            {/* Info message for Pickup/Dine-in */}
            {orderType !== 'delivery' && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-primary flex items-center gap-2">
                  {orderType === 'pickup' ? (
                    <><Home className="h-4 w-4" /> Tu pedido estará listo para recoger en {store?.store_name || 'nuestro negocio'}</>
                  ) : (
                    <><Utensils className="h-4 w-4" /> Por favor indica tu número de mesa en las notas</>
                  )}
                </p>
              </div>
            )}

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all active:scale-95 ${paymentMethod === 'cash'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <Wallet className={`h-5 w-5 ${paymentMethod === 'cash' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all active:scale-95 ${paymentMethod === 'card'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <CreditCard className={`h-5 w-5 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Tarjeta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all active:scale-95 ${paymentMethod === 'transfer'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <Building2 className={`h-5 w-5 ${paymentMethod === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Transferencia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all active:scale-95 ${paymentMethod === 'mobile'
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                >
                  <Smartphone className={`h-5 w-5 ${paymentMethod === 'mobile' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Pago Móvil</span>
                </button>
              </div>

              {/* Cash Options: Needs Change? */}
              {paymentMethod === 'cash' && (
                <div className="mt-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      ¿Necesitas cambio?
                    </label>
                    <div className="flex bg-muted p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setNeedsChange(false)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!needsChange ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'}`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setNeedsChange(true)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${needsChange ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'}`}
                      >
                        Sí
                      </button>
                    </div>
                  </div>

                  {needsChange && (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-xs text-muted-foreground font-medium italic">Selecciona con cuánto vas a pagar:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[100, 200, 500, 1000, 2000].map(amount => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setAmountPayingWith(amount.toString())}
                            className={`py-2 px-1 rounded-lg border-2 transition-all text-sm font-bold ${amountPayingWith === amount.toString()
                              ? 'border-primary bg-primary/20 text-primary scale-105'
                              : 'border-border hover:border-primary/30 hover:bg-background bg-background'
                              }`}
                          >
                            ${amount}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setAmountPayingWith(''); document.getElementById('cash-input')?.focus(); }}
                          className={`py-2 px-1 rounded-lg border-2 transition-all text-xs font-bold ${!['100', '200', '500', '1000', '2000'].includes(amountPayingWith) && amountPayingWith !== ''
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border hover:border-primary/30'
                            }`}
                        >
                          Otro
                        </button>
                      </div>

                      <div className="relative group">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="cash-input"
                          type="number"
                          placeholder="Monto exacto (ej: 150)"
                          value={amountPayingWith}
                          onChange={e => setAmountPayingWith(e.target.value)}
                          className="pl-9 h-11 text-base font-bold bg-background border-2 focus-visible:ring-0 focus-visible:border-primary transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas Adicionales (Opcional)</label>
              <Input
                placeholder="Ej: Tocar el timbre dos veces"
                value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <Separator className="my-2 opacity-50" />

            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Total a Pagar</span>
                <span className="text-2xl font-black text-primary">${cartTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{cartItemCount} {cartItemCount === 1 ? 'producto' : 'productos'}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-md px-6 py-4 border-t border-border/40">
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCheckout(false)}
                className="w-full sm:w-auto h-12 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={createOrder.isPending || !customerName.trim() || !isStoreCurrentlyOpen}
                className="w-full sm:flex-1 h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
              >
                {createOrder.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </div>
                ) : !isStoreCurrentlyOpen ? (
                  "Cerrado"
                ) : (
                  <div className="flex items-center justify-center gap-2 w-full">
                    Confirmar Pedido
                    <ChevronRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </div>
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
                <div className="h-16 w-16 p-1 bg-white/95 backdrop-blur-md rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] border-2 border-primary/20 flex items-center justify-center">
                  <img src={anim.image} alt="product" className="h-full w-full rounded-full object-cover" />
                </div>
              ) : (
                <div className="h-16 w-16 p-1 bg-white/95 backdrop-blur-md rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] border-2 border-primary/20 flex items-center justify-center">
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
