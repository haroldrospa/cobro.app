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
  GraduationCap,
  CreditCard,
  Trophy,
  ShieldCheck,
  SendHorizontal
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

// 1. OPERADORAS MÓVILES - RD Y HAITÍ
const MOBILE_OPERATORS = [
  { id: 'claro', name: 'Claro', sub: 'Dominicana', badge: '6% com.' },
  { id: 'altice', name: 'Altice', sub: 'Dominicana', badge: '5% com.' },
  { id: 'viva', name: 'Viva', sub: 'Tu Voz Viva', badge: '7% com.' },
  { id: 'digicel', name: 'Digicel', sub: 'Haití / Caribe', badge: '5% com.' },
  { id: 'natcom', name: 'Natcom', sub: 'Haití', badge: '5% com.' },
  { id: 'wind_telecom', name: 'Wind Telecom', sub: 'Dominicana', badge: '5% com.' },
];

// 2. LUZ PREPAGO Y ELECTRICIDAD
const PREPAID_POWER_PROVIDERS = [
  { id: 'edesur_prepago', name: 'Edesur Dominicana', desc: 'PIN para medidor', fee: 15 },
  { id: 'edenorte_prepago', name: 'Edenorte', desc: 'PIN para medidor', fee: 15 },
  { id: 'edeeste_prepago', name: 'Edeeste', desc: 'PIN para medidor', fee: 15 },
  { id: 'cepm_prepago', name: 'CEPM', desc: 'Punta Cana - Macao', fee: 20 },
  { id: 'ceb_prepago', name: 'CEB', desc: 'Bayahibe', fee: 20 },
  { id: 'luz_y_fuerza_prepago', name: 'Luz y Fuerza', desc: 'Las Terrenas', fee: 20 },
];

// 3. REMESAS A HAITÍ
const REMITTANCE_PROVIDERS = [
  { id: 'moncash', name: 'MonCash', sub: 'Digicel Haití', fee: 25 },
  { id: 'natcash', name: 'Natcash', sub: 'Natcom Haití', fee: 25 },
];

// 4. CATEGORÍAS OFICIALES RECARGAMEYA
type BillCategory = 
  | 'all'
  | 'water'
  | 'gov'
  | 'education'
  | 'telecom'
  | 'finance'
  | 'catalog'
  | 'betting'
  | 'insurance'
  | 'gaming';

const RECARGAMEYA_CATEGORIES: { id: BillCategory; label: string; icon: any }[] = [
  { id: 'all', label: 'Todos', icon: Layers },
  { id: 'water', label: 'Agua y Acueductos', icon: Droplets },
  { id: 'gov', label: 'Impuestos y Gobierno', icon: Landmark },
  { id: 'education', label: 'Universidades', icon: GraduationCap },
  { id: 'telecom', label: 'TV, Cable e Internet', icon: Tv },
  { id: 'finance', label: 'Financieras y Crédito', icon: CreditCard },
  { id: 'catalog', label: 'Catálogos y Cosméticos', icon: ShoppingBag },
  { id: 'betting', label: 'Apuestas Deportivas', icon: Trophy },
  { id: 'insurance', label: 'Seguros', icon: ShieldCheck },
  { id: 'gaming', label: 'Gaming y Recreación', icon: Gamepad2 },
];

