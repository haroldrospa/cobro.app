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
import {
  Smartphone,
  Wifi,
  Receipt,
  Zap,
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
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
} from 'lucide-react';
import { useDigitalServices } from '@/hooks/useDigitalServices';
import { DigitalServiceType } from '@/types/digitalServices';
import { cn } from '@/lib/utils';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { BrandLogo } from './BrandLogo';

interface DigitalServicesPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 1. RECARGAS
const RECHARGE_CARRIERS = [
  { id: 'claro', name: 'Claro', sub: 'Dominicana', badge: '6% com.' },
  { id: 'altice', name: 'Altice', sub: 'Dominicana', badge: '5% com.' },
  { id: 'viva', name: 'Viva', sub: 'Dominicana', badge: '7% com.' },
  { id: 'digicel', name: 'Digicel', sub: 'Haití / Int.', badge: '5% com.' },
  { id: 'natcom', name: 'Natcom', sub: 'Haití / Int.', badge: '5% com.' },
  { id: 'wind', name: 'Wind', sub: 'Dominicana', badge: '5% com.' },
];

// 2. LUZ PREPAGO
const PREPAID_POWER_BILLERS = [
  { id: 'edesur_prepago', name: 'Edesur Prepago', desc: 'PIN para medidor' },
  { id: 'edeeste_prepago', name: 'Edeeste Prepago', desc: 'PIN para medidor' },
  { id: 'edenorte_prepago', name: 'Edenorte Prepago', desc: 'PIN para medidor' },
  { id: 'cepm_prepago', name: 'CEPM Prepago', desc: 'Punta Cana / Bávaro' },
];

// 3. FACTURAS POR CATEGORÍAS
type BillCategory = 'all' | 'electricity' | 'water' | 'telecom' | 'government' | 'catalog' | 'gaming';

const BILL_CATEGORIES: { id: BillCategory; label: string; icon: any }[] = [
  { id: 'all', label: 'Todos', icon: Layers },
  { id: 'electricity', label: 'Electricidad', icon: Zap },
  { id: 'water', label: 'Agua', icon: Droplets },
  { id: 'telecom', label: 'Teléfono & Cable', icon: Tv },
  { id: 'government', label: 'Gobierno', icon: Landmark },
  { id: 'catalog', label: 'Catálogos', icon: ShoppingBag },
  { id: 'gaming', label: 'Streaming & Pines', icon: Gamepad2 },
];

