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
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Wallet,
  Coins
} from 'lucide-react';
import { useDigitalServices } from '@/hooks/useDigitalServices';
import { DigitalServiceType, CarrierType } from '@/types/digitalServices';
import { cn } from '@/lib/utils';
import { sendEvolutionWhatsAppMessage } from '@/utils/evolutionApi';
import { useStoreSettings } from '@/hooks/useStoreSettings';

interface DigitalServicesPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CARRIERS = [
  { id: 'claro', name: 'Claro', color: 'bg-red-600 text-white hover:bg-red-700 border-red-500', badge: '6% com.' },
  { id: 'altice', name: 'Altice', color: 'bg-sky-600 text-white hover:bg-sky-700 border-sky-500', badge: '5% com.' },
  { id: 'viva', name: 'Viva', color: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500', badge: '7% com.' },
];

const BILLERS = [
  { id: 'edesur', name: 'Edesur Dominicana', color: 'bg-amber-600 text-white', category: 'Electricidad' },
  { id: 'edeeste', name: 'Edeeste', color: 'bg-orange-600 text-white', category: 'Electricidad' },
  { id: 'edenorte', name: 'Edenorte', color: 'bg-blue-600 text-white', category: 'Electricidad' },
  { id: 'caasd', name: 'CAASD (Agua)', color: 'bg-cyan-600 text-white', category: 'Agua' },
  { id: 'coraasan', name: 'Coraasan', color: 'bg-teal-600 text-white', category: 'Agua' },
];

const QUICK_AMOUNTS = [50, 100, 150, 200, 300, 500, 1000];

const SAMPLE_PACKAGES = [
  { id: 'claro-1d', carrier: 'claro', name: '1 Día Ilimitado', price: 50, validity: '24 horas', desc: 'Internet Libre + Minutos' },
  { id: 'claro-3d', carrier: 'claro', name: '3 Días Ilimitado', price: 100, validity: '3 días', desc: 'Internet Libre + WhatsApp' },
  { id: 'claro-5d', carrier: 'claro', name: '5 Días Ilimitado', price: 150, validity: '5 días', desc: 'Internet Libre + Redes' },
  { id: 'altice-1d', carrier: 'altice', name: 'Paquete 1 Día', price: 50, validity: '24 horas', desc: 'Datos ilimitados Altice' },
  { id: 'altice-3d', carrier: 'altice', name: 'Paquete 3 Días', price: 95, validity: '3 días', desc: 'Datos + Minutos' },
  { id: 'viva-1d', carrier: 'viva', name: 'Viva Ta Nítido 1D', price: 40, validity: '24 horas', desc: 'Internet + Llamadas' },
];

export const DigitalServicesPOSDialog: React.FC<DigitalServicesPOSDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { wallet, config, processSale, isProcessingSale, addBalance } = useDigitalServices();
  const { data: storeSettings } = useStoreSettings();

  const [activeTab, setActiveTab] = useState<DigitalServiceType>('recharge');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('claro');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [targetName, setTargetName] = useState('');
  const [amount, setAmount] = useState<number | string>(100);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<any | null>(null);

  const balance = Number(wallet?.balance || 0);
  const commissionRate = wallet?.custom_commission_rate ?? config?.default_recharge_commission_rate ?? 6.0;

  // Cálculo de ganancia y costo en vivo
  const numericAmount = Number(amount) || 0;
  const estimatedCommission = useMemo(() => {
    if (activeTab === 'bill_payment') {
      return Number(config?.default_bill_fixed_commission || 15.0);
    }
    return Math.round((numericAmount * (commissionRate / 100)) * 100) / 100;
  }, [numericAmount, commissionRate, activeTab, config]);

  const estimatedCost = useMemo(() => {
    if (activeTab === 'bill_payment') return numericAmount;
    return Math.max(0, numericAmount - estimatedCommission);
  }, [numericAmount, estimatedCommission, activeTab]);

  const hasEnoughBalance = balance >= estimatedCost;

  // Formato para teléfono (809, 829, 849)
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(raw);
  };

  const handleSelectPackage = (pkg: typeof SAMPLE_PACKAGES[0]) => {
    setSelectedPackage(pkg.id);
    setSelectedCarrier(pkg.carrier);
    setAmount(pkg.price);
  };

  const handleExecuteTransaction = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Por favor ingrese un número de teléfono o contrato de 10 dígitos.');
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
    const printWindow = window.open('', '_blank', 'width=380,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Recarga</title>
          <style>
            body { font-family: monospace; font-size: 13px; margin: 10px; color: #000; }
            .text-center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .font-bold { font-weight: bold; }
            .big { font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold big">${storeSettings?.store_name || 'COBROAPP POS'}</div>
          <div class="text-center">COMPROBANTE DE RECARGA</div>
          <div class="divider"></div>
          <div class="row"><span>Fecha:</span><span>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span></div>
          <div class="row"><span>Transacción:</span><span>${completedTx.id || completedTx.transaction_id}</span></div>
          <div class="row"><span>Operador:</span><span class="font-bold">${completedTx.carrier?.toUpperCase()}</span></div>
          <div class="row"><span>Número:</span><span class="font-bold big">${completedTx.target_number}</span></div>
          <div class="divider"></div>
          <div class="row font-bold big"><span>MONTO TOTAL:</span><span>RD$ ${Number(completedTx.amount).toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="text-center font-bold">¡Recarga aplicada exitosamente!</div>
          <div class="text-center" style="margin-top: 10px; font-size: 10px;">Gracias por su compra</div>
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
    const msg = `🧾 *COMPROBANTE DE RECARGA*\n` +
      `*Comercio:* ${storeSettings?.store_name || 'CobroApp'}\n` +
      `*Operador:* ${completedTx.carrier?.toUpperCase()}\n` +
      `*Número:* ${completedTx.target_number}\n` +
      `*Monto:* RD$ ${Number(completedTx.amount).toFixed(2)}\n` +
      `*Ref:* ${completedTx.id || completedTx.client_reference_id}\n` +
      `*Fecha:* ${new Date().toLocaleString()}\n\n` +
      `¡Gracias por su preferencia! ✨`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/1${phoneNumber}?text=${encoded}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border shadow-2xl">
        {/* Cabecera estilizada con Badge de Saldo de Billetera */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  Recargas y Servicios Digitales
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                    RecargameYa API
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Venta inmediata de saldo, paqueticos y cobro de facturas
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

        {/* CONTENIDO PRINCIPAL */}
        {completedTx ? (
          // Vista de Éxito / Comprobante
          <div className="p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-10 w-10 animate-in zoom-in-75 duration-300" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-foreground">¡Transacción Completada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Se ha acreditado la recarga a <strong className="text-foreground">{completedTx.target_number}</strong> con éxito.
              </p>
            </div>

            {/* Tarjeta de Ganancia y Detalles */}
            <Card className="bg-muted/40 border-dashed">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Operador:</span>
                  <span className="font-semibold text-foreground uppercase">{completedTx.carrier}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Monto cobrado al cliente:</span>
                  <span className="font-bold text-foreground text-base">RD$ {Number(completedTx.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t">
                  <span className="flex items-center gap-1">
                    <Coins className="h-4 w-4" /> Tu ganancia neta (Comisión):
                  </span>
                  <span className="font-bold text-base">+ RD$ {Number(completedTx.commission).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <span>Deducido de tu saldo de CobroApp:</span>
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
          // Vista de Venta Normal
          <div className="p-6 space-y-5">
            {/* Pestañas de Servicio */}
            <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val as DigitalServiceType); }} className="w-full">
              <TabsList className="grid grid-cols-4 w-full h-11 bg-muted/80">
                <TabsTrigger value="recharge" className="text-xs sm:text-sm font-medium gap-1.5">
                  <Smartphone className="h-4 w-4" /> Recargas
                </TabsTrigger>
                <TabsTrigger value="data_package" className="text-xs sm:text-sm font-medium gap-1.5">
                  <Wifi className="h-4 w-4" /> Paqueticos
                </TabsTrigger>
                <TabsTrigger value="bill_payment" className="text-xs sm:text-sm font-medium gap-1.5">
                  <Receipt className="h-4 w-4" /> Facturas
                </TabsTrigger>
                <TabsTrigger value="prepaid_power" className="text-xs sm:text-sm font-medium gap-1.5">
                  <Zap className="h-4 w-4" /> Luz Prepago
                </TabsTrigger>
              </TabsList>

              {/* 1. SELECCIÓN DE OPERADOR / EMPRESA */}
              <div className="mt-4 space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {activeTab === 'bill_payment' ? 'Seleccionar Empresa / Servicio' : 'Seleccionar Operador'}
                </Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(activeTab === 'bill_payment' ? BILLERS.slice(0, 3) : CARRIERS).map((c) => {
                    const isSelected = selectedCarrier === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCarrier(c.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-center relative",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20 scale-[1.02]"
                            : "border-border hover:border-primary/40 bg-card hover:bg-muted/30"
                        )}
                      >
                        <span className="font-bold text-sm text-foreground">{c.name}</span>
                        {'badge' in c && (
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 bg-muted border-primary/20 text-primary">
                            {c.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. NÚMERO DE TELÉFONO O CONTRATO */}
              <div className="mt-4 space-y-2">
                <Label htmlFor="phone-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {activeTab === 'bill_payment' ? 'Número de Contrato / NIC' : activeTab === 'prepaid_power' ? 'Número de Medidor' : 'Número de Teléfono'}
                </Label>
                <div className="relative">
                  <Input
                    id="phone-input"
                    type="tel"
                    placeholder={activeTab === 'bill_payment' ? "Ej. 100234567" : "8091234567 o (809) 123-4567"}
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="h-12 text-lg font-bold tracking-wider pl-4 rounded-xl border-2"
                    maxLength={10}
                  />
                  {phoneNumber.length === 10 && (
                    <span className="absolute right-3 top-3 text-xs bg-emerald-500/20 text-emerald-600 font-semibold px-2 py-0.5 rounded-md">
                      Válido ✓
                    </span>
                  )}
                </div>
              </div>

              {/* 3. CONTENIDO SEGÚN LA PESTAÑA */}
              <TabsContent value="recharge" className="mt-3 space-y-4">
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
                        className={cn(
                          "h-10 font-bold rounded-lg text-sm",
                          Number(amount) === amt && "shadow-md"
                        )}
                        onClick={() => setAmount(amt)}
                      >
                        ${amt}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-1/2">
                    <Label htmlFor="custom-amount" className="text-xs text-muted-foreground">Monto Personalizado (RD$)</Label>
                    <Input
                      id="custom-amount"
                      type="number"
                      min={10}
                      max={10000}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 text-base font-semibold"
                    />
                  </div>
                  <div className="w-1/2 bg-muted/60 p-2.5 rounded-xl border text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tu comisión ({commissionRate}%):</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+ RD$ {estimatedCommission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Costo de tu saldo:</span>
                      <span className="font-semibold text-foreground">RD$ {estimatedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Pestaña Paqueticos */}
              <TabsContent value="data_package" className="mt-3 space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Paquetes Disponibles para {selectedCarrier.toUpperCase()}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {SAMPLE_PACKAGES.filter(p => p.carrier === selectedCarrier).map((pkg) => (
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
                        <Badge variant="secondary" className="font-mono text-[10px] bg-primary/10 text-primary">
                          RD$ {pkg.price}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{pkg.desc}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Pestaña Facturas & Luz Prepago */}
              <TabsContent value="bill_payment" className="mt-3 space-y-3">
                <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                  💡 <strong>Pago de Servicios:</strong> Se aplicará una tarifa de comisión por gestión de <strong>RD$ {config?.default_bill_fixed_commission || 15}.00</strong> que te queda íntegra como ganancia.
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monto de la Factura (RD$)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Monto a pagar"
                    className="h-10 text-base font-semibold"
                  />
                </div>
              </TabsContent>

              <TabsContent value="prepaid_power" className="mt-3 space-y-3">
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  ⚡ <strong>Luz Prepago:</strong> El PIN de recarga se emitirá automáticamente en el comprobante impreso y por WhatsApp.
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monto a Recargar (RD$)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="RD$ 100 mínimo"
                    className="h-10 text-base font-semibold"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* AVISO DE SALDO INSUFICIENTE */}
            {!hasEnoughBalance && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Saldo insuficiente en tu billetera (Requieres RD$ {estimatedCost.toFixed(2)}).</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive"
                  onClick={() => addBalance({ amount: 1000, description: 'Recarga rápida de prueba POS' })}
                >
                  + Recargar Saldo
                </Button>
              </div>
            )}

            {/* BOTÓN DE ACCIÓN FINAL */}
            <div className="pt-2">
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
                    Vender Recarga RD$ {numericAmount.toFixed(2)}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
