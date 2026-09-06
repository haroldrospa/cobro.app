import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, DollarSign, StickyNote, ChevronDown, ChevronUp, RefreshCcw, Building2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useSuppliers } from '@/hooks/useSuppliers';

export interface QuickNote {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    store_id: string;
    supplier_name?: string;
}

export const useQuickNotes = () => {
    const { data: store, userId } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const storeId = store?.id;

    const { data: notes = [], isLoading, error: queryError } = useQuery({
        queryKey: ['pos-quick-notes', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            const { data, error } = await supabase
                .from('pos_quick_notes' as any)
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error loading notes:", error);
                throw error;
            }
            return (data || []).map((n: any) => ({
                id: n.id,
                name: n.name,
                amount: Number(n.amount),
                dueDate: n.due_date,
                store_id: n.store_id,
                supplier_name: n.supplier_name || undefined
            })) as QuickNote[];
        },
        enabled: !!storeId && !!userId
    });

    // ─── Realtime Subscription for Quick Notes ───
    useEffect(() => {
        if (!storeId) return;

        const channel = supabase
            .channel(`pos-quick-notes-realtime-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pos_quick_notes',
                    filter: `store_id=eq.${storeId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['pos-quick-notes', storeId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId, queryClient]);

    const addMutation = useMutation({
        mutationFn: async ({ name, amount, dueDate, supplier_name }: Omit<QuickNote, 'id' | 'store_id'>) => {
            const currentStoreId = storeId;
            if (!currentStoreId) throw new Error("No se encontró el ID de la tienda. Por favor, recarga la página.");
            
            const { data, error } = await supabase
                .from('pos_quick_notes' as any)
                .insert({
                    store_id: currentStoreId,
                    name,
                    amount: isNaN(Number(amount)) ? 0 : Number(amount),
                    due_date: dueDate,
                    supplier_name: supplier_name || null
                })
                .select();
            
            if (error) {
                console.error("Error de Supabase al insertar nota:", error);
                throw error;
            }
            
            return data?.[0];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos-quick-notes', storeId] });
            toast({
                title: "Nota guardada",
                description: "La nota se ha guardado correctamente.",
            });
        },
        onError: (error: any) => {
            console.error("Error detallado al agregar nota:", error);
            
            let errorMessage = "Error desconocido";
            if (!error) {
                errorMessage = "Objeto de error nulo o indefinido";
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (error.details) {
                errorMessage = error.details;
            } else if (error.error_description) {
                errorMessage = error.error_description;
            } else {
                const strError = String(error);
                if (strError && strError !== "[object Object]") {
                    errorMessage = strError;
                } else {
                    try {
                        errorMessage = JSON.stringify(error);
                    } catch (e) {
                        errorMessage = "Error no estructurado";
                    }
                }
            }

            const errorCode = error.code ? ` (Código: ${error.code})` : "";
            
            toast({
                title: "Error al guardar",
                description: `${errorMessage}${errorCode}`,
                variant: "destructive"
            });
        }
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('pos_quick_notes' as any)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos-quick-notes', storeId] });
            toast({
                title: "Nota eliminada",
                description: "La nota se ha eliminado correctamente.",
            });
        },
        onError: (error: any) => {
            console.error("Error removing note:", error);
            toast({
                title: "Error al eliminar",
                description: error.message || "No se pudo eliminar la nota",
                variant: "destructive"
            });
        }
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    const totalNotes = notes.reduce((acc, current) => acc + (current.amount || 0), 0);
    const todayTotal = notes
        .filter(n => n.dueDate <= today)
        .reduce((acc, n) => acc + (n.amount || 0), 0);

    return { 
        notes, 
        addNote: async (name: string, amount: number, dueDate: string, supplier_name?: string) => {
            return addMutation.mutateAsync({ name, amount, dueDate, supplier_name });
        }, 
        removeNote: (id: string) => removeMutation.mutate(id),
        totalNotes,
        todayTotal,
        isLoading: isLoading || (!!userId && !storeId),
        isAdding: addMutation.isPending,
        isRemoving: removeMutation.isPending,
        storeId
    };
};

const QuickNotesSection: React.FC = () => {
    const { notes, addNote, removeNote, totalNotes, todayTotal, isLoading, isAdding, isRemoving, storeId } = useQuickNotes();
    const { suppliers } = useSuppliers();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState<Date>(new Date());
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [supplierOpen, setSupplierOpen] = useState(false);
    const { toast } = useToast();

    const handleSelectSupplier = (supplierName: string) => {
        setSelectedSupplier(supplierName);
        if (!name) setName(supplierName);
        setSupplierOpen(false);
    };

    const handleAdd = async () => {
        if (!storeId) {
            toast({
                title: "Iniciando sesión",
                description: "Esperando identificación del negocio...",
                variant: "destructive"
            });
            return;
        }

        if (!name.trim() || !amount) {
            toast({
                title: "Campos requeridos",
                description: "Ingresa el concepto y el monto",
                variant: "destructive"
            });
            return;
        }

        try {
            await addNote(name.trim(), parseFloat(amount), format(date, 'yyyy-MM-dd'), selectedSupplier || undefined);
            setName('');
            setAmount('');
            setDate(new Date());
            setSelectedSupplier('');
        } catch (error) {
            // Error handled in mutation
        }
    };

    return (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden w-full transition-all">
            {/* Minimalist Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <StickyNote className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-semibold text-foreground tracking-tight">Notas y Pendientes</span>
                    {notes.length > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border/40">
                            {notes.length}
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
            </button>
            
            {isExpanded && (
                <div className="p-3 space-y-2.5">
                    {/* Add Form Container */}
                    <div className="space-y-2 bg-muted/20 p-2 rounded-lg border border-border/30">
                        {/* Supplier Selector (Compact) */}
                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-7 text-[11px] justify-between font-normal bg-background/80 px-2 rounded-md border-border/40",
                                        !selectedSupplier && "text-muted-foreground"
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        {selectedSupplier || "Proveedor (opcional)"}
                                    </span>
                                    <ChevronsUpDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar proveedor..." className="h-8 text-xs" />
                                    <CommandList>
                                        <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">
                                            No se encontraron proveedores.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {selectedSupplier && (
                                                <CommandItem
                                                    onSelect={() => {
                                                        setSelectedSupplier('');
                                                        setSupplierOpen(false);
                                                    }}
                                                    className="text-xs text-muted-foreground italic"
                                                >
                                                    — Sin proveedor
                                                </CommandItem>
                                            )}
                                            {suppliers.map((s) => (
                                                <CommandItem
                                                    key={s.id}
                                                    value={s.name}
                                                    onSelect={() => handleSelectSupplier(s.name)}
                                                    className="text-xs"
                                                >
                                                    <Building2 className="h-3 w-3 mr-2 text-muted-foreground" />
                                                    {s.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Concept, Amount, Date & Submit Row */}
                        <div className="flex items-center gap-1.5">
                            <Input
                                placeholder="Concepto..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                className="h-7 text-xs bg-background/80 flex-1 min-w-0 rounded-md border-border/40"
                            />

                            <div className="relative w-18 shrink-0">
                                <span className="absolute left-1.5 top-1.5 text-muted-foreground text-[10px]">$</span>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                    className="h-7 text-xs bg-background/80 pl-3.5 pr-1 rounded-md border-border/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full font-medium"
                                />
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-7 text-[11px] px-1.5 rounded-md bg-background/80 border-border/40 shrink-0 font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="h-3 w-3 text-muted-foreground mr-1 shrink-0" />
                                        <span>{date ? format(date, "dd/MM", { locale: es }) : "Fecha"}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>

                            <Button 
                                size="icon" 
                                className="h-7 w-7 shrink-0 rounded-md shadow-none" 
                                onClick={handleAdd}
                                disabled={isAdding || isLoading}
                                title="Agregar pendiente"
                            >
                                {isAdding ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className={cn(
                        notes.length > 0 || isLoading ? "max-h-44 overflow-y-auto" : "h-0 overflow-hidden",
                        "w-full pr-0.5 space-y-1.5 scrollbar-thin"
                    )}>
                        {isLoading && (
                            <div className="flex items-center justify-center py-4">
                                <RefreshCcw className="h-4 w-4 animate-spin text-primary/50" />
                            </div>
                        )}
                        {notes.map((note) => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            const isToday = note.dueDate === today;
                            const isOverdue = note.dueDate < today;

                            return (
                                <div 
                                    key={note.id} 
                                    className={cn(
                                        "group flex items-center justify-between gap-2 p-2 rounded-lg border transition-all text-xs",
                                        isOverdue
                                            ? "bg-destructive/[0.06] border-destructive/30 hover:border-destructive/50"
                                            : isToday
                                            ? "bg-primary/[0.06] border-primary/30 hover:border-primary/50"
                                            : "bg-background/60 border-border/40 hover:border-border hover:bg-background/90"
                                    )}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isOverdue && (
                                                <span className="text-[9px] font-semibold uppercase bg-destructive/15 text-destructive px-1.5 py-0.2 rounded shrink-0">
                                                    Vencido
                                                </span>
                                            )}
                                            {isToday && !isOverdue && (
                                                <span className="text-[9px] font-semibold uppercase bg-primary/15 text-primary px-1.5 py-0.2 rounded shrink-0">
                                                    Hoy
                                                </span>
                                            )}
                                            <span className="font-semibold text-foreground truncate">{note.name}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span className="flex items-center gap-1 shrink-0">
                                                <CalendarIcon className="h-2.5 w-2.5 opacity-70" />
                                                {format(parseISO(note.dueDate), 'dd/MM/yyyy')}
                                            </span>
                                            {note.supplier_name && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                                                        <Building2 className="h-2.5 w-2.5 opacity-70 shrink-0" />
                                                        <span className="truncate">{note.supplier_name}</span>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className={cn(
                                            "font-bold text-xs tabular-nums",
                                            isOverdue ? "text-destructive" : "text-primary"
                                        )}>
                                            ${(note.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </span>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                            onClick={() => removeNote(note.id)}
                                            disabled={isRemoving}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Minimalist Summary Footer */}
                    {notes.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                            {todayTotal > 0 && (
                                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                                        <CalendarIcon className="h-3 w-3" /> Pagar Hoy / Vencido:
                                    </span>
                                    <span className="font-bold tabular-nums">
                                        ${todayTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center px-1 text-muted-foreground">
                                <span className="text-[11px] font-medium">Total Pendientes:</span>
                                <span className="font-bold text-foreground tabular-nums">
                                    ${totalNotes.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuickNotesSection;