const ALL_BILLERS = [
  // Electricidad
  { id: 'edesur', name: 'Edesur Dominicana', category: 'electricity', sub: 'Factura (NIC)', fee: 15 },
  { id: 'edeeste', name: 'Edeeste', category: 'electricity', sub: 'Factura (NIC)', fee: 15 },
  { id: 'edenorte', name: 'Edenorte', category: 'electricity', sub: 'Factura (NIC)', fee: 15 },
  { id: 'cepm', name: 'CEPM', category: 'electricity', sub: 'Punta Cana - Macao', fee: 20 },
  { id: 'cepp', name: 'CEPP Puerto Plata', category: 'electricity', sub: 'Costa Norte', fee: 20 },

  // Agua
  { id: 'caasd', name: 'CAASD', category: 'water', sub: 'Santo Domingo', fee: 15 },
  { id: 'coraasan', name: 'Coraasan', category: 'water', sub: 'Santiago', fee: 15 },
  { id: 'inapa', name: 'INAPA', category: 'water', sub: 'Nacional', fee: 15 },
  { id: 'coraamoca', name: 'Coraamoca', category: 'water', sub: 'Moca', fee: 15 },
  { id: 'coraaplata', name: 'Coraaplata', category: 'water', sub: 'Puerto Plata', fee: 15 },
  { id: 'coaarom', name: 'Coaarom', category: 'water', sub: 'La Romana', fee: 15 },

  // Telecomunicaciones
  { id: 'claro_factura', name: 'Claro Factura', category: 'telecom', sub: 'Móvil / Fibra', fee: 15 },
  { id: 'altice_factura', name: 'Altice Factura', category: 'telecom', sub: 'Móvil / Fibra', fee: 15 },
  { id: 'viva_pospago', name: 'Viva Factura', category: 'telecom', sub: 'Pospago', fee: 15 },
  { id: 'wind', name: 'Wind Telecom', category: 'telecom', sub: 'Internet y TV', fee: 15 },
  { id: 'aster', name: 'Aster', category: 'telecom', sub: 'Cable e Internet', fee: 15 },
  { id: 'sky', name: 'Sky Dominicana', category: 'telecom', sub: 'TV Satelital', fee: 20 },

  // Gobierno
  { id: 'dgii', name: 'DGII', category: 'government', sub: 'Impuestos / Marbetes', fee: 25 },
  { id: 'digesett', name: 'Digesett', category: 'government', sub: 'Multas de Tránsito', fee: 20 },
  { id: 'policia_nacional', name: 'Policía Nacional', category: 'government', sub: 'Buena Conducta', fee: 25 },
  { id: 'pasaportes_rd', name: 'Pasaportes RD', category: 'government', sub: 'Tasas de Libreta', fee: 25 },

  // Catálogos
  { id: 'belcorp', name: 'Belcorp (Ésika / L\'Bel)', category: 'catalog', sub: 'Consultoras', fee: 20 },
  { id: 'avon', name: 'Avon Dominicana', category: 'catalog', sub: 'Representantes', fee: 20 },
  { id: 'yanbal', name: 'Yanbal', category: 'catalog', sub: 'Belleza', fee: 20 },

  // Streaming & Juegos
  { id: 'free_fire', name: 'Free Fire', category: 'gaming', sub: 'Diamantes (ID)', fee: 15 },
  { id: 'netflix', name: 'Netflix', category: 'gaming', sub: 'Pines y Cuenta', fee: 25 },
  { id: 'spotify', name: 'Spotify', category: 'gaming', sub: 'Membresía', fee: 20 },
  { id: 'psn', name: 'PlayStation (PSN)', category: 'gaming', sub: 'Tarjetas de regalo', fee: 25 },
  { id: 'xbox', name: 'Xbox Live', category: 'gaming', sub: 'Pines y Game Pass', fee: 25 },
  { id: 'roblox', name: 'Roblox (Robux)', category: 'gaming', sub: 'Pines para juegos', fee: 15 },
  { id: 'google_play', name: 'Google Play', category: 'gaming', sub: 'Saldo Play Store', fee: 20 },
  { id: 'apple_itunes', name: 'Apple Store', category: 'gaming', sub: 'Saldo App Store', fee: 25 },
];

