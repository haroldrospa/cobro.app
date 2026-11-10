import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Tv,
  Clock,
  Maximize2,
  Minimize2,
  Settings,
  Sparkles,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Package,
  QrCode,
  Tag,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Store,
  RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CustomerDisplayPayload, CustomerDisplayStatus } from '@/types/customerDisplay';
import { subscribeCustomerDisplay } from '@/services/customerDisplayService';
import appLogo from '@/assets/cobro-logo.png';

export const CustomerDisplay: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Store & Register identifiers (URL first, then localStorage fallback, then 'default')
  const initialStoreId = searchParams.get('store') || localStorage.getItem('cobro_cd_store_id') || 'default';
  const initialRegisterId = searchParams.get('caja') || localStorage.getItem('cobro_cd_register_id') || 'caja_1';
  const initialStoreName = searchParams.get('name') || localStorage.getItem('cobro_cd_store_name') || 'Visor de Clientes';

  const [storeId, setStoreId] = useState<string>(initialStoreId);
  const [registerId, setRegisterId] = useState<string>(initialRegisterId);
  const [storeName, setStoreName] = useState<string>(initialStoreName);
  const [storeLogo, setStoreLogo] = useState<string>('');

  // Config modal: NEVER open automatically - visor operates 100% session-free and standalone
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [tempStoreId, setTempStoreId] = useState<string>(initialStoreId);
  const [tempRegisterId, setTempRegisterId] = useState<string>(initialRegisterId);
  const [tempStoreName, setTempStoreName] = useState<string>(initialStoreName);

  // Live state received from POS
  const [displayData, setDisplayData] = useState<CustomerDisplayPayload>({
    status: 'idle',
    storeId: initialStoreId,
    storeName: initialStoreName,
    registerId: initialRegisterId,
    registerName: 'Caja 1',
    cart: [],
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0,
    itemsCount: 0,
    updatedAt: Date.now(),
  });

  // Current clock time
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const cartListRef = useRef<HTMLDivElement>(null);
  const mobileCartListRef = useRef<HTMLDivElement>(null);

  // Play subtle chime on item scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio might be blocked before first interaction
    }
  };

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-DO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save config to localStorage & update URL
  const saveConfig = (newStoreId: string, newRegId: string, newStoreName: string) => {
    setStoreId(newStoreId);
    setRegisterId(newRegId);
    setStoreName(newStoreName);
    localStorage.setItem('cobro_cd_store_id', newStoreId);
    localStorage.setItem('cobro_cd_register_id', newRegId);
    localStorage.setItem('cobro_cd_store_name', newStoreName);
    setSearchParams({ store: newStoreId, caja: newRegId, name: newStoreName });
    setIsConfigOpen(false);
  };

  // Realtime subscription to POS Broadcasts (100% public, works without login or session)
  useEffect(() => {
    const activeStore = storeId || 'default';
    const activeRegister = registerId || 'caja_1';

    const unsubscribe = subscribeCustomerDisplay(activeStore, activeRegister, (payload) => {
      setDisplayData((prev) => {
        // If an item was added, play a subtle pleasant beep
        if (payload.lastItem && (!prev.lastItem || prev.lastItem.timestamp !== payload.lastItem.timestamp)) {
          playBeep();
        }
        return payload;
      });

      if (payload.storeId && payload.storeId !== 'default') {
        setStoreId(payload.storeId);
        localStorage.setItem('cobro_cd_store_id', payload.storeId);
      }
      if (payload.storeName) {
        setStoreName(payload.storeName);
        localStorage.setItem('cobro_cd_store_name', payload.storeName);
      }
      if (payload.storeLogo) setStoreLogo(payload.storeLogo);
    });

    return () => unsubscribe();
  }, [storeId, registerId]);

  // Auto scroll cart list to top when new item arrives
  useEffect(() => {
    if (cartListRef.current) {
      cartListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (mobileCartListRef.current) {
      mobileCartListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [displayData.cart.length, displayData.lastItem]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const status: CustomerDisplayStatus = displayData.status || 'idle';
  const hasCart = displayData.cart && displayData.cart.length > 0;

  // Active hero item (latest scanned or first in cart)
  const heroItem = displayData.lastItem || (displayData.cart && displayData.cart.length > 0 ? {
    id: displayData.cart[0].id,
    name: displayData.cart[0].name,
    price: displayData.cart[0].price,
    quantity: displayData.cart[0].quantity,
    total: displayData.cart[0].total,
    image_url: displayData.cart[0].image_url,
    timestamp: 0,
  } : undefined);

  return (
    <div className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-zinc-950 text-white flex flex-col select-none overflow-hidden font-sans touch-none overscroll-none">
      {/* ── TOP HEADER BAR ── */}
      <header className="h-12 sm:h-14 md:h-16 px-3 sm:px-6 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden shrink-0">
            {storeLogo ? (
              <img src={storeLogo} alt={storeName} className="h-full w-full object-contain" />
            ) : (
              <img src={appLogo} alt="Logo" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-black tracking-tight text-white leading-tight truncate">
              {storeName || 'Cobro App Supermercado'}
            </h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] sm:text-[10px] font-black uppercase tracking-wider py-0 px-1.5 rounded-md shrink-0">
                {displayData.registerName || registerId.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              <span className="text-[10px] sm:text-[11px] text-zinc-400 font-medium truncate">Visor de Cliente</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs font-mono font-bold text-zinc-300">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>{currentTime}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setTempStoreId(storeId);
              setTempRegisterId(registerId);
              setTempStoreName(storeName);
              setIsConfigOpen(true);
            }}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Configurar Caja"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 min-h-0 w-full p-2.5 sm:p-4 md:p-5 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {/* 1. MODO FINALIZADO / FACTURA EMITIDA */}
          {status === 'completed' && displayData.completed ? (
            <motion.div
              key="completed-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex-1 min-h-0 my-auto flex flex-col items-center justify-center max-w-xl mx-auto w-full text-center space-y-3 sm:space-y-4 md:space-y-5 px-2"
            >
              <div className="relative shrink-0">
                <div className="h-14 w-14 sm:h-18 sm:w-18 md:h-20 md:w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400" />
                </div>
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300 absolute -top-1 -right-1 animate-bounce" />
              </div>

              <div className="space-y-0.5 sm:space-y-1 shrink-0">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                  ¡Muchas gracias por su compra!
                </h2>
                <p className="text-zinc-400 text-xs sm:text-sm">
                  Factura #{displayData.completed.invoiceNumber} registrada exitosamente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full bg-zinc-900/90 border border-zinc-800 p-3.5 sm:p-4 md:p-5 rounded-2xl shadow-xl shrink-0">
                <div className="text-left space-y-0.5 sm:space-y-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Pagado:</span>
                  <p className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                    ${(displayData.completed.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {displayData.completed.change !== undefined && displayData.completed.change > 0 && (
                  <div className="text-right space-y-0.5 sm:space-y-1 bg-emerald-500/10 border border-emerald-500/30 p-2 sm:p-2.5 rounded-xl">
                    <span className="text-[10px] sm:text-[11px] font-black text-emerald-400 uppercase tracking-wider">Su Devuelta:</span>
                    <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-400">
                      ${displayData.completed.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>

              {displayData.completed.qrCodeUrl && (
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg shrink-0">
                  <span className="text-[11px] sm:text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                    Escanee para ver o guardar su factura digital:
                  </span>
                  <div className="p-2 sm:p-2.5 bg-white rounded-xl shadow-md">
                    <QRCodeSVG value={displayData.completed.qrCodeUrl} size={105} level="M" />
                  </div>
                </div>
              )}
            </motion.div>
          ) : status === 'payment' && displayData.payment ? (
            /* 2. MODO PAGO EN PROCESO (Total, Pagado y Devuelta) */
            <motion.div
              key="payment-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0 my-auto flex flex-col justify-center max-w-2xl mx-auto w-full space-y-3 sm:space-y-5 px-2"
            >
              <div className="text-center space-y-0.5 sm:space-y-1 shrink-0">
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-0.5 text-[11px] sm:text-xs">
                  Procesando Cobro
                </Badge>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                  Resumen de Pago
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 shrink-0">
                <Card className="p-4 sm:p-6 bg-zinc-900 border-zinc-800 flex flex-col justify-center space-y-1.5 sm:space-y-2 text-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">Total a Pagar</span>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-black text-white">
                    ${(displayData.payment.total || displayData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[11px] sm:text-xs text-zinc-500 font-medium">
                    Método: {displayData.payment.paymentMethodLabel || displayData.payment.paymentMethod || 'Efectivo'}
                  </span>
                </Card>

                {displayData.payment.change !== undefined && displayData.payment.change > 0 ? (
                  <Card className="p-4 sm:p-6 bg-emerald-500/10 border-emerald-500/40 flex flex-col justify-center space-y-1.5 sm:space-y-2 text-center shadow-lg shadow-emerald-500/10">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400">
                      Su Devuelta / Cambio
                    </span>
                    <p className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 animate-pulse">
                      ${displayData.payment.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    {displayData.payment.amountPaid && (
                      <span className="text-[11px] sm:text-xs text-emerald-400/80 font-semibold">
                        Recibido: ${displayData.payment.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </Card>
                ) : (
                  <Card className="p-4 sm:p-6 bg-zinc-900 border-zinc-800 flex flex-col justify-center items-center text-center space-y-1.5">
                    <CreditCard className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400 mb-0.5" />
                    <span className="text-xs sm:text-sm font-bold text-zinc-300">Esperando confirmación...</span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-500">El cajero está registrando su pago.</span>
                  </Card>
                )}
              </div>
            </motion.div>
          ) : hasCart ? (
            /* 3. MODO ESCANEO ACTIVO (Split Screen para escritorio/landscape + Layout apilado sin scroll para móvil/vertical) */
            <motion.div
              key="scanning-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col"
            >
              {/* ── A) VISTA HORIZONTAL / TABLET / ESCRITORIO (md en adelante) ── */}
              <div className="hidden md:grid md:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 h-full min-h-0 overflow-hidden">
                {/* PANEL IZQUIERDO: ÚLTIMO PRODUCTO ESCANEADO (Hero Highlight) */}
                <div className="md:col-span-5 h-full min-h-0 flex flex-col justify-between bg-zinc-900/90 border border-zinc-800/80 rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex-1 min-h-0 flex flex-col justify-center">
                    {heroItem ? (
                      <motion.div
                        key={heroItem.id + '-' + (heroItem.timestamp || heroItem.quantity)}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="space-y-3 sm:space-y-4"
                      >
                        <div className="h-40 sm:h-48 md:h-52 max-h-[30vh] w-full rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center overflow-hidden p-3 shadow-inner">
                          {heroItem.image_url ? (
                            <img
                              src={heroItem.image_url}
                              alt={heroItem.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="h-20 w-20 rounded-2xl bg-zinc-700/40 flex items-center justify-center text-zinc-500">
                              <Package className="h-10 w-10 text-emerald-400" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight line-clamp-2">
                            {heroItem.name}
                          </h3>
                          <p className="text-xs text-zinc-400 font-semibold">
                            Precio Unitario: ${heroItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Cantidad</span>
                            <span className="text-lg sm:text-xl font-black text-white">{heroItem.quantity} ud</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Subtotal</span>
                            <span className="text-lg sm:text-xl font-black text-emerald-400">
                              ${heroItem.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center text-zinc-500 space-y-2 text-center">
                        <ShoppingBag className="h-10 w-10 text-zinc-600 animate-pulse" />
                        <p className="text-xs sm:text-sm font-semibold">Esperando próximo producto...</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-800 text-center text-zinc-400 text-xs font-medium shrink-0">
                    {storeName} • {displayData.registerName || registerId.toUpperCase()}
                  </div>
                </div>

                {/* PANEL DERECHO: TICKET EN VIVO + TOTALES GIGANTES */}
                <div className="md:col-span-7 h-full min-h-0 flex flex-col justify-between bg-zinc-900/90 border border-zinc-800/80 rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-xs sm:text-sm text-white">Detalle de su Compra</span>
                    </div>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-bold text-xs">
                      {displayData.itemsCount || displayData.cart.length} {displayData.itemsCount === 1 ? 'artículo' : 'artículos'}
                    </Badge>
                  </div>

                  {/* LISTA SIN SCROLLBAR VISIBLE, SCROLL INTERNO SUAVE AL TOPE */}
                  <div
                    ref={cartListRef}
                    className="flex-1 min-h-0 overflow-y-auto no-scrollbar my-2.5 space-y-2 pr-0.5"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {displayData.cart.map((item, idx) => {
                      const isLatest = idx === 0 || (displayData.lastItem && (item.id === displayData.lastItem.id || item.name === displayData.lastItem.name));
                      return (
                        <motion.div
                          key={item.id + idx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                            isLatest
                              ? 'bg-zinc-800/90 border-2 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                              : 'bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-zinc-700/50 flex items-center justify-center shrink-0 text-xs font-black text-emerald-400 border border-zinc-600/40">
                              {item.quantity}x
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs sm:text-sm text-white truncate" title={item.name}>
                                {item.name}
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium">
                                ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} c/u
                              </p>
                              {item.extras && item.extras.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {item.extras.map((ex, i) => (
                                    <span key={i} className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                                      +{ex.name} (${ex.price})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-xs sm:text-base text-white">
                              ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* PANEL FIJO DE TOTALES EN GRANDE */}
                  <div className="bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800 shadow-inner space-y-1.5 shrink-0">
                    <div className="flex justify-between text-xs text-zinc-400 font-medium">
                      <span>Subtotal:</span>
                      <span>${(displayData.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {displayData.tax > 0 && (
                      <div className="flex justify-between text-xs text-zinc-400 font-medium">
                        <span>ITBIS / Impuestos:</span>
                        <span>+${displayData.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {displayData.discount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-400 font-bold">
                        <span>Descuento aplicado:</span>
                        <span>-${displayData.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-400 block">
                          Total a Pagar
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 font-medium">Impuestos incluidos</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                          ${(displayData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── B) VISTA VERTICAL / MÓVIL (menos de md) 100% ADAPTADA SIN SCROLL GLOBAL ── */}
              <div className="flex md:hidden flex-col h-full min-h-0 gap-2 overflow-hidden">
                {/* 1. BANNER COMPACTO DEL ÚLTIMO PRODUCTO (HERO COMPACTO) */}
                {heroItem && (
                  <motion.div
                    key={'mob-' + heroItem.id + '-' + (heroItem.timestamp || heroItem.quantity)}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="shrink-0 bg-zinc-900/95 border border-zinc-800 rounded-xl p-2.5 shadow-md flex items-center gap-2.5"
                  >
                    <div className="h-11 w-11 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 overflow-hidden">
                      {heroItem.image_url ? (
                        <img src={heroItem.image_url} alt={heroItem.name} className="h-full w-full object-contain" />
                      ) : (
                        <Package className="h-5 w-5 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Último producto</span>
                        <span className="text-[9px] text-zinc-500">• {heroItem.quantity} ud</span>
                      </div>
                      <p className="font-black text-xs text-white truncate leading-tight">
                        {heroItem.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        ${heroItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} c/u
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold text-zinc-400 block">Subtotal</span>
                      <span className="text-base font-black text-emerald-400">
                        ${heroItem.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* 2. LISTA EN VIVO DE ARTÍCULOS (Contenedor adaptable con scroll interno sin barra visible) */}
                <div className="flex-1 min-h-0 bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2.5 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Detalle de Compra</span>
                    </div>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-bold text-[10px] py-0 px-1.5">
                      {displayData.itemsCount || displayData.cart.length} art.
                    </Badge>
                  </div>

                  <div
                    ref={mobileCartListRef}
                    className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 py-1.5"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {displayData.cart.map((item, idx) => {
                      const isLatest = idx === 0 || (displayData.lastItem && (item.id === displayData.lastItem.id || item.name === displayData.lastItem.name));
                      return (
                        <div
                          key={'m-item-' + item.id + idx}
                          className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors ${
                            isLatest
                              ? 'bg-zinc-800/95 border border-emerald-500/50'
                              : 'bg-zinc-800/40 border border-zinc-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="h-6 w-6 rounded bg-zinc-700/50 flex items-center justify-center shrink-0 text-[10px] font-black text-emerald-400 border border-zinc-600/40">
                              {item.quantity}x
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white truncate text-[11px] leading-tight">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <span className="font-black text-white text-xs shrink-0">
                            ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. TOTAL A PAGAR FIJO AL FONDO (100% VISIBLE SIEMPRE SIN SCROLL) */}
                <div className="shrink-0 bg-zinc-950 p-2.5 sm:p-3 rounded-xl border border-zinc-800 shadow-xl space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Subtotal: ${(displayData.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    {displayData.tax > 0 && <span>ITBIS: +${displayData.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                    {displayData.discount > 0 && <span className="text-emerald-400 font-bold">Desc: -${displayData.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                  </div>
                  <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                        Total a Pagar
                      </span>
                      <span className="text-[9px] text-zinc-500">Impuestos incluidos</span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      ${(displayData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* 4. MODO STANDBY / BIENVENIDA (Pantalla de Espera del Supermercado) */
            <motion.div
              key="idle-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-0 my-auto flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center space-y-3 sm:space-y-6 md:space-y-8 px-2 overflow-hidden"
            >
              <div className="space-y-1.5 sm:space-y-3 shrink-0">
                <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-2xl sm:rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto shadow-2xl overflow-hidden p-2">
                  {storeLogo ? (
                    <img src={storeLogo} alt={storeName} className="h-full w-full object-contain" />
                  ) : (
                    <img src={appLogo} alt="Logo" className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain" />
                  )}
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <Badge className="bg-emerald-500 text-zinc-950 font-black text-[10px] sm:text-xs uppercase tracking-wider px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full mb-0.5 sm:mb-1">
                    Caja Abierta y Lista
                  </Badge>
                  <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight line-clamp-1">
                    ¡Bienvenidos a {storeName}!
                  </h2>
                  <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto line-clamp-2">
                    Sus artículos se mostrarán en esta pantalla a medida que el cajero los vaya escaneando.
                  </p>
                </div>
              </div>

              {/* 3 Promociones / Beneficios en formato Supermercado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full shrink-0">
                <Card className="p-2.5 sm:p-4 bg-zinc-900/80 border-zinc-800 text-left space-y-1 sm:space-y-2 rounded-xl sm:rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">Múltiples Métodos</h4>
                    <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 line-clamp-2 sm:line-clamp-none">Efectivo, tarjetas de débito/crédito y transferencias.</p>
                  </div>
                </Card>

                <Card className="p-2.5 sm:p-4 bg-zinc-900/80 border-zinc-800 text-left space-y-1 sm:space-y-2 rounded-xl sm:rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">Factura Digital</h4>
                    <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 line-clamp-2 sm:line-clamp-none">Escanee su factura electrónica directo en su celular.</p>
                  </div>
                </Card>

                <Card className="p-2.5 sm:p-4 bg-zinc-900/80 border-zinc-800 text-left space-y-1 sm:space-y-2 rounded-xl sm:rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">Transparencia</h4>
                    <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 line-clamp-2 sm:line-clamp-none">Compruebe cada precio, descuento y su devuelta exacta.</p>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── MODAL DE CONFIGURACIÓN DEL VISOR (Permite vincular a cualquier Caja) ── */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white rounded-2xl p-5 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-zinc-800 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Tv className="h-4 w-4 text-emerald-400" />
              Configurar Visor de Cliente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-300">Caja a Vincular:</label>
              <Input
                value={tempRegisterId}
                onChange={(e) => setTempRegisterId(e.target.value)}
                placeholder="Ej. caja_1, caja_2, caja_rapida..."
                className="bg-zinc-800 border-zinc-700 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500">
                Identificador de la caja del POS a la que responderá esta pantalla (ej: caja_1).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-300">Nombre de la Tienda (opcional):</label>
              <Input
                value={tempStoreName}
                onChange={(e) => setTempStoreName(e.target.value)}
                placeholder="Nombre de tu negocio..."
                className="bg-zinc-800 border-zinc-700 text-xs text-white"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfigOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => saveConfig(tempStoreId, tempRegisterId, tempStoreName)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Guardar y Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDisplay;
