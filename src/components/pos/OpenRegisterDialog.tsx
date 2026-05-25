import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Wallet, UserCircle, Store } from 'lucide-react';
import { useOpenSession, useOpenSessions } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStore } from '@/hooks/useUserStore';
import { supabase } from '@/integrations/supabase/client';

interface OpenRegisterDialogProps {
    isOpen: boolean;
    onOpenChange?: (open: boolean) => void;
}

const OpenRegisterDialog: React.FC<OpenRegisterDialogProps> = ({ isOpen, onOpenChange }) => {
    const [initialCash, setInitialCash] = useState<string>(() => {
        return localStorage.getItem('cobro_suggested_next_fondo') || '';
    });
    const [isSuccess, setIsSuccess] = useState(false);
    const openSession = useOpenSession();
    const { profile } = useUserProfile();
    const { data: store } = useUserStore();
    const { toast } = useToast();

    // Reset state when dialog opens to ensure fresh form
    React.useEffect(() => {
        if (isOpen) {
            const suggested = localStorage.getItem('cobro_suggested_next_fondo') || '';
            setInitialCash(suggested);
            setIsSuccess(false);
        }
    }, [isOpen]);

    // If locally successful, force close visually even if parent prop hasn't updated yet
    if (isSuccess && !isOpen) return null;

    const handleOpenRegister = async () => {
        const amount = parseFloat(initialCash);
        if (isNaN(amount) || amount < 0) {
            toast({
                title: 'Monto inválido',
                description: 'Por favor ingrese un monto inicial válido.',
                variant: 'destructive'
            });
            return;
        }

        try {
            await openSession.mutateAsync({ initialCash: amount });
            toast({
                title: 'Caja Aperturada',
                description: `Caja iniciada con RD$ ${amount.toLocaleString()}`
            });
            setIsSuccess(true);
            if (onOpenChange) onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            let description = error.message || 'No se pudo aperturar la caja. Intente nuevamente.';

            if (error?.code === '42P01' || error?.message?.includes('relation "public.cash_sessions" does not exist')) {
                description = "Error Crítico: Faltan tablas en la base de datos (cash_sessions). Contacte al administrador para ejecutar las migraciones pendientes.";
            }

            toast({
                title: 'Error de Apertura',
                description: description,
                variant: 'destructive',
                duration: 5000
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className="sm:max-w-md border-2 border-primary/20 shadow-2xl" 
            >
                <DialogHeader className="pt-2 pb-1">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="relative">
                            <div className="p-3 bg-primary/10 rounded-full animate-pulse">
                                <UserCircle className="h-10 w-10 text-primary" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 p-0.5 bg-green-500 rounded-full border-2 border-background">
                                <span className="block h-2 w-2 rounded-full" />
                            </div>
                        </div>
                        
                        <div className="text-center space-y-0.5">
                            <h2 className="text-xl font-extrabold tracking-tight text-primary">
                                ¡Bienvenido, {profile?.full_name || 'Cajero'}!
                            </h2>
                            {store?.store_name && (
                                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold">
                                    <Store className="h-3 w-3 text-primary/70" />
                                    {store.store_name}
                                </p>
                            )}
                        </div>

                        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-1" />
                    </div>
                    
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold justify-center pt-1">
                        <Wallet className="h-5 w-5 text-green-600" />
                        Inicio de Turno
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm">
                        Defina el **fondo inicial** disponible en caja.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-1 space-y-2">
                    <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border/50">
                        <div className="space-y-2">
                            <Label htmlFor="initial-cash" className="text-sm font-semibold">
                                ¿Con cuánto efectivo inicia la caja?
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">RD$</span>
                                <Input
                                    id="initial-cash"
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-14 h-12 text-xl font-bold bg-background border-2 border-primary/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                                    value={initialCash}
                                    onChange={(e) => setInitialCash(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleOpenRegister();
                                    }}
                                    autoFocus
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                <AlertCircle className="h-2.5 w-2.5" />
                                Este es el dinero físico que se dejará en caja para dar cambio.
                            </p>
                        </div>
                    </div>

                    <ActiveSessionsWarning />
                </div>

                <DialogFooter className="mt-1">
                    <Button
                        className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                        size="lg"
                        onClick={handleOpenRegister}
                        disabled={!initialCash || openSession.isPending}
                    >
                        {openSession.isPending ? 'Abriendo Turno...' : 'Abrir Turno de Caja'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ActiveSessionsWarning = () => {
    const { profile } = useUserProfile();
    
    // Fetch currently open sessions for the store
    const { data: openSessions, isLoading } = useOpenSessions();

    if (isLoading || !openSessions || openSessions.length === 0) return null;

    return (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500">
            <AlertCircle className="h-4 w-4 stroke-red-500" />
            <AlertTitle className="font-bold">¡Atención! Turnos ya abiertos</AlertTitle>
            <AlertDescription className="text-xs mt-2 space-y-2">
                <p>Actualmente hay cajas abiertas por otros usuarios. Para evitar descuadres, considere cerrar los turnos anteriores antes de abrir uno nuevo.</p>
                <div className="bg-red-500/10 p-2 rounded-lg">
                    <ul className="space-y-2">
                        {openSessions.map((s: any) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 text-[10px] bg-background/50 p-2 rounded-md border border-red-500/10">
                                <div className="flex flex-col">
                                    <span className="font-bold">{s.opener?.full_name || 'Usuario desconocido'}</span>
                                    <span className="text-[9px] opacity-70">Abierto el {new Date(s.opened_at).toLocaleDateString()} a las {new Date(s.opened_at).toLocaleTimeString()}</span>
                                </div>
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-7 px-2 text-[9px] font-black uppercase"
                                    onClick={async () => {
                                        try {
                                            const { error } = await supabase
                                                .from('cash_sessions')
                                                .update({ 
                                                    status: 'closed', 
                                                    closed_at: new Date().toISOString(),
                                                    closed_by: profile?.id 
                                                })
                                                .eq('id', s.id);
                                            
                                            if (error) throw error;
                                            
                                            toast({ title: 'Turno cerrado', description: 'El turno se ha cerrado correctamente.' });
                                            // Trigger refetch
                                            window.location.reload(); 
                                        } catch (err: any) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.message });
                                        }
                                    }}
                                >
                                    Cerrar Turno
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </AlertDescription>
        </Alert>
    );
};

export default OpenRegisterDialog;
