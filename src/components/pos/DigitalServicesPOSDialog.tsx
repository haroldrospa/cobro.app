import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Smartphone,
  Wifi,
  Receipt,
  Zap,
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Wallet,
  Coins,
  Search,
  Droplets,
  Landmark,
  Tv,
  Gamepad2,
  ShoppingBag,
  Layers,
  Flame
} from 'lucide-react';
import { useDigitalServices } from '@/hooks/useDigitalServices';
import { DigitalServiceType } from '@/types/digitalServices';
import { cn } from '@/lib/utils';
import { useStoreSettings } from '@/hooks/useStoreSettings';

interface DigitalServicesPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 1. OPERADORES PARA RECARGAS DE SALDO
const RECHARGE_CARRIERS = [
  { id: 'claro', name: 'Claro', sub: 'Dominicana', color: 'border-red-500 bg-red-500/10 text-red-600', badge: '6% com.' },
  { id: 'altice', name: 'Altice', sub: 'Dominicana', color: 'border-sky-500 bg-sky-500/10 text-sky-600', badge: '5% com.' },
  { id: 'viva', name: 'Viva', sub: 'Dominicana', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-600', badge: '7% com.' },
  { id: 'digicel', name: 'Digicel', sub: 'Internacional / Haití', color: 'border-red-600 bg-red-600/10 text-red-700', badge: '5% com.' },
  { id: 'natcom', name: 'Natcom', sub: 'Internacional / Haití', color: 'border-blue-600 bg-blue-600/10 text-blue-700', badge: '5% com.' },
  { id: 'moun', name: 'Moun Móvil', sub: 'Dominicana', color: 'border-purple-500 bg-purple-500/10 text-purple-600', badge: '5% com.' },
];

// 2. DISTRIBUIDORAS PARA LUZ PREPAGO (EMISIÓN DE PIN)
const PREPAID_POWER_BILLERS = [
  { id: 'edesur_prepago', name: 'Edesur Prepago', desc: 'Emisión de PIN para medidor', color: 'border-amber-500' },
  { id: 'edeeste_prepago', name: 'Edeeste Prepago', desc: 'Emisión de PIN para medidor', color: 'border-orange-500' },
  { id: 'edenorte_prepago', name: 'Edenorte Prepago', desc: 'Emisión de PIN para medidor', color: 'border-blue-500' },
  { id: 'cepm_prepago', name: 'CEPM Prepago', desc: 'Punta Cana / Bávaro', color: 'border-teal-500' },
];

// 3. CATEGORÍAS Y CATÁLOGO COMPLETO DE FACTURAS Y SERVICIOS PÚBLICOS
type BillCategory = 'all' | 'electricity' | 'water' | 'telecom' | 'government' | 'catalog' | 'gaming';

const BILL_CATEGORIES: { id: BillCategory; label: string; icon: any }[] = [
  { id: 'all', label: 'Todos', icon: Layers },
  { id: 'electricity', label: 'Electricidad', icon: Zap },
  { id: 'water', label: 'Agua Potable', icon: Droplets },
  { id: 'telecom', label: 'Teléfono & Cable', icon: Tv },
  { id: 'government', label: 'Gobierno & Multas', icon: Landmark },
  { id: 'catalog', label: 'Catálogos', icon: ShoppingBag },
  { id: 'gaming', label: 'Juegos & Streaming', icon: Gamepad2 },
];

const ALL_BILLERS = [
  // --- ELECTRICIDAD POSPAGO ---
  { id: 'edesur', name: 'Edesur Dominicana', category: 'electricity', sub: 'Factura mensual (NIC)', fee: 15 },
  { id: 'edeeste', name: 'Edeeste', category: 'electricity', sub: 'Factura mensual (NIC)', fee: 15 },
  { id: 'edenorte', name: 'Edenorte', category: 'electricity', sub: 'Factura mensual (NIC)', fee: 15 },
  { id: 'cepm', name: 'CEPM', category: 'electricity', sub: 'Punta Cana - Macao', fee: 20 },
  { id: 'cepp', name: 'CEPP Puerto Plata', category: 'electricity', sub: 'Costa Norte', fee: 20 },

  // --- AGUA POTABLE ---
  { id: 'caasd', name: 'CAASD', category: 'water', sub: 'Santo Domingo', fee: 15 },
  { id: 'coraasan', name: 'Coraasan', category: 'water', sub: 'Santiago', fee: 15 },
  { id: 'inapa', name: 'INAPA', category: 'water', sub: 'Nacional', fee: 15 },
  { id: 'coraamoca', name: 'Coraamoca', category: 'water', sub: 'Moca / Espaillat', fee: 15 },
  { id: 'coraaplata', name: 'Coraaplata', category: 'water', sub: 'Puerto Plata', fee: 15 },
  { id: 'coaarom', name: 'Coaarom', category: 'water', sub: 'La Romana', fee: 15 },
  { id: 'coraavega', name: 'Coraavega', category: 'water', sub: 'La Vega', fee: 15 },

  // --- TELEFONÍA, CABLE & INTERNET ---
  { id: 'claro_factura', name: 'Claro Factura', category: 'telecom', sub: 'Móvil / Fibra / Hogar', fee: 15 },
  { id: 'altice_factura', name: 'Altice Factura', category: 'telecom', sub: 'Móvil / Fibra / Hogar', fee: 15 },
  { id: 'viva_pospago', name: 'Viva Pospago', category: 'telecom', sub: 'Planes y Factura', fee: 15 },
  { id: 'aster', name: 'Aster Comunicaciones', category: 'telecom', sub: 'Cable e Internet', fee: 15 },
  { id: 'wind', name: 'Wind Telecom', category: 'telecom', sub: 'Internet y Televisión', fee: 15 },
  { id: 'sky', name: 'Sky Dominicana', category: 'telecom', sub: 'Televisión Satelital', fee: 20 },
  { id: 'telecable_central', name: 'Telecable Central', category: 'telecom', sub: 'La Vega y Cibao', fee: 15 },
  { id: 'activa_telecable', name: 'Activa Telecable', category: 'telecom', sub: 'Cable local', fee: 15 },

  // --- GOBIERNO & IMPUESTOS & SALUD ---
  { id: 'dgii', name: 'DGII', category: 'government', sub: 'Impuestos, Marbetes, Tasas', fee: 25 },
  { id: 'digesett', name: 'Digesett', category: 'government', sub: 'Multas de Tránsito', fee: 20 },
  { id: 'policia_nacional', name: 'Policía Nacional', category: 'government', sub: 'Papel de Buena Conducta', fee: 25 },
  { id: 'pasaportes_rd', name: 'Pasaportes RD', category: 'government', sub: 'Impuestos de Libreta', fee: 25 },
  { id: 'senasa', name: 'SeNaSa', category: 'government', sub: 'Seguro Nacional de Salud', fee: 15 },
  { id: 'alcaldia_adn', name: 'Alcaldía ADN', category: 'government', sub: 'Distrito Nacional', fee: 20 },
  { id: 'alcaldia_asde', name: 'Alcaldía ASDE', category: 'government', sub: 'Santo Domingo Este', fee: 20 },
  { id: 'alcaldia_santiago', name: 'Alcaldía Santiago', category: 'government', sub: 'Tasas municipales', fee: 20 },

  // --- CATÁLOGOS Y VENTAS ---
  { id: 'belcorp', name: 'Belcorp (Ésika / L\'Bel / Cyzone)', category: 'catalog', sub: 'Pago de consultoras', fee: 20 },
  { id: 'avon', name: 'Avon Dominicana', category: 'catalog', sub: 'Factura de representantes', fee: 20 },
  { id: 'yanbal', name: 'Yanbal', category: 'catalog', sub: 'Cosméticos y belleza', fee: 20 },
  { id: 'cristel', name: 'Cristel Joyas', category: 'catalog', sub: 'Catálogo de joyas', fee: 20 },

  // --- STREAMING, PINES & VIDEOJUEGOS ---
  { id: 'free_fire', name: 'Free Fire', category: 'gaming', sub: 'Diamantes y Pases (ID)', fee: 15 },
  { id: 'netflix', name: 'Netflix', category: 'gaming', sub: 'Pines y Membresía', fee: 25 },
  { id: 'spotify', name: 'Spotify', category: 'gaming', sub: 'Suscripción Premium', fee: 20 },
  { id: 'psn', name: 'PlayStation Network', category: 'gaming', sub: 'Tarjetas de regalo PSN', fee: 25 },
  { id: 'xbox', name: 'Xbox Live & Game Pass', category: 'gaming', sub: 'Pines digitales', fee: 25 },
  { id: 'roblox', name: 'Roblox (Robux)', category: 'gaming', sub: 'Pines para juegos', fee: 15 },
  { id: 'google_play', name: 'Google Play', category: 'gaming', sub: 'Saldo Google', fee: 20 },
  { id: 'apple_itunes', name: 'Apple App Store', category: 'gaming', sub: 'Saldo iTunes / Apple', fee: 25 },
];

// 4. PAQUETICOS REALES
const ALL_PACKAGES = [
  // Claro
  { id: 'claro-1d', carrier: 'claro', name: '1 Día Ilimitado', price: 50, validity: '24 horas', desc: 'Internet Libre + Minutos' },
  { id: 'claro-3d', carrier: 'claro', name: '3 Días Ilimitado', price: 100, validity: '3 días', desc: 'Internet Libre + WhatsApp' },
  { id: 'claro-5d', carrier: 'claro', name: '5 Días Ilimitado', price: 150, validity: '5 días', desc: 'Internet Libre + Redes' },
  { id: 'claro-7d', carrier: 'claro', name: '7 Días Ilimitado', price: 200, validity: '7 días', desc: 'Internet Full Libre' },
  { id: 'claro-10d', carrier: 'claro', name: '10 Días Ilimitado', price: 300, validity: '10 días', desc: 'Internet + Llamadas' },
  { id: 'claro-15d', carrier: 'claro', name: '15 Días Ilimitado', price: 400, validity: '15 días', desc: 'Internet Quincenal' },
  { id: 'claro-noche', carrier: 'claro', name: 'Noche Libre', price: 40, validity: '12am a 6am', desc: 'Internet nocturno sin límite' },
  // Altice
  { id: 'altice-1d', carrier: 'altice', name: '1 Día Libre', price: 50, validity: '24 horas', desc: 'Datos ilimitados Altice' },
  { id: 'altice-3d', carrier: 'altice', name: '3 Días Libre', price: 95, validity: '3 días', desc: 'Datos ilimitados + Minutos' },
  { id: 'altice-5d', carrier: 'altice', name: '5 Días Libre', price: 140, validity: '5 días', desc: 'Datos ilimitados Altice' },
  { id: 'altice-7d', carrier: 'altice', name: '7 Días Libre', price: 190, validity: '7 días', desc: 'Internet Libre semanal' },
  { id: 'altice-10d', carrier: 'altice', name: '10 Días Libre', price: 280, validity: '10 días', desc: 'Internet 10 días' },
  { id: 'altice-15d', carrier: 'altice', name: '15 Días Libre', price: 380, validity: '15 días', desc: 'Internet Quincenal Altice' },
  { id: 'altice-noche', carrier: 'altice', name: 'Noche Libre', price: 40, validity: '12am a 7am', desc: 'Datos libres noche' },
  // Viva
  { id: 'viva-1d', carrier: 'viva', name: 'Ta Nítido 1D', price: 40, validity: '24 horas', desc: 'Internet + Llamadas ilimitadas' },
  { id: 'viva-3d', carrier: 'viva', name: 'Ta Nítido 3D', price: 85, validity: '3 días', desc: 'Internet libre 3 días' },
  { id: 'viva-5d', carrier: 'viva', name: 'Ta Nítido 5D', price: 130, validity: '5 días', desc: 'Internet libre 5 días' },
  { id: 'viva-7d', carrier: 'viva', name: 'Ta Nítido 7D', price: 175, validity: '7 días', desc: 'Internet libre semanal' },
];

const QUICK_AMOUNTS = [50, 100, 150, 200, 300, 500, 1000];

export const DigitalServicesPOSDialog: React.FC<DigitalServicesPOSDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { wallet, config, processSale, isProcessingSale, addBalance } = useDigitalServices();
  const { data: storeSettings } = useStoreSettings();

  const [activeTab, setActiveTab] = useState<DigitalServiceType>('recharge');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('claro');
  const [selectedBillCategory, setSelectedBillCategory] = useState<BillCategory>('all');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [targetName, setTargetName] = useState('');
  const [amount, setAmount] = useState<number | string>(100);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<any | null>(null);

  const balance = Number(wallet?.balance || 0);
  const commissionRate = wallet?.custom_commission_rate ?? config?.default_recharge_commission_rate ?? 6.0;

  // Filtrado de Facturas por Categoría y Buscador
  const filteredBillers = useMemo(() => {
    return ALL_BILLERS.filter((b) => {
      const matchesCategory = selectedBillCategory === 'all' || b.category === selectedBillCategory;
      const matchesSearch = !billSearchQuery ||
        b.name.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
        b.sub.toLowerCase().includes(billSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedBillCategory, billSearchQuery]);

  // Proveedor seleccionado actualmente
  const currentBiller = useMemo(() => {
    if (activeTab === 'bill_payment') {
      return ALL_BILLERS.find((b) => b.id === selectedCarrier) || ALL_BILLERS[0];
    }
    if (activeTab === 'prepaid_power') {
      return PREPAID_POWER_BILLERS.find((b) => b.id === selectedCarrier) || PREPAID_POWER_BILLERS[0];
    }
    return RECHARGE_CARRIERS.find((c) => c.id === selectedCarrier) || RECHARGE_CARRIERS[0];
  }, [activeTab, selectedCarrier]);

  // Cálculo de ganancia y costo en vivo
  const numericAmount = Number(amount) || 0;
  const estimatedCommission = useMemo(() => {
    if (activeTab === 'bill_payment') {
      const billFee = (currentBiller as any)?.fee || Number(config?.default_bill_fixed_commission || 15.0);
      return Number(billFee);
    }
    return Math.round((numericAmount * (commissionRate / 100)) * 100) / 100;
  }, [numericAmount, commissionRate, activeTab, config, currentBiller]);

  const estimatedCost = useMemo(() => {
    if (activeTab === 'bill_payment') return numericAmount;
    return Math.max(0, numericAmount - estimatedCommission);
  }, [numericAmount, estimatedCommission, activeTab]);

  const hasEnoughBalance = balance >= estimatedCost;

  // Formato para teléfono
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 15);
    setPhoneNumber(raw);
  };

  const handleSelectPackage = (pkg: typeof ALL_PACKAGES[0]) => {
    setSelectedPackage(pkg.id);
    setSelectedCarrier(pkg.carrier);
    setAmount(pkg.price);
  };

  const handleExecuteTransaction = async () => {
    if (!phoneNumber || phoneNumber.length < 5) {
      alert('Por favor ingrese un número de teléfono, contrato, NIC o medidor válido.');
      return;
    }
    if (numericAmount <= 0) {
      alert('Ingrese un monto válido.');
      return;
    }

    try {
      const result = await processSale({
        carrier: selectedCarrier,
        phone: phoneNumber,
        amount: numericAmount,
        service_type: activeTab,
        target_name: targetName || undefined,
        package_id: selectedPackage || undefined,
      });

      setCompletedTx(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = () => {
    setCompletedTx(null);
    setPhoneNumber('');
    setTargetName('');
    setSelectedPackage('');
    setAmount(100);
  };

  const handlePrintReceipt = () => {
    if (!completedTx) return;
    const printWindow = window.open('', '_blank', 'width=380,height=520');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Servicio</title>
          <style>
            body { font-family: monospace; font-size: 13px; margin: 10px; color: #000; }
            .text-center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .font-bold { font-weight: bold; }
            .big { font-size: 16px; }
            .pin-box { border: 2px solid #000; padding: 6px; margin: 8px 0; text-align: center; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold big">${storeSettings?.store_name || 'COBROAPP POS'}</div>
          <div class="text-center">COMPROBANTE DE SERVICIO DIGITAL</div>
          <div class="divider"></div>
          <div class="row"><span>Fecha:</span><span>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span></div>
          <div class="row"><span>Transacción:</span><span>${completedTx.id || completedTx.transaction_id}</span></div>
          <div class="row"><span>Servicio:</span><span class="font-bold">${completedTx.carrier?.toUpperCase()}</span></div>
          <div class="row"><span>Destino:</span><span class="font-bold big">${completedTx.target_number}</span></div>
          ${activeTab === 'prepaid_power' ? `
            <div class="text-center" style="margin-top:6px;">PIN DE RECARGA:</div>
            <div class="pin-box">${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}</div>
          ` : ''}
          <div class="divider"></div>
          <div class="row font-bold big"><span>TOTAL PAGADO:</span><span>RD$ ${Number(completedTx.amount).toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="text-center font-bold">¡Operación Realizada Exitosamente!</div>
          <div class="text-center" style="margin-top: 10px; font-size: 10px;">Gracias por su preferencia</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSendWhatsApp = () => {
    if (!completedTx || !phoneNumber) return;
    const msg = `🧾 *COMPROBANTE DE PAGO DE SERVICIO*\n` +
      `*Comercio:* ${storeSettings?.store_name || 'CobroApp'}\n` +
      `*Servicio:* ${completedTx.carrier?.toUpperCase()}\n` +
      `*Número/Referencia:* ${completedTx.target_number}\n` +
      `*Monto:* RD$ ${Number(completedTx.amount).toFixed(2)}\n` +
      `*Ref:* ${completedTx.id || completedTx.client_reference_id}\n` +
      `*Fecha:* ${new Date().toLocaleString()}\n\n` +
      `¡Gracias por su compra! ✨`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/1${phoneNumber.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border shadow-2xl max-h-[92vh] flex flex-col">
        {/* Cabecera estilizada con Badge de Saldo de Billetera */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-4 sm:p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  Recargas y Servicios Digitales
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[10px]">
                    Catálogo Completo
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Recargas, paqueticos, luz prepago y facturas de más de 30 empresas dominicanas
                </DialogDescription>
              </div>
            </div>

            {/* Widget de Saldo Disponible en la Billetera */}
            <div className="text-right bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
              <div className="text-[10px] text-white/70 uppercase font-semibold tracking-wider flex items-center justify-end gap-1">
                <Wallet className="h-3 w-3" /> Saldo Billetera
              </div>
              <div className={cn(
                "text-lg font-black tracking-tight",
                balance < 200 ? "text-amber-300" : "text-emerald-300"
              )}>
                RD$ {balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {completedTx ? (
            // Vista de Éxito / Comprobante
            <div className="p-4 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="h-10 w-10 animate-in zoom-in-75 duration-300" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground">¡Transacción Exitosa!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Operación procesada para <strong className="text-foreground">{completedTx.target_number}</strong> ({completedTx.carrier?.toUpperCase()}).
                </p>
              </div>

              {/* Tarjeta de Ganancia y Detalles */}
              <Card className="bg-muted/40 border-dashed max-w-md mx-auto">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Servicio:</span>
                    <span className="font-semibold text-foreground uppercase">{completedTx.carrier}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Monto cobrado al cliente:</span>
                    <span className="font-bold text-foreground text-base">RD$ {Number(completedTx.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <Coins className="h-4 w-4" /> Tu ganancia limpia:
                    </span>
                    <span className="font-bold text-base">+ RD$ {Number(completedTx.commission).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span>Costo deducido de CobroApp:</span>
                    <span>RD$ {Number(completedTx.amount_charged).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Acciones de comprobante */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={handlePrintReceipt} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" /> Imprimir Ticket
                </Button>
                <Button onClick={handleSendWhatsApp} variant="secondary" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Share2 className="h-4 w-4" /> Enviar por WhatsApp
                </Button>
                <Button onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Nueva Venta
                </Button>
              </div>
            </div>
          ) : (
            // Vista de Formulario de Venta
            <div className="space-y-4">
              {/* Pestañas de Servicios Principales */}
              <Tabs
                value={activeTab}
                onValueChange={(val) => {
                  const newTab = val as DigitalServiceType;
                  setActiveTab(newTab);
                  if (newTab === 'recharge') setSelectedCarrier('claro');
                  if (newTab === 'bill_payment') setSelectedCarrier('edesur');
                  if (newTab === 'prepaid_power') setSelectedCarrier('edesur_prepago');
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-4 w-full h-11 bg-muted/80">
                  <TabsTrigger value="recharge" className="text-xs sm:text-sm font-semibold gap-1.5">
                    <Smartphone className="h-4 w-4" /> Recargas
                  </TabsTrigger>
                  <TabsTrigger value="data_package" className="text-xs sm:text-sm font-semibold gap-1.5">
                    <Wifi className="h-4 w-4" /> Paqueticos
                  </TabsTrigger>
                  <TabsTrigger value="bill_payment" className="text-xs sm:text-sm font-semibold gap-1.5">
                    <Receipt className="h-4 w-4" /> Facturas ({ALL_BILLERS.length})
                  </TabsTrigger>
                  <TabsTrigger value="prepaid_power" className="text-xs sm:text-sm font-semibold gap-1.5">
                    <Zap className="h-4 w-4" /> Luz Prepago
                  </TabsTrigger>
                </TabsList>

                {/* 1. CONTENIDO TAB: RECARGAS */}
                <TabsContent value="recharge" className="mt-4 space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Selecciona la Compañía Telefónica
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {RECHARGE_CARRIERS.map((c) => {
                        const isSelected = selectedCarrier === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCarrier(c.id)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all cursor-pointer text-center",
                              isSelected
                                ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20 scale-[1.02]"
                                : "border-border hover:border-primary/40 bg-card"
                            )}
                          >
                            <span className="font-bold text-sm text-foreground">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground">{c.sub}</span>
                            <Badge variant="outline" className="mt-1 text-[9px] px-1 py-0 bg-muted text-primary border-primary/20">
                              {c.badge}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Montos Rápidos (RD$)
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {QUICK_AMOUNTS.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={Number(amount) === amt ? 'default' : 'outline'}
                          className="h-10 font-bold rounded-lg text-sm"
                          onClick={() => setAmount(amt)}
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* 2. CONTENIDO TAB: PAQUETICOS */}
                <TabsContent value="data_package" className="mt-4 space-y-4">
                  <div className="flex gap-2 pb-1">
                    {['claro', 'altice', 'viva'].map((car) => (
                      <Button
                        key={car}
                        type="button"
                        size="sm"
                        variant={selectedCarrier === car ? 'default' : 'outline'}
                        className="capitalize font-bold text-xs"
                        onClick={() => setSelectedCarrier(car)}
                      >
                        {car}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {ALL_PACKAGES.filter((p) => p.carrier === selectedCarrier).map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleSelectPackage(pkg)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          selectedPackage === pkg.id
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                            : "border-border hover:border-primary/40 bg-card"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-foreground">{pkg.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px] bg-primary/15 text-primary font-bold">
                            RD$ {pkg.price}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{pkg.desc}</p>
                        <span className="text-[10px] text-primary/80 font-medium mt-1 block">⏱️ {pkg.validity}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* 3. CONTENIDO TAB: FACTURAS & SERVICIOS PÚBLICOS */}
                <TabsContent value="bill_payment" className="mt-4 space-y-3">
                  {/* Filtro de Categorías */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {BILL_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedBillCategory === cat.id;
                      return (
                        <Button
                          key={cat.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-7 text-xs font-medium rounded-full px-2.5 gap-1 shrink-0",
                            isSelected && "shadow-xs"
                          )}
                          onClick={() => setSelectedBillCategory(cat.id)}
                        >
                          <Icon className="h-3 w-3" />
                          {cat.label}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Buscador de Servicios */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre (ej. CAASD, Edesur, Claro, Avon, Free Fire, DGII)..."
                      value={billSearchQuery}
                      onChange={(e) => setBillSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl"
                    />
                  </div>

                  {/* Catálogo de Empresas en Grid con Scroll */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {filteredBillers.map((b) => {
                      const isSelected = selectedCarrier === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedCarrier(b.id)}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer relative",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                              : "border-border hover:border-primary/40 bg-card"
                          )}
                        >
                          <span className="font-bold text-xs text-foreground truncate w-full">{b.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate w-full">{b.sub}</span>
                          <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                            Comisión: +RD$ {b.fee}.00
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* 4. CONTENIDO TAB: LUZ PREPAGO */}
                <TabsContent value="prepaid_power" className="mt-4 space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                    ⚡ <strong>Luz Prepago:</strong> Ingresa el número de medidor. El sistema generará el <strong>código PIN</strong> oficial para recargar el contador en el ticket impreso y por WhatsApp.
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PREPAID_POWER_BILLERS.map((b) => {
                      const isSelected = selectedCarrier === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedCarrier(b.id)}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500"
                              : "border-border hover:border-amber-500/40 bg-card"
                          )}
                        >
                          <span className="font-bold text-xs text-foreground block">{b.name}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">{b.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>

              {/* CAMPOS COMUNES DE ENTRADA: NÚMERO Y MONTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                {/* Destino (Teléfono, Contrato, NIC o Medidor) */}
                <div className="space-y-1.5">
                  <Label htmlFor="target-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {activeTab === 'bill_payment'
                        ? 'Número de Contrato / NIC / Cédula'
                        : activeTab === 'prepaid_power'
                        ? 'Número de Medidor'
                        : 'Número de Teléfono'}
                    </span>
                    <span className="text-[10px] text-primary lowercase font-normal">
                      {(currentBiller as any)?.name}
                    </span>
                  </Label>
                  <Input
                    id="target-input"
                    type="text"
                    placeholder={
                      activeTab === 'bill_payment'
                        ? 'Ej. 100234567 o Cédula'
                        : activeTab === 'prepaid_power'
                        ? 'Ej. 0123456789 (Medidor)'
                        : '8091234567'
                    }
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="h-11 text-base font-bold tracking-wider rounded-xl border-2"
                  />
                </div>

                {/* Monto de la Transacción */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="custom-amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Monto a Cobrar (RD$)
                    </Label>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      + Ganancia: RD$ {estimatedCommission.toFixed(2)}
                    </span>
                  </div>
                  <Input
                    id="custom-amount"
                    type="number"
                    min={10}
                    max={50000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 text-base font-bold rounded-xl"
                  />
                </div>
              </div>

              {/* RESUMEN FINANCIERO DE LA VENTA */}
              <div className="p-3 bg-muted/60 rounded-xl border text-xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Cobras en caja al cliente:</div>
                  <div className="text-base font-bold text-foreground">RD$ {numericAmount.toFixed(2)}</div>
                </div>
                <div className="space-y-0.5 text-center">
                  <div className="text-muted-foreground">Tu comisión neta:</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">+ RD$ {estimatedCommission.toFixed(2)}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <div className="text-muted-foreground">Se debita de tu saldo:</div>
                  <div className="text-base font-semibold text-foreground">RD$ {estimatedCost.toFixed(2)}</div>
                </div>
              </div>

              {/* AVISO DE SALDO INSUFICIENTE */}
              {!hasEnoughBalance && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Saldo insuficiente (Requieres RD$ {estimatedCost.toFixed(2)}).</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive font-bold"
                    onClick={() => addBalance({ amount: 1000, description: 'Recarga rápida de prueba POS' })}
                  >
                    + Abonar RD$ 1,000
                  </Button>
                </div>
              )}

              {/* BOTÓN DE ACCIÓN FINAL */}
              <div>
                <Button
                  type="button"
                  className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 shadow-lg text-white rounded-xl gap-2 transition-transform active:scale-[0.98]"
                  disabled={!hasEnoughBalance || isProcessingSale || !phoneNumber || numericAmount <= 0}
                  onClick={handleExecuteTransaction}
                >
                  {isProcessingSale ? (
                    <>Procesando con RecargameYa...</>
                  ) : (
                    <>
                      Procesar {(currentBiller as any)?.name || 'Servicio'} por RD$ {numericAmount.toFixed(2)}
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
