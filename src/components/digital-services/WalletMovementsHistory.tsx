import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  RefreshCw,
  Clock,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { useDigitalServices, useDigitalWalletMovements } from '@/hooks/useDigitalServices';
import { Input } from '@/components/ui/input';

interface WalletMovementsHistoryProps {
  storeId?: string;
  limit?: number;
  showHeaderSummary?: boolean;
}

export const WalletMovementsHistory: React.FC<WalletMovementsHistoryProps> = ({
  storeId,
  limit = 50,
  showHeaderSummary = true,
}) => {
  const { wallet, isLoadingWallet, refetchWallet } = useDigitalServices();
  const {
    data: movements = [],
    isLoading: isLoadingMovements,
    refetch: refetchMovements,
    isRefetching,
  } = useDigitalWalletMovements({ limit, storeId });

  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'service_sale'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const currentBalance = Number(wallet?.balance || 0);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const descMatch = m.description?.toLowerCase().includes(term);
        const refMatch = m.reference_id?.toLowerCase().includes(term);
        return descMatch || refMatch;
      }
      return true;
    });
  }, [movements, typeFilter, searchTerm]);

  // Totales
  const stats = useMemo(() => {
    let totalDeposits = 0;
    let totalSales = 0;

    movements.forEach((m) => {
      const amt = Number(m.amount || 0);
      if (m.type === 'deposit' || amt > 0) {
        totalDeposits += Math.abs(amt);
      } else if (m.type === 'service_sale' || amt < 0) {
        totalSales += Math.abs(amt);
      }
    });

    return {
      totalDeposits,
      totalSales,
      count: movements.length,
    };
  }, [movements]);

  const handleRefresh = async () => {
    await Promise.all([refetchWallet(), refetchMovements()]);
  };

  return (
    <div className="space-y-4">
      {/* 1. Resumen de Saldo y Totales */}
      {showHeaderSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border border-primary/30 bg-primary/[0.04] p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Saldo Actual Disponible
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground">
              RD$ {currentBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Listo para vender recargas y pagar servicios
            </p>
          </Card>

          <Card className="border border-border/60 bg-card p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Recargas Aprobadas
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              RD$ {stats.totalDeposits.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Saldo total acreditado a tu billetera
            </p>
          </Card>

          <Card className="border border-border/60 bg-card p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Consumido en Ventas
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground">
              RD$ {stats.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Costo deducido por recargas emitidas
            </p>
          </Card>
        </div>
      )}

      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Button
            size="sm"
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl"
            onClick={() => setTypeFilter('all')}
          >
            Todos ({movements.length})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'deposit' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl gap-1"
            onClick={() => setTypeFilter('deposit')}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
            Recargas / Depósitos
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'service_sale' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl gap-1"
            onClick={() => setTypeFilter('service_sale')}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-500" />
            Ventas de Servicios
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar ref o detalle..."
              className="pl-8 h-8 text-xs rounded-xl border-border/60 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-xl border-border/60"
            onClick={handleRefresh}
            disabled={isLoadingMovements || isRefetching}
            title="Actualizar movimientos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 3. Lista de Movimientos */}
      <Card className="border border-border/60 bg-card shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Historial de Movimientos de Saldo
            </CardTitle>
            <CardDescription className="text-xs">
              Registro cronológico de entradas y salidas de saldo en tu billetera
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {filteredMovements.length} movimientos
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingMovements ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando movimientos...
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="font-semibold text-sm text-foreground">No hay movimientos registrados</p>
              <p className="text-xs max-w-sm mx-auto">
                {typeFilter !== 'all'
                  ? 'No hay movimientos para el filtro seleccionado.'
                  : 'Tus recargas de saldo aprobadas y consumos de servicios aparecerán listados aquí en tiempo real.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-4">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Detalle / Concepto</th>
                    <th className="py-2.5 px-3">Referencia</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-4 text-right">Saldo Resultante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredMovements.map((mov) => {
                    const isDeposit = mov.type === 'deposit' || Number(mov.amount) > 0;
                    const isSale = mov.type === 'service_sale' || Number(mov.amount) < 0;
                    const amountVal = Math.abs(Number(mov.amount || 0));

                    return (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                          {new Date(mov.created_at).toLocaleDateString('es-DO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {isDeposit ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <ArrowDownLeft className="h-3 w-3" />
                              <span>Recarga / Depósito</span>
                            </Badge>
                          ) : isSale ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <ArrowUpRight className="h-3 w-3" />
                              <span>Venta Servicio</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <RotateCcw className="h-3 w-3" />
                              <span>{mov.type}</span>
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 font-semibold text-foreground max-w-xs">
                          <span>{mov.description || 'Movimiento de saldo'}</span>
                        </td>

                        <td className="py-3 px-3 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {mov.reference_id ? (
                            <span className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                              {mov.reference_id.slice(0, 16)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                          <span
                            className={
                              isDeposit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }
                          >
                            {isDeposit ? '+' : '-'} RD${' '}
                            {amountVal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-foreground">
                              RD$ {Number(mov.balance_after || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Antes: RD$ {Number(mov.balance_before || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