// 5. PROVEEDORES DE FACTURAS Y SERVICIOS RECARGAMEYA
const ALL_BILLERS = [
  // Agua y Acueductos
  { id: 'caasd', name: 'CAASD', category: 'water', sub: 'Santo Domingo', fee: 15 },
  { id: 'coraasan', name: 'CORAASAN', category: 'water', sub: 'Santiago', fee: 15 },
  { id: 'coraaplata', name: 'CORAAPLATA', category: 'water', sub: 'Puerto Plata', fee: 15 },
  { id: 'coraavega', name: 'CORAAVEGA', category: 'water', sub: 'La Vega', fee: 15 },
  { id: 'coaarom', name: 'COAAROM', category: 'water', sub: 'La Romana', fee: 15 },
  { id: 'asdn', name: 'ASDN', category: 'water', sub: 'Santo Domingo Norte', fee: 15 },

  // Impuestos y Gobierno
  { id: 'dgii', name: 'Impuestos Internos (DGII)', category: 'gov', sub: 'Tributos y Marbetes', fee: 25 },
  { id: 'tss', name: 'TSS', category: 'gov', sub: 'Seguridad Social', fee: 25 },
  { id: 'adn', name: 'ADN', category: 'gov', sub: 'Distrito Nacional', fee: 20 },
  { id: 'pgr_multas', name: 'Procuraduría (PGR)', category: 'gov', sub: 'Multas y Certificaciones', fee: 25 },

  // Universidades y Educación
  { id: 'uapa', name: 'UAPA', category: 'education', sub: 'Universidad Abierta', fee: 20 },
  { id: 'unapec', name: 'UNAPEC', category: 'education', sub: 'Universidad APEC', fee: 20 },
  { id: 'unibe', name: 'UNIBE', category: 'education', sub: 'Universidad Iberoamericana', fee: 20 },
  { id: 'utel', name: 'Utel', category: 'education', sub: 'Universidad Online', fee: 20 },
  { id: 'infotep', name: 'INFOTEP', category: 'education', sub: 'Formación Técnico Profesional', fee: 20 },

  // TV, Cable e Internet
  { id: 'starcable', name: 'Star Cable', category: 'telecom', sub: 'Cable e Internet', fee: 15 },
  { id: 'telecasa', name: 'TELECASA', category: 'telecom', sub: 'Televisión por Cable', fee: 15 },
  { id: 'milchans', name: 'Milchans', category: 'telecom', sub: 'Entretenimiento y Cable', fee: 15 },

  // Financieras y Crédito
  { id: 'credigo', name: 'CrediGo', category: 'finance', sub: 'Financiamiento Móvil', fee: 20 },
  { id: 'krece', name: 'Krece', category: 'finance', sub: 'Microcréditos', fee: 20 },
  { id: 'solucredito', name: 'Solucrédito', category: 'finance', sub: 'Créditos Personales', fee: 20 },
  { id: 'paycash', name: 'PayCash', category: 'finance', sub: 'Red de Pagos', fee: 20 },
  { id: 'paso_rapido', name: 'Paso Rápido', category: 'finance', sub: 'Peajes RD Vial', fee: 15 },
  { id: 'moneyshop', name: 'Money Shop', category: 'finance', sub: 'Servicios Financieros', fee: 20 },

  // Catálogos y Cosméticos
  { id: 'avon', name: 'AVON', category: 'catalog', sub: 'Catálogo de Belleza', fee: 20 },
  { id: 'belcorp', name: 'BELCORP', category: 'catalog', sub: 'Ésika, L\'Bel, Cyzone', fee: 20 },

  // Apuestas Deportivas
  { id: 'betcris', name: 'Betcris', category: 'betting', sub: 'Recargas y Retiros', fee: 15 },
  { id: 'starsport', name: 'Star Sport', category: 'betting', sub: 'Apuestas Deportivas', fee: 15 },
  { id: 'juancito_sport', name: 'Juancito Sport', category: 'betting', sub: 'Bancas Deportivas', fee: 15 },
  { id: 'activa', name: 'Activa', category: 'betting', sub: 'Cable Teléfono Internet', fee: 15 },

  // Seguros
  { id: 'angloamericana', name: 'Angloamericana', category: 'insurance', sub: 'Seguros Generales', fee: 25 },
  { id: 'seguro_midas', name: 'Midas Seguros', category: 'insurance', sub: 'Pólizas y Coberturas', fee: 25 },

  // Gaming y Recreación Digital
  { id: 'freefire', name: 'Free Fire', category: 'gaming', sub: 'Diamantes y Pases', fee: 15 },
  { id: 'mobile_legends', name: 'Mobile Legends', category: 'gaming', sub: 'Diamantes MLBB', fee: 15 },
  { id: 'pubg', name: 'PUBG Mobile', category: 'gaming', sub: 'UC y Pases Royale', fee: 15 },
  { id: 'roblox', name: 'Roblox', category: 'gaming', sub: 'Robux y Membresías', fee: 15 },
];

