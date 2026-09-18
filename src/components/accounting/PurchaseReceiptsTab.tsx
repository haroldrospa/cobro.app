import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  Plus,
  Search,
  Printer,
  Ban,
  ShieldCheck,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Building2,
  User,
  Filter
} from 'lucide-react';
import { usePurchaseReceipts, PurchaseReceipt } from '@/hooks/usePurchaseReceipts';
import { CreatePurchaseReceiptDialog } from './CreatePurchaseReceiptDialog';
import { PurchaseReceiptPrintDialog } from './PurchaseReceiptPrintDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PurchaseReceiptsTabProps {
  currentDate?: Date;
}

export const PurchaseReceiptsTab: React.FC<PurchaseReceiptsTabProps> = ({ currentDate }) => {
  const { receipts, isLoading, cancelPurchaseReceipt, isCanceling, isElectronicActive } = usePurchaseReceipts();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<PurchaseReceipt | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'EMITIDO' | 'ANULADO'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'E41' | 'B11'>('all');

  // Filter receipts by current month / date if provided
  const monthlyReceipts = useMemo(() => {
    if (!currentDate) return receipts;
    const targetMonth = currentDate.getMonth();
    const targetYear = currentDate.getFullYear();

    return receipts.filter(r => {
      if (!r.issue_date) return true;
      const d = new Date(r.issue_date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }, [receipts, currentDate]);

  // Apply search and status filters
  const filteredReceipts = useMemo(() => {
    return monthlyReceipts.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.ncf_type !== typeFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.ncf.toLowerCase().includes(q) ||
        r.supplier_name.toLowerCase().includes(q) ||
        r.supplier_rnc_cedula.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [monthlyReceipts, searchQuery, statusFilter, typeFilter]);

  // Monthly Metrics
  const metrics = useMemo(() => {
    const active = monthlyReceipts.filter(r => r.status !== 'ANULADO');
    const totalPurchased = active.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const itbisRetained = active.reduce((sum, r) => sum + (r.itbis_retained || 0), 0);
    const isrRetained = active.reduce((sum, r) => sum + (r.isr_retained || 0), 0);
    const totalNetPaid = active.reduce((sum, r) => sum + (r.total_net_paid || 0), 0);
    const count = active.length;

    return {
      totalPurchased,
      itbisRetained,
      isrRetained,
      totalNetPaid,
      count
    };
  }, [monthlyReceipts]);

  const handleOpenPrint = (receipt: PurchaseReceipt) => {
    setSelectedReceiptForPrint(receipt);
    setIsPrintOpen(true);
  };

  const handleCancelReceipt = async (receipt: PurchaseReceipt) => {
    if (confirm(`¿Estás seguro de anular el comprobante ${receipt.ncf}? Esta acción no se puede deshacer y removerá su impacto en la contabilidad.`)) {
      await cancelPurchaseReceipt({ receiptId: receipt.id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Comprobantes de Compras (e-CF 41 / B11)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Emisión y control de compras a personas físicas y proveedores no registrados conforme a la DGII
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-primary/20 gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo Comprobante e-CF 41
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Compras Facturado */}
        <div className="bg-card/70 border border-border/60 p-3.5 rounded-2xl flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Facturado
            </span>
            <div className="p-1.5 bg-primary/15 rounded-lg text-primary">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              RD$ {metrics.totalPurchased.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {metrics.count} {metrics.count === 1 ? 'comprobante emitido' : 'comprobantes emitidos'}
            </p>
          </div>
        </div>

        {/* ITBIS Retenido (Norma 02-05) */}
        <div className="bg-card/70 border border-border/60 p-3.5 rounded-2xl flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              ITBIS Retenido (02-05)
            </span>
            <div className="p-1.5 bg-amber-500/15 rounded-lg text-amber-500">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-amber-500 tracking-tight">
              RD$ {metrics.itbisRetained.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Retención 100% ITBIS a personas físicas
            </p>
          </div>
        </div>

        {/* ISR Retenido (Norma 07-07) */}
        <div className="bg-card/70 border border-border/60 p-3.5 rounded-2xl flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              ISR Retenido (07-07)
            </span>
            <div className="p-1.5 bg-rose-500/15 rounded-lg text-rose-500">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-rose-500 tracking-tight">
              RD$ {metrics.isrRetained.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Retención 10% / 2% honorarios y servicios
            </p>
          </div>
        </div>

        {/* Total Neto Pagado */}
        <div className="bg-card/70 border border-border/60 p-3.5 rounded-2xl flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Neto Desembolsado
            </span>
            <div className="p-1.5 bg-blue-500/15 rounded-lg text-blue-500">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-blue-500 tracking-tight">
              RD$ {metrics.totalNetPaid.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Monto pagado a proveedores informales
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-NCF, proveedor, cédula/RNC, concepto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 bg-card/60 border-border/60 rounded-xl text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex bg-muted/40 p-0.5 rounded-xl border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${statusFilter === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EMITIDO')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${statusFilter === 'EMITIDO' ? 'bg-card text-emerald-500 shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Emitidos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ANULADO')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${statusFilter === 'ANULADO' ? 'bg-card text-rose-500 shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Anulados
            </button>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">e-NCF / NCF</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proveedor / Persona Física</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Concepto</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Subtotal</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">ITBIS</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Retenciones</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Neto Pagado</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Estado</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    Cargando comprobantes de compras...
                  </TableCell>
                </TableRow>
              ) : filteredReceipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-foreground">No hay comprobantes de compras registrados</p>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Los comprobantes de compras (tipo e-CF 41 / B11) se emiten cuando adquieres bienes o servicios a personas físicas sin RNC formal, aplicando retenciones de ITBIS e ISR.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsCreateOpen(true)}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl gap-2 mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Emitir Primer Comprobante e-CF 41
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReceipts.map((receipt) => {
                  const isAnnulled = receipt.status === 'ANULADO';
                  const totalRetained = (receipt.itbis_retained || 0) + (receipt.isr_retained || 0);

                  return (
                    <TableRow
                      key={receipt.id}
                      className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${isAnnulled ? 'opacity-50' : ''}`}
                    >
                      {/* Fecha */}
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {receipt.issue_date
                          ? format(new Date(receipt.issue_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>

                      {/* e-NCF */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-primary">
                            {receipt.ncf}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 rounded font-mono uppercase bg-primary/10 border-primary/20 text-primary"
                          >
                            {receipt.ncf_type}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Proveedor */}
                      <TableCell>
                        <div className="min-w-[160px]">
                          <p className="text-xs font-bold text-foreground leading-tight truncate">
                            {receipt.supplier_name}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            Céd/RNC: {receipt.supplier_rnc_cedula}
                          </p>
                        </div>
                      </TableCell>

                      {/* Concepto */}
                      <TableCell>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={receipt.description}>
                          {receipt.description}
                        </p>
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="text-right font-mono text-xs">
                        RD$ {receipt.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* ITBIS */}
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        RD$ {receipt.itbis_amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* Retenciones */}
                      <TableCell className="text-right font-mono text-xs">
                        {totalRetained > 0 ? (
                          <span className="text-amber-500 font-medium">
                            -RD$ {totalRetained.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">RD$ 0.00</span>
                        )}
                      </TableCell>

                      {/* Neto Pagado */}
                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        RD$ {receipt.total_net_paid.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase rounded-md px-2 py-0.5 ${
                            isAnnulled
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          }`}
                        >
                          {receipt.status}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPrint(receipt)}
                            title="Ver / Imprimir Comprobante"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>

                          {!isAnnulled && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelReceipt(receipt)}
                              disabled={isCanceling}
                              title="Anular Comprobante"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialogs */}
      <CreatePurchaseReceiptDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <PurchaseReceiptPrintDialog
        receipt={selectedReceiptForPrint}
        open={isPrintOpen}
        onOpenChange={setIsPrintOpen}
      />
    </div>
  );
};
