import React, { useState } from 'react';
import { Plus, X, Trash2, List, Pencil, Check, FolderCog, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ManageCategoriesDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export const ManageCategoriesDialog: React.FC<ManageCategoriesDialogProps> = ({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    trigger
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const { data: categories = [], isLoading } = useCategories();
    const createCategory = useCreateCategory();
    const deleteCategory = useDeleteCategory();
    const updateCategory = useUpdateCategory();
    const { toast } = useToast();

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;

        try {
            await createCategory.mutateAsync({ name: newCategoryName.trim() });
            toast({ title: "Categoría creada", description: newCategoryName });
            setNewCategoryName('');
        } catch (error) {
            toast({
                title: "Error al crear",
                description: "No se pudo crear la categoría.",
                variant: "destructive"
            });
        }
    };

    const handleStartEdit = (id: string, name: string) => {
        setEditingId(id);
        setEditingName(name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editingName.trim()) return;

        try {
            await updateCategory.mutateAsync({ id, name: editingName.trim() });
            toast({ title: "Categoría actualizada", description: `Nuevo nombre: ${editingName.trim()}` });
            setEditingId(null);
            setEditingName('');
        } catch (error: any) {
            toast({
                title: "Error al actualizar",
                description: error.message || "No se pudo actualizar la categoría.",
                variant: "destructive"
            });
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar la categoría "${name}"? Los productos asignados quedarán como 'Sin categoría'.`)) return;

        try {
            await deleteCategory.mutateAsync(id);
            toast({ title: "Categoría eliminada", description: name });
        } catch (error: any) {
            toast({
                title: "Error al eliminar",
                description: error.message || "No se pudo eliminar la categoría.",
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger ? (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            ) : !isControlled && (
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="shrink-0" title="Gestionar Categorías">
                        <List className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[440px] p-6 rounded-2xl bg-card border border-border shadow-2xl">
                <DialogHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <FolderCog className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Gestionar Categorías</DialogTitle>
                            <p className="text-xs text-muted-foreground">Crea, edita el nombre o elimina categorías</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex gap-2 my-2">
                    <Input
                        placeholder="Nueva categoría (ej. Bebidas, Postres)..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        className="rounded-xl h-10 text-sm"
                    />
                    <Button 
                        type="button" 
                        onClick={handleAddCategory} 
                        disabled={createCategory.isPending || !newCategoryName.trim()}
                        className="rounded-xl h-10 px-4 shrink-0 font-medium"
                    >
                        {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex items-center justify-between mt-3 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Categorías Existentes ({categories.length})
                    </span>
                </div>
                <Separator className="mb-2 opacity-50" />

                <ScrollArea className="h-[280px] w-full pr-3">
                    <div className="space-y-1.5">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <p className="text-xs">Cargando categorías...</p>
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-xs">
                                No tienes categorías registradas aún.
                            </div>
                        ) : (
                            categories.map((cat) => {
                                const isEditing = editingId === cat.id;

                                if (isEditing) {
                                    return (
                                        <div key={cat.id} className="flex items-center gap-1.5 p-1.5 bg-accent/30 rounded-xl border border-primary/30">
                                            <Input
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit(cat.id);
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                autoFocus
                                                className="h-8 text-xs rounded-lg flex-1"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleSaveEdit(cat.id)}
                                                disabled={updateCategory.isPending || !editingName.trim()}
                                                className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                                                title="Guardar cambio"
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelEdit}
                                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted rounded-lg"
                                                title="Cancelar"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/60 transition-colors group border border-transparent hover:border-border/40">
                                        <div className="flex items-center gap-2 truncate pr-2">
                                          <span className="h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                                          <span className="text-xs font-medium text-foreground truncate">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                                onClick={() => handleStartEdit(cat.id, cat.name)}
                                                title="Modificar nombre"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                disabled={deleteCategory.isPending}
                                                title="Eliminar categoría"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