// 4. PAQUETICOS
const ALL_PACKAGES = [
  // Claro
  { id: 'claro-1d', carrier: 'claro', name: '1 Día Ilimitado', price: 50, validity: '24 horas', desc: 'Internet Libre + Minutos' },
  { id: 'claro-3d', carrier: 'claro', name: '3 Días Ilimitado', price: 100, validity: '3 días', desc: 'Internet Libre + WhatsApp' },
  { id: 'claro-5d', carrier: 'claro', name: '5 Días Ilimitado', price: 150, validity: '5 días', desc: 'Internet Libre + Redes' },
  { id: 'claro-7d', carrier: 'claro', name: '7 Días Ilimitado', price: 200, validity: '7 días', desc: 'Internet Full Libre' },
  { id: 'claro-10d', carrier: 'claro', name: '10 Días Ilimitado', price: 300, validity: '10 días', desc: 'Internet + Llamadas' },
  { id: 'claro-15d', carrier: 'claro', name: '15 Días Ilimitado', price: 400, validity: '15 días', desc: 'Internet Quincenal' },
  { id: 'claro-noche', carrier: 'claro', name: 'Noche Libre', price: 40, validity: '12am a 6am', desc: 'Internet nocturno' },
  // Altice
  { id: 'altice-1d', carrier: 'altice', name: '1 Día Libre', price: 50, validity: '24 horas', desc: 'Datos ilimitados Altice' },
  { id: 'altice-3d', carrier: 'altice', name: '3 Días Libre', price: 95, validity: '3 días', desc: 'Datos ilimitados + Minutos' },
  { id: 'altice-5d', carrier: 'altice', name: '5 Días Libre', price: 140, validity: '5 días', desc: 'Datos ilimitados Altice' },
  { id: 'altice-7d', carrier: 'altice', name: '7 Días Libre', price: 190, validity: '7 días', desc: 'Internet Libre semanal' },
  { id: 'altice-10d', carrier: 'altice', name: '10 Días Libre', price: 280, validity: '10 días', desc: 'Internet 10 días' },
  { id: 'altice-15d', carrier: 'altice', name: '15 Días Libre', price: 380, validity: '15 días', desc: 'Internet Quincenal Altice' },
  { id: 'altice-noche', carrier: 'altice', name: 'Noche Libre', price: 40, validity: '12am a 7am', desc: 'Datos libres noche' },
  // Viva
  { id: 'viva-1d', carrier: 'viva', name: 'Ta Nítido 1D', price: 40, validity: '24 horas', desc: 'Internet + Llamadas' },
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
      alert('Por favor ingrese un número de teléfono, contrato o NIC válido.');
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
    const msg = `🧾 *COMPROBANTE DE SERVICIO*\n` +
      `*Comercio:* ${storeSettings?.store_name || 'CobroApp'}\n` +
      `*Servicio:* ${completedTx.carrier?.toUpperCase()}\n` +
      `*Destino:* ${completedTx.target_number}\n` +
      `*Monto:* RD$ ${Number(completedTx.amount).toFixed(2)}\n` +
      `*Ref:* ${completedTx.id || completedTx.client_reference_id}\n` +
      `*Fecha:* ${new Date().toLocaleString()}\n\n` +
      `¡Gracias por su compra! ✨`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/1${phoneNumber.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border border-border/80 shadow-2xl max-h-[92vh] flex flex-col rounded-2xl">
        {/* Cabecera Minimalista con los colores oficiales de CobroApp */}
        <div className="bg-card border-b border-border/60 p-4 sm:p-5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Servicios Digitales & Recargas
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground font-normal">
                  RecargameYa
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Recargas, paqueticos y pago de servicios dominicanos
              </DialogDescription>
            </div>
          </div>

          {/* Saldo de Billetera Minimalista */}
          <div className="text-right px-3 py-1.5 rounded-xl bg-muted/50 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block">
              Saldo Billetera
            </span>
            <span className={cn(
              "text-sm sm:text-base font-bold",
              balance < 200 ? "text-amber-500" : "text-primary"
            )}>
              RD$ {balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {completedTx ? (
            // Vista de Éxito / Comprobante
            <div className="p-4 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">¡Transacción Exitosa!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Operación procesada para <strong className="text-foreground">{completedTx.target_number}</strong> ({completedTx.carrier?.toUpperCase()}).
                </p>
              </div>

              <Card className="bg-muted/30 border border-border/60 text-left">
                <CardContent className="p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Servicio:</span>
                    <span className="font-semibold text-foreground uppercase">{completedTx.carrier}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Cobrado al cliente:</span>
                    <span className="font-bold text-foreground text-sm">RD$ {Number(completedTx.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-primary font-medium pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> Tu ganancia neta:
                    </span>
                    <span className="font-bold text-sm">+ RD$ {Number(completedTx.commission).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground pt-1">
                    <span>Deducido de tu saldo:</span>
                    <span>RD$ {Number(completedTx.amount_charged).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button onClick={handlePrintReceipt} variant="outline" size="sm" className="gap-1.5 h-9">
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button onClick={handleSendWhatsApp} variant="outline" size="sm" className="gap-1.5 h-9 text-primary border-primary/30 hover:bg-primary/5">
                  <Share2 className="h-4 w-4" /> WhatsApp
                </Button>
                <Button onClick={handleReset} size="sm" className="gap-1.5 h-9 bg-primary text-primary-foreground">
                  <RotateCcw className="h-4 w-4" /> Nueva Venta
                </Button>
              </div>
            </div>
          ) : (
            // Formulario de Venta Minimalista
            <div className="space-y-4">
              {/* Pestañas Principales */}
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
                <TabsList className="grid grid-cols-4 w-full h-10 bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger value="recharge" className="text-xs font-medium gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                    <Smartphone className="h-3.5 w-3.5" /> Recargas
                  </TabsTrigger>
                  <TabsTrigger value="data_package" className="text-xs font-medium gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                    <Wifi className="h-3.5 w-3.5" /> Paqueticos
                  </TabsTrigger>
                  <TabsTrigger value="bill_payment" className="text-xs font-medium gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                    <Receipt className="h-3.5 w-3.5" /> Facturas
                  </TabsTrigger>
                  <TabsTrigger value="prepaid_power" className="text-xs font-medium gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                    <Zap className="h-3.5 w-3.5" /> Luz Prepago
                  </TabsTrigger>
                </TabsList>

                {/* 1. TAB: RECARGAS */}
                <TabsContent value="recharge" className="mt-3.5 space-y-3.5">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground block mb-2">
                      Selecciona Compañía
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
                              "flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group",
                              isSelected
                                ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40 shadow-xs"
                                : "border-border/60 hover:border-border bg-card"
                            )}
                          >
                            <BrandLogo id={c.id} className="w-8 h-8 rounded-lg mb-1.5 shrink-0" />
                            <span className="font-semibold text-xs text-foreground">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground">{c.sub}</span>
                            <span className="text-[9px] text-primary font-medium mt-0.5">
                              {c.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Montos Rápidos (RD$)
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {QUICK_AMOUNTS.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={Number(amount) === amt ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-9 font-semibold text-xs rounded-lg",
                            Number(amount) === amt ? "bg-primary text-primary-foreground" : "border-border/60 hover:bg-muted/50"
                          )}
                          onClick={() => setAmount(amt)}
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* 2. TAB: PAQUETICOS */}
                <TabsContent value="data_package" className="mt-3.5 space-y-3">
                  <div className="flex gap-1.5">
                    {['claro', 'altice', 'viva'].map((car) => (
                      <Button
                        key={car}
                        type="button"
                        size="sm"
                        variant={selectedCarrier === car ? 'default' : 'outline'}
                        className={cn(
                          "capitalize text-xs font-semibold h-8 rounded-lg gap-1.5",
                          selectedCarrier === car && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => setSelectedCarrier(car)}
                      >
                        <BrandLogo id={car} className="w-4 h-4 rounded-full" />
                        {car}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {ALL_PACKAGES.filter((p) => p.carrier === selectedCarrier).map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleSelectPackage(pkg)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all",
                          selectedPackage === pkg.id
                            ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40 shadow-xs"
                            : "border-border/60 hover:border-border bg-card"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-xs text-foreground">{pkg.name}</span>
                          <span className="font-mono text-xs text-primary font-bold">
                            RD$ {pkg.price}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{pkg.desc}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">⏱️ {pkg.validity}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* 3. TAB: FACTURAS & SERVICIOS */}
                <TabsContent value="bill_payment" className="mt-3.5 space-y-3">
                  {/* Categorías en chips minimalistas */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {BILL_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedBillCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={cn(
                            "h-7 text-xs font-medium rounded-lg px-2.5 flex items-center gap-1.5 shrink-0 transition-colors border",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setSelectedBillCategory(cat.id)}
                        >
                          <Icon className="h-3 w-3" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Buscador minimalista */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar servicio (ej. Edesur, CAASD, Claro, Avon, Free Fire)..."
                      value={billSearchQuery}
                      onChange={(e) => setBillSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-lg border-border/60 bg-background"
                    />
                  </div>

                  {/* Catálogo con Logos Oficiales */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {filteredBillers.map((b) => {
                      const isSelected = selectedCarrier === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedCarrier(b.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40 shadow-xs"
                              : "border-border/60 hover:border-border bg-card"
                          )}
                        >
                          <BrandLogo id={b.id} className="w-8 h-8 rounded-lg shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-xs text-foreground block truncate">{b.name}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{b.sub}</span>
                            <span className="text-[9px] text-primary font-medium block">
                              +RD$ {b.fee} ganancia
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* 4. TAB: LUZ PREPAGO */}
                <TabsContent value="prepaid_power" className="mt-3.5 space-y-3">
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                    ⚡ <strong>Luz Prepago:</strong> Ingresa el número de medidor. El PIN de recarga se imprimirá en el comprobante y se enviará por WhatsApp.
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
                            "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40 shadow-xs"
                              : "border-border/60 hover:border-border bg-card"
                          )}
                        >
                          <BrandLogo id={b.id} className="w-8 h-8 rounded-lg shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">{b.name}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{b.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>

              {/* CAMPOS DE ENTRADA: NÚMERO Y MONTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60">
                <div className="space-y-1">
                  <Label htmlFor="target-input" className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>
                      {activeTab === 'bill_payment'
                        ? 'Número de Contrato / NIC'
                        : activeTab === 'prepaid_power'
                        ? 'Número de Medidor'
                        : 'Número de Teléfono'}
                    </span>
                    <span className="text-[10px] text-primary">
                      {(currentBiller as any)?.name}
                    </span>
                  </Label>
                  <Input
                    id="target-input"
                    type="text"
                    placeholder={
                      activeTab === 'bill_payment'
                        ? 'Ej. 100234567'
                        : activeTab === 'prepaid_power'
                        ? 'Ej. 0123456789'
                        : '8091234567'
                    }
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="h-10 text-sm font-semibold tracking-wider rounded-xl border-border/60"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="custom-amount" className="text-xs font-medium text-muted-foreground">
                      Monto a Cobrar (RD$)
                    </Label>
                    <span className="text-xs font-semibold text-primary">
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
                    className="h-10 text-sm font-semibold rounded-xl border-border/60"
                  />
                </div>
              </div>

              {/* RESUMEN FINANCIERO MINIMALISTA */}
              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-xs flex items-center justify-between">
                <div>
                  <div className="text-muted-foreground text-[11px]">Cobras al cliente:</div>
                  <div className="text-sm font-bold text-foreground">RD$ {numericAmount.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-[11px]">Tu comisión:</div>
                  <div className="text-sm font-bold text-primary">+ RD$ {estimatedCommission.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px]">Costo saldo:</div>
                  <div className="text-sm font-semibold text-muted-foreground">RD$ {estimatedCost.toFixed(2)}</div>
                </div>
              </div>

              {/* SALDO INSUFICIENTE */}
              {!hasEnoughBalance && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Saldo insuficiente (Requieres RD$ {estimatedCost.toFixed(2)}).</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive font-medium"
                    onClick={() => addBalance({ amount: 1000, description: 'Recarga rápida POS' })}
                  >
                    + Abonar RD$ 1,000
                  </Button>
                </div>
              )}

              {/* BOTÓN DE ACCIÓN */}
              <div>
                <Button
                  type="button"
                  className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 shadow-xs transition-all active:scale-[0.99]"
                  disabled={!hasEnoughBalance || isProcessingSale || !phoneNumber || numericAmount <= 0}
                  onClick={handleExecuteTransaction}
                >
                  {isProcessingSale ? (
                    <>Procesando con RecargameYa...</>
                  ) : (
                    <>
                      Cobrar y Procesar {(currentBiller as any)?.name || 'Servicio'} &bull; RD$ {numericAmount.toFixed(2)}
                      <ArrowRight className="h-4 w-4" />
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
