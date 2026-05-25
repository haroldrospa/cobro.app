
import React, { useState } from 'react';
import { Plus, X, Trash2, List } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export const ManageCategoriesDialog = () => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { data: categories = [], isLoading } = useCategories();
    const createCategory = useCreateCategory();
    const deleteCategory = useDeleteCategory();
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

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar la categoría "${name}"? Esto podría afectar productos asociados.`)) return;

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
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="shrink-0" title="Gestionar Categorías">
                    <List className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Gestionar Categorías</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 mb-4 mt-2">
                    <Input
                        placeholder="Nueva categoría..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    />
                    <Button type="button" onClick={handleAddCategory} disabled={createCategory.isPending}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="text-sm font-medium mb-2 text-muted-foreground">Categorías Existentes</div>
                <Separator className="mb-2" />

                <ScrollArea className="h-[300px] w-full pr-4">
                    <div className="space-y-2">
                        {isLoading ? (
                            <p className="text-center text-muted-foreground py-4">Cargando...</p>
                        ) : categories.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No hay categorías.</p>
                        ) : (
                            categories.map((cat) => (
                                <div key={cat.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted group">
                                    <span className="truncate max-w-[280px]">{cat.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                        disabled={deleteCategory.isPending}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
