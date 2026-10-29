import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Wallet,
  Coins,
  ArrowDownToLine,
  Smartphone,
  Search,
  Printer,
  Building,
  PlusCircle,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Activity,
  Eye,
  EyeOff,
  Server,
  Clock
} from 'lucide-react';
import { useDigitalServices, useDigitalTransactions } from '@/hooks/useDigitalServices';
import { useOfficialBankAccounts } from '@/hooks/useOfficialBankAccounts';
import { DigitalServicesPOSDialog } from '@/components/pos/DigitalServicesPOSDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BrandLogo } from '@/components/pos/BrandLogo';
import { CommissionRatesGrid } from '@/components/digital-services/CommissionRatesGrid';
import { BankTransferTopUpDialog } from '@/components/digital-services/BankTransferTopUpDialog';
import { TopupRequestsApprovalList } from '@/components/digital-services/TopupRequestsApprovalList';

export const DigitalServicesDashboard: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');

  const {
    wallet,
    config,
    isLoadingWallet,
    addBalance,
    isAddingBalance,
    updateApiConfig,
    isUpdatingConfig,
    checkHealth
  } = useDigitalServices();

  const { activeAccounts: officialAccounts } = useOfficialBankAccounts();

  // Estados para Configuración de Credenciales API RecargameYa
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiEnv, setApiEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://recargameya.com/api/v1/public');
  const [showSecret, setShowSecret] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.api_key) setApiKey(config.api_key);
      if (config.api_secret) setApiSecret(config.api_secret);
      if (config.api_environment) setApiEnv(config.api_environment);
      if (config.api_base_url) setApiBaseUrl(config.api_base_url);
    }
  }, [config]);

  const handleTestApiConnection = async () => {
    setIsTestingHealth(true);
    setHealthStatus(null);
    try {
      const res = await checkHealth();
      setHealthStatus(res);
    } catch (err: any) {
      setHealthStatus({ ok: false, error: err.message || 'Error al conectar' });
    } finally {
      setIsTestingHealth(false);
    }
  };

  const handleSaveApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateApiConfig({
      apiKey,
      apiSecret,
      environment: apiEnv,
      baseUrl: apiBaseUrl,
    });
  };

  const { data: transactions = [], isLoading: isLoadingTx } = useDigitalTransactions({
    dateFilter: dateFilter,
    limit: 50
  });

  // Cálculos de KPIs del periodo
  const kpis = useMemo(() => {
    let totalGross = 0;
    let totalCommission = 0;
    let totalProviderCost = 0;

    transactions.forEach(tx => {
      if (tx.status === 'completed') {
        totalGross += Number(tx.amount || 0);
        totalCommission += Number(tx.commission || 0);
        totalProviderCost += Number(tx.amount_charged || 0);
      }
    });

    return {
      totalGross,
      totalCommission,
      totalProviderCost,
      count: transactions.length
    };
  }, [transactions]);

  // Filtro de búsqueda en vivo
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter(tx =>
      tx.target_number.toLowerCase().includes(term) ||
      tx.carrier.toLowerCase().includes(term) ||
      tx.client_reference_id.toLowerCase().includes(term)
    );
  }, [transactions, searchTerm]);

  const handlePrintSettlementReport = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Cuadre de Servicios Digitales</title>
          <style>
            body { font-family: sans-serif; font-size: 13px; margin: 20px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .kpi-box { background: #f4f4f5; padding: 10px; border-radius: 6px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 18px; }
            .divider { border-top: 1px dashed #999; margin: 12px 0; }
            .profit { color: #16a34a; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">REPORTE DE CUADRE: SERVICIOS DIGITALES</h2>
            <p style="margin: 4px 0; color: #666;">CobroApp &bull; Plataforma de Recargas</p>
            <small>Generado: ${new Date().toLocaleString()}</small>
          </div>

          <div class="kpi-box">
            <div class="row"><span>Período:</span><span class="font-bold">${dateFilter.toUpperCase()}</span></div>
            <div class="row"><span>Total Transacciones:</span><span class="font-bold">${kpis.count}</span></div>
          </div>

          <div class="divider"></div>

          <div class="row text-xl">
            <span>TOTAL RECAUDADO EN CAJA:</span>
            <span class="font-bold">RD$ ${kpis.totalGross.toFixed(2)}</span>
          </div>

          <div class="row profit text-xl">
            <span>GANANCIA COMERCIO (COMISIÓN):</span>
            <span>+ RD$ ${kpis.totalCommission.toFixed(2)}</span>
          </div>

          <div class="divider"></div>

          <div class="kpi-box" style="border: 1px solid #16a34a;">
            <div class="row font-bold text-xl">
              <span>MONTO A PAGAR A COBROAPP:</span>
              <span>RD$ ${kpis.totalProviderCost.toFixed(2)}</span>
            </div>
            <p style="font-size: 11px; margin: 5px 0 0 0; color: #555;">
              * Costo neto que corresponde a la plataforma. El dinero restante de comisiones pertenece íntegramente a tu negocio.
            </p>
          </div>

          <div class="divider"></div>
          <div style="text-align: center; font-size: 11px; color: #777; margin-top: 25px;">
            Firma Cajero: __________________________ &nbsp;&nbsp;&nbsp; Firma Administrador: __________________________
          </div>
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

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* 1. CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Servicios Digitales & Recargas
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground font-normal">
                  RecargameYa
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Panel contable independiente: Venta de saldo, comisiones y liquidación a CobroApp
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 rounded-xl border-border/60"
            onClick={() => setIsTopUpDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4 text-primary" />
            Recargar Billetera
          </Button>

          <Button
            size="sm"
            className="gap-1.5 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            onClick={() => setIsSellDialogOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Vender Recarga
          </Button>
        </div>
      </div>

      {/* 2. TARJETAS DE RENDIMIENTO & CUADRE FINANCIERO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Saldo Disponible */}
        <Card className="border border-border/60 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Saldo en Billetera
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              RD$ {Number(wallet?.balance || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(wallet?.balance || 0) < 300 ? (
                <span className="text-amber-500 font-medium">⚠️ Saldo bajo</span>
              ) : (
                <span className="text-primary font-medium">✓ Saldo activo</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Recaudado (Venta Bruta) */}
        <Card className="border border-border/60 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recaudado en Caja
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
              <ArrowDownToLine className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              RD$ {kpis.totalGross.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Efectivo cobrado ({kpis.count} transacciones)
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Ganancia Neta Limpia (Comisión Comercio) */}
        <Card className="border border-primary/30 bg-primary/[0.03] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">
              Tu Ganancia Limpia
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Coins className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              + RD$ {kpis.totalCommission.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comisión 100% tuya
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Monto a Pagar a CobroApp / Plataforma */}
        <Card className="border border-border/60 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              A Pagar a CobroApp
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <Building className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              RD$ {kpis.totalProviderCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Costo de servicios a liquidar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. PESTAÑAS DE CONTENIDO */}
      <Tabs defaultValue="history" className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="history" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
              Historial de Ventas
            </TabsTrigger>
            <TabsTrigger value="topup-requests" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" /> Recargas & Aprobación
            </TabsTrigger>
            <TabsTrigger value="settlement" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
              Cuadre & Liquidación
            </TabsTrigger>
            <TabsTrigger value="commissions" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1.5 text-primary">
              <Coins className="h-3.5 w-3.5" /> % de Ganancias
            </TabsTrigger>
            <TabsTrigger value="api-config" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-primary" /> API RecargameYa
            </TabsTrigger>
            <TabsTrigger value="bank-info" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
              Cuentas Bancarias
            </TabsTrigger>
          </TabsList>

          {/* Filtros de Fecha */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">Período:</span>
            <Button
              size="sm"
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              className="h-8 text-xs font-medium rounded-lg"
              onClick={() => setDateFilter('today')}
            >
              Hoy
            </Button>
            <Button
              size="sm"
              variant={dateFilter === 'this_month' ? 'default' : 'outline'}
              className="h-8 text-xs font-medium rounded-lg"
              onClick={() => setDateFilter('this_month')}
            >
              Este Mes
            </Button>
            <Button
              size="sm"
              variant={dateFilter === 'all' ? 'default' : 'outline'}
              className="h-8 text-xs font-medium rounded-lg"
              onClick={() => setDateFilter('all')}
            >
              Todos
            </Button>
          </div>
        </div>

        {/* PESTAÑA: HISTORIAL */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Ventas de Servicios Realizadas</CardTitle>
                <CardDescription className="text-xs">
                  {filteredTransactions.length} transacciones registradas
                </CardDescription>
              </div>

              {/* Buscador */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar teléfono o ref..."
                  className="pl-8 h-8 text-xs rounded-lg border-border/60 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/60">
                    <tr>
                      <th className="p-3">Servicio</th>
                      <th className="p-3">Destino (Teléfono/NIC)</th>
                      <th className="p-3">Monto Cobrado</th>
                      <th className="p-3">Costo Plataforma</th>
                      <th className="p-3">Tu Ganancia</th>
                      <th className="p-3">Fecha & Hora</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No se encontraron transacciones en este período. ¡Realiza tu primera recarga desde el POS!
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                            <BrandLogo id={tx.carrier} className="w-6 h-6 rounded-md shrink-0" />
                            <span className="capitalize">{tx.carrier.replace('_', ' ')}</span>
                          </td>
                          <td className="p-3 font-mono font-medium text-foreground">
                            {tx.target_number}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            RD$ {Number(tx.amount).toFixed(2)}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            RD$ {Number(tx.amount_charged).toFixed(2)}
                          </td>
                          <td className="p-3 font-semibold text-primary">
                            + RD$ {Number(tx.commission).toFixed(2)}
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
                              Completado
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-[10px] text-muted-foreground">
                            {tx.client_reference_id}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA: CUADRE & LIQUIDACIÓN */}
        <TabsContent value="settlement" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="md:col-span-2 border border-border/60 bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Resumen de Cuadre de Servicios</CardTitle>
                <CardDescription className="text-xs">
                  Conciliación de dinero físico en caja versus dinero a liquidar a la plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Efectivo cobrado en caja:</span>
                    <span className="font-bold text-foreground text-sm">RD$ {kpis.totalGross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-primary font-medium border-t border-border/40 pt-2">
                    <span>( - ) Tu comisión limpia (Ganancia comercio):</span>
                    <span className="text-sm">- RD$ {kpis.totalCommission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-foreground font-bold text-base border-t border-border/40 pt-2">
                    <span>( = ) Monto neto a pagar a CobroApp:</span>
                    <span>RD$ {kpis.totalProviderCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <Button onClick={handlePrintSettlementReport} variant="outline" size="sm" className="gap-1.5 h-9 rounded-xl border-border/60">
                    <Printer className="h-4 w-4" />
                    Imprimir Comprobante de Cuadre
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta Explicativa */}
            <Card className="border border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  ¿Cómo funciona el cuadre?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2.5 leading-relaxed">
                <p>
                  1. Al cobrar una recarga o factura, recibes <strong>efectivo en mano</strong> de tu cliente.
                </p>
                <p>
                  2. Tu comisión ganada se queda <strong>en tu gaveta o cuenta</strong>.
                </p>
                <p>
                  3. Para continuar vendiendo sin interrupciones, mantén saldo en tu billetera transfiriendo el costo neto a las cuentas oficiales de CobroApp.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PESTAÑA: TABLA OFICIAL DE COMISIONES Y GANANCIAS */}
        <TabsContent value="commissions" className="space-y-4">
          <CommissionRatesGrid />
        </TabsContent>

        {/* PESTAÑA: SOLICITUDES Y APROBACIÓN DE RECARGAS */}
        <TabsContent value="topup-requests" className="space-y-4">
          <Card className="border border-border/60 bg-card shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  Solicitudes y Aprobación de Recargas
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Depósitos bancarios reportados por comercios pendientes de verificación y activación.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setIsTopUpDialogOpen(true)}
                className="h-9 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5 cursor-pointer shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
                Reportar Transferencia
              </Button>
            </CardHeader>
            <CardContent>
              <TopupRequestsApprovalList />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA: CUENTAS BANCARIAS */}
        <TabsContent value="bank-info" className="space-y-4">
          <Card className="border border-border/60 bg-card shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building className="h-4.5 w-4.5 text-primary" />
                  Cuentas Bancarias Oficiales de CobroApp
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Realiza tu depósito o transferencia bancaria y luego envía el comprobante para activar tu saldo.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setIsTopUpDialogOpen(true)}
                className="h-9 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5 cursor-pointer shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
                Reportar Transferencia
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {officialAccounts.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{b.bank}</span>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary font-medium">
                        {b.badge || 'Oficial'}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{b.accountType}</div>
                      <div className="text-sm font-mono font-bold text-primary mt-0.5">{b.accountNumber}</div>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/40 space-y-0.5">
                      <div>Titular: <strong className="text-foreground">{b.holder}</strong></div>
                      <div>Cédula / RNC: <strong className="text-foreground">{b.taxId}</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-muted/40 p-3.5 rounded-xl text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 border border-border/60">
                <span>¿Tienes dudas con tu depósito? Comunícate directamente con soporte para confirmación inmediata.</span>
                <Button size="sm" variant="outline" className="border-border/60 h-8 shrink-0" onClick={() => window.open('https://wa.me/18090000000?text=Hola,%20acabo%20de%20realizar%20un%20deposito%20de%20saldo%20para%20recargas', '_blank')}>
                  WhatsApp Soporte
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA: CONFIGURACIÓN OFICIAL API RECARGAMEYA */}
        <TabsContent value="api-config" className="space-y-4">
          <Card className="border border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Server className="h-4.5 w-4.5 text-primary" />
                    Conexión API Oficial RecargameYa
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configuración de llaves públicas y privadas con firma criptográfica HMAC-SHA256 (v1).
                  </CardDescription>
                </div>
                <Badge
                  variant={apiKey && apiSecret ? 'default' : 'outline'}
                  className={apiKey && apiSecret ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground'}
                >
                  {apiKey && apiSecret
                    ? (apiEnv === 'production' ? '● En Vivo (Producción)' : '● Conectado (Sandbox)')
                    : '○ Modo Simulado Local'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Panel de Estado / Conectividad */}
              {healthStatus && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  healthStatus.ok
                    ? 'bg-primary/10 border-primary/20 text-foreground'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}>
                  {healthStatus.ok ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="font-bold">
                      {healthStatus.ok ? '¡Conexión Exitosa con RecargameYa!' : 'Fallo en la prueba de conexión'}
                    </div>
                    <div className="text-[11px] opacity-90">
                      {healthStatus.error || healthStatus.data?.message || (
                        healthStatus.data?.balance !== undefined
                          ? `Balance en cuenta API: RD$ ${Number(healthStatus.data.balance).toFixed(2)} (${healthStatus.data.currency || 'DOP'})`
                          : 'Servidor respondiendo correctamente (200 OK).'
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveApiConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Public Key */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Public Key (pk_*)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Header X-API-Key</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="pk_live_... o pk_sandbox_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-10 text-xs font-mono rounded-xl bg-card border-border/70"
                    />
                  </div>

                  {/* Secret Key */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Secret Key (sk_*)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Para firma HMAC-SHA256</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        placeholder="sk_live_... o sk_sandbox_..."
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        className="h-10 text-xs font-mono rounded-xl bg-card border-border/70 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Entorno */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Modo de Entorno
                    </Label>
                    <select
                      value={apiEnv}
                      onChange={(e) => setApiEnv(e.target.value as 'sandbox' | 'production')}
                      className="w-full h-10 px-3 text-xs rounded-xl bg-card border border-border/70 text-foreground font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
                    >
                      <option value="sandbox">Sandbox / Modo de Pruebas (pk_sandbox_ / sk_sandbox_)</option>
                      <option value="production">Producción / En Vivo (pk_live_ / sk_live_)</option>
                    </select>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Base URL del Endpoint
                    </Label>
                    <Input
                      type="text"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                      className="h-10 text-xs font-mono rounded-xl bg-card border-border/70"
                    />
                  </div>
                </div>

                {/* Callout de Seguridad y Reparto 50/50 */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    Criptografía y División de Ingresos 50/50
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Las firmas criptográficas se computan en Supabase Edge Functions mediante el estándar 
                    <code>&lt;timestamp&gt;\n&lt;HTTP_METHOD&gt;\n&lt;path&gt;\n&lt;sha256(body)&gt;</code> con formato LF. 
                    El sistema aplica automáticamente la división del 50% de beneficio al comerciante y el 50% a la plataforma, garantizando que el punto de venta solo exponga el margen asignado al comercio.
                  </p>
                </div>

                {/* Botones de Acción */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestApiConnection}
                    disabled={isTestingHealth}
                    className="h-9 text-xs font-medium rounded-xl gap-1.5"
                  >
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    {isTestingHealth ? 'Comprobando...' : 'Probar Conectividad (/health)'}
                  </Button>

                  <Button
                    type="submit"
                    disabled={isUpdatingConfig}
                    className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    {isUpdatingConfig ? 'Guardando...' : 'Guardar Credenciales'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE VENTA RÁPIDA */}
      <DigitalServicesPOSDialog
        open={isSellDialogOpen}
        onOpenChange={setIsSellDialogOpen}
      />

      {/* DIÁLOGO DE RECARGA DE BILLETERA VÍA TRANSFERENCIA */}
      <BankTransferTopUpDialog
        open={isTopUpDialogOpen}
        onOpenChange={setIsTopUpDialogOpen}
        defaultAmount={Number(topUpAmount) || 1000}
      />
    </div>
  );
};

export default DigitalServicesDashboard;
