import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, DollarSign, StickyNote, ChevronDown, ChevronUp, RefreshCcw, Building2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    const [selectedSupplier, setSelectedSupplier] = useState<string>(''); // supplier name
    const [supplierOpen, setSupplierOpen] = useState(false);
    const { toast } = useToast();

    // When a supplier is selected, pre-fill the concept
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

        if (!name || !amount) {
            toast({
                title: "Campos requeridos",
                description: "Por favor el nombre y el monto",
                variant: "destructive"
            });
            return;
        }

        try {
            await addNote(name, parseFloat(amount), format(date, 'yyyy-MM-dd'), selectedSupplier || undefined);
            setName('');
            setAmount('');
            setDate(new Date());
            setSelectedSupplier('');
        } catch (error) {
            // Error is handled in the mutation onSuccess/onError
        }
    };

    return (
        <Card className="border-border/60 shadow-none bg-accent/20 overflow-hidden w-full">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-2.5 bg-accent/30 hover:bg-accent/40 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas y Pendientes de Pago</span>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
            
            {isExpanded && (
                <CardContent className="p-2.5 space-y-2.5">
                    {/* Supplier selector row */}
                    <div className="pb-2 border-b border-border/30">
                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-8 text-xs justify-between font-normal bg-background px-2",
                                        !selectedSupplier && "text-muted-foreground"
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        {selectedSupplier || "Proveedor (opcional)"}
                                    </span>
                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar proveedor..." className="h-8 text-xs" />
                                    <CommandList>
                                        <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                                            No se encontraron proveedores.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {/* Option to clear selection */}
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
                    </div>

                    {/* Note form row with flex layout to prevent grid blowout */}
                    <div className="flex items-center gap-1.5 pb-2 border-b border-border/40">
                        <div className="flex-1 min-w-0">
                            <Input
                                placeholder="Concepto"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-8 text-xs bg-background w-full"
                            />
                        </div>
                        <div className="w-20 shrink-0">
                            <div className="relative">
                                <span className="absolute left-1.5 top-2 text-muted-foreground/50 text-[10px]">$</span>
                                <Input
                                    type="number"
                                    placeholder="Monto"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="h-8 text-xs bg-background pl-3.5 pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
                                />
                            </div>
                        </div>
                        <div className="w-24 shrink-0">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full h-8 text-xs justify-start text-left font-normal bg-background px-1.5",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-1 h-3 w-3 shrink-0" />
                                        <span className="truncate">{date ? format(date, "dd/MM/yy", { locale: es }) : "Fecha"}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button 
                            size="icon" 
                            variant="default" 
                            className="h-8 w-8 shrink-0 p-0" 
                            onClick={handleAdd}
                            disabled={isAdding || isLoading}
                            title="Agregar pendiente"
                        >
                            {isAdding ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                    </div>

                    <ScrollArea className={cn(notes.length > 0 || isLoading ? "h-32" : "h-0", "w-full pr-1.5")}>
                        {isLoading && (
                            <div className="h-full flex items-center justify-center py-4">
                                <RefreshCcw className="h-5 w-5 animate-spin text-primary/40" />
                            </div>
                        )}
                        <div className="space-y-1.5 pr-0.5">
                            {notes.map((note) => {
                                const today = format(new Date(), 'yyyy-MM-dd');
                                const isToday = note.dueDate === today;
                                const isOverdue = note.dueDate < today;
                                return (
                                    <div key={note.id} className={cn(
                                        "flex items-center justify-between gap-1.5 p-2 rounded-md border transition-all w-full",
                                        isOverdue
                                            ? "bg-destructive/10 border-destructive/40"
                                            : isToday
                                            ? "bg-primary/10 border-primary/40"
                                            : "bg-background/50 border-border/30 hover:border-primary/30"
                                    )}>
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1 overflow-hidden">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isOverdue && (
                                                    <span className="text-[9px] font-black uppercase bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded shrink-0">VENCIDO</span>
                                                )}
                                                {isToday && !isOverdue && (
                                                    <span className="text-[9px] font-black uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0">HOY</span>
                                                )}
                                                <span className="text-xs font-bold text-foreground truncate">{note.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 truncate">
                                                <span className="flex items-center gap-1 shrink-0"><CalendarIcon className="h-2.5 w-2.5" /> {format(parseISO(note.dueDate), 'dd/MM/yyyy')}</span>
                                                {note.supplier_name && (
                                                    <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded font-medium truncate">
                                                        <Building2 className="h-2.5 w-2.5 shrink-0" />
                                                        <span className="truncate">{note.supplier_name}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className={cn("text-xs md:text-sm font-black whitespace-nowrap", isOverdue ? "text-destructive" : "text-primary")}>
                                                ${note.amount.toLocaleString()}
                                            </span>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                onClick={() => removeNote(note.id)}
                                                disabled={isRemoving}
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    {notes.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5">
                            <div className={cn(
                                "flex justify-between items-center px-2 py-1.5 rounded-md border transition-colors gap-2",
                                todayTotal > 0 
                                    ? "bg-primary/10 border-primary/30" 
                                    : "bg-muted/50 border-border/20"
                            )}>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 truncate",
                                    todayTotal > 0 ? "text-primary" : "text-muted-foreground"
                                )}>
                                    <CalendarIcon className="h-3 w-3 shrink-0" /> Pagar Hoy / Vencido:
                                </span>
                                <span className={cn(
                                    "text-sm md:text-base font-black whitespace-nowrap shrink-0",
                                    todayTotal > 0 ? "text-primary" : "text-muted-foreground"
                                )}>
                                    ${todayTotal.toLocaleString()}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center px-2 gap-2">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/70 truncate">Monto Total General:</span>
                                <span className="text-xs md:text-sm font-black text-foreground/70 whitespace-nowrap shrink-0">
                                    ${totalNotes.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
};

export default QuickNotesSection;
