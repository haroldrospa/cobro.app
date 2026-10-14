import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Utensils, Plus, Check, Clock, Sparkles, Settings2, User } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTableConfig } from '@/hooks/useTableConfig';
import { TableConfigDialog } from './TableConfigDialog';

export interface OccupiedTableInfo {
  tableName: string;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  total: number;
  createdAt: string;
  itemCount: number;
}

interface TableSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTable: string | null;
  onSelectTable: (tableName: string, personName?: string) => void;
  onClearTable?: () => void;
  onLoadTableOrder?: (orderId: string) => void;
  occupiedTables?: OccupiedTableInfo[];
  initialPersonName?: string;
}

export const TableSelectorDialog: React.FC<TableSelectorDialogProps> = ({
  isOpen,
  onClose,
  selectedTable,
  onSelectTable,
  onClearTable,
  onLoadTableOrder,
  occupiedTables = [],
  initialPersonName = '',
}) => {
  const { sections } = useTableConfig();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [customTable, setCustomTable] = useState('');
  const [personName, setPersonName] = useState(initialPersonName || '');
  const [activeTab, setActiveTab] = useState(sections[0]?.id || 'salon');

  // Sincronizar initialPersonName
  React.useEffect(() => {
    if (initialPersonName) {
      setPersonName(initialPersonName);
    }
  }, [initialPersonName]);

  // Ajustar pestaña si las secciones cambian
  React.useEffect(() => {
    if (sections.length > 0 && !sections.some((s) => s.id === activeTab)) {
      setActiveTab(sections[0].id);
    }
  }, [sections, activeTab]);

  // Mapa rápido de mesas ocupadas por nombre normalizado
  const occupiedMap = React.useMemo(() => {
    const map = new Map<string, OccupiedTableInfo>();
    occupiedTables.forEach((t) => {
      map.set(t.tableName.trim().toLowerCase(), t);
    });
    return map;
  }, [occupiedTables]);

  const handleSelect = (tableName: string) => {
    onSelectTable(tableName, personName.trim() || undefined);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTable.trim();
    if (!clean) return;
    const finalTable = clean.startsWith('Mesa') || clean.startsWith('mesa') ? clean : `Mesa ${clean}`;
    onSelectTable(finalTable, personName.trim() || undefined);
    setCustomTable('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-xl w-full p-0 overflow-hidden bg-background border-border rounded-[2rem] shadow-2xl"
        centerOnMobile={true}
      >
        {/* Header con gradiente elegante */}
        <div className="relative p-5 sm:p-6 border-b border-border/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent flex items-center justify-between">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  Asignar Mesa
                  {selectedTable && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-bold bg-amber-500/10 text-xs">
                      Actual: {selectedTable}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs font-medium">
                  Selecciona la mesa para vincular este pedido o cargar una comanda abierta.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfigDialog(true)}
            className="h-8 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted rounded-xl shrink-0"
            title="Configurar Mesas y Salones"
          >
            <Settings2 className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Configurar</span>
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Input para nombre de la persona opcional */}
          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 space-y-1.5">
            <Label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              Nombre de la persona (opcional)
            </Label>
            <Input
              placeholder="Ej: Harold, Juan, Familia Gómez..."
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="h-10 rounded-xl bg-background border-border/80 text-sm font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Al seleccionar una mesa quedará identificada como: <span className="font-semibold text-foreground">{customTable.trim() || selectedTable || 'Mesa 1'}{personName.trim() ? ` - ${personName.trim()}` : ''}</span>
            </p>
          </div>

          {/* Input de mesa personalizada rápida */}
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Escribe un número o nombre de mesa (ej: 14, VIP, Terraza 5)..."
                value={customTable}
                onChange={(e) => setCustomTable(e.target.value)}
                className="h-11 rounded-xl bg-muted/50 border-border/80 text-sm font-medium pr-10"
              />
              <Sparkles className="absolute right-3 top-3 h-5 w-5 text-muted-foreground/40 pointer-events-none" />
            </div>
            <Button
              type="submit"
              disabled={!customTable.trim()}
              className="h-11 px-4 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Asignar
            </Button>
          </form>

          {/* Pestañas de zonas / salones */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex overflow-x-auto h-10 p-1 bg-muted/60 rounded-xl scrollbar-none justify-start">
              {sections.map((sec) => {
                const occCount = sec.tables.filter((t) => occupiedMap.has(t.toLowerCase())).length;
                return (
                  <TabsTrigger
                    key={sec.id}
                    value={sec.id}
                    className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm shrink-0 px-3"
                  >
                    <span>{sec.name}</span>
                    {occCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black">
                        {occCount}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <ScrollArea className="h-[280px] sm:h-[320px] w-full mt-3 pr-2">
              {sections.map((sec) => (
                <TabsContent key={sec.id} value={sec.id} className="mt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {sec.tables.map((table) => {
                      const occInfo = occupiedMap.get(table.toLowerCase());
                      const isSelected = selectedTable?.toLowerCase() === table.toLowerCase();
                      const isOccupied = !!occInfo;

                      return (
                        <div
                          key={table}
                          className={cn(
                            "relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all duration-200 select-none text-left",
                            isSelected
                              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-md"
                              : isOccupied
                              ? "border-amber-500/40 bg-card hover:border-amber-500/70 hover:bg-amber-500/5 shadow-xs"
                              : "border-border/70 bg-card/60 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                          )}
                        >
                          {/* Cabecera de la mesa */}
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-sm sm:text-base text-foreground">
                                {table}
                              </span>
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              )}
                            </div>

                            {isOccupied ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 font-black tracking-wider uppercase border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              >
                                Ocupada
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              >
                                Libre
                              </Badge>
                            )}
                          </div>

                          {/* Detalle si está ocupada */}
                          {isOccupied && occInfo ? (
                            <div className="space-y-1 mb-2.5 text-xs">
                              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                                <span className="truncate max-w-[90px] font-medium">
                                  {occInfo.customerName || 'Cliente'}
                                </span>
                                <span className="font-bold text-foreground">
                                  ${occInfo.total.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {formatDistanceToNow(new Date(occInfo.createdAt), {
                                    addSuffix: true,
                                    locale: es,
                                  })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/70 mb-2.5">
                              Lista para asignar pedido
                            </p>
                          )}

                          {/* Botones de acción */}
                          <div className="flex items-center gap-1.5 mt-auto pt-1">
                            {isOccupied && occInfo && onLoadTableOrder ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    onLoadTableOrder(occInfo.orderId);
                                    onClose();
                                  }}
                                  className="h-7 px-2 text-[10px] font-bold flex-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300"
                                >
                                  Ver Comanda
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSelect(table)}
                                  className="h-7 px-2 text-[10px] font-bold border-amber-500/30 hover:border-amber-500"
                                  title="Asignar carrito actual a esta mesa"
                                >
                                  Usar
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={() => handleSelect(table)}
                                className={cn(
                                  "h-7 w-full text-xs font-bold rounded-lg transition-colors",
                                  isSelected
                                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                                    : "border-border hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                )}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Seleccionada
                                  </>
                                ) : (
                                  'Seleccionar'
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>

          {/* Footer con opción de liberar mesa */}
          {selectedTable && onClearTable && (
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mesa asignada actualmente: <strong className="text-foreground">{selectedTable}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClearTable();
                  onClose();
                }}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 font-bold"
              >
                Quitar Mesa (Sin Mesa)
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {showConfigDialog && (
        <TableConfigDialog
          isOpen={showConfigDialog}
          onClose={() => setShowConfigDialog(false)}
        />
      )}
    </Dialog>
  );
};

export default TableSelectorDialog;
