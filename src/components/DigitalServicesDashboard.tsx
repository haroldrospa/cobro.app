import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Wallet,
  TrendingUp,
  Coins,
  ArrowDownToLine,
  Smartphone,
  Search,
  Printer,
  Calendar,
  AlertCircle,
  Building,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { useDigitalServices, useDigitalTransactions } from '@/hooks/useDigitalServices';
import { DigitalServicesPOSDialog } from '@/components/pos/DigitalServicesPOSDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const DigitalServicesDashboard: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');

  const { wallet, config, isLoadingWallet, refetchWallet, addBalance, isAddingBalance } = useDigitalServices();
  const { data: transactions = [], isLoading: isLoadingTx, refetch: refetchTx } = useDigitalTransactions({
    dateFilter: dateFilter,
    limit: 50
  });

  // Cálculos de KPIs del periodo
  const kpis = useMemo(() => {
    let totalGross = 0; // Lo recaudado en efectivo
    let totalCommission = 0; // Ganancia de la tienda
    let totalProviderCost = 0; // A pagar a CobroApp/Plataforma

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

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(topUpAmount);
    if (!val || val <= 0) return;
    await addBalance({ amount: val, description: 'Recarga de billetera desde panel de servicios' });
    setIsTopUpDialogOpen(false);
  };

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
            .highlight { color: #0284c7; }
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

          <div class="kpi-box" style="border: 2px solid #0284c7;">
            <div class="row font-bold text-xl highlight">
              <span>MONTO A PAGAR A COBROAPP:</span>
              <span>RD$ ${kpis.totalProviderCost.toFixed(2)}</span>
            </div>
            <p style="font-size: 11px; margin: 5px 0 0 0; color: #555;">
              * Este es el monto neto del costo del servicio que corresponde a la plataforma. El dinero restante de comisiones pertenece íntegramente a tu negocio.
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <span className="p-2 bg-primary/10 text-primary rounded-xl">
                <Smartphone className="h-7 w-7" />
              </span>
              Servicios Digitales & Recargas
            </h1>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-semibold">
              RecargameYa API
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Panel contable independiente: Venta de saldo, paqueticos, cobro de facturas y cuadres sin alterar tu inventario principal.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="gap-2 border-dashed"
            onClick={() => setIsTopUpDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4 text-emerald-600" />
            Recargar Billetera
          </Button>

          <Button
            className="gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg"
            onClick={() => setIsSellDialogOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Vender Recarga
          </Button>
        </div>
      </div>

      {/* 2. TARJETAS DE RENDIMIENTO & CUADRE FINANCIERO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Disponible */}
        <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saldo en Billetera
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              RD$ {Number(wallet?.balance || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {Number(wallet?.balance || 0) < 300 ? (
                <span className="text-amber-500 font-semibold">⚠️ Saldo bajo para ventas</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Disponible para recargas</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Recaudado (Venta Bruta) */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recaudado en Caja
            </CardTitle>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              RD$ {kpis.totalGross.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Efectivo cobrado a clientes ({kpis.count} transacciones)
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Ganancia Neta Limpia (Comisión Comercio) */}
        <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-card to-purple-500/5 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tu Ganancia (Comisión)
            </CardTitle>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <Coins className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              + RD$ {kpis.totalCommission.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium text-emerald-600 dark:text-emerald-400">
              Dinero 100% tuyo libre de costos
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Monto a Pagar a CobroApp / Plataforma */}
        <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-card to-amber-500/5 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              A Pagar a CobroApp
            </CardTitle>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Building className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              RD$ {kpis.totalProviderCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Costo de saldo que corresponde liquidar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. PESTAÑAS DE CONTENIDO */}
      <Tabs defaultValue="history" className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="history" className="rounded-lg text-xs sm:text-sm font-semibold">
              Historial de Ventas
            </TabsTrigger>
            <TabsTrigger value="settlement" className="rounded-lg text-xs sm:text-sm font-semibold">
              Cuadre & Liquidación a Plataforma
            </TabsTrigger>
            <TabsTrigger value="bank-info" className="rounded-lg text-xs sm:text-sm font-semibold">
              Cuentas para Recargar Saldo
            </TabsTrigger>
          </TabsList>

          {/* Filtros de Fecha */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Período:</span>
            <Button
              size="sm"
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              className="h-8 text-xs font-semibold"
              onClick={() => setDateFilter('today')}
            >
              Hoy
            </Button>
            <Button
              size="sm"
              variant={dateFilter === 'this_month' ? 'default' : 'outline'}
              className="h-8 text-xs font-semibold"
              onClick={() => setDateFilter('this_month')}
            >
              Este Mes
            </Button>
            <Button
              size="sm"
              variant={dateFilter === 'all' ? 'default' : 'outline'}
              className="h-8 text-xs font-semibold"
              onClick={() => setDateFilter('all')}
            >
              Todos
            </Button>
          </div>
        </div>

        {/* PESTAÑA: HISTORIAL */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Ventas de Servicios Realizadas</CardTitle>
                <CardDescription className="text-xs">
                  Mostrando {filteredTransactions.length} transacciones registradas
                </CardDescription>
              </div>

              {/* Buscador */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar teléfono o ref..."
                  className="pl-9 h-9 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b">
                    <tr>
                      <th className="p-3">Operador / Servicio</th>
                      <th className="p-3">Destino (Teléfono/NIC)</th>
                      <th className="p-3">Monto Cobrado</th>
                      <th className="p-3">Costo Plataforma</th>
                      <th className="p-3">Tu Ganancia</th>
                      <th className="p-3">Fecha & Hora</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No se encontraron transacciones en este período. ¡Realiza tu primera recarga desde el POS!
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-bold uppercase text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {tx.carrier}
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground">
                            {tx.target_number}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            RD$ {Number(tx.amount).toFixed(2)}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            RD$ {Number(tx.amount_charged).toFixed(2)}
                          </td>
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                            + RD$ {Number(tx.commission).toFixed(2)}
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Resumen de Cuadre de Servicios</CardTitle>
                <CardDescription>
                  Conciliación de dinero físico en caja versus dinero a liquidar a la plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/60 space-y-3 text-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Efectivo cobrado en caja por servicios:</span>
                    <span className="font-bold text-foreground text-base">RD$ {kpis.totalGross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold border-t pt-2">
                    <span>( - ) Tu comisión retenida (Tu ganancia limpia):</span>
                    <span className="text-base">- RD$ {kpis.totalCommission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 font-bold text-lg border-t pt-2">
                    <span>( = ) Monto neto a pagar a CobroApp:</span>
                    <span>RD$ {kpis.totalProviderCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handlePrintSettlementReport} variant="outline" className="gap-2">
                    <Printer className="h-4 w-4" />
                    Imprimir Comprobante de Cuadre
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta Explicativa */}
            <Card className="border bg-gradient-to-br from-blue-500/5 to-indigo-500/10">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  ¿Cómo funciona el pago?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3 leading-relaxed">
                <p>
                  1. Cada vez que vendes una recarga o pagas una factura, el cliente te entrega <strong>efectivo en mano</strong>.
                </p>
                <p>
                  2. Tu ganancia de comisión (ej. 6%) se queda <strong>de inmediato en tu bolsillo o gaveta de caja</strong>.
                </p>
                <p>
                  3. Para seguir vendiendo, solo debes mantener saldo en tu billetera transfiriendo el costo neto a las cuentas oficiales de CobroApp.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PESTAÑA: CUENTAS BANCARIAS PARA RECARGAR SALDO */}
        <TabsContent value="bank-info" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Datos Bancarios para Transferencias</CardTitle>
              <CardDescription>
                Transfiere a cualquiera de estas cuentas y tu saldo de recargas será acreditado de inmediato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="font-bold text-sm text-foreground">Banco BHD</div>
                  <div className="text-xs text-muted-foreground">Cuenta Corriente: <strong>123-456789-0</strong></div>
                  <div className="text-xs text-muted-foreground">Titular: <strong>CobroApp Dominicana SRL</strong></div>
                  <div className="text-xs text-muted-foreground">RNC: <strong>1-32-45678-9</strong></div>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="font-bold text-sm text-foreground">Banco Popular Dominicano</div>
                  <div className="text-xs text-muted-foreground">Cuenta Corriente: <strong>987-654321-0</strong></div>
                  <div className="text-xs text-muted-foreground">Titular: <strong>CobroApp Dominicana SRL</strong></div>
                  <div className="text-xs text-muted-foreground">RNC: <strong>1-32-45678-9</strong></div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-xl text-xs text-muted-foreground flex items-center justify-between">
                <span>¿Hiciste una transferencia? Notifícala directamente al soporte para activación en 2 minutos.</span>
                <Button size="sm" variant="secondary" onClick={() => window.open('https://wa.me/18090000000?text=Hola,%20acabo%20de%20realizar%20un%20deposito%20de%20saldo%20para%20recargas', '_blank')}>
                  Notificar por WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE VENTA RÁPIDA */}
      <DigitalServicesPOSDialog
        open={isSellDialogOpen}
        onOpenChange={setIsSellDialogOpen}
      />

      {/* DIÁLOGO DE RECARGA DE BILLETERA */}
      <Dialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Saldo a la Billetera</DialogTitle>
            <DialogDescription>
              Abona saldo a tu billetera de servicios para continuar vendiendo recargas a tus clientes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUpSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Monto a Acreditar (RD$)</Label>
              <Input
                type="number"
                min={100}
                step={100}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="h-11 text-lg font-bold"
                required
              />
            </div>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 font-semibold text-xs"
                  onClick={() => setTopUpAmount(val.toString())}
                >
                  ${val}
                </Button>
              ))}
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-bold text-white bg-emerald-600 hover:bg-emerald-700"
              disabled={isAddingBalance}
            >
              {isAddingBalance ? 'Acreditando...' : 'Confirmar Saldo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalServicesDashboard;
