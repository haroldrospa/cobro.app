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
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Hourglass
} from 'lucide-react';
import { useDigitalServices, useDigitalWalletMovements, useDigitalTopupRequests } from '@/hooks/useDigitalServices';
import { Input } from '@/components/ui/input';

interface WalletMovementsHistoryProps {
  storeId?: string;
  limit?: number;
  showHeaderSummary?: boolean;
}

interface UnifiedMovementItem {
  id: string;
  created_at: string;
  category: 'deposit' | 'service_sale' | 'topup_pending' | 'topup_rejected' | 'other';
  status: 'completed' | 'pending' | 'rejected';
  amount: number;
  description: string;
  reference_id?: string;
  balance_before?: number;
  balance_after?: number;
  bank_name?: string;
  receipt_url?: string;
  rejection_reason?: string;
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
    isRefetching: isRefetchingMovements,
  } = useDigitalWalletMovements({ limit, storeId });

  const {
    data: topupRequests = [],
    isLoading: isLoadingTopups,
    refetch: refetchTopups,
    isRefetching: isRefetchingTopups,
  } = useDigitalTopupRequests({ allStores: false });

  const [typeFilter, setTypeFilter] = useState<'all' | 'deposits' | 'pending' | 'sales'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const currentBalance = Number(wallet?.balance || 0);
  const isRefreshing = isRefetchingMovements || isRefetchingTopups;

  // Unificar solicitudes de recarga y movimientos de saldo confirmados
  const unifiedItems = useMemo<UnifiedMovementItem[]>(() => {
    const items: UnifiedMovementItem[] = [];
    const seenRefs = new Set<string>();

    // 1. Agregar movimientos confirmados de billetera
    movements.forEach((m) => {
      const isDeposit = m.type === 'deposit' || Number(m.amount) > 0;
      const isSale = m.type === 'service_sale' || Number(m.amount) < 0;

      items.push({
        id: m.id,
        created_at: m.created_at,
        category: isDeposit ? 'deposit' : isSale ? 'service_sale' : 'other',
        status: 'completed',
        amount: Math.abs(Number(m.amount || 0)),
        description: m.description || (isDeposit ? 'Depósito / Recarga de Saldo' : 'Venta de Servicio'),
        reference_id: m.reference_id,
        balance_before: m.balance_before,
        balance_after: m.balance_after,
      });

      if (m.reference_id) seenRefs.add(m.reference_id);
    });

    // 2. Agregar solicitudes de recarga (especialmente las pendientes "En Verificación" o rechazadas)
    topupRequests.forEach((req) => {
      const refKey = req.reference_number || req.id;
      // Si ya está reflejada como depósito completado con el mismo id o ref, no duplicar
      if (req.status === 'approved' && (seenRefs.has(req.id) || seenRefs.has(req.reference_number))) {
        return;
      }

      if (req.status === 'pending') {
        items.push({
          id: req.id,
          created_at: req.created_at,
          category: 'topup_pending',
          status: 'pending',
          amount: Number(req.amount || 0),
          description: `Solicitud de recarga enviada (${req.bank_name})`,
          reference_id: req.reference_number,
          bank_name: req.bank_name,
          receipt_url: req.receipt_url,
        });
      } else if (req.status === 'rejected') {
        items.push({
          id: req.id,
          created_at: req.created_at,
          category: 'topup_rejected',
          status: 'rejected',
          amount: Number(req.amount || 0),
          description: `Recarga rechazada (${req.bank_name})`,
          reference_id: req.reference_number,
          bank_name: req.bank_name,
          rejection_reason: req.rejection_reason,
          receipt_url: req.receipt_url,
        });
      }
    });

    // Ordenar de más reciente a más antiguo
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [movements, topupRequests]);

  // Solicitudes pendientes en verificación
  const pendingRequests = useMemo(() => {
    return topupRequests.filter((r) => r.status === 'pending');
  }, [topupRequests]);

  const pendingTotal = useMemo(() => {
    return pendingRequests.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [pendingRequests]);

  // Filtrado en vivo
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (typeFilter === 'deposits' && item.category !== 'deposit' && item.category !== 'topup_pending') {
        return false;
      }
      if (typeFilter === 'pending' && item.status !== 'pending') {
        return false;
      }
      if (typeFilter === 'sales' && item.category !== 'service_sale') {
        return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const descMatch = item.description?.toLowerCase().includes(term);
        const refMatch = item.reference_id?.toLowerCase().includes(term);
        return descMatch || refMatch;
      }
      return true;
    });
  }, [unifiedItems, typeFilter, searchTerm]);

  // Estadísticas
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
      movementsCount: unifiedItems.length,
    };
  }, [movements, unifiedItems]);

  const handleRefresh = async () => {
    await Promise.all([refetchWallet(), refetchMovements(), refetchTopups()]);
  };

  return (
    <div className="space-y-4">
      {/* ALERTA DESTACADA SI HAY SOLICITUDES EN VERIFICACIÓN */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
            <Hourglass className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                Solicitud de Recarga en Verificación
              </h4>
              <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/40 text-[10px] font-bold">
                {pendingRequests.length} {pendingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
              </Badge>
            </div>
            {pendingRequests.map((req) => (
              <div key={req.id} className="mt-1 text-xs text-foreground font-semibold">
                RD$ {Number(req.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })} &bull; {req.bank_name}{' '}
                <span className="font-mono text-muted-foreground font-normal">(Ref: {req.reference_number})</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground mt-1">
              Tu solicitud fue enviada correctamente. Tan pronto el administrador apruebe el comprobante en el panel maestro, los fondos se sumarán de inmediato a tu saldo disponible.
            </p>
          </div>
        </div>
      )}

      {/* 1. Resumen de Saldo y Totales */}
      {showHeaderSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Saldo Disponible */}
          <Card className="border border-primary/30 bg-primary/[0.04] p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Saldo Disponible
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground">
              RD$ {currentBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              Fondos activos para emitir recargas
            </p>
          </Card>

          {/* Card 2: En Verificación */}
          <Card className="border border-amber-500/30 bg-amber-500/[0.04] p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                En Verificación
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              RD$ {pendingTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {pendingRequests.length > 0 ? `${pendingRequests.length} solicitud(es) por validar` : 'Sin recargas pendientes'}
            </p>
          </Card>

          {/* Card 3: Total Aprobado */}
          <Card className="border border-border/60 bg-card p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recargas Aprobadas
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              RD$ {stats.totalDeposits.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Total histórico acreditado a billetera
            </p>
          </Card>

          {/* Card 4: Consumido en Ventas */}
          <Card className="border border-border/60 bg-card p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Consumido en Ventas
              </span>
              <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
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
            Todos ({unifiedItems.length})
          </Button>

          <Button
            size="sm"
            variant={typeFilter === 'pending' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl gap-1 text-amber-500 border-amber-500/30"
            onClick={() => setTypeFilter('pending')}
          >
            <Clock className="h-3.5 w-3.5" />
            En Verificación ({pendingRequests.length})
          </Button>

          <Button
            size="sm"
            variant={typeFilter === 'deposits' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl gap-1"
            onClick={() => setTypeFilter('deposits')}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
            Recargas / Depósitos
          </Button>

          <Button
            size="sm"
            variant={typeFilter === 'sales' ? 'default' : 'outline'}
            className="h-8 text-xs font-semibold rounded-xl gap-1"
            onClick={() => setTypeFilter('sales')}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
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
            disabled={isLoadingMovements || isRefreshing}
            title="Actualizar movimientos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 3. Lista de Movimientos y Solicitudes */}
      <Card className="border border-border/60 bg-card shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Historial de Movimientos & Solicitudes
            </CardTitle>
            <CardDescription className="text-xs">
              Registro cronológico de recargas enviadas, aprobaciones y consumos de saldo
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {filteredItems.length} registros
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingMovements && isLoadingTopups ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando movimientos y solicitudes...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="font-semibold text-sm text-foreground">No hay movimientos ni solicitudes</p>
              <p className="text-xs max-w-sm mx-auto">
                {typeFilter !== 'all'
                  ? 'No hay registros para el filtro seleccionado.'
                  : 'Tus recargas de saldo (tanto en verificación como aprobadas) y ventas aparecerán listadas aquí.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-4">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Estado / Tipo</th>
                    <th className="py-2.5 px-3">Detalle / Concepto</th>
                    <th className="py-2.5 px-3">Referencia</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-4 text-right">Saldo Resultante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredItems.map((item) => {
                    const isPending = item.status === 'pending';
                    const isRejected = item.status === 'rejected';
                    const isDeposit = item.category === 'deposit';
                    const isSale = item.category === 'service_sale';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isPending
                            ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                            : isRejected
                            ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08]'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString('es-DO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {isPending ? (
                            <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center shadow-xs">
                              <Hourglass className="h-3 w-3 animate-pulse" />
                              <span>En Verificación</span>
                            </Badge>
                          ) : isRejected ? (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <AlertCircle className="h-3 w-3" />
                              <span>Rechazada</span>
                            </Badge>
                          ) : isDeposit ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <ArrowDownLeft className="h-3 w-3" />
                              <span>Recarga Aprobada</span>
                            </Badge>
                          ) : isSale ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border border-blue-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <ArrowUpRight className="h-3 w-3" />
                              <span>Venta Servicio</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex items-center">
                              <span>{item.category}</span>
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 font-semibold text-foreground max-w-xs">
                          <div className="flex flex-col">
                            <span>{item.description}</span>
                            {item.rejection_reason && (
                              <span className="text-[10px] text-rose-500 font-normal mt-0.5">
                                Motivo: {item.rejection_reason}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {item.reference_id ? (
                            <span className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/40 font-semibold text-foreground">
                              {item.reference_id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                          {isPending ? (
                            <span className="text-amber-500 font-bold">
                              RD$ {item.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                          ) : isDeposit ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              + RD$ {item.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-foreground">
                              - RD$ {item.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isPending ? (
                            <span className="text-[10px] font-medium text-amber-500 italic">
                              Pendiente aprobación
                            </span>
                          ) : item.balance_after !== undefined ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-foreground">
                                RD$ {Number(item.balance_after).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </span>
                              {item.balance_before !== undefined && (
                                <span className="text-[10px] text-muted-foreground">
                                  Antes: RD$ {Number(item.balance_before).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
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
