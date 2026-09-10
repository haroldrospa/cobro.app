import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, DollarSign, StickyNote, ChevronDown, ChevronUp, RefreshCcw, Building2, ChevronsUpDown, X, Check, Search, Phone, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
    const { suppliers, createSupplier, isCreating: isCreatingSupplier } = useSuppliers();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState<Date>(new Date());
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [searchSupplier, setSearchSupplier] = useState('');
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
    const [newSupplierForm, setNewSupplierForm] = useState({
        name: '',
        phone: '',
        rnc: '',
        bank_name: '',
        bank_account_number: '',
    });
    const { toast } = useToast();

    const filteredSuppliers = suppliers.filter(s => {
        const query = searchSupplier.toLowerCase().trim();
        if (!query) return true;
        return (
            s.name.toLowerCase().includes(query) ||
            (s.phone && s.phone.toLowerCase().includes(query)) ||
            (s.rnc && s.rnc.toLowerCase().includes(query))
        );
    });

    const handleSelectSupplier = (supplierName: string) => {
        setSelectedSupplier(supplierName);
        if (!name.trim()) setName(supplierName);
        setSupplierOpen(false);
        setSearchSupplier('');
    };

    const handleQuickCreateSupplier = async (supplierName: string) => {
        const trimmed = supplierName.trim();
        if (!trimmed) return;
        try {
            await createSupplier({ name: trimmed });
            setSelectedSupplier(trimmed);
            if (!name.trim()) setName(trimmed);
            setSearchSupplier('');
            setSupplierOpen(false);
            toast({
                title: "Proveedor creado",
                description: `"${trimmed}" se ha registrado y seleccionado.`,
            });
        } catch (err: any) {
            console.error("Error creating supplier inline:", err);
        }
    };

    const handleSaveSupplierModal = async () => {
        const trimmedName = newSupplierForm.name.trim();
        if (!trimmedName) {
            toast({
                title: "Nombre requerido",
                description: "Por favor ingresa el nombre del proveedor",
                variant: "destructive"
            });
            return;
        }

        try {
            await createSupplier({
                name: trimmedName,
                phone: newSupplierForm.phone.trim() || null,
                rnc: newSupplierForm.rnc.trim() || null,
                bank_name: newSupplierForm.bank_name.trim() || null,
                bank_account_number: newSupplierForm.bank_account_number.trim() || null,
            });
            setSelectedSupplier(trimmedName);
            if (!name.trim()) setName(trimmedName);
            setIsAddSupplierModalOpen(false);
            setNewSupplierForm({ name: '', phone: '', rnc: '', bank_name: '', bank_account_number: '' });
            toast({
                title: "Proveedor creado",
                description: `"${trimmedName}" se ha guardado y seleccionado.`,
            });
        } catch (err: any) {
            console.error("Error creating supplier modal:", err);
        }
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
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden w-full transition-all shadow-xs">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <StickyNote className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-semibold text-foreground tracking-tight">Notas y Pendientes</span>
                    {notes.length > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
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
                    <div className="space-y-2 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                        {/* Supplier Selector Row */}
                        <div className="flex items-center gap-1.5">
                            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "flex-1 h-8 text-xs justify-between font-normal bg-background hover:bg-accent/40 px-2.5 rounded-lg border-border/60 transition-all",
                                            selectedSupplier ? "text-foreground font-medium border-emerald-500/40 bg-emerald-500/5" : "text-muted-foreground"
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5 truncate">
                                            <Building2 className={cn("h-3.5 w-3.5 shrink-0", selectedSupplier ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                                            <span className="truncate">{selectedSupplier || "Proveedor (opcional)"}</span>
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                            {selectedSupplier && (
                                                <span 
                                                    role="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSupplier('');
                                                    }}
                                                    className="p-0.5 hover:bg-muted-foreground/20 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Quitar proveedor"
                                                >
                                                    <X className="h-3 w-3" />
                                                </span>
                                            )}
                                            <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                        </div>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[270px] p-0 shadow-lg border-border/60 rounded-xl overflow-hidden" align="start">
                                    <div className="flex flex-col">
                                        {/* Search Header */}
                                        <div className="flex items-center px-2.5 py-1.5 border-b border-border/40 bg-muted/20">
                                            <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                                            <input
                                                placeholder="Buscar o crear proveedor..."
                                                value={searchSupplier}
                                                onChange={(e) => setSearchSupplier(e.target.value)}
                                                className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
                                                autoFocus
                                            />
                                            {searchSupplier && (
                                                <button onClick={() => setSearchSupplier('')} className="p-1 text-muted-foreground hover:text-foreground">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>

                                        {/* List items */}
                                        <div className="max-h-48 overflow-y-auto p-1 text-xs space-y-0.5 scrollbar-thin">
                                            {/* Quick create item when user types something not existing */}
                                            {searchSupplier.trim() && !suppliers.some(s => s.name.toLowerCase() === searchSupplier.trim().toLowerCase()) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickCreateSupplier(searchSupplier)}
                                                    disabled={isCreatingSupplier}
                                                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold transition-colors border border-emerald-500/20 mb-1"
                                                >
                                                    <Plus className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">Crear "{searchSupplier.trim()}"</span>
                                                </button>
                                            )}

                                            {selectedSupplier && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSupplier('');
                                                        setSupplierOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded-lg text-muted-foreground hover:bg-muted/40 italic text-[11px]"
                                                >
                                                    — Sin proveedor
                                                </button>
                                            )}

                                            {filteredSuppliers.map((s) => {
                                                const isSelected = selectedSupplier === s.name;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => handleSelectSupplier(s.name)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-lg transition-colors hover:bg-accent text-xs",
                                                            isSelected && "bg-primary/10 text-primary font-medium"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="truncate">{s.name}</span>
                                                                {s.phone && (
                                                                    <span className="text-[10px] text-muted-foreground truncate">{s.phone}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
                                                    </button>
                                                );
                                            })}

                                            {filteredSuppliers.length === 0 && !searchSupplier.trim() && (
                                                <div className="py-4 text-center text-muted-foreground text-xs">
                                                    No hay proveedores registrados.
                                                </div>
                                            )}

                                            {filteredSuppliers.length === 0 && searchSupplier.trim() && (
                                                <div className="py-2 text-center text-muted-foreground text-[11px]">
                                                    Toca arriba para crear este proveedor
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer Action */}
                                        <div className="p-1.5 border-t border-border/40 bg-muted/20">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSupplierOpen(false);
                                                    setNewSupplierForm({
                                                        name: searchSupplier.trim(),
                                                        phone: '',
                                                        rnc: '',
                                                        bank_name: '',
                                                        bank_account_number: ''
                                                    });
                                                    setIsAddSupplierModalOpen(true);
                                                }}
                                                className="w-full justify-center h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
                                            >
                                                <Plus className="h-3 w-3" />
                                                Crear con teléfono / RNC
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Shortcut Button to open full add supplier modal */}
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    setNewSupplierForm({
                                        name: '',
                                        phone: '',
                                        rnc: '',
                                        bank_name: '',
                                        bank_account_number: ''
                                    });
                                    setIsAddSupplierModalOpen(true);
                                }}
                                className="h-8 w-8 shrink-0 rounded-lg border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-muted-foreground"
                                title="Registrar nuevo proveedor"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Concept Row */}
                        <div>
                            <Input
                                placeholder="Concepto o descripción..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                className="h-8 text-xs bg-background rounded-lg border-border/60 placeholder:text-muted-foreground/70"
                            />
                        </div>

                        {/* Amount, Date & Submit Row */}
                        <div className="flex items-center gap-1.5">
                            <div className="relative flex-1 min-w-0">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                    className="h-8 text-xs bg-background pl-6 pr-2 rounded-lg border-border/60 font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
                                />
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-8 text-xs px-2.5 rounded-lg bg-background border-border/60 shrink-0 font-medium gap-1.5",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>{date ? format(date, "dd/MM", { locale: es }) : "Fecha"}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-xl" align="end">
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
                                size="sm" 
                                className="h-8 px-3 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1 shadow-sm transition-all" 
                                onClick={handleAdd}
                                disabled={isAdding || isLoading}
                                title="Agregar pendiente"
                            >
                                {isAdding ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                <span>Agregar</span>
                            </Button>
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className={cn(
                        notes.length > 0 || isLoading ? "max-h-48 overflow-y-auto" : "h-0 overflow-hidden",
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
                                        "group flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all text-xs",
                                        isOverdue
                                            ? "bg-rose-500/[0.08] dark:bg-rose-950/30 border-rose-500/40 hover:border-rose-500/60"
                                            : isToday
                                            ? "bg-emerald-500/[0.08] dark:bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-500/60"
                                            : "bg-background/80 border-border/50 hover:border-border hover:bg-background"
                                    )}
                                >
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isOverdue && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded shrink-0">
                                                    Vencido
                                                </span>
                                            )}
                                            {isToday && !isOverdue && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                                                    Hoy
                                                </span>
                                            )}
                                            <span className="font-semibold text-foreground truncate">{note.name}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span className="flex items-center gap-1 shrink-0">
                                                <CalendarIcon className="h-3 w-3 opacity-70" />
                                                {format(parseISO(note.dueDate), 'dd/MM/yyyy')}
                                            </span>
                                            {note.supplier_name && (
                                                <>
                                                    <span className="opacity-40">•</span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md border border-border/30 max-w-[130px] truncate">
                                                        <Building2 className="h-2.5 w-2.5 opacity-70 shrink-0" />
                                                        <span className="truncate">{note.supplier_name}</span>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={cn(
                                            "font-bold text-xs tabular-nums",
                                            isOverdue ? "text-rose-600 dark:text-rose-300 font-extrabold" : isToday ? "text-emerald-600 dark:text-emerald-300 font-bold" : "text-foreground"
                                        )}>
                                            ${(note.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </span>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
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

                    {/* Minimalist Summary Footer */}
                    {notes.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                            {todayTotal > 0 && (
                                <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-rose-500/15 dark:bg-rose-950/50 border border-rose-500/40 text-rose-600 dark:text-rose-300 shadow-xs">
                                    <span className="text-[11px] font-bold flex items-center gap-1.5">
                                        <CalendarIcon className="h-3.5 w-3.5 text-rose-500 dark:text-rose-300" /> Pagar Hoy / Vencido:
                                    </span>
                                    <span className="font-extrabold text-xs tabular-nums text-rose-600 dark:text-rose-200">
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

            {/* Modal Dialog: Crear Nuevo Proveedor */}
            <Dialog open={isAddSupplierModalOpen} onOpenChange={setIsAddSupplierModalOpen}>
                <DialogContent className="sm:max-w-[420px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <Building2 className="h-4 w-4" />
                            </div>
                            Nuevo Proveedor
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Registra el proveedor para asociarlo rápidamente a compras y pendientes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="sup-name" className="text-xs font-semibold">
                                Nombre o Empresa <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="sup-name"
                                placeholder="Ej. Distribuidora Central, Cervecería..."
                                value={newSupplierForm.name}
                                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveSupplierModal();
                                }}
                                className="h-9 text-xs"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="sup-phone" className="text-xs font-semibold">
                                    Teléfono
                                </Label>
                                <Input
                                    id="sup-phone"
                                    placeholder="Ej. 809-555-0123"
                                    value={newSupplierForm.phone}
                                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sup-rnc" className="text-xs font-semibold">
                                    RNC / Cédula
                                </Label>
                                <Input
                                    id="sup-rnc"
                                    placeholder="Ej. 130-12345-6"
                                    value={newSupplierForm.rnc}
                                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, rnc: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="sup-bank" className="text-xs font-semibold">
                                    Banco (Opcional)
                                </Label>
                                <Input
                                    id="sup-bank"
                                    placeholder="Ej. Banreservas, BHD..."
                                    value={newSupplierForm.bank_name}
                                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, bank_name: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sup-account" className="text-xs font-semibold">
                                    No. Cuenta (Opcional)
                                </Label>
                                <Input
                                    id="sup-account"
                                    placeholder="Ej. 960-123456-7"
                                    value={newSupplierForm.bank_account_number}
                                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, bank_account_number: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddSupplierModalOpen(false)}
                            className="text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveSupplierModal}
                            disabled={isCreatingSupplier || !newSupplierForm.name.trim()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                        >
                            {isCreatingSupplier ? (
                                <RefreshCcw className="h-3 w-3 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )}
                            Guardar y Seleccionar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default QuickNotesSection;
