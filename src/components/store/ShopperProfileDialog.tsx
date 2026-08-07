import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    MapPin, Save, User, Loader2, ShoppingBag, LogIn, UserPlus, LogOut,
    ClipboardList, Settings, Navigation, CheckCircle2, CreditCard,
    Eye, EyeOff, Package, ChevronRight, ChevronLeft, Phone, ArrowRight,
    Sparkles, MessageCircle, Mail, Lock
} from 'lucide-react';
import OrderChatPanel from '../pos/OrderChatPanel';
import { useToast } from '@/hooks/use-toast';
import { ShopperProfile, emptyProfile } from '@/hooks/useShopperProfile';
import { useShopperAuth } from '@/hooks/useShopperAuth';
import { useShopperOrders } from '@/hooks/useShopperOrders';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrderTracker } from './OrderTracker';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { motion, AnimatePresence } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

/* ─────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────── */
interface ShopperProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentProfile: ShopperProfile | null;
    onSave: (profile: ShopperProfile) => void;
    requiresCompletion?: boolean;
    shopType?: string;
    storeId?: string;
    storeName?: string;
    logoUrl?: string;
    companyPhone?: string;
    companyAddress?: string;
    companyEmail?: string;
    companyDescription?: string;
    defaultView?: 'orders' | 'settings';
    cartItemsCount?: number;
    cartTotal?: number;
    onViewCart?: () => void;
}

type AuthMode = 'login' | 'register';
type RegisterStep = 1 | 2 | 3; // 1=Name, 2=Email+Pass, 3=Cédula
type ActiveView = 'orders' | 'settings';