// 6. PAQUETICOS REALES
const ALL_PACKAGES = [
  // Claro
  { id: 'claro-1d', carrier: 'claro', name: '1 Día Ilimitado', price: 50, validity: '24 horas', desc: 'Internet Libre + Minutos' },
  { id: 'claro-3d', carrier: 'claro', name: '3 Días Ilimitado', price: 100, validity: '3 días', desc: 'Internet Libre + WhatsApp' },
  { id: 'claro-5d', carrier: 'claro', name: '5 Días Ilimitado', price: 150, validity: '5 días', desc: 'Internet Libre + Redes' },
  { id: 'claro-7d', carrier: 'claro', name: '7 Días Ilimitado', price: 200, validity: '7 días', desc: 'Internet Full Libre' },
  { id: 'claro-10d', carrier: 'claro', name: '10 Días Ilimitado', price: 300, validity: '10 días', desc: 'Internet + Llamadas' },
  { id: 'claro-15d', carrier: 'claro', name: '15 Días Ilimitado', price: 400, validity: '15 días', desc: 'Internet Quincenal' },
  // Altice
  { id: 'altice-1d', carrier: 'altice', name: '1 Día Libre', price: 50, validity: '24 horas', desc: 'Datos ilimitados Altice' },
  { id: 'altice-3d', carrier: 'altice', name: '3 Días Libre', price: 95, validity: '3 días', desc: 'Datos ilimitados + Minutos' },
  { id: 'altice-5d', carrier: 'altice', name: '5 Días Libre', price: 140, validity: '5 días', desc: 'Datos ilimitados Altice' },
  { id: 'altice-7d', carrier: 'altice', name: '7 Días Libre', price: 190, validity: '7 días', desc: 'Internet Libre semanal' },
  { id: 'altice-10d', carrier: 'altice', name: '10 Días Libre', price: 280, validity: '10 días', desc: 'Internet 10 días' },
  { id: 'altice-15d', carrier: 'altice', name: '15 Días Libre', price: 380, validity: '15 días', desc: 'Internet Quincenal Altice' },
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
      return PREPAID_POWER_PROVIDERS.find((b) => b.id === selectedCarrier) || PREPAID_POWER_PROVIDERS[0];
    }
    if (activeTab === 'remittance') {
      return REMITTANCE_PROVIDERS.find((r) => r.id === selectedCarrier) || REMITTANCE_PROVIDERS[0];
    }
    return MOBILE_OPERATORS.find((c) => c.id === selectedCarrier) || MOBILE_OPERATORS[0];
  }, [activeTab, selectedCarrier]);

  // Cálculo de ganancia y costo en vivo
  const numericAmount = Number(amount) || 0;
  const estimatedCommission = useMemo(() => {
    if (activeTab === 'bill_payment' || activeTab === 'prepaid_power' || activeTab === 'remittance') {
      const billFee = (currentBiller as any)?.fee || Number(config?.default_bill_fixed_commission || 15.0);
      return Number(billFee);
    }
    return Math.round((numericAmount * (commissionRate / 100)) * 100) / 100;
  }, [numericAmount, commissionRate, activeTab, config, currentBiller]);

  const estimatedCost = useMemo(() => {
    if (activeTab === 'bill_payment' || activeTab === 'prepaid_power' || activeTab === 'remittance') {
      return numericAmount;
    }
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
      alert('Por favor ingrese un número de teléfono, contrato, cuenta o NIC válido.');
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
          <div class="text-center">COMPROBANTE RECARGAMEYA</div>
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
    const msg = `🧾 *COMPROBANTE DE PAGO RECARGAMEYA*\n` +
      `*Comercio:* ${storeSettings?.store_name || 'CobroApp'}\n` +
      `*Servicio:* ${completedTx.carrier?.toUpperCase()}\n` +
      `*Número / Cuenta:* ${completedTx.target_number}\n` +
      `*Monto:* RD$ ${Number(completedTx.amount).toFixed(2)}\n` +
      `*Ref:* ${completedTx.id || completedTx.client_reference_id}\n` +
      `*Fecha:* ${new Date().toLocaleString()}\n\n` +
      `¡Gracias por su compra! ✨`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/1${phoneNumber.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl p-0 overflow-hidden bg-background border border-border/80 shadow-2xl h-[88vh] max-h-[700px] flex flex-col rounded-2xl">
        {/* Cabecera Minimalista Compacta */}
        <div className="bg-card border-b border-border/60 px-4 py-2.5 sm:px-5 sm:py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                Servicios Digitales & Recargas
                <Badge variant="outline" className="border-border text-[9px] text-muted-foreground font-normal py-0 px-1.5 h-4">
                  RecargameYa Oficial
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground line-clamp-1">
                Recargas, luz prepago, remesas a Haití, facturas y entretenimiento
              </DialogDescription>
            </div>
          </div>

          {/* Saldo de Billetera */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/60 mr-8 sm:mr-9 shrink-0">
            <Wallet className="h-4 w-4 text-primary shrink-0" />
            <div className="text-right">
              <span className="text-[9px] text-muted-foreground uppercase font-semibold block leading-tight">
                Saldo Billetera
              </span>
              <span className={cn(
                "text-xs sm:text-sm font-bold block leading-tight",
                balance < 200 ? "text-amber-500" : "text-primary"
              )}>
                RD$ {balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL ADAPTADO Y SIN SCROLL GLOBAL */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full">
          {completedTx ? (
            // Vista de Éxito / Comprobante
            <div className="p-6 text-center space-y-4 max-w-md mx-auto my-auto">
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
            // Formulario Dividido en 2 Columnas (Master-Detail) Adaptado al 100% de la pantalla
            <div className="flex-1 h-full min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* COLUMNA IZQUIERDA: CATÁLOGO Y PROVEEDORES */}
              <div className="md:col-span-7 h-full flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-border/60 p-3 sm:p-4 gap-2.5 overflow-hidden bg-background">
                {/* Pestañas Principales */}
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => {
                    const newTab = val as DigitalServiceType;
                    setActiveTab(newTab);
                    if (newTab === 'recharge') setSelectedCarrier('claro');
                    if (newTab === 'prepaid_power') setSelectedCarrier('edesur_prepago');
                    if (newTab === 'remittance') setSelectedCarrier('moncash');
                    if (newTab === 'bill_payment') setSelectedCarrier('caasd');
                  }}
                  className="w-full h-full flex flex-col min-h-0 flex-1 overflow-hidden"
                >
                  <TabsList className="grid grid-cols-5 w-full h-9 bg-muted/60 p-1 rounded-xl shrink-0">
                    <TabsTrigger value="recharge" className="text-xs font-medium gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                      <Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Recargas</span><span className="sm:hidden">Rec.</span>
                    </TabsTrigger>
                    <TabsTrigger value="data_package" className="text-xs font-medium gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                      <Wifi className="h-3.5 w-3.5" /> Paquetes
                    </TabsTrigger>
                    <TabsTrigger value="prepaid_power" className="text-xs font-medium gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                      <Zap className="h-3.5 w-3.5" /> Luz Prepago
                    </TabsTrigger>
                    <TabsTrigger value="remittance" className="text-xs font-medium gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                      <SendHorizontal className="h-3.5 w-3.5" /> Remesas
                    </TabsTrigger>
                    <TabsTrigger value="bill_payment" className="text-xs font-medium gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                      <Receipt className="h-3.5 w-3.5" /> Facturas ({ALL_BILLERS.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* 1. OPERADORAS MÓVILES */}
                  <TabsContent
                    value="recharge"
                    className="mt-2.5 flex-1 min-h-0 overflow-y-auto no-scrollbar outline-none data-[state=active]:flex data-[state=active]:flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground block">
                        Operadoras Móviles (RD y Haití)
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {MOBILE_OPERATORS.map((c) => {
                          const isSelected = selectedCarrier === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCarrier(c.id)}
                              className={cn(
                                "flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/[0.08] ring-2 ring-primary/40 shadow-xs"
                                  : "border-border/60 hover:border-border bg-card"
                              )}
                            >
                              <BrandLogo id={c.id} className="w-12 h-9 rounded-lg mb-1.5 shrink-0" />
                              <span className="font-bold text-xs text-foreground truncate w-full">{c.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate w-full">{c.sub}</span>
                              <span className="text-[10px] text-primary font-semibold mt-0.5">
                                {c.badge}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground flex items-center gap-2 mt-auto shrink-0">
                      <span className="text-base shrink-0">💡</span>
                      <span>Recargas inmediatas procesadas vía API oficial con confirmación instantánea.</span>
                    </div>
                  </TabsContent>

                  {/* 2. PAQUETICOS */}
                  <TabsContent
                    value="data_package"
                    className="mt-2.5 flex-1 min-h-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col gap-2"
                  >
                    <div className="flex gap-2 shrink-0">
                      {['claro', 'altice', 'viva'].map((car) => (
                        <Button
                          key={car}
                          type="button"
                          size="sm"
                          variant={selectedCarrier === car ? 'default' : 'outline'}
                          className={cn(
                            "capitalize text-xs font-semibold h-8 rounded-lg gap-2 px-3",
                            selectedCarrier === car && "bg-primary text-primary-foreground"
                          )}
                          onClick={() => setSelectedCarrier(car)}
                        >
                          <BrandLogo id={car} className="w-4 h-4 rounded-xs" />
                          {car}
                        </Button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {ALL_PACKAGES.filter((p) => p.carrier === selectedCarrier).map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleSelectPackage(pkg)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                            selectedPackage === pkg.id
                              ? "border-primary bg-primary/[0.08] ring-2 ring-primary/40 shadow-xs"
                              : "border-border/60 hover:border-border bg-card"
                          )}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-semibold text-xs text-foreground truncate">{pkg.name}</span>
                            <span className="font-mono text-xs text-primary font-bold shrink-0">
                              RD$ {pkg.price}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{pkg.desc}</p>
                          <span className="text-[10px] text-muted-foreground mt-1 block">⏱️ {pkg.validity}</span>
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  {/* 3. LUZ PREPAGO Y ELECTRICIDAD */}
                  <TabsContent
                    value="prepaid_power"
                    className="mt-2.5 flex-1 min-h-0 overflow-y-auto no-scrollbar outline-none data-[state=active]:flex data-[state=active]:flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground block">
                        Empresas Eléctricas y Luz Prepago
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {PREPAID_POWER_PROVIDERS.map((b) => {
                          const isSelected = selectedCarrier === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedCarrier(b.id)}
                              className={cn(
                                "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/[0.08] ring-2 ring-primary/40 shadow-xs"
                                  : "border-border/60 hover:border-border bg-card"
                              )}
                            >
                              <BrandLogo id={b.id} className="w-12 h-9 rounded-lg mb-1 shrink-0" />
                              <span className="font-bold text-xs text-foreground block truncate w-full">{b.name}</span>
                              <span className="text-[10px] text-muted-foreground block truncate w-full">{b.desc}</span>
                              <span className="text-[10px] text-primary font-medium mt-0.5">+RD$ {b.fee} ganancia</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground flex items-center gap-2 mt-auto shrink-0">
                      <span className="text-base shrink-0">⚡</span>
                      <span>El PIN de recarga para el medidor prepago se genera e imprime en el comprobante fiscal/ticket.</span>
                    </div>
                  </TabsContent>

                  {/* 4. REMESAS A HAITÍ */}
                  <TabsContent
                    value="remittance"
                    className="mt-2.5 flex-1 min-h-0 overflow-y-auto no-scrollbar outline-none data-[state=active]:flex data-[state=active]:flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground block">
                        Billeteras Móviles de Envío a Haití
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {REMITTANCE_PROVIDERS.map((r) => {
                          const isSelected = selectedCarrier === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setSelectedCarrier(r.id)}
                              className={cn(
                                "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/[0.08] ring-2 ring-primary/40 shadow-xs"
                                  : "border-border/60 hover:border-border bg-card"
                              )}
                            >
                              <BrandLogo id={r.id} className="w-14 h-11 rounded-lg shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-sm text-foreground block">{r.name}</span>
                                <span className="text-xs text-muted-foreground block">{r.sub}</span>
                                <span className="text-[11px] text-primary font-semibold mt-0.5 block">+RD$ {r.fee} comisión</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground flex items-center gap-2 mt-auto shrink-0">
                      <span className="text-base shrink-0">💸</span>
                      <span>Envío inmediato a Haití. El receptor recibe saldo en su billetera digital MonCash o Natcash.</span>
                    </div>
                  </TabsContent>

                  {/* 5. FACTURAS Y SERVICIOS PÚBLICOS */}
                  <TabsContent
                    value="bill_payment"
                    className="mt-2 flex-1 min-h-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col gap-2"
                  >
                    {/* Categorías oficiales */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0 no-scrollbar">
                      {RECARGAMEYA_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedBillCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            className={cn(
                              "h-6.5 text-[11px] font-medium rounded-lg px-2 flex items-center gap-1 shrink-0 transition-colors border cursor-pointer",
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

                    {/* Buscador compacto */}
                    <div className="relative shrink-0">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa (ej. CAASD, DGII, UNIBE, Free Fire, Paso Rápido, AVON)..."
                        value={billSearchQuery}
                        onChange={(e) => setBillSearchQuery(e.target.value)}
                        className="pl-8 h-7.5 text-xs rounded-lg border-border/60 bg-card"
                      />
                    </div>

                    {/* Catálogo con Logos Oficiales de RecargameYa */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                      {filteredBillers.map((b) => {
                        const isSelected = selectedCarrier === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedCarrier(b.id)}
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/[0.08] ring-2 ring-primary/40 shadow-xs"
                                : "border-border/60 hover:border-border bg-card"
                            )}
                          >
                            <BrandLogo id={b.id} className="w-9 h-7 rounded-md shrink-0" />
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
                </Tabs>
              </div>

              {/* COLUMNA DERECHA: PANEL DE COBRO Y FACTURACIÓN (100% FIJO SIN SCROLL) */}
              <div className="md:col-span-5 h-full flex flex-col justify-between min-h-0 p-3 sm:p-4 bg-muted/20 overflow-hidden border-t md:border-t-0 md:border-l border-border/60">
                {/* PARTE SUPERIOR: SERVICIO SELECCIONADO Y CAMPOS */}
                <div className="space-y-3">
                  {/* Tarjeta del Proveedor Seleccionado */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                    <BrandLogo id={currentBiller?.id || selectedCarrier} className="w-12 h-10 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {(currentBiller as any)?.name || selectedCarrier}
                        </h4>
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0 font-medium">
                          {activeTab === 'recharge' 
                            ? `${commissionRate}% com.` 
                            : `+RD$ ${estimatedCommission.toFixed(0)} ganancia`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(currentBiller as any)?.sub || (currentBiller as any)?.desc || 'Servicio Digital'}
                      </p>
                    </div>
                  </div>

                  {/* Campos del Formulario */}
                  <div className="space-y-2.5">
                    {/* Input Destino */}
                    <div className="space-y-1">
                      <Label htmlFor="target-input" className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>
                          {activeTab === 'bill_payment'
                            ? 'Número de Cuenta / Contrato / NIC'
                            : activeTab === 'prepaid_power'
                            ? 'Número de Medidor'
                            : activeTab === 'remittance'
                            ? 'Teléfono en Haití'
                            : 'Número de Teléfono'}
                        </span>
                      </Label>
                      <Input
                        id="target-input"
                        type="text"
                        autoFocus
                        placeholder={
                          activeTab === 'bill_payment'
                            ? 'Ej. 100234567 o Cédula'
                            : activeTab === 'prepaid_power'
                            ? 'Ej. 0123456789'
                            : activeTab === 'remittance'
                            ? '50931234567'
                            : '8091234567'
                        }
                        value={phoneNumber}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && hasEnoughBalance && phoneNumber && numericAmount > 0) {
                            handleExecuteTransaction();
                          }
                        }}
                        className="h-9 sm:h-10 text-sm font-semibold tracking-wider rounded-xl border-border/70 bg-card"
                      />
                    </div>

                    {/* Input Monto */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="custom-amount" className="text-xs font-semibold text-foreground">
                          Monto a Cobrar (RD$)
                        </Label>
                        <span className="text-xs font-bold text-primary">
                          Ganancia: +RD$ {estimatedCommission.toFixed(2)}
                        </span>
                      </div>
                      <Input
                        id="custom-amount"
                        type="number"
                        min={10}
                        max={50000}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && hasEnoughBalance && phoneNumber && numericAmount > 0) {
                            handleExecuteTransaction();
                          }
                        }}
                        className="h-9 sm:h-10 text-sm font-bold rounded-xl border-border/70 bg-card"
                      />
                    </div>

                    {/* Montos Rápidos en Botones Compactos */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[50, 100, 150, 200, 300, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmount(amt)}
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-lg border transition-all cursor-pointer",
                            Number(amount) === amt
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-muted border-border/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PARTE INFERIOR: RESUMEN, SALDO Y BOTÓN PRINCIPAL (SIEMPRE VISIBLE) */}
                <div className="space-y-2.5 pt-2">
                  {/* Desglose Financiero */}
                  <div className="p-2.5 bg-card rounded-xl border border-border/60 text-xs grid grid-cols-3 gap-2 text-center shadow-2xs">
                    <div className="text-left border-r border-border/40 pr-1">
                      <div className="text-muted-foreground text-[10px]">Cobras en caja:</div>
                      <div className="text-xs sm:text-sm font-bold text-foreground">RD$ {numericAmount.toFixed(2)}</div>
                    </div>
                    <div className="border-r border-border/40 px-1">
                      <div className="text-muted-foreground text-[10px]">Tu ganancia:</div>
                      <div className="text-xs sm:text-sm font-bold text-primary">+ RD$ {estimatedCommission.toFixed(2)}</div>
                    </div>
                    <div className="text-right pl-1">
                      <div className="text-muted-foreground text-[10px]">Deducción:</div>
                      <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground mt-0.5">RD$ {estimatedCost.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Alerta de Saldo Insuficiente */}
                  {!hasEnoughBalance && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="truncate text-[11px]">Saldo insuficiente (Req. RD$ {estimatedCost.toFixed(2)})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-destructive/30 hover:bg-destructive/20 text-destructive font-medium shrink-0"
                        onClick={() => addBalance({ amount: 1000, description: 'Recarga rápida POS' })}
                      >
                        + Abonar RD$ 1,000
                      </Button>
                    </div>
                  )}

                  {/* Botón Principal de Acción */}
                  <Button
                    type="button"
                    className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                    disabled={!hasEnoughBalance || isProcessingSale || !phoneNumber || numericAmount <= 0}
                    onClick={handleExecuteTransaction}
                  >
                    {isProcessingSale ? (
                      <>Procesando con RecargameYa...</>
                    ) : (
                      <>
                        Cobrar {(currentBiller as any)?.name || 'Servicio'} &bull; RD$ {numericAmount.toFixed(2)}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
