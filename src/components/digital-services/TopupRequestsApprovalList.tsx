import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Building,
  Image as ImageIcon,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  AlertCircle
} from 'lucide-react';
import { useDigitalServices, useDigitalTopupRequests } from '@/hooks/useDigitalServices';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { DigitalServiceTopupRequest } from '@/types/digitalServices';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

export const TopupRequestsApprovalList: React.FC = () => {
  const { isPlatformAdmin } = usePlatformAdmin();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    approveTopup,
    isApprovingTopup,
    rejectTopup,
    isRejectingTopup,
  } = useDigitalServices();

  const { data: requests = [], isLoading, refetch } = useDigitalTopupRequests({
    allStores: isPlatformAdmin,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copiado al portapapeles', description: text });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApprove = async (req: DigitalServiceTopupRequest) => {
    const storeName = req.stores?.name || 'la tienda';
    if (!window.confirm(`¿Confirmas que recibiste la transferencia en tu cuenta bancaria y deseas APROBAR y acreditar RD$ ${req.amount.toLocaleString()} a ${storeName}?`)) {
      return;
    }
    await approveTopup(req.id);
  };

  const handleReject = async (req: DigitalServiceTopupRequest) => {
    const reason = window.prompt('Indica el motivo del rechazo (opcional, ej. comprobante no legible o fondos no recibidos):');
    if (reason === null) return;
    await rejectTopup({ requestId: req.id, reason });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl w-fit">
          <Button
            size="sm"
            variant={statusFilter === 'pending' ? 'default' : 'ghost'}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setStatusFilter('pending')}
          >
            <Clock className="h-3.5 w-3.5 mr-1" />
            Pendientes
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'approved' ? 'default' : 'ghost'}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setStatusFilter('approved')}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            Aprobadas
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'rejected' ? 'default' : 'ghost'}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setStatusFilter('rejected')}
          >
            <XCircle className="h-3.5 w-3.5 mr-1 text-destructive" />
            Rechazadas
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'ghost'}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setStatusFilter('all')}
          >
            Todas
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {requests.length} solicitud(es) registrada(s)
        </div>
      </div>

      {/* Lista de Solicitudes */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Cargando solicitudes de recarga...
        </div>
      ) : requests.length === 0 ? (
        <Card className="border border-border/60 p-8 text-center bg-card shadow-xs rounded-2xl">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h4 className="text-sm font-bold text-foreground">No hay solicitudes en esta categoría</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter === 'pending'
              ? 'Todas las transferencias han sido validadas y activadas.'
              : 'No se encontraron registros de recargas con este filtro.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {requests.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';

            return (
              <Card
                key={req.id}
                className="border border-border/60 bg-card shadow-2xs hover:shadow-xs transition-all rounded-xl p-3.5 sm:p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Info Principal */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {req.stores?.name || 'Comercio'}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isPending
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : isApproved
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'
                        }
                      >
                        {isPending ? '⏳ Pendiente de Aprobación' : isApproved ? '✓ Aprobada y Acreditada' : '✗ Rechazada'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Building className="h-3.5 w-3.5 text-primary" />
                        {req.bank_name}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 font-mono">
                        Ref: <strong className="text-foreground">{req.reference_number}</strong>
                        <button
                          type="button"
                          onClick={() => handleCopy(req.reference_number, req.id)}
                          className="hover:text-primary transition-colors cursor-pointer"
                          title="Copiar referencia"
                        >
                          {copiedId === req.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </span>
                      {req.notes && (
                        <>
                          <span>&bull;</span>
                          <span className="italic truncate max-w-xs">{req.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Monto y Botones de Acción */}
                  <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Monto Solicitado</div>
                      <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">
                        RD$ {Number(req.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Ver Comprobante */}
                      {req.receipt_url && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReceipt(req.receipt_url || null)}
                          className="h-8 text-xs gap-1 px-2.5 rounded-lg border-border/70 hover:bg-muted"
                          title="Ver imagen del comprobante"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="hidden sm:inline">Comprobante</span>
                        </Button>
                      )}

                      {/* Botones de Aprobación para Platform Admin */}
                      {isPending && isPlatformAdmin && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(req)}
                            disabled={isApprovingTopup}
                            className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Aprobar Saldo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(req)}
                            disabled={isRejectingTopup}
                            className="h-8 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg"
                          >
                            Rechazar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Visor de Comprobante */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-2xl p-4 rounded-2xl bg-background border border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span>Comprobante de Transferencia Bancaria</span>
              {selectedReceipt && (
                <a
                  href={selectedReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir original <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-xl overflow-hidden border border-border/60 bg-muted/20 flex items-center justify-center max-h-[75vh]">
            {selectedReceipt && (
              <img
                src={selectedReceipt}
                alt="Comprobante Bancario"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
