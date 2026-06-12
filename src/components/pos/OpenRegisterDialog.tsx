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
                className="w-[calc(100%-1.5rem)] sm:max-w-md p-4 sm:p-6 border border-emerald-500/20 shadow-2xl gap-3 sm:gap-4 overflow-y-auto max-h-[90dvh] sm:max-h-[85dvh]" 
            >
                <DialogHeader className="pt-1 sm:pt-2 pb-1 sm:pb-2">
                    <div className="flex flex-col items-center justify-center text-center space-y-1 sm:space-y-2">
                        {/* Compact Store Pill Badge */}
                        {store?.store_name && (
                            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm animate-fade-in">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] sm:text-xs font-bold text-emerald-500 tracking-wide uppercase">
                                    {store.store_name}
                                </span>
                            </div>
                        )}

                        {/* Welcoming Title */}
                        <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 pt-1">
                            <span className="text-muted-foreground font-medium text-base sm:text-xl">
                                ¡Hola, {profile?.full_name?.split(' ')[0] || 'Cajero'}!
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/30">|</span>
                            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent flex items-center gap-1.5 font-extrabold">
                                <Wallet className="h-5 w-5 text-emerald-500" />
                                Inicio de Turno
                            </span>
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground max-w-xs sm:max-w-sm">
                            Defina el <strong className="font-semibold text-foreground">fondo inicial</strong> en efectivo para abrir la caja.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="py-0.5 sm:py-1 space-y-3">
                    {/* Glassmorphic Form Card */}
                    <div className="bg-muted/40 backdrop-blur-md p-4 rounded-2xl border border-border/40 shadow-inner space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="initial-cash" className="text-xs sm:text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                                ¿Con cuánto efectivo inicia la caja?
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold">RD$</span>
                                <Input
                                    id="initial-cash"
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-14 h-11 sm:h-12 text-xl font-bold bg-background border-2 border-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 rounded-xl transition-all"
                                    value={initialCash}
                                    onChange={(e) => setInitialCash(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleOpenRegister();
                                    }}
                                    autoFocus
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-normal flex items-start gap-1">
                                <AlertCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>Este es el dinero físico que se dejará en caja para dar cambio.</span>
                            </p>
                        </div>
                    </div>

                    <ActiveSessionsWarning />
                </div>

                <DialogFooter className="mt-0.5 sm:mt-1">
                    <Button
                        className="w-full h-11 sm:h-12 text-sm sm:text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98] transition-all rounded-xl border-0"
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
    const { toast } = useToast();
    
    // Fetch currently open sessions for the store
    const { data: openSessions, isLoading } = useOpenSessions();

    if (isLoading || !openSessions || openSessions.length === 0) return null;

    return (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 p-3 rounded-xl">
            <AlertCircle className="h-4 w-4 stroke-red-500" />
            <AlertTitle className="font-bold text-xs sm:text-sm">¡Atención! Turnos ya abiertos</AlertTitle>
            <AlertDescription className="text-[11px] sm:text-xs mt-1.5 space-y-1.5 leading-normal">
                <p>Actualmente hay cajas abiertas por otros usuarios. Considere cerrar los turnos anteriores antes de abrir uno nuevo.</p>
                <div className="bg-red-500/5 p-1.5 rounded-lg border border-red-500/10 mt-1 max-h-[120px] overflow-y-auto">
                    <ul className="space-y-1.5">
                        {openSessions.map((s: any) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px] bg-background/60 p-1.5 rounded-md border border-red-500/5">
                                <div className="flex flex-col">
                                    <span className="font-bold text-foreground">{s.opener?.full_name || 'Usuario'}</span>
                                    <span className="text-[8px] opacity-70">Abierto el {new Date(s.opened_at).toLocaleDateString()} a las {new Date(s.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-6 px-2 text-[8px] sm:text-[9px] font-black uppercase rounded-md"
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
                                            window.location.reload(); 
                                        } catch (err: any) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.message });
                                        }
                                    }}
                                >
                                    Cerrar
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