/* ─────────────────────────────────────────────────────────
   STEP INDICATOR COMPONENT
───────────────────────────────────────────────────────── */
const StepDots: React.FC<{ current: RegisterStep }> = ({ current }) => (
    <div className="flex items-center justify-center gap-2 mt-2">
        {([1, 2, 3] as RegisterStep[]).map((s) => (
            <motion.div
                key={s}
                animate={{
                    width: current === s ? 24 : 8,
                    backgroundColor: current === s ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="h-2 rounded-full"
            />
        ))}
    </div>
);

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export const ShopperProfileDialog: React.FC<ShopperProfileDialogProps> = ({
    open,
    onOpenChange,
    currentProfile,
    onSave,
    requiresCompletion = false,
    shopType,
    storeId,
    storeName,
    logoUrl,
    companyPhone,
    companyAddress,
    companyEmail,
    companyDescription,
    defaultView,
    cartItemsCount = 0,
    cartTotal = 0,
    onViewCart,
}) => {
    const { user, loading: authLoading, signIn, signUp, signOut } = useShopperAuth();
    const { toast } = useToast();

    /* ── Auth / Register state ── */
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [regStep, setRegStep] = useState<RegisterStep>(1);
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regCedula, setRegCedula] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [regDone, setRegDone] = useState(false); // confetti trigger
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    /* ── Logged-in view ── */
    const [activeView, setActiveView] = useState<ActiveView>('orders');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);

    const { data: orders = [], isLoading: ordersLoading } = useShopperOrders(
        user?.email || currentProfile?.email || '',
        currentProfile?.phone || ''
    );

    const { data: unreadCounts = {} } = useUnreadCounts(
        orders.map((o: any) => o.id),
        'customer'
    );

    const { register, handleSubmit, setValue, reset, watch } = useForm<ShopperProfile>({
        defaultValues: emptyProfile(),
    });
    const watchedLat = watch('deliveryLat');
    const watchedLng = watch('deliveryLng');

    /* ── Reset on open/close ── */
    useEffect(() => {
        if (open) {
            if (user) {
                if (defaultView) {
                    setActiveView(defaultView);
                } else {
                    setActiveView(requiresCompletion ? 'settings' : 'orders');
                }
                const base = currentProfile || emptyProfile();
                reset(base);
                if (user.email) setValue('email', user.email);
                if (user.user_metadata?.full_name && !base.name) setValue('name', user.user_metadata.full_name);
            } else {
                setAuthMode('login');
                setRegStep(1);
                setRegDone(false);
            }
        }
    }, [open, user, defaultView]);

    /* ── Auto-expand active orders ── */
    useEffect(() => {
        if (orders.length > 0 && !expandedOrder) {
            const active = orders.find((o: any) =>
                !['delivered', 'cancelled', 'completed'].includes(o.order_status)
            );
            if (active) setExpandedOrder(active.id);
        }
    }, [orders]);

    /* ─────────────────────────────────────────
       CONFETTI BURST
    ───────────────────────────────────────── */
    const fireConfetti = () => {
        const colors = ['#22c55e', '#16a34a', '#fbbf24', '#f59e0b', '#ffffff', '#10b981'];

        const fire = (particleRatio: number, opts: confetti.Options) => {
            confetti({
                origin: { y: 0.6 },
                colors,
                ...opts,
                particleCount: Math.floor(200 * particleRatio),
            });
        };

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    /* ─────────────────────────────────────────
       REGISTER FLOW
    ───────────────────────────────────────── */
    const formatCedula = (v: string) => {
        const d = v.replace(/\D/g, '').slice(0, 11);
        if (d.length <= 3) return d;
        if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
        return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
    };

    const handleRegisterStep = async () => {
        if (regStep === 1) {
            if (!regName.trim()) {
                toast({ title: 'Campo requerido', description: 'Escribe tu nombre.', variant: 'destructive' });
                return;
            }
            setRegStep(2);
        } else if (regStep === 2) {
            if (!regEmail.trim() || !regPassword.trim()) {
                toast({ title: 'Campos requeridos', description: 'Completa tu correo y contraseña.', variant: 'destructive' });
                return;
            }
            if (regPassword.length < 6) {
                toast({ title: 'Contraseña muy corta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
                return;
            }
            setRegStep(3);
        } else if (regStep === 3) {
            const cid = regCedula.replace(/\D/g, '');
            if (cid.length !== 11) {
                toast({ title: 'Cédula inválida', description: 'La cédula debe tener 11 dígitos.', variant: 'destructive' });
                return;
            }
            // Create account
            try {
                await signUp(regEmail, regPassword, regName);
                // Save cedula to profile after sign-up
                const baseProfile: ShopperProfile = {
                    ...emptyProfile(),
                    name: regName,
                    email: regEmail,
                    cedula: regCedula,
                };
                await onSave(baseProfile);
                setRegDone(true);
                setTimeout(() => fireConfetti(), 300);
            } catch {
                // toast handled in hook
            }
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signIn(loginEmail, loginPassword);
        } catch {
            // toast handled in hook
        }
    };

    /* ─────────────────────────────────────────
       GPS
    ───────────────────────────────────────── */
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast({ title: 'Error', description: 'Geolocalización no soportada.', variant: 'destructive' });
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                setValue('deliveryLat', coords.latitude);
                setValue('deliveryLng', coords.longitude);
                setValue('locationUrl', `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`);
                setGettingLocation(false);
                toast({ title: '📍 Ubicación confirmada', description: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` });
            },
            () => {
                setGettingLocation(false);
                toast({ title: 'Error de ubicación', description: 'Permite el acceso a tu ubicación.', variant: 'destructive' });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const onSubmitSettings = async (data: ShopperProfile) => {
        const cedulaClean = (data.cedula || '').replace(/\D/g, '');
        if (cedulaClean.length !== 11) {
            toast({ title: 'Cédula inválida', description: 'La cédula debe tener 11 dígitos.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await onSave(data);
            toast({ title: '✅ Datos guardados', description: 'Tu perfil ha sido actualizado.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        setAuthMode('login');
    };

    /* ─────────────────────────────────────────
       STATUS BADGE
    ───────────────────────────────────────── */
    const getStatusBadge = (status: string) => {
        const map: Record<string, { label: string; color: string }> = {
            pending: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
            confirmed: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            preparing: { label: 'Preparando', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
            shipped: { label: 'En camino', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            delivered: { label: 'Entregado', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
            completed: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
            cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
        };
        const s = map[status] || { label: status, color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
        return (
            <Badge variant="outline" className={cn('px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-tight', s.color)}>
                {s.label}
            </Badge>
        );
    };

    const hasGPS = !!(watchedLat && watchedLng);

    /* ═════════════════════════════════════════════════════════
       VIEWS
    ═════════════════════════════════════════════════════════ */

    /* ── LOGIN ── */
    const renderLogin = () => (
        <div className="flex flex-col px-4 sm:px-6 pb-6 pt-4 space-y-5">
            {/* Header / Brand Card */}
            <div className="flex flex-col items-center text-center space-y-2 pt-2">
                {logoUrl ? (
                    <div className="relative mb-1 group">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full transition-all group-hover:bg-primary/30" />
                        <img 
                            src={logoUrl} 
                            alt={storeName || 'Logo'} 
                            className="h-16 w-16 object-contain rounded-2xl bg-white p-2 border border-border shadow-lg relative" 
                        />
                    </div>
                ) : (
                    <div className="relative mb-1">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-lg relative border border-white/10">
                            <ShoppingBag className="h-6 w-6 text-white" />
                        </div>
                    </div>
                )}
                
                <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                        {storeName ? `Bienvenido a ${storeName}` : 'Bienvenido de vuelta'}
                    </h2>
                    {companyDescription && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[280px] line-clamp-2 italic">
                            "{companyDescription}"
                        </p>
                    )}
                </div>

                {(companyPhone || companyAddress) && (
                    <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border/50 max-w-[320px]">
                        {companyAddress && (
                            <span className="flex items-center gap-1 truncate max-w-[160px]">
                                <MapPin className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate">{companyAddress}</span>
                            </span>
                        )}
                        {companyAddress && companyPhone && <span className="text-muted-foreground/40">•</span>}
                        {companyPhone && (
                            <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-primary shrink-0" />
                                <span>{companyPhone}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-bold text-foreground/80 ml-1">
                        Correo electrónico
                    </Label>
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="login-email"
                            type="email"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            className="h-12 pl-10 rounded-xl bg-muted/40 border-border/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                            required
                        />
                    </div>
                </div>
                
                <div className="space-y-1.5">
                    <Label htmlFor="login-pass" className="text-xs font-bold text-foreground/80 ml-1">
                        Contraseña
                    </Label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="login-pass"
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-12 pl-10 pr-10 rounded-xl bg-muted/40 border-border/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                            required
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(p => !p)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground mt-2" 
                    disabled={authLoading}
                >
                    {authLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <span>Iniciar Sesión</span>
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    )}
                </Button>
            </form>

            {/* Footer / Switch mode */}
            <div className="pt-2 border-t border-border/40 text-center">
                <p className="text-xs text-muted-foreground">
                    ¿No tienes cuenta aún?{' '}
                    <button 
                        onClick={() => { setAuthMode('register'); setRegStep(1); setRegDone(false); }}
                        className="text-primary font-bold hover:underline transition-all ml-1"
                    >
                        Regístrate aquí
                    </button>
                </p>
            </div>
        </div>
    );

    /* ── REGISTER: Step content per step ── */
    const stepVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
    };

    const [stepDir, setStepDir] = useState(1);

    const goNext = () => { setStepDir(1); handleRegisterStep(); };
    const goBack = () => {
        setStepDir(-1);
        setRegStep(s => (s > 1 ? (s - 1) as RegisterStep : 1));
    };

    const stepConfig = [
        {
            step: 1 as RegisterStep,
            icon: '👋',
            title: '¿Cuál es tu nombre?',
            subtitle: 'Así sabremos cómo llamarte.',
        },
        {
            step: 2 as RegisterStep,
            icon: '📧',
            title: 'Tu correo y contraseña',
            subtitle: 'Para que puedas entrar a tu cuenta.',
        },
        {
            step: 3 as RegisterStep,
            icon: '🪪',
            title: 'Tu cédula de identidad',
            subtitle: 'Necesaria para verificar y agilizar tus pedidos.',
        },
    ];

    const currentStepConfig = stepConfig.find(s => s.step === regStep)!;

    /* ─ Success screen ─ */
    const renderSuccess = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 sm:py-12 px-6 text-center gap-6 sm:min-h-[480px] min-h-[400px]"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.2, duration: 0.6, type: 'spring' }}
                className="text-7xl"
            >
                🎉
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <h2 className="text-2xl font-black tracking-tight">¡Bienvenido, {regName.split(' ')[0]}!</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    Tu cuenta ha sido creada exitosamente. Ya puedes hacer pedidos y rastrear tu historial.
                </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Cuenta activada
                </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="w-full">
                <Button className="w-full h-12 font-bold text-base gap-2" onClick={() => onOpenChange(false)}>
                    <Sparkles className="h-4 w-4" />
                    ¡Empezar a comprar!
                </Button>
            </motion.div>
        </motion.div>
    );

    /* ─ Register multi-step ─ */
    const renderRegister = () => {
        if (regDone) return renderSuccess();

        return (
            <div className="flex flex-col sm:min-h-[520px] min-h-[440px]">
                {/* Header */}
                <div className="flex flex-col items-center pt-8 pb-4 px-6 text-center">
                    <motion.div
                        key={`icon-${regStep}`}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl mb-3"
                    >
                        {currentStepConfig.icon}
                    </motion.div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`title-${regStep}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h2 className="text-2xl font-black tracking-tight">{currentStepConfig.title}</h2>
                            <p className="text-sm text-muted-foreground mt-1">{currentStepConfig.subtitle}</p>
                        </motion.div>
                    </AnimatePresence>
                    <StepDots current={regStep} />
                </div>

                {/* Step form */}
                <div className="flex-1 px-6 pt-4 pb-2">
                    <AnimatePresence mode="wait" custom={stepDir}>
                        {regStep === 1 && (
                            <motion.div
                                key="step1"
                                custom={stepDir}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="reg-name">Nombre completo</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reg-name"
                                            value={regName}
                                            onChange={e => setRegName(e.target.value)}
                                            placeholder="Ej: Juan Pérez"
                                            className="h-13 pl-10 text-base h-12"
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {regStep === 2 && (
                            <motion.div
                                key="step2"
                                custom={stepDir}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="reg-email">Correo electrónico</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">@</span>
                                        <Input
                                            id="reg-email"
                                            type="email"
                                            value={regEmail}
                                            onChange={e => setRegEmail(e.target.value)}
                                            placeholder="ejemplo@correo.com"
                                            className="h-12 pl-8 text-base"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-pass">Contraseña</Label>
                                    <div className="relative">
                                        <Input
                                            id="reg-pass"
                                            type={showPassword ? 'text' : 'password'}
                                            value={regPassword}
                                            onChange={e => setRegPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            className="h-12 pr-10 text-base"
                                            minLength={6}
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                        <button type="button" onClick={() => setShowPassword(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {/* Strength indicator */}
                                    {regPassword.length > 0 && (
                                        <div className="flex gap-1 pt-1">
                                            {[1, 2, 3, 4].map(i => (
                                                <motion.div
                                                    key={i}
                                                    className={cn('h-1 flex-1 rounded-full transition-colors duration-300', {
                                                        'bg-red-400': regPassword.length >= i * 1 && regPassword.length < 6,
                                                        'bg-yellow-400': regPassword.length >= 6 && regPassword.length < 8 && i <= 2,
                                                        'bg-emerald-400': regPassword.length >= 8 && i <= 3,
                                                        'bg-emerald-500': regPassword.length >= 10,
                                                        'bg-muted': regPassword.length < i,
                                                    })}
                                                    initial={{ scaleX: 0 }}
                                                    animate={{ scaleX: regPassword.length >= i ? 1 : 0 }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {regStep === 3 && (
                            <motion.div
                                key="step3"
                                custom={stepDir}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="reg-cedula" className="flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                                        Cédula de Identidad
                                    </Label>
                                    <Input
                                        id="reg-cedula"
                                        value={regCedula}
                                        onChange={e => setRegCedula(formatCedula(e.target.value))}
                                        placeholder="000-0000000-0"
                                        className="h-14 font-mono tracking-[0.3em] text-2xl text-center"
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && goNext()}
                                    />
                                    <p className="text-xs text-muted-foreground text-center">
                                        Formato: 001-1234567-8 · 11 dígitos
                                    </p>
                                </div>

                                {/* Cedula digit progress */}
                                <div className="flex gap-1">
                                    {Array.from({ length: 11 }).map((_, i) => {
                                        const digits = regCedula.replace(/\D/g, '');
                                        return (
                                            <motion.div
                                                key={i}
                                                className={cn('h-1.5 flex-1 rounded-full transition-colors duration-200',
                                                    i < digits.length ? 'bg-primary' : 'bg-muted'
                                                )}
                                                animate={{ scaleY: i < digits.length ? 1.5 : 1 }}
                                                transition={{ duration: 0.15 }}
                                            />
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Navigation buttons */}
                <div className="px-6 pt-4 pb-2 space-y-3">
                    <Button
                        onClick={goNext}
                        disabled={authLoading}
                        className="w-full h-12 font-bold text-base gap-2"
                    >
                        {authLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : regStep === 3 ? (
                            <><UserPlus className="h-4 w-4" /> Crear mi Cuenta</>
                        ) : (
                            <>Continuar <ArrowRight className="h-4 w-4" /></>
                        )}
                    </Button>

                    {regStep > 1 && (
                        <Button variant="ghost" onClick={goBack} className="w-full h-10 text-muted-foreground gap-1">
                            <ChevronLeft className="h-4 w-4" /> Atrás
                        </Button>
                    )}
                </div>

                {/* Switch to login */}
                <div className="px-6 pb-6 text-center border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                        ¿Ya tienes cuenta?{' '}
                        <button onClick={() => setAuthMode('login')} className="text-primary font-bold hover:underline">
                            Inicia Sesión
                        </button>
                    </p>
                </div>
            </div>
        );
    };

    /* ── ORDERS VIEW ── */
    const renderOrders = () => {
        if (ordersLoading) return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Cargando tu historial...</p>
            </div>
        );

        const hasCart = cartItemsCount > 0;
        const hasOrders = orders.length > 0;

        if (!hasCart && !hasOrders) {
            return (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                        <Package className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">No tienes pedidos aún</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-[220px] mx-auto">
                            Cuando realices tu primera compra, aquí verás su estado en tiempo real.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Ir de compras
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {/* Active Cart Notification */}
                {hasCart && (
                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                                <ShoppingBag className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-foreground">Pedido en el Carrito</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {cartItemsCount} {cartItemsCount === 1 ? 'producto' : 'productos'} · ${cartTotal?.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <Button 
                            size="sm" 
                            className="w-full text-xs font-bold h-9" 
                            onClick={() => {
                                onOpenChange(false);
                                onViewCart?.();
                            }}
                        >
                            Ver y Completar Pedido
                        </Button>
                    </div>
                )}

                {/* Orders Section */}
                {hasOrders ? (
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                            Historial de Pedidos ({orders.length})
                        </p>
                        {orders.map((order: any) => {
                            const isExpanded = expandedOrder === order.id;
                            const isActive = !['delivered', 'cancelled', 'completed'].includes(order.order_status);
                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    className={cn(
                                        'rounded-2xl border cursor-pointer transition-all',
                                        isExpanded ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border/60 bg-card hover:border-primary/20'
                                    )}
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                >
                                    <div className="flex items-center gap-3 p-4">
                                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                            isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                                            <ShoppingBag className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">#{order.order_number}</p>
                                            <p className="text-sm font-bold truncate">{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            {getStatusBadge(order.order_status)}
                                            <span className="text-base font-black text-primary">${order.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="border-t mx-4 pt-3 pb-4">
                                                    <OrderTracker status={order.order_status} shopType={shopType} />
                                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            {order.payment_method?.toUpperCase()} • {order.source?.toUpperCase()}
                                                        </span>
                                                        {(storeId && storeName) && (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-8 gap-2 rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5 relative"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveChatOrderId(order.id);
                                                                }}
                                                            >
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                                Chat del Pedido
                                                                {unreadCounts[order.id] > 0 && (
                                                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background animate-pulse">
                                                                        {unreadCounts[order.id]}
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 text-center border border-dashed rounded-2xl bg-muted/10 border-border/50">
                        <Package className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No tienes pedidos anteriores finalizados.</p>
                    </div>
                )}

                {/* Chat Panel Overlay */}
                <AnimatePresence>
                    {activeChatOrderId && (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="fixed inset-0 z-50 bg-background flex flex-col p-4"
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <Button variant="ghost" size="sm" onClick={() => setActiveChatOrderId(null)} className="gap-1 px-0 hover:bg-transparent">
                                    ← Volver a mis pedidos
                                </Button>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    #{orders.find((o: any) => o.id === activeChatOrderId)?.order_number}
                                </span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <OrderChatPanel 
                                    orderId={activeChatOrderId}
                                    storeId={storeId!}
                                    customerName={currentProfile?.name || 'Cliente'}
                                    storeName={storeName!}
                                    isShopper={true}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    /* ── SETTINGS VIEW ── */
    const renderSettings = () => (
        <form onSubmit={handleSubmit(onSubmitSettings)} className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> Información Personal
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label htmlFor="s-name">Nombre y Apellido <span className="text-destructive">*</span></Label>
                    <Input id="s-name" {...register('name', { required: true })} placeholder="Juan Pérez" className="h-11" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="s-cedula" className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        Cédula <span className="text-destructive">*</span>
                    </Label>
                    <Input id="s-cedula" {...register('cedula', { required: true })}
                        placeholder="000-0000000-0"
                        className="h-11 font-mono tracking-widest text-lg"
                        onChange={e => setValue('cedula', formatCedula(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="s-phone">Teléfono <span className="text-destructive">*</span></Label>
                        <Input id="s-phone" {...register('phone', { required: true })} placeholder="(809) 000-0000" className="h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input {...register('email')} type="email" readOnly={!!user}
                            className={cn('h-11', user ? 'bg-muted cursor-not-allowed text-muted-foreground' : '')} />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Punto de Entrega
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label>Nombre del punto (opcional)</Label>
                    <Input {...register('locationLabel')} placeholder="Mi Casa, Trabajo..." className="h-11" />
                </div>

                {/* GPS box */}
                <div className={cn('rounded-xl border-2 p-4 space-y-3 transition-colors',
                    hasGPS ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'border-dashed border-border bg-muted/20')}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                                <Navigation className={cn('h-4 w-4', hasGPS ? 'text-emerald-500' : 'text-primary')} />
                                Ubicación GPS <span className="text-destructive">*</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Tu punto exacto de entrega</p>
                        </div>
                        {hasGPS && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    {hasGPS ? (
                        <div className="space-y-2">
                            <a href={`https://www.google.com/maps?q=${watchedLat},${watchedLng}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2.5 bg-white dark:bg-background rounded-lg border text-xs font-mono text-emerald-700 dark:text-emerald-400 hover:opacity-80 transition-opacity">
                                <MapPin className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                {watchedLat?.toFixed(5)}, {watchedLng?.toFixed(5)}
                                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                            </a>
                            <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={handleGetLocation} disabled={gettingLocation}>
                                {gettingLocation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Navigation className="h-3 w-3 mr-1" />}
                                Actualizar ubicación
                            </Button>
                        </div>
                    ) : (
                        <Button type="button" className="w-full font-semibold" onClick={handleGetLocation} disabled={gettingLocation}>
                            {gettingLocation ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Obteniendo...</>
                                : <><Navigation className="h-4 w-4 mr-2" />Confirmar mi punto de entrega</>}
                        </Button>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Dirección (referencia adicional)</Label>
                    <Textarea {...register('address')} placeholder="Calle, número, sector..." className="resize-none min-h-[70px]" />
                </div>
                <div className="space-y-2">
                    <Label>Notas para el repartidor</Label>
                    <Input {...register('notes')} placeholder="Edificio blanco, 2do piso..." className="h-11" />
                </div>
            </div>

            <Button type="submit" className="w-full h-12 font-bold text-base" disabled={isSaving}>
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</>
                    : <><Save className="h-4 w-4 mr-2" />Guardar Cambios</>}
            </Button>
        </form>
    );

    /* ── LOGGED IN WRAPPER ── */
    const renderLoggedIn = () => (
        <div className="flex flex-col h-full">
            {/* User header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-black text-lg flex-shrink-0 shadow">
                    {(user?.user_metadata?.full_name || currentProfile?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">
                        {user?.user_metadata?.full_name || currentProfile?.name || 'Mi Cuenta'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive gap-1.5 flex-shrink-0" onClick={handleSignOut}>
                    <LogOut className="h-3.5 w-3.5" /> Salir
                </Button>
            </div>

            {/* Tab content */}
            <ScrollArea className="flex-1 max-h-[calc(90dvh-170px)] sm:max-h-[460px]">
                <div className="p-5">
                    <AnimatePresence mode="wait">
                        {activeView === 'orders' && (
                            <motion.div key="orders" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                {renderOrders()}
                            </motion.div>
                        )}
                        {activeView === 'settings' && (
                            <motion.div key="settings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                                {renderSettings()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Bottom nav */}
            <div className="grid grid-cols-2 border-t bg-background">
                {[
                    { view: 'orders' as ActiveView, icon: ClipboardList, label: 'Mis Pedidos' },
                    { view: 'settings' as ActiveView, icon: Settings, label: 'Configuración' },
                ].map(({ view, icon: Icon, label }) => (
                    <button key={view} onClick={() => setActiveView(view)}
                        className={cn('flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors border-t-2',
                            activeView === view ? 'text-primary border-primary' : 'text-muted-foreground hover:text-foreground border-transparent')}>
                        <Icon className="h-5 w-5" />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );

    /* ═════════════════════════════════════════════════════════
       ROOT
    ═════════════════════════════════════════════════════════ */
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                centerOnMobile={false} 
                hideCloseButton={true} 
                className="max-w-md w-full p-0 max-h-[90vh] flex flex-col overflow-y-auto max-sm:overflow-x-hidden gap-0 sm:rounded-[2rem] rounded-t-[2.5rem] bg-card border-border shadow-2xl"
            >
                <DialogTitle className="sr-only">Perfil de Comprador</DialogTitle>
                <DialogDescription className="sr-only">
                    Accede a tu historial de pedidos y configura tu información de entrega.
                </DialogDescription>
                
                {/* Mobile bottom-sheet pull bar */}
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-3 block sm:hidden shrink-0 animate-pulse" />
                
                <AnimatePresence mode="wait">
                    {!user ? (
                        <motion.div key="unauth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {authMode === 'login' ? renderLogin() : renderRegister()}
                        </motion.div>
                    ) : (
                        <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {renderLoggedIn()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};
