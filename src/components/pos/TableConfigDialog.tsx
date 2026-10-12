import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Utensils,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TableConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TableConfigDialog: React.FC<TableConfigDialogProps> = ({ isOpen, onClose }) => {
  const {
    sections,
    addSection,
    updateSection,
    deleteSection,
    addTable,
    updateTable,
    removeTable,
    generateTables,
    resetToDefaults,
  } = useTableConfig();

  const { toast } = useToast();

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || 'salon');
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  // Edición de nombre de zona
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  // Agregar mesa individual
  const [newTableName, setNewTableName] = useState('');

  // Edición de mesa individual
  const [editingTable, setEditingTable] = useState<{ oldName: string; newName: string } | null>(null);

  // Generador en lote
  const [showBatchGenerator, setShowBatchGenerator] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('Mesa');
  const [batchCount, setBatchCount] = useState(8);
  const [batchStartFrom, setBatchStartFrom] = useState(1);

  // Diálogo para confirmar reseteo
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Confirmar eliminación de zona
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

  // Mantener zona activa válida si cambia sections
  const currentSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    await addSection(newSectionName);
    toast({
      title: 'Zona creada',
      description: `Se agregó la zona "${newSectionName.trim()}"`,
    });
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleSaveSectionRename = async () => {
    if (!editingSectionId || !editingSectionName.trim()) {
      setEditingSectionId(null);
      return;
    }
    await updateSection(editingSectionId, editingSectionName);
    toast({
      title: 'Zona actualizada',
      description: `Zona renombrada a "${editingSectionName.trim()}"`,
    });
    setEditingSectionId(null);
  };

  const handleConfirmDeleteSection = async () => {
    if (!sectionToDelete) return;
    const sec = sections.find((s) => s.id === sectionToDelete);
    await deleteSection(sectionToDelete);
    toast({
      title: 'Zona eliminada',
      description: `Se eliminó la zona "${sec?.name || ''}"`,
    });
    setSectionToDelete(null);
    if (activeSectionId === sectionToDelete) {
      const remaining = sections.filter((s) => s.id !== sectionToDelete);
      if (remaining.length > 0) setActiveSectionId(remaining[0].id);
    }
  };

  const handleAddSingleTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSection || !newTableName.trim()) return;
    const name = newTableName.trim();
    if (currentSection.tables.some((t) => t.toLowerCase() === name.toLowerCase())) {
      toast({
        title: 'Mesa ya existe',
        description: `Ya existe una mesa con el nombre "${name}" en esta zona`,
        variant: 'destructive',
      });
      return;
    }
    await addTable(currentSection.id, name);
    setNewTableName('');
  };

  const handleSaveTableRename = async () => {
    if (!currentSection || !editingTable || !editingTable.newName.trim()) {
      setEditingTable(null);
      return;
    }
    if (editingTable.oldName.toLowerCase() !== editingTable.newName.trim().toLowerCase()) {
      if (currentSection.tables.some((t) => t.toLowerCase() === editingTable.newName.trim().toLowerCase())) {
        toast({
          title: 'Nombre en uso',
          description: `Ya existe una mesa con el nombre "${editingTable.newName.trim()}"`,
          variant: 'destructive',
        });
        return;
      }
    }
    await updateTable(currentSection.id, editingTable.oldName, editingTable.newName.trim());
    setEditingTable(null);
  };

  const handleRunBatchGenerate = async () => {
    if (!currentSection) return;
    await generateTables(currentSection.id, batchPrefix, batchCount, batchStartFrom);
    toast({
      title: 'Mesas generadas',
      description: `Se agregaron las mesas generadas a "${currentSection.name}"`,
    });
    setShowBatchGenerator(false);
  };

  const handleResetDefaults = async () => {
    await resetToDefaults();
    setConfirmResetOpen(false);
    toast({
      title: 'Valores restablecidos',
      description: 'Se restauraron las zonas y mesas predeterminadas',
    });
    setActiveSectionId('salon');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl w-full p-0 overflow-hidden bg-background border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-border/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground">
                  Configuración de Mesas y Salones
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Organiza las áreas de tu local (Salón, Barra, Terraza, VIP) y gestiona sus mesas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {/* Selector de Zonas / Salones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Zonas / Salones
                </span>
                {!isAddingSection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingSection(true)}
                    className="h-7 text-xs font-bold text-primary hover:bg-primary/10 gap-1 px-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva Zona
                  </Button>
                )}
              </div>

              {/* Formulario rápido para nueva zona */}
              {isAddingSection && (
                <form onSubmit={handleCreateSection} className="flex gap-2 p-2 bg-muted/40 rounded-xl border border-border/60">
                  <Input
                    placeholder="Nombre de la zona (ej. Terraza VIP, Piso 2, Patio)..."
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    autoFocus
                    className="h-9 text-xs bg-background"
                  />
                  <Button type="submit" size="sm" className="h-9 text-xs font-bold px-3">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Crear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingSection(false);
                      setNewSectionName('');
                    }}
                    className="h-9 text-xs px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}

              {/* Lista horizontal de zonas */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {sections.map((sec) => {
                  const isActive = currentSection?.id === sec.id;
                  const isEditingThis = editingSectionId === sec.id;

                  if (isEditingThis) {
                    return (
                      <div key={sec.id} className="flex items-center gap-1 bg-card border rounded-lg p-1 shrink-0">
                        <Input
                          value={editingSectionName}
                          onChange={(e) => setEditingSectionName(e.target.value)}
                          className="h-7 text-xs w-28 px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSectionRename();
                            if (e.key === 'Escape') setEditingSectionId(null);
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-500"
                          onClick={handleSaveSectionRename}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setEditingSectionId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={sec.id}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/80'
                      )}
                      onClick={() => setActiveSectionId(sec.id)}
                    >
                      <span>{sec.name}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                          isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {sec.tables.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zona seleccionada y sus mesas */}
            {currentSection && (
              <div className="flex-1 min-h-0 flex flex-col gap-3 p-3.5 rounded-xl border border-border/60 bg-card/40">
                {/* Cabecera de la zona activa */}
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">{currentSection.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {currentSection.tables.length} {currentSection.tables.length === 1 ? 'mesa' : 'mesas'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSectionId(currentSection.id);
                        setEditingSectionName(currentSection.name);
                      }}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Renombrar
                    </Button>

                    {sections.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSectionToDelete(currentSection.id)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar Zona
                      </Button>
                    )}
                  </div>
                </div>

                {/* Formulario de agregar mesa individual + Botón Lote */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <form onSubmit={handleAddSingleTable} className="flex-1 flex gap-2">
                      <Input
                        placeholder={`Nueva mesa en ${currentSection.name} (ej. ${currentSection.name} ${currentSection.tables.length + 1})...`}
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        className="h-9 text-xs bg-background"
                      />
                      <Button type="submit" size="sm" disabled={!newTableName.trim()} className="h-9 text-xs font-bold px-3 shrink-0">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar
                      </Button>
                    </form>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBatchGenerator(!showBatchGenerator)}
                      className={cn(
                        'h-9 text-xs font-bold gap-1 shrink-0 border-dashed',
                        showBatchGenerator && 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Generar en Lote</span>
                      {showBatchGenerator ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>

                  {/* Panel de generador en lote */}
                  {showBatchGenerator && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Generador rápido de mesas numeradas
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Creará: {batchPrefix} {batchStartFrom} hasta {batchPrefix} {batchStartFrom + batchCount - 1}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Prefijo</label>
                          <Input
                            value={batchPrefix}
                            onChange={(e) => setBatchPrefix(e.target.value)}
                            placeholder="Mesa / Barra / Box"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Cantidad</label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={batchCount}
                            onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Iniciar en</label>
                          <Input
                            type="number"
                            min={1}
                            value={batchStartFrom}
                            onChange={(e) => setBatchStartFrom(parseInt(e.target.value) || 1)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBatchGenerator(false)}
                          className="h-7 text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleRunBatchGenerate}
                          className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
                        >
                          Generar {batchCount} Mesas
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cuadrícula de mesas existentes en la zona */}
                <ScrollArea className="flex-1 pr-2 mt-1">
                  {currentSection.tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                      <Utensils className="h-8 w-8 stroke-[1.5] mb-2 opacity-30" />
                      <p className="text-xs font-medium">No hay mesas en esta zona todavía.</p>
                      <p className="text-[11px] opacity-75">Agrega una mesa arriba o utiliza el generador en lote.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pb-2">
                      {currentSection.tables.map((table) => {
                        const isEditing = editingTable?.oldName.toLowerCase() === table.toLowerCase();

                        if (isEditing) {
                          return (
                            <div
                              key={table}
                              className="p-2 rounded-xl border border-primary bg-primary/5 flex flex-col gap-1.5"
                            >
                              <Input
                                value={editingTable.newName}
                                onChange={(e) =>
                                  setEditingTable({ ...editingTable, newName: e.target.value })
                                }
                                className="h-7 text-xs bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTableRename();
                                  if (e.key === 'Escape') setEditingTable(null);
                                }}
                              />
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-emerald-500"
                                  onClick={handleSaveTableRename}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground"
                                  onClick={() => setEditingTable(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={table}
                            className="group relative flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:border-border hover:bg-muted/40 transition-colors"
                          >
                            <span className="text-xs font-bold text-foreground truncate pr-1" title={table}>
                              {table}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => setEditingTable({ oldName: table, newName: table })}
                                className="p-1 hover:text-primary rounded transition-colors text-muted-foreground"
                                title="Renombrar mesa"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTable(currentSection.id, table)}
                                className="p-1 hover:text-destructive rounded transition-colors text-muted-foreground"
                                title="Eliminar mesa"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer valores iniciales
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="h-8 text-xs font-bold px-4"
            >
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de confirmación para restablecer */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              ¿Restablecer mesas a los valores de fábrica?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta acción volverá a configurar las zonas predeterminadas (Salón 1 al 8, Barra 1 al 4 y Terraza 1 al 4).
              Los pedidos abiertos mantendrán sus números de mesa asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetDefaults}
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restablecer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alerta de confirmación para eliminar zona */}
      <AlertDialog open={!!sectionToDelete} onOpenChange={(open) => !open && setSectionToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">¿Eliminar esta zona?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Se eliminará la zona y todas las mesas asociadas a ella. Los pedidos abiertos actuales no se verán afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSection}
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
export default TableConfigDialog;
